import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { getQuestionsSync } from "./questionService";
import { getSyllabusSync } from "./syllabusService";
import { generateQuestion, placeholderQuestion } from "./mockAi";
import { EXAMS, SET_LABELS, SUBJECT_SOURCES, getExam, getSubject } from "../data/exams";
import { shuffle, sleep, uid } from "../utils/helpers";
import { matchesConcepts } from "../utils/concepts";

export const GENERATION_STEPS = [
  "Reading exam pattern & syllabus",
  "Selecting chapters and weightage",
  "Generating questions with AI",
  "Balancing difficulty levels",
  "Creating paper sets & answer keys",
];

// ── Sets ───────────────────────────────────────────────────────
// Set A keeps the original order. Other sets shuffle questions within each
// section and/or shuffle MCQ options, so every set has its own answer key.
export function buildSets(paper, count, { shuffleQuestions = true, shuffleOptions = true } = {}) {
  return SET_LABELS.slice(0, Math.min(Math.max(count, 1), 8)).map((label, index) => {
    const order = paper.sections.flatMap((section) => {
      const ids = paper.questions.filter((q) => q.sectionId === section.subjectId).map((q) => q.id);
      return index > 0 && shuffleQuestions ? shuffle(ids) : ids;
    });
    const optionOrder = Object.fromEntries(
      paper.questions.map((q) => {
        const identity = q.options.map((_, i) => i);
        return [q.id, index > 0 && shuffleOptions && q.type === "mcq" ? shuffle(identity) : identity];
      })
    );
    return { label, order, optionOrder };
  });
}

// Question numbering from paper.layout.numbering:
//   start – first number (default 1); scope – "continuous" across sections or restart per "section".
export function numberingOf(paper) {
  const n = paper.layout?.numbering ?? {};
  const start = Number.isFinite(Number(n.start)) && Number(n.start) >= 0 ? Math.floor(Number(n.start)) : 1;
  return { start, scope: n.scope === "section" ? "section" : "continuous" };
}

// Returns the paper as it looks in a given set: sections → numbered questions
// with options re-ordered and the correct option index for that set.
export function getSetView(paper, label) {
  const set = paper.sets.find((s) => s.label === label) ?? paper.sets[0];
  const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
  const { start, scope } = numberingOf(paper);
  let number = start - 1;

  return paper.sections.map((section) => {
    if (scope === "section") number = start - 1;
    const inSection = paper.questions.filter((q) => q.sectionId === section.subjectId);
    const ordered = [
      ...set.order.map((id) => byId[id]).filter((q) => q && q.sectionId === section.subjectId),
      ...inSection.filter((q) => !set.order.includes(q.id)),
    ];
    return {
      ...section,
      questions: ordered.map((q) => {
        number += 1;
        const perm = set.optionOrder[q.id]?.length === q.options.length ? set.optionOrder[q.id] : q.options.map((_, i) => i);
        return {
          ...q,
          number,
          displayOptions: perm.map((i) => q.options[i]),
          correctIndex: q.type === "mcq" ? perm.indexOf(Number(q.answer)) : null,
        };
      }),
    };
  });
}

// ── Editing helpers (pure: they return a new paper) ────────────
// Question order of one set, complete and grouped by section (as displayed).
const setOrder = (paper, label) => getSetView(paper, label).flatMap((s) => s.questions.map((q) => q.id));

// Moves a question before/after another question of the same section in one set.
// In Set A (the master order) the paper's own question order follows, so later
// rebuilt sets start from it. Answer keys are derived from the order, so they stay in sync.
export function moveQuestion(paper, label, id, targetId, position = "before") {
  if (id === targetId) return paper;
  const order = setOrder(paper, label).filter((x) => x !== id);
  const at = order.indexOf(targetId);
  if (at < 0) return paper;
  order.splice(position === "after" ? at + 1 : at, 0, id);
  const isMaster = paper.sets[0]?.label === label;
  const byId = Object.fromEntries(paper.questions.map((q) => [q.id, q]));
  return {
    ...paper,
    questions: isMaster ? order.map((x) => byId[x]).filter(Boolean) : paper.questions,
    sets: paper.sets.map((s) => (s.label === label ? { ...s, order } : s)),
  };
}

