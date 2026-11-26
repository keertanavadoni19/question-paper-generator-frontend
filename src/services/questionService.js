import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { SEED_CONCEPTS, SEED_QUESTIONS } from "../data/questions";
import { SUBJECT_SOURCES } from "../data/exams";
import { sleep, uid } from "../utils/helpers";

const SEED_CHAPTER = Object.fromEntries(SEED_QUESTIONS.map((q) => [q.id, q.chapter]));
// Seed question saved before concepts existed (and still in its original chapter).
const needsConceptTag = (q) => !q.concept && SEED_CONCEPTS[q.id] && SEED_CHAPTER[q.id] === q.chapter;

export function getQuestionsSync() {
  let questions = storage.get("questions");
  if (!questions) {
    questions = SEED_QUESTIONS;
    storage.set("questions", questions);
  } else if (questions.some(needsConceptTag)) {
    questions = questions.map((q) => (needsConceptTag(q) ? { ...q, concept: SEED_CONCEPTS[q.id] } : q));
    storage.set("questions", questions);
  }
  return questions;
}
const save = (questions) => storage.set("questions", questions);

const FORMAT_TEST = {
  mtf: (q) => q.format === "match",
  ar: (q) => q.format === "assertion_reason",
  mcq: (q) => q.type === "mcq" && !q.format?.match(/match|assertion/),
  statement: (q) => q.type === "mcq" && /statement/i.test(q.text),
  diagram: (q) => /\{\{IMG::/.test(q.text),
  numerical: (q) => q.type === "numerical",
};

export function matchesFilters(q, { search = "", examId = "", subjectId = "", chapter = "", difficulty = "", type = "", concept = "", format = "" } = {}) {
  const subjects = subjectId ? (SUBJECT_SOURCES[subjectId] ?? [subjectId]) : null;
  const term = search.trim().toLowerCase();
  return (
    (!examId || q.examIds?.includes(examId)) &&
    (!subjects || subjects.includes(q.subjectId)) &&
    (!chapter?.length || (Array.isArray(chapter) ? chapter.includes(q.chapter) : q.chapter === chapter)) &&
    (!difficulty || q.difficulty === difficulty) &&
    (!type || q.type === type) &&
    (!concept?.length || (Array.isArray(concept) ? concept.includes(q.concept) : q.concept === concept)) &&
    (!format || (FORMAT_TEST[format]?.(q) ?? true)) &&
    (!term || q.text.toLowerCase().includes(term) || q.chapter.toLowerCase().includes(term) || q.id.toLowerCase().includes(term))
  );
}

// Paged search used by the Question Bank and the paper editor.
// Returns { items, total }. The backend searches all Supabase projects server-side.
export async function searchQuestions({ limit = 10, offset = 0, ...filters } = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, limit, offset })) {
      if (v === "" || v === undefined || v === null) continue;
      for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
    }
    return request(`/questions?${params}`);
  }
  await sleep(150);
  const all = getQuestionsSync().filter((q) => matchesFilters(q, filters));
  return { items: all.slice(offset, offset + limit), total: all.length };
}

// Questions per subject for the filter chips: { total, bySubject: { physics: n, … } }
export async function bankStats() {
  if (!USE_MOCK) return request("/questions/stats");
  const all = getQuestionsSync();
  return { total: all.length, bySubject: all.reduce((acc, q) => ({ ...acc, [q.subjectId]: (acc[q.subjectId] ?? 0) + 1 }), {}) };
}

export async function listQuestions(filters = {}) {
  if (!USE_MOCK) return request(`/questions?${new URLSearchParams(filters)}`);
  await sleep(250);
  return getQuestionsSync().filter((q) => matchesFilters(q, filters));
}

export async function createQuestion(data, user) {
  if (!USE_MOCK) return request("/questions", { method: "POST", body: data });
  await sleep(300);
  const question = {
    ...data,
    id: uid("Q").toUpperCase(),
    source: data.source ?? "manual",
    createdBy: user?.id ?? "unknown",
    createdAt: new Date().toISOString(),
  };
  save([question, ...getQuestionsSync()]);
  return question;
}

export async function updateQuestion(id, data) {
  if (!USE_MOCK) return request(`/questions/${id}`, { method: "PUT", body: data });
  await sleep(300);
  const questions = getQuestionsSync().map((q) => (q.id === id ? { ...q, ...data, updatedAt: new Date().toISOString() } : q));
  save(questions);
  return questions.find((q) => q.id === id);
}

export async function deleteQuestion(id) {
  if (!USE_MOCK) return request(`/questions/${id}`, { method: "DELETE" });
  await sleep(250);
  save(getQuestionsSync().filter((q) => q.id !== id));
}
