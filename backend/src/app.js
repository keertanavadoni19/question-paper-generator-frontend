// QP Generator API on top of the Supabase projects.
// Implements the endpoints the React app calls when VITE_USE_MOCK=false (see README).
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { QuestionIndex } from "./questionIndex.js";
import { FETCH_COLUMNS, fetchRows, generatePaper, regenerateQuestion } from "./generator.js";
import { usersRepo, papersRepo, settingsRepo, usageRepo, toAppUser } from "./repos.js";
import { DB_SUBJECT, KINDS, biologyPart, chapterKey, examAllows, examKinds, questionToRow, rowToQuestion } from "./normalize.js";
import { computeAnalytics } from "../../src/shared/analytics.js";
import { getExam } from "../../src/data/exams.js";

const OVERRIDES_KEY = "qpg_syllabus_overrides";
const httpError = (status, message, extra) => Object.assign(new Error(message), { status, ...extra });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ config, clients, log = console }) {
  const app = express();
  const index = new QuestionIndex({ clients, config, log });
  const main = clients.get(config.mainDb);
  const users = usersRepo(main);
  const papers = papersRepo(main);
  const settings = settingsRepo(main);
  const usage = usageRepo(main);

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json({ limit: "20mb" }));

  // ── auth ──
  const sign = (u) => jwt.sign({ sub: u.id, role: u.role, name: u.fullName }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const requireAuth = (req, _res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return next(httpError(401, "Please log in."));
    try {
      const p = jwt.verify(token, config.jwtSecret);
      req.user = { id: p.sub, role: p.role, fullName: p.name };
      next();
    } catch {
      next(httpError(401, "Your session has expired. Please log in again."));
    }
  };
  const requireAdmin = (req, _res, next) => (req.user?.role === "admin" ? next() : next(httpError(403, "Only administrators can do this.")));

  const overrides = async () => (await settings.get(OVERRIDES_KEY, {})) ?? {};
  const syllabusFor = async (examId) => {
    await index.ready();
    return index.syllabusFor(examId, (await overrides())[examId] ?? {});
  };

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: !config.problems.length && index.status.state === "ready",
      problems: config.problems,
      index: index.status,
      questions: index.entries.length,
      databases: config.databases.map((d) => ({ id: d.id, label: d.label, configured: Boolean(d.url && d.key), main: d.id === config.mainDb })),
    });
  });

  app.get("/api/meta", requireAuth, (_req, res) => {
    res.json({ mode: "supabase", difficultyAvailable: false, kinds: KINDS, questions: index.entries.length, index: index.status });
  });

  app.post("/api/auth/login", wrap(async (req, res) => {
    const { email = "", password = "", role } = req.body ?? {};
    if (!email || !password) throw httpError(400, "Email and password are required.");
    const row = await users.verify(email, password);
    if (!row) throw httpError(401, "Invalid email or password.");
    const user = toAppUser(row);
    if (role && user.role !== role) throw httpError(403, `This account is registered as ${user.role === "admin" ? "an Admin" : "a Teacher"}. Select the correct role.`);
    if (user.status !== "active") throw httpError(403, "Your account is inactive. Please contact the administrator.");
    users.touchLogin(row.id).catch(() => {});
    res.json({ user, token: sign(user) });
  }));

  app.post("/api/auth/signup", wrap(async (req, res) => {
    if (!config.allowSignup) throw httpError(403, "Sign-up is turned off. Please ask an administrator to create your account.");
    const { fullName = "", email = "", password = "" } = req.body ?? {};
    if (fullName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email) || String(password).length < 8) throw httpError(400, "Enter your name, a valid email and a password of at least 8 characters.");
    const created = await users.create({ fullName, email, password, role: "teacher" }); // admins are created by admins
    res.status(201).json(toAppUser(created));
  }));

  // ── users ──
  app.get("/api/users", requireAuth, requireAdmin, wrap(async (_req, res) => res.json((await users.list()).map(toAppUser))));
  app.patch("/api/users/:id", requireAuth, wrap(async (req, res) => {
    const self = req.user.id === req.params.id;
    if (!self && req.user.role !== "admin") throw httpError(403, "You can only change your own profile.");
    const allowed = req.user.role === "admin" && !self ? ["fullName", "email", "role", "status"] : ["fullName", "email"];
    const changes = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
    res.json(toAppUser(await users.update(req.params.id, changes)));
  }));
  app.delete("/api/users/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
    if (req.user.id === req.params.id) throw httpError(400, "You cannot remove your own account.");
    await users.remove(req.params.id);
    res.json({ ok: true });
  }));

  // ── syllabus ──
  app.get("/api/syllabus/:examId", requireAuth, wrap(async (req, res) => {
    if (!getExam(req.params.examId)) throw httpError(404, "Unknown exam");
    res.json(await syllabusFor(req.params.examId));
  }));
  // All chapters of a subject (any exam) — for the question bank forms and filters
  app.get("/api/chapters/:subjectId", requireAuth, wrap(async (req, res) => {
    await index.ready();
    res.json(index.chaptersFor("any", req.params.subjectId));
  }));
  app.put("/api/syllabus/:examId/:subjectId", requireAuth, requireAdmin, wrap(async (req, res) => {
    const { examId, subjectId } = req.params;
    await index.ready();
    const bank = index.chaptersFor(examId, subjectId, {});
    const next = { _custom: [] };
    for (const ch of req.body?.chapters ?? []) {
      const original = bank.find((b) => b.id === ch.id);
      if (!original) {
        next._custom.push({ id: ch.id, name: ch.name, classLevel: Number(ch.classLevel) || 11, weightage: ch.weightage ?? "medium", active: ch.active !== false });
        continue;
      }
      const o = {};
      if (ch.active === false) o.active = false;
      if (ch.weightage && ch.weightage !== original.weightage) o.weightage = ch.weightage;
      if (Number(ch.classLevel) && Number(ch.classLevel) !== original.classLevel) o.classLevel = Number(ch.classLevel);
      if (ch.name?.trim() && ch.name.trim() !== original.name) o.name = ch.name.trim();
      if (Object.keys(o).length) next[ch.id] = o;
    }
    const all = await overrides();
    all[examId] = { ...(all[examId] ?? {}), [subjectId]: next };
    await settings.set(OVERRIDES_KEY, all, req.user.id);
    res.json(index.chaptersFor(examId, subjectId, next));
  }));
  app.post("/api/syllabus/:examId/reset", requireAuth, requireAdmin, wrap(async (req, res) => {
    const all = await overrides();
    delete all[req.params.examId];
    await settings.set(OVERRIDES_KEY, all, req.user.id);
    res.json(await syllabusFor(req.params.examId));
  }));

  // ── question bank ──
  const bankSubjectId = (row) => (row.subject === "Biology" ? biologyPart(row.chapter) : Object.keys(DB_SUBJECT).find((k) => DB_SUBJECT[k] === row.subject) ?? "physics");
  const toBankQuestion = (row) => {
    const q = rowToQuestion(row, { subjectId: bankSubjectId(row) }) ?? {
      ...rowToQuestion({ ...row, q_type: "mcq_single", opt_a: row.opt_a || "—", opt_b: row.opt_b || "—", correct_option: "A" }, { subjectId: bankSubjectId(row) }),
      incomplete: true,
    };
    const entry = index.byId.get(row.id);
    const chapterName = entry ? index.chapters.get(entry.key)?.name ?? row.chapter : row.chapter;
    return { ...q, id: row.id, bankId: row.id, chapter: chapterName, concept: entry?.topic && entry.topic !== "General" ? entry.topic : q.concept, examIds: ["jee-main", "neet-ug", "kcet"].filter((e) => examAllows(e, entry?.tags ?? [])) };
  };

  app.get("/api/questions/stats", requireAuth, wrap(async (_req, res) => {
    await index.ready();
    const bySubject = {};
    for (const e of index.entries) {
      const chapter = index.chapters.get(e.key);
      if (chapter?.legacy && !config.includeLegacyChapters) continue;
      const id = e.subject === "Biology" ? biologyPart(chapter?.name ?? e.chapterName) : Object.keys(DB_SUBJECT).find((k) => DB_SUBJECT[k] === e.subject);
      bySubject[id] = (bySubject[id] ?? 0) + 1;
    }
    res.json({ total: Object.values(bySubject).reduce((a, b) => a + b, 0), bySubject });
  }));

  app.get("/api/questions", requireAuth, wrap(async (req, res) => {
    await index.ready();
    const { subjectId, examId, chapter, type, concept, format, search = "" } = req.query;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    let entries = index.entries;
    if (subjectId) {
      const subject = DB_SUBJECT[subjectId];
      entries = entries.filter((e) => e.subject === subject && (subject !== "Biology" || subjectId === "biology" || biologyPart(index.chapters.get(e.key)?.name ?? e.chapterName) === subjectId));
    }
    if (examId) entries = entries.filter((e) => examAllows(examId, e.tags) && examKinds(examId).includes(e.kind));
    const many = (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]);
    if (many(chapter).length) {
      const keys = new Set(many(chapter).map(chapterKey));
      entries = entries.filter((e) => keys.has(e.key.slice(e.key.indexOf("|") + 1)) || keys.has(chapterKey(index.chapters.get(e.key)?.name)));
    }
    if (type) entries = entries.filter((e) => (type === "mcq" ? e.kind !== "numerical" : e.kind === type));
    if (many(concept).length) {
      const topics = new Set(many(concept));
      entries = entries.filter((e) => topics.has(e.topic));
    }
    const FORMAT_TYPE = { mtf: "match", ar: "assertion_reason", mcq: "mcq_single", statement: "mcq_single", diagram: null, numerical: "numerical" };
    if (format && format in FORMAT_TYPE && FORMAT_TYPE[format]) entries = entries.filter((e) => e.qType === FORMAT_TYPE[format]);
    // statement / diagram questions are recognised from the text
    const textPatterns = [];
    if (format === "statement") textPatterns.push("%statement%");
    if (format === "diagram") textPatterns.push("%{{IMG::%");
    entries = entries.filter((e) => config.includeLegacyChapters || !index.chapters.get(e.key)?.legacy);
    const term = String(search).trim();
    if (term) textPatterns.push(`%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    for (const pattern of textPatterns) {
      const dbs = [...new Set(entries.map((e) => e.db))];
      const found = new Set();
      await Promise.all(dbs.map(async (db) => {
        const { data, error } = await clients.get(db).from("questions").select("id").ilike("question", pattern).limit(20000);
        if (error) throw httpError(502, `DB${db}: ${error.message}`);
        for (const r of data ?? []) found.add(r.id);
      }));
      entries = entries.filter((e) => found.has(e.id));
    }
    entries = [...entries].sort((a, b) => a.key.localeCompare(b.key) || a.topic.localeCompare(b.topic) || String(a.id).localeCompare(String(b.id)));
    const page = entries.slice(offset, offset + limit);
    const rows = await fetchRows(clients, page);
    res.json({ items: page.map((e) => rows.get(e.id)).filter(Boolean).map(toBankQuestion), total: entries.length, limit, offset });
  }));

  app.post("/api/questions", requireAuth, wrap(async (req, res) => {
    await index.ready();
    const q = req.body ?? {};
    const subject = DB_SUBJECT[q.subjectId];
    if (!subject || !q.chapter || !String(q.text ?? "").trim()) throw httpError(400, "Subject, chapter and question text are required.");
    const chapterInfo = [...index.chapters.values()].find((c) => c.subject === subject && chapterKey(c.name) === chapterKey(q.chapter));
    const klass = chapterInfo?.classLevel ?? 11;
    const db = index.shardFor(subject, String(klass)) ?? [...index.shards.entries()].find(([k]) => k.startsWith(`${subject}|`))?.[1]?.keys().next().value;
    if (!db) throw httpError(400, `No database holds ${subject} questions.`);
    const row = {
      ...questionToRow(q, { chapterDbName: chapterInfo?.name ?? q.chapter, klass }),
      created_by: req.user.id,
      created_by_name: req.user.fullName ?? "",
      review_status: "pending",
      acceptance_status: "pending",
    };
    const { data, error } = await clients.get(db).from("questions").insert(row).select(FETCH_COLUMNS).single();
    if (error) throw httpError(502, error.message);
    index.add(data, db);
    res.status(201).json(toBankQuestion(data));
  }));

  app.put("/api/questions/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
    await index.ready();
    const entry = index.byId.get(req.params.id);
    if (!entry) throw httpError(404, "Question not found");
    const chapterInfo = [...index.chapters.values()].find((c) => c.subject === entry.subject && chapterKey(c.name) === chapterKey(req.body?.chapter ?? ""));
    const row = { ...questionToRow(req.body ?? {}, { chapterDbName: chapterInfo?.name ?? req.body?.chapter }), updated_by: req.user.id, updated_by_name: req.user.fullName ?? "" };
    delete row.subject; // a question stays in its project
    const { data, error } = await clients.get(entry.db).from("questions").update(row).eq("id", req.params.id).select(FETCH_COLUMNS).single();
    if (error) throw httpError(502, error.message);
    index.add(data, entry.db);
    res.json(toBankQuestion(data));
  }));

  app.delete("/api/questions/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
    await index.ready();
    const entry = index.byId.get(req.params.id);
    if (!entry) throw httpError(404, "Question not found");
    const { error } = await clients.get(entry.db).from("questions").delete().eq("id", req.params.id);
    if (error) throw httpError(502, error.message);
    index.remove(req.params.id);
    res.json({ ok: true });
  }));

  // ── papers ──
  app.post("/api/papers/generate", requireAuth, wrap(async (req, res) => {
    const cfg = req.body ?? {};
    const syllabus = await syllabusFor(cfg.examId);
    const recentlyUsed = await usage.recentIds();
    const paper = await generatePaper({ config: cfg, index, clients, user: req.user, syllabus, recentlyUsed });
    const saved = await papers.create(paper);
    const usageError = await usage.record(saved, req.user);
    if (usageError) log.warn?.(`[usage] ${usageError}`);
    res.status(201).json({ ...saved, warnings: paper.warnings });
  }));
  app.get("/api/papers", requireAuth, wrap(async (req, res) => res.json(await papers.list(req.user))));
  app.get("/api/papers/:id", requireAuth, wrap(async (req, res) => res.json(await papers.get(req.params.id, req.user))));
  app.post("/api/papers", requireAuth, wrap(async (req, res) => {
    const paper = { ...req.body, createdBy: { id: req.user.id, name: req.user.fullName } };
    if (!paper?.id || !Array.isArray(paper.questions)) throw httpError(400, "Invalid paper");
    res.status(201).json(await papers.create(paper));
  }));
  app.put("/api/papers/:id", requireAuth, wrap(async (req, res) => {
    if (req.body?.id !== req.params.id) throw httpError(400, "Paper id mismatch");
    const p = req.body;
    res.json(await papers.update({ ...p, stats: { fromBank: p.questions.filter((q) => q.bankId).length, aiGenerated: p.questions.filter((q) => q.source === "ai" && !q.bankId).length, drafts: p.questions.filter((q) => q.needsReview).length } }, req.user));
  }));
  app.delete("/api/papers/:id", requireAuth, wrap(async (req, res) => {
    await papers.remove(req.params.id, req.user);
    res.json({ ok: true });
  }));
  app.post("/api/papers/:id/questions/:qid/regenerate", requireAuth, wrap(async (req, res) => {
    const paper = req.body?.paper ?? (await papers.get(req.params.id, req.user));
    const target = req.body?.question ?? paper.questions.find((q) => q.id === req.params.qid);
    if (!target) throw httpError(404, "Question not found in this paper");
    const section = paper.config?.sections?.find((s) => s.subjectId === target.sectionId) ?? { subjectId: target.sectionId, chapters: [target.chapter] };
    const syllabus = await syllabusFor(paper.examId);
    const fresh = await regenerateQuestion({ index, clients, examId: paper.examId, section, syllabus, target, usedBankIds: paper.questions.map((q) => q.bankId).filter(Boolean) });
    res.json({ ...fresh, id: target.id, sectionId: target.sectionId, marks: target.marks, negative: target.negative, examIds: [paper.examId] });
  }));

  app.get("/api/analytics", requireAuth, wrap(async (req, res) => {
    const list = await papers.list(req.user);
    res.json(computeAnalytics(list, { total: index.entries.length, byDifficulty: {} }));
  }));

  app.use("/api", (_req, _res, next) => next(httpError(404, "Not found")));
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) log.error?.(err);
    res.status(status).json({ message: status >= 500 && !err.status ? "Something went wrong on the server." : err.message, ...(err.warnings ? { warnings: err.warnings } : {}) });
  });

  return { app, index };
}