// Moves a question one place up (-1) or down (+1) within its section in one set.
export function stepQuestion(paper, label, id, step) {
  const section = getSetView(paper, label).find((s) => s.questions.some((q) => q.id === id));
  const ids = section?.questions.map((q) => q.id) ?? [];
  const target = ids[ids.indexOf(id) + step];
  return target ? moveQuestion(paper, label, id, target, step > 0 ? "after" : "before") : paper;
}

// Copies a question and places the copy right after the original in every set.
export function duplicateQuestion(paper, id) {
  const original = paper.questions.find((q) => q.id === id);
  if (!original) return paper;
  const copy = { ...structuredClone(original), id: uid("PQ"), bankId: undefined };
  const insertAfter = (list) => {
    const i = list.indexOf(id);
    return i < 0 ? [...list, copy.id] : [...list.slice(0, i + 1), copy.id, ...list.slice(i + 1)];
  };
  const qi = paper.questions.indexOf(original);
  return {
    ...paper,
    questions: [...paper.questions.slice(0, qi + 1), copy, ...paper.questions.slice(qi + 1)],
    sets: paper.sets.map((s) => ({
      ...s,
      order: insertAfter(s.order),
      optionOrder: { ...s.optionOrder, [copy.id]: [...(s.optionOrder[id] ?? copy.options.map((_, i) => i))] },
    })),
  };
}

// Removes a question from the paper and from every set (and any block anchored to it moves up).
export function removeQuestion(paper, id) {
  const layout = paper.layout;
  return {
    ...paper,
    questions: paper.questions.filter((q) => q.id !== id),
    sets: paper.sets.map((s) => {
      const { [id]: _removed, ...optionOrder } = s.optionOrder;
      return { ...s, order: s.order.filter((qid) => qid !== id), optionOrder };
    }),
    ...(layout?.blocks?.length
      ? { layout: { ...layout, blocks: layout.blocks.map((b) => (b.after === `q:${id}` ? { ...b, after: `section:${paper.questions.find((q) => q.id === id)?.sectionId}` } : b)) } }
      : {}),
  };
}

// Edits a question's content. Option permutations of every set are kept when the
// number of options is unchanged, so each set's answer key follows the new correct answer.
export function updateQuestion(paper, id, data) {
  return {
    ...paper,
    questions: paper.questions.map((q) => (q.id === id ? { ...q, ...data, id, sectionId: q.sectionId } : q)),
    sets: paper.sets.map((s) => {
      const perm = s.optionOrder[id];
      const count = data.options?.length;
      if (count === undefined || perm?.length === count) return s;
      return { ...s, optionOrder: { ...s.optionOrder, [id]: Array.from({ length: count }, (_, i) => i) } };
    }),
  };
}

export function paperTotals(paper) {
  const questions = paper.questions.length;
  return { questions, marks: paper.questions.reduce((sum, q) => sum + (q.marks ?? 0), 0) };
}

// ── Mock generator ─────────────────────────────────────────────
function difficultyQuota(total, mix) {
  const easy = Math.round((total * mix.easy) / 100);
  const hard = Math.round((total * mix.hard) / 100);
  return { easy, hard, medium: Math.max(0, total - easy - hard) };
}

function pickForSection({ exam, section, type, count, mix, used }) {
  const sources = SUBJECT_SOURCES[section.subjectId] ?? [section.subjectId];
  const chapters = section.chapters;
  const concepts = section.concepts; // { [chapter]: { mode, selected } } — chapters without an entry use every concept
  const bank = shuffle(
    getQuestionsSync().filter(
      (q) =>
        sources.includes(q.subjectId) &&
        q.type === type &&
        (!chapters.length || chapters.includes(q.chapter)) &&
        matchesConcepts(q, concepts) &&
        !used.has(q.id)
    )
  );

  const picked = [];
  const quota = difficultyQuota(count, mix);
  for (const level of ["easy", "medium", "hard"]) {
    bank.filter((q) => q.difficulty === level).slice(0, quota[level]).forEach((q) => picked.push(q));
  }
  // top up from any difficulty if a level ran short
  for (const q of bank) {
    if (picked.length >= count) break;
    if (!picked.includes(q)) picked.push(q);
  }
  picked.forEach((q) => used.add(q.id));

  const result = picked.slice(0, count).map((q) => ({ ...q, bankId: q.id, id: uid("PQ") }));

  // fill the rest with AI-generated (template) questions, then drafts
  const generatorSubjects = sources.length > 1 ? sources : [section.subjectId];
  while (result.length < count) {
    const subjectId = generatorSubjects[result.length % generatorSubjects.length];
    const generated =
      generateQuestion({ subjectId, chapters, type, examId: exam.id, concepts }) ??
      placeholderQuestion({ subjectId, chapters, type, difficulty: ["easy", "medium", "hard"][result.length % 3], examId: exam.id, concepts, slot: result.length });
    result.push({ ...generated, id: uid("PQ") });
  }
  return result;
}

