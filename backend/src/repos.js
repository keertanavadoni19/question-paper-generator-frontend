// Data access for the main Supabase project (MAIN_DB): users, papers, settings, question_usage.
import bcrypt from "bcryptjs";
import { getExam } from "../../src/data/exams.js";
import { paperTotals } from "../../src/shared/paperCore.js";

const fail = (error, status = 500) => {
  if (error) throw Object.assign(new Error(error.message || String(error)), { status });
};
const httpError = (status, message) => Object.assign(new Error(message), { status });
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (m) => `\\${m}`);

// ── Users (public.users) ───────────────────────────────────────
// Only `password_hash` (bcrypt) is used. The legacy plain-text `password` column is never read or written.
const USER_COLUMNS = "id,name,email,role,subject,status,is_active,created_at,last_login,password_hash";

export const toAppUser = (u) => ({
  id: u.id,
  fullName: u.name,
  email: u.email,
  role: u.role === "admin" ? "admin" : "teacher",
  bankRole: u.role, // admin | teacher | adder | editor | viewer
  subject: u.subject,
  status: u.status === "active" && u.is_active !== false ? "active" : "inactive",
  createdAt: u.created_at,
  lastLogin: u.last_login,
});

export function usersRepo(db) {
  const table = () => db.from("users");
  return {
    async findByEmail(email) {
      const { data, error } = await table().select(USER_COLUMNS).ilike("email", likeEscape(email.trim())).limit(1);
      fail(error);
      return data?.[0] ?? null;
    },
    async get(id) {
      const { data, error } = await table().select(USER_COLUMNS).eq("id", id).maybeSingle();
      fail(error);
      return data;
    },
    async verify(email, password) {
      const user = await this.findByEmail(email);
      if (!user?.password_hash || !(await bcrypt.compare(String(password), user.password_hash))) return null;
      return user;
    },
    async touchLogin(id) {
      await table().update({ last_login: new Date().toISOString() }).eq("id", id);
    },
    async create({ fullName, email, password, role }) {
      if (await this.findByEmail(email)) throw httpError(409, "An account with this email already exists.");
      const row = {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password_hash: await bcrypt.hash(String(password), 10),
        role: role === "admin" ? "admin" : "teacher",
        status: "active",
        is_active: true,
      };
      const { data, error } = await table().insert(row).select(USER_COLUMNS).single();
      fail(error);
      return data;
    },
    async list() {
      const { data, error } = await table().select(USER_COLUMNS).order("created_at", { ascending: true });
      fail(error);
      return data ?? [];
    },
    async update(id, changes) {
      const row = {};
      if (changes.fullName !== undefined) row.name = String(changes.fullName).trim();
      if (changes.email !== undefined) row.email = String(changes.email).trim().toLowerCase();
      if (changes.role !== undefined) row.role = changes.role === "admin" ? "admin" : "teacher";
      if (changes.status !== undefined) {
        row.status = changes.status === "active" ? "active" : "disabled";
        row.is_active = changes.status === "active";
      }
      row.updated_at = new Date().toISOString();
      const { data, error } = await table().update(row).eq("id", id).select(USER_COLUMNS).single();
      fail(error);
      return data;
    },
    async remove(id) {
      const { error } = await table().delete().eq("id", id);
      fail(error);
    },
  };
}

// ── Papers (public.papers) ─────────────────────────────────────
// The table is shared with another app. QP Generator rows are marked with
// metadata.source = "qp-generator"; other rows are never listed, changed or deleted.
export const SOURCE = "qp-generator";
const EXAM_TYPE = { "jee-main": "JEE", "neet-ug": "NEET", kcet: "CET" };

function toRow(paper) {
  const exam = getExam(paper.examId);
  const { marks } = paperTotals(paper);
  const classes = [...new Set(paper.questions.map((q) => q.classLevel).filter(Boolean))].sort();
  const start = Number(paper.layout?.numbering?.start) || 1;
  return {
    paper_id: paper.id,
    title: paper.title,
    subject: paper.sections.map((s) => s.name).join(", "),
    class_level: classes.join(",") || null,
    exam_type: EXAM_TYPE[paper.examId] ?? exam?.name ?? paper.examId,
    duration_minutes: paper.durationMinutes,
    duration: `${paper.durationMinutes} mins`,
    total_marks: Math.round(marks),
    instructions: paper.instructions || null,
    // Readable copy for other tools: one entry per question (bank id, chapter, concept, answer)
    questions: paper.questions.map((q) => ({
      id: q.id, questionId: q.bankId ?? null, chapter: q.chapter, concept: q.concept ?? null, q_type: q.format ?? (q.type === "numerical" ? "numerical" : "mcq_single"),
      question: q.text, options: q.options, correct_option: q.type === "mcq" ? "ABCD"[q.answer] : String(q.answer), isNumerical: q.type === "numerical",
    })),
    sections: paper.sections.map((s) => ({ subject: s.name, questions: paper.questions.filter((q) => q.sectionId === s.subjectId).map((q) => q.bankId ?? q.id), status: paper.status })),
    layout_settings: paper.layout ?? {},
    difficulty_distribution: paper.config?.difficulty ?? undefined,
    start_q_no: start,
    end_q_no: start + paper.questions.length - 1,
    classes: classes.map(Number),
    status: paper.status === "final" ? "Approved" : "Draft",
    created_by: paper.createdBy?.name ?? null,
    author_id: paper.createdBy?.id ?? null,
    teacher_id: paper.createdBy?.id ?? null,
    metadata: { source: SOURCE, version: 1, paper },
    updated_at: new Date().toISOString(),
  };
}

