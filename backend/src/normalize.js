// Maps the Supabase question bank (public.questions) to the app's data model.
import { SUBJECTS, getExam } from "../../src/data/exams.js";

// App subject id → database `subject` value
export const DB_SUBJECT = { physics: "Physics", chemistry: "Chemistry", mathematics: "Mathematics", botany: "Biology", zoology: "Biology", biology: "Biology" };

// NEET splits Biology into Botany and Zoology. Chapters listed here are Zoology; the rest of Biology is Botany.
const ZOOLOGY = [
  "Animal Kingdom", "Structural Organisation in Animals", "Biomolecules", "Breathing and Exchange of Gases", "Body Fluids and Circulation",
  "Excretory Products and their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration",
  "Digestion and Absorption", "Human Reproduction", "Reproductive Health", "Evolution", "Human Health and Disease",
  "Biotechnology: Principles and Processes", "Biotechnology and its Applications",
].map((n) => chapterKey(n));
export const biologyPart = (chapterName) => (ZOOLOGY.includes(chapterKey(chapterName)) ? "zoology" : "botany");

// Which questions each exam may use, by normalised exam tag. KCET follows the
// PU (NCERT) syllabus and the bank has few KCET tags, so KCET may use any question.
export const EXAM_TAGS = { "jee-main": ["JEE"], "neet-ug": ["NEET"], kcet: ["*"] };

// Question formats the app handles: bank `q_type` → app kind
export const KIND_OF = { mcq_single: "mcq", match: "mcq", assertion_reason: "assertion_reason", numerical: "numerical" };
export const KINDS = ["mcq", "assertion_reason", "numerical"];
export const examKinds = (examId) => (getExam(examId)?.questionTypes?.includes("numerical") ? KINDS : ["mcq", "assertion_reason"]);

