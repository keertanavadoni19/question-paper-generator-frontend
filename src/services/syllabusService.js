import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { buildDefaultSyllabus } from "../data/syllabus";
import { conceptsFor } from "../data/concepts";
import { sleep, uid } from "../utils/helpers";

// Syllabi saved before concepts existed: attach each chapter's default concept list.
function addMissingConcepts(syllabus) {
  let changed = false;
  for (const subjects of Object.values(syllabus)) {
    for (const chapters of Object.values(subjects)) {
      for (const chapter of chapters) {
        if (!Array.isArray(chapter.concepts)) {
          chapter.concepts = conceptsFor(chapter.source, chapter.name);
          changed = true;
        }
      }
    }
  }
  return changed;
}

function load() {
  let syllabus = storage.get("syllabus");
  if (!syllabus) {
    syllabus = buildDefaultSyllabus();
    storage.set("syllabus", syllabus);
  } else if (addMissingConcepts(syllabus)) {
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
  concepts: [],
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