const fromRow = (row) => (row?.metadata?.paper ? { ...row.metadata.paper, status: row.status === "Approved" ? "final" : "draft" } : null);

// Lists only need totals, so questions are slimmed down.
const slim = (paper) => ({
  ...paper,
  layout: undefined,
  questions: paper.questions.map((q) => ({ id: q.id, sectionId: q.sectionId, marks: q.marks, type: q.type, chapter: q.chapter, difficulty: q.difficulty, source: q.source, bankId: q.bankId, needsReview: q.needsReview })),
});

export function papersRepo(db) {
  const table = () => db.from("papers");
  const mine = (query, user) => (user.role === "admin" ? query : query.eq("teacher_id", user.id));
  return {
    async list(user) {
      const { data, error } = await mine(table().select("paper_id,status,metadata,created_at").eq("metadata->>source", SOURCE), user).order("created_at", { ascending: false });
      fail(error);
      return (data ?? []).map(fromRow).filter(Boolean).map(slim);
    },
    async listFull(user) {
      const { data, error } = await mine(table().select("paper_id,status,metadata").eq("metadata->>source", SOURCE), user);
      fail(error);
      return (data ?? []).map(fromRow).filter(Boolean);
    },
    async get(id, user) {
      const { data, error } = await table().select("paper_id,status,metadata,teacher_id").eq("paper_id", id).eq("metadata->>source", SOURCE).maybeSingle();
      fail(error);
      if (!data) throw httpError(404, "Paper not found");
      if (user.role !== "admin" && data.teacher_id !== user.id) throw httpError(403, "You can only open your own papers.");
      return fromRow(data);
    },
    async create(paper) {
      const { data, error } = await table().insert({ ...toRow(paper), created_at: paper.createdAt ?? new Date().toISOString() }).select("paper_id,status,metadata").single();
      fail(error);
      return fromRow(data);
    },
    async update(paper, user) {
      const existing = await this.get(paper.id, user);
      const next = { ...paper, createdBy: existing.createdBy, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
      const { data, error } = await table().update(toRow(next)).eq("paper_id", paper.id).eq("metadata->>source", SOURCE).select("paper_id,status,metadata").single();
      fail(error);
      return fromRow(data);
    },
    async remove(id, user) {
      await this.get(id, user);
      const { error } = await table().delete().eq("paper_id", id).eq("metadata->>source", SOURCE);
      fail(error);
    },
  };
}

// ── Settings (public.settings: key → jsonb) ────────────────────
export function settingsRepo(db) {
  return {
    async get(key, fallback = null) {
      const { data, error } = await db.from("settings").select("value").eq("key", key).maybeSingle();
      fail(error);
      return data?.value ?? fallback;
    },
    async set(key, value, userId) {
      const { error } = await db.from("settings").upsert({ key, value, updated_at: new Date().toISOString(), updated_by: userId ?? null }, { onConflict: "key" });
      fail(error);
    },
  };
}

// ── Question usage (public.question_usage) ─────────────────────
export function usageRepo(db) {
  return {
    // Questions used in papers recently, so new papers prefer fresh ones.
    async recentIds(days = 60) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await db.from("question_usage").select("question_id").gte("used_at", since).order("used_at", { ascending: false }).limit(20000);
      if (error) return new Set(); // usage history is optional
      return new Set((data ?? []).map((r) => r.question_id));
    },
    async record(paper, user) {
      const exam = getExam(paper.examId);
      const rows = paper.questions
        .filter((q) => q.bankId)
        .map((q) => ({ question_id: q.bankId, paper_id: paper.id, teacher_id: user.id, teacher_name: user.fullName || "Unknown", exam_name: exam?.name ?? paper.examId }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("question_usage").insert(rows.slice(i, i + 500));
        if (error) return error.message;
      }
      return null;
    },
  };
}