// "NEET/JEE", "JEE Main", "JEE Advanced", "KCET" … → normalised tags
export function normaliseTags(exams) {
  const list = Array.isArray(exams) ? exams : typeof exams === "string" ? exams.replace(/^\{|\}$/g, "").split(",") : [];
  const tags = new Set();
  for (const raw of list) {
    for (const part of String(raw).replace(/"/g, "").split(/[/,]/)) {
      const t = part.trim().toUpperCase();
      if (t.includes("NEET")) tags.add("NEET");
      if (t.includes("JEE")) tags.add("JEE");
      if (t.includes("KCET") || t === "CET") tags.add("KCET");
    }
  }
  return [...tags];
}

export const examAllows = (examId, tags) => {
  const wanted = EXAM_TAGS[examId] ?? ["*"];
  return wanted.includes("*") || tags.some((t) => wanted.includes(t));
};

// Tags to store on a new question for the chosen app exams
export const tagsForExams = (examIds = []) => [...new Set(examIds.map((id) => ({ "jee-main": "JEE", "neet-ug": "NEET", kcet: "KCET" })[id]).filter(Boolean))];

// Chapter names differ in case/spacing between projects ("Ray Optics And/and …").
export function chapterKey(name) {
  return String(name ?? "").toLowerCase().replace(/[‐-―]/g, "-").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
}
export const isLegacyChapter = (name) => /\(legacy|removed syllabus/i.test(name) || /^general$/i.test(String(name).trim());

export const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const LETTERS = ["A", "B", "C", "D"];
const STANDARD_AR_OPTIONS = [
  "Both Assertion and Reason are true and Reason is the correct explanation of Assertion.",
  "Both Assertion and Reason are true but Reason is not the correct explanation of Assertion.",
  "Assertion is true but Reason is false.",
  "Assertion is false but Reason is true.",
];

// "A" / "b" / "1" / "(C)" → 0-based index, or -1
export function answerIndex(value) {
  const v = String(value ?? "").trim().replace(/[()\s.]/g, "").toUpperCase();
  if (/^[A-D]$/.test(v)) return LETTERS.indexOf(v);
  if (/^[1-4]$/.test(v)) return Number(v) - 1;
  return -1;
}

const pgArray = (v) => (Array.isArray(v) ? v : typeof v === "string" && v.startsWith("{") ? v.slice(1, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).filter(Boolean) : []);

function matchText(row) {
  const a = pgArray(row.column_a);
  const b = pgArray(row.column_b);
  if (!a.length && !b.length) return "";
  const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];
  const lines = ["Column I:", ...a.map((x, i) => `(${String.fromCharCode(97 + i)}) ${x}`), "Column II:", ...b.map((x, i) => `(${roman[i] ?? i + 1}) ${x}`)];
  return lines.join("\n");
}

// Database row → app question (or null when the row cannot be used in a paper).
export function rowToQuestion(row, { subjectId, chapterName } = {}) {
  const kind = KIND_OF[row.q_type];
  if (!kind) return null;
  let text = String(row.question ?? "").trim();
  if (row.q_type === "assertion_reason" && (row.assertion || row.reason) && !/assertion/i.test(text)) {
    text = [text, row.assertion && `Assertion (A): ${row.assertion}`, row.reason && `Reason (R): ${row.reason}`].filter(Boolean).join("\n");
  }
  if (row.q_type === "match") text = [text || "Match Column I with Column II.", matchText(row)].filter(Boolean).join("\n");

  const base = {
    bankId: row.id,
    subjectId: subjectId ?? Object.keys(DB_SUBJECT).find((k) => DB_SUBJECT[k] === row.subject && k !== "botany" && k !== "zoology") ?? "physics",
    chapter: chapterName ?? row.chapter,
    concept: row.topic && row.topic !== "General" ? row.topic : undefined,
    classLevel: Number(row.klass) || undefined,
    format: row.q_type,
    text,
    solution: row.solution_text ?? "",
    examIds: [],
    source: "bank",
    createdBy: row.created_by_name || "bank",
    createdAt: row.created_at,
    reviewStatus: row.review_status ?? undefined,
  };

  if (kind === "numerical") {
    const answer = String(row.correct_option || row.num_answer || "").trim();
    // Numerical answers must be numbers ("-25", "10.6", "2.5e3"); words like "one" are skipped.
    if (!text || answer === "" || !Number.isFinite(Number(answer.replace(/[\s,]/g, "").replace(/[−–]/g, "-")))) return null;
    return { ...base, type: "numerical", options: [], answer };
  }

  let options;
  if (row.q_type === "match") {
    const m = typeof row.match_options === "string" ? JSON.parse(row.match_options || "{}") : row.match_options ?? {};
    options = LETTERS.map((l) => String(m[l] ?? "").trim());
  } else {
    options = [row.opt_a, row.opt_b, row.opt_c, row.opt_d].map((o) => String(o ?? "").trim());
  }
  if (row.q_type === "assertion_reason" && options.every((o) => !o)) options = [...STANDARD_AR_OPTIONS];
  const answer = answerIndex(row.correct_option);
  if (!text || answer < 0 || options.filter(Boolean).length < 2 || !options[answer]) return null;
  return { ...base, type: "mcq", options, answer, fixedOptions: row.q_type === "assertion_reason" };
}

// App question → database columns (for creating / editing bank questions)
export function questionToRow(q, { chapterDbName, klass } = {}) {
  const row = {
    subject: DB_SUBJECT[q.subjectId] ?? "General",
    chapter: chapterDbName ?? q.chapter,
    topic: q.concept || "General",
    question: String(q.text ?? "").trim(),
    solution_text: String(q.solution ?? ""),
    updated_at: new Date().toISOString(),
  };
  if (klass) row.klass = String(klass);
  if (q.examIds) row.exams = tagsForExams(q.examIds);
  if (q.type === "numerical") {
    Object.assign(row, { q_type: "numerical", correct_option: String(q.answer ?? "").trim(), num_answer: "", opt_a: "", opt_b: "", opt_c: "", opt_d: "" });
  } else {
    const [a = "", b = "", c = "", d = ""] = q.options ?? [];
    Object.assign(row, {
      q_type: q.format === "assertion_reason" ? "assertion_reason" : "mcq_single",
      opt_a: a, opt_b: b, opt_c: c, opt_d: d,
      correct_option: LETTERS[Number(q.answer)] ?? "A",
    });
  }
  return row;
}

export const subjectName = (subjectId) => SUBJECTS[subjectId]?.name ?? subjectId;
