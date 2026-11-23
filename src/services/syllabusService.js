import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { buildDefaultSyllabus } from "../data/syllabus";
import { sleep, uid } from "../utils/helpers";

function load() {
  let syllabus = storage.get("syllabus");
  if (!syllabus) {
    syllabus = buildDefaultSyllabus();
    storage.set("syllabus", syllabus);
  }
  return syllabus;
}

// Synchronous read for the paper generator (mock mode).
export const getSyllabusSync = (examId) => load()[examId] ?? {};

export async function getSyllabus(examId) {
  if (!USE_MOCK) return request(`/syllabus/${examId}`);
  await sleep(250);
  return getSyllabusSync(examId);
}

export async function saveChapters(examId, subjectId, chapters) {
  if (!USE_MOCK) {
    return request(`/syllabus/${examId}/${subjectId}`, { method: "PUT", body: { chapters } });
  }
  await sleep(300);
  const syllabus = load();
  syllabus[examId] = { ...syllabus[examId], [subjectId]: chapters };
  storage.set("syllabus", syllabus);
  return chapters;
}

export const newChapter = (name, classLevel = 11, weightage = "medium") => ({
  id: uid("ch"),
  name: name.trim(),
  classLevel: Number(classLevel),
  weightage,
  source: "custom",
  active: true,
});

export async function resetSyllabus(examId) {
  if (!USE_MOCK) return request(`/syllabus/${examId}/reset`, { method: "POST" });
  await sleep(300);
  const syllabus = load();
  syllabus[examId] = buildDefaultSyllabus()[examId];
  storage.set("syllabus", syllabus);
  return syllabus[examId];
}
