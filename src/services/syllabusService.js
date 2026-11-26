import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { useEffect, useState } from "react";
import { buildDefaultSyllabus, chaptersFor } from "../data/syllabus";
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
  } else {
    // exams added after the syllabus was saved (e.g. Assignment) get their default chapters
    const defaults = buildDefaultSyllabus();
    const missing = Object.keys(defaults).filter((id) => !syllabus[id]);
    for (const id of missing) syllabus[id] = defaults[id];
    if (addMissingConcepts(syllabus) || missing.length) storage.set("syllabus", syllabus);
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

// All chapters (with concepts) of one subject, for question forms and filters.
const subjectCache = new Map();
export function getSubjectChapters(subjectId) {
  if (!subjectId) return Promise.resolve([]);
  if (USE_MOCK) return Promise.resolve(chaptersFor(subjectId));
  if (!subjectCache.has(subjectId)) {
    subjectCache.set(subjectId, request(`/chapters/${subjectId}`).catch((err) => { subjectCache.delete(subjectId); throw err; }));
  }
  return subjectCache.get(subjectId);
}

export function useSubjectChapters(subjectId) {
  const [state, setState] = useState({ subjectId: null, chapters: USE_MOCK ? chaptersFor(subjectId) : [] });
  useEffect(() => {
    let alive = true;
    getSubjectChapters(subjectId).then((chapters) => alive && setState({ subjectId, chapters })).catch(() => alive && setState({ subjectId, chapters: [] }));
    return () => { alive = false; };
  }, [subjectId]);
  return state.subjectId === subjectId ? state.chapters : USE_MOCK ? chaptersFor(subjectId) : [];
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
