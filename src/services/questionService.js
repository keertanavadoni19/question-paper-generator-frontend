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

export function matchesFilters(q, { search = "", examId = "", subjectId = "", chapter = "", difficulty = "", type = "" } = {}) {
  const subjects = subjectId ? (SUBJECT_SOURCES[subjectId] ?? [subjectId]) : null;
  const term = search.trim().toLowerCase();
  return (
    (!examId || q.examIds?.includes(examId)) &&
    (!subjects || subjects.includes(q.subjectId)) &&
    (!chapter || q.chapter === chapter) &&
    (!difficulty || q.difficulty === difficulty) &&
    (!type || q.type === type) &&
    (!term || q.text.toLowerCase().includes(term) || q.chapter.toLowerCase().includes(term) || q.id.toLowerCase().includes(term))
  );
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