export function buildPaper(config, user) {
  const exam = getExam(config.examId);
  const used = new Set();
  const sections = config.sections.map((s) => ({ subjectId: s.subjectId, name: getSubject(s.subjectId).name }));

  const questions = config.sections.flatMap((section) =>
    [
      ...pickForSection({ exam, section, type: "mcq", count: section.mcq || 0, mix: config.difficulty, used }),
      ...pickForSection({ exam, section, type: "numerical", count: section.numerical || 0, mix: config.difficulty, used }),
    ].map((q) => ({
      ...q,
      sectionId: section.subjectId,
      marks: exam.marking.correct,
      negative: exam.marking.incorrect,
    }))
  );

  const now = new Date().toISOString();
  const paper = {
    id: uid("P"),
    title: config.title?.trim() || `${exam.name} Practice Paper`,
    examId: exam.id,
    institute: config.institute ?? "",
    instructions: config.instructions ?? "",
    durationMinutes: Number(config.durationMinutes) || exam.durationMinutes,
    marking: exam.marking,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: { id: user?.id ?? "unknown", name: user?.fullName ?? "Unknown" },
    sections,
    questions,
    config,
    stats: {
      fromBank: questions.filter((q) => q.bankId).length,
      aiGenerated: questions.filter((q) => q.source === "ai" && !q.bankId).length,
      drafts: questions.filter((q) => q.needsReview).length,
    },
  };
  paper.sets = buildSets(paper, config.setCount ?? 1, config);
  return paper;
}

// ── Seed data so the dashboard & analytics are not empty on first run ──
function seedPapers() {
  const syllabusChapters = (examId, subjectId) =>
    (getSyllabusSync(examId)[subjectId] ?? []).filter((c) => c.active).map((c) => c.name);
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const users = {
    admin: { id: "u-admin", fullName: "Anita Rao" },
    teacher: { id: "u-teacher", fullName: "Rahul Verma" },
    meera: { id: "u-t2", fullName: "Meera Iyer" },
  };
  const make = (examId, title, user, days, setCount, sizes, mix = { easy: 30, medium: 50, hard: 20 }) => {
    const exam = getExam(examId);
    const config = {
      examId,
      title,
      institute: "Vidya Coaching Centre",
      durationMinutes: exam.durationMinutes,
      difficulty: mix,
      setCount,
      shuffleQuestions: true,
      shuffleOptions: true,
      sections: exam.subjects
        .filter((s) => sizes[s.subjectId])
        .map((s) => ({ subjectId: s.subjectId, chapters: syllabusChapters(examId, s.subjectId), mcq: sizes[s.subjectId][0], numerical: sizes[s.subjectId][1] ?? 0 })),
    };
    const paper = buildPaper(config, user);
    return { ...paper, createdAt: daysAgo(days), updatedAt: daysAgo(days), status: days > 10 ? "final" : "draft" };
  };

  return [
    make("jee-main", "JEE Main Full Mock Test – 1", users.teacher, 2, 4, { physics: [20, 5], chemistry: [20, 5], mathematics: [20, 5] }),
    make("neet-ug", "NEET Physics & Chemistry Chapter Test", users.meera, 6, 2, { physics: [15], chemistry: [15] }, { easy: 40, medium: 40, hard: 20 }),
    make("kcet", "KCET Mathematics Practice Paper", users.teacher, 12, 3, { mathematics: [30] }),
    make("jee-main", "JEE Main Physics Weekly Test", users.admin, 19, 2, { physics: [15, 5] }, { easy: 20, medium: 50, hard: 30 }),
    make("neet-ug", "NEET Biology Revision Test", users.meera, 27, 1, { botany: [10], zoology: [10] }),
    make("kcet", "KCET PCM Mini Test", users.teacher, 40, 2, { physics: [10], chemistry: [10], mathematics: [10] }),
    make("jee-main", "JEE Main Chemistry Drill", users.teacher, 51, 1, { chemistry: [10, 3] }),
  ];
}

function loadPapers() {
  let papers = storage.get("papers");
  if (!papers) {
    papers = seedPapers();
    storage.set("papers", papers);
  }
  return papers;
}
const savePapers = (papers) => storage.set("papers", papers);

// ── API ────────────────────────────────────────────────────────
export async function generatePaper(config, user, onProgress = () => {}) {
  if (!USE_MOCK) {
    onProgress(2);
    const paper = await request("/papers/generate", { method: "POST", body: config });
    onProgress(GENERATION_STEPS.length);
    return paper;
  }
  for (let step = 0; step < GENERATION_STEPS.length; step += 1) {
    onProgress(step);
    await sleep(550 + Math.random() * 450);
  }
  const paper = buildPaper(config, user);
  savePapers([paper, ...loadPapers()]);
  onProgress(GENERATION_STEPS.length);
  return paper;
}

export function getPapersSync(user) {
  const papers = loadPapers();
  return user?.role === "admin" ? papers : papers.filter((p) => p.createdBy.id === user?.id);
}

export async function listPapers(user) {
  if (!USE_MOCK) return request("/papers");
  await sleep(250);
  return getPapersSync(user);
}

export async function getPaper(id) {
  if (!USE_MOCK) return request(`/papers/${id}`);
  await sleep(200);
  const paper = loadPapers().find((p) => p.id === id);
  if (!paper) throw new Error("Paper not found");
  return paper;
}

export async function savePaper(paper) {
  if (!USE_MOCK) return request(`/papers/${paper.id}`, { method: "PUT", body: paper });
  await sleep(300);
  const updated = {
    ...paper,
    updatedAt: new Date().toISOString(),
    stats: {
      fromBank: paper.questions.filter((q) => q.bankId).length,
      aiGenerated: paper.questions.filter((q) => q.source === "ai" && !q.bankId).length,
      drafts: paper.questions.filter((q) => q.needsReview).length,
    },
  };
  savePapers(loadPapers().map((p) => (p.id === paper.id ? updated : p)));
  return updated;
}

export async function deletePaper(id) {
  if (!USE_MOCK) return request(`/papers/${id}`, { method: "DELETE" });
  await sleep(250);
  savePapers(loadPapers().filter((p) => p.id !== id));
}

export async function duplicatePaper(id, user) {
  const original = await getPaper(id);
  const now = new Date().toISOString();
  const copy = {
    ...structuredClone(original),
    id: uid("P"),
    title: `${original.title} (Copy)`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: { id: user.id, name: user.fullName },
  };
  if (!USE_MOCK) return request("/papers", { method: "POST", body: copy });
  savePapers([copy, ...loadPapers()]);
  return copy;
}

// Replaces one question with a fresh one (same section, type and chapter list).
export async function regenerateQuestion(paper, questionId) {
  const target = paper.questions.find((q) => q.id === questionId);
  if (!USE_MOCK) {
    return request(`/papers/${paper.id}/questions/${questionId}/regenerate`, { method: "POST" });
  }
  await sleep(700);
  const exam = getExam(paper.examId);
  const sectionConfig = paper.config?.sections?.find((s) => s.subjectId === target.sectionId) ?? { subjectId: target.sectionId, chapters: [target.chapter] };
  const used = new Set(paper.questions.map((q) => q.bankId).filter(Boolean));
  const [fresh] = pickForSection({
    exam,
    section: { ...sectionConfig, chapters: sectionConfig.chapters?.length ? sectionConfig.chapters : [target.chapter] },
    type: target.type,
    count: 1,
    mix: { easy: target.difficulty === "easy" ? 100 : 0, medium: target.difficulty === "medium" ? 100 : 0, hard: target.difficulty === "hard" ? 100 : 0 },
    used,
  });
  return {
    ...fresh,
    id: target.id, // keep the slot so every set keeps its position
    sectionId: target.sectionId,
    marks: target.marks,
    negative: target.negative,
  };
}

export const examById = Object.fromEntries(EXAMS.map((e) => [e.id, e]));
