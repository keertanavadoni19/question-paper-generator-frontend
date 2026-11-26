// Builds a question paper from the Supabase question bank.
//   config.sections[] = { subjectId, chapters[], mcq, numerical, concepts?, chapterCounts?, typeCounts? }
// chapterCounts – questions wanted per chapter (wizard step 4)
// typeCounts    – questions wanted per type { mcq, assertion_reason, numerical } (wizard step 5)
// concepts      – { [chapter]: { mode, selected[] } } chosen concepts per chapter (step 3)
import { buildSets, paperTotals } from "../../src/shared/paperCore.js";
import { getExam, getSubject } from "../../src/data/exams.js";
import { shuffle, uid } from "../../src/utils/helpers.js";
import { KINDS, examKinds, rowToQuestion } from "./normalize.js";
import { allocate, splitByWeight } from "../../src/shared/allocation.js";

export { allocate, splitByWeight };

export const FETCH_COLUMNS =
  "id,subject,klass,chapter,topic,exams,q_type,question,opt_a,opt_b,opt_c,opt_d,assertion,reason,predef_options,column_a,column_b,match_options,num_answer,correct_option,solution_text,created_by_name,created_at,review_status";

const WEIGHT = { high: 3, medium: 2, low: 1 };
const textKey = (q) => `${q.text}|${(q.options ?? []).join("|")}`.toLowerCase().replace(/\s+/g, " ").trim();

// Orders candidates: not-recently-used first, and alternating between topics so the
// selected concepts are covered evenly instead of repeating the same one.
function spreadByTopic(entries, recentlyUsed) {
  const fresh = entries.filter((e) => !recentlyUsed.has(e.id));
  const used = entries.filter((e) => recentlyUsed.has(e.id));
  const roundRobin = (list) => {
    const groups = new Map();
    for (const e of shuffle(list)) {
      if (!groups.has(e.topic)) groups.set(e.topic, []);
      groups.get(e.topic).push(e);
    }
    const queues = shuffle([...groups.values()]);
    const out = [];
    while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift());
    return out;
  };
  return [...roundRobin(fresh), ...roundRobin(used)];
}

export async function fetchRows(clients, entries) {
  const byDb = new Map();
  for (const e of entries) {
    if (!byDb.has(e.db)) byDb.set(e.db, []);
    byDb.get(e.db).push(e.id);
  }
  const rows = new Map();
  await Promise.all(
    [...byDb.entries()].map(async ([db, ids]) => {
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await clients.get(db).from("questions").select(FETCH_COLUMNS).in("id", ids.slice(i, i + 100));
        if (error) throw new Error(`DB${db}: ${error.message}`);
        for (const row of data ?? []) rows.set(row.id, row);
      }
    })
  );
  return rows;
}

// Picks `count` usable questions from ordered candidates (fetching in batches, skipping
// rows that cannot be shown and duplicates already in the paper).
export async function pickQuestions({ clients, ordered, count, seen, map }) {
  const picked = [];
  let cursor = 0;
  while (picked.length < count && cursor < ordered.length) {
    const batch = ordered.slice(cursor, cursor + Math.max(10, (count - picked.length) * 2));
    cursor += batch.length;
    const rows = await fetchRows(clients, batch);
    for (const e of batch) {
      if (picked.length >= count) break;
      const row = rows.get(e.id);
      const mapped = row && map(row, e);
      if (!mapped) continue;
      // use the merged concept name (case / apostrophe variants are one concept)
      const q = e.topic && e.topic !== "General" ? { ...mapped, concept: e.topic } : mapped;
      const key = textKey(q);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(q);
    }
  }
  return picked;
}

function chapterTopics(section, chapterName) {
  const f = section.concepts?.[chapterName];
  return f?.selected?.length ? f.selected : null;
}

// Requested counts per chapter and per type for one section (with sensible defaults).
export function sectionPlan(section, chapters, examId) {
  const kinds = examKinds(examId);
  const typeCounts = section.typeCounts
    ? Object.fromEntries(KINDS.map((k) => [k, kinds.includes(k) ? Math.max(0, Math.floor(section.typeCounts[k] || 0)) : 0]))
    : { mcq: Math.max(0, section.mcq || 0), assertion_reason: 0, numerical: kinds.includes("numerical") ? Math.max(0, section.numerical || 0) : 0 };
  const total = KINDS.reduce((s, k) => s + typeCounts[k], 0);
  let needs;
  if (section.chapterCounts && Object.keys(section.chapterCounts).length) {
    needs = chapters.map((c) => Math.max(0, Math.floor(section.chapterCounts[c.name] || 0)));
  } else {
    const caps = chapters.map((c) => c.available.total);
    needs = splitByWeight(total, chapters.map((c) => WEIGHT[c.weightage] ?? 2), caps).counts;
  }
  return { typeCounts, needs, total };
}

export async function generatePaper({ config, index, clients, user, syllabus, recentlyUsed = new Set() }) {
  const exam = getExam(config.examId);
  if (!exam) throw Object.assign(new Error("Unknown exam"), { status: 400 });
  const warnings = [];
  const seen = new Set();
  const questions = [];

  for (const section of config.sections ?? []) {
    const subjectChapters = syllabus[section.subjectId] ?? [];
    const chapters = (section.chapters ?? [])
      .map((name) => subjectChapters.find((c) => c.name === name))
      .filter((c) => c && c.source !== "custom")
      .map((c) => {
        const topics = chapterTopics(section, c.name);
        const available = Object.fromEntries(KINDS.map((k) => [k, 0]));
        for (const e of index.candidates({ examId: exam.id, subjectId: section.subjectId, chapter: c, topics })) available[e.kind] += 1;
        available.total = KINDS.reduce((s, k) => s + available[k], 0);
        return { ...c, topics, available };
      });
    const name = getSubject(section.subjectId)?.name ?? section.subjectId;
    if (section.questionIds?.length) {
      // Manual Fetch: exactly the questions the faculty picked, in their order
      const entries = section.questionIds.map((id) => index.byId.get(id)).filter(Boolean);
      const rows = await fetchRows(clients, entries);
      for (const e of entries) {
        const row = rows.get(e.id);
        const chapterName = index.chapters.get(e.key)?.name ?? row?.chapter;
        const subjectId = section.subjectId === "biology" ? (subjectChapters.find((c) => c.name === chapterName)?.source ?? "botany") : section.subjectId;
        const q = row && rowToQuestion(row, { subjectId, chapterName });
        if (!q) {
          warnings.push(`${name}: one picked question could not be used (incomplete in the bank).`);
          continue;
        }
        seen.add(textKey(q));
        questions.push({ ...q, concept: e.topic !== "General" ? e.topic : q.concept, id: uid("PQ"), sectionId: section.subjectId, marks: exam.marking.correct, negative: exam.marking.incorrect, examIds: [exam.id] });
      }
      if (entries.length < section.questionIds.length) warnings.push(`${name}: ${section.questionIds.length - entries.length} picked question(s) are no longer in the bank.`);
      continue;
    }
    if (!chapters.length) {
      warnings.push(`${name}: none of the selected chapters have questions in the bank.`);
      continue;
    }
    const { typeCounts, needs } = sectionPlan(section, chapters, exam.id);
    const { alloc, shortages } = allocate(needs, typeCounts, chapters.map((c) => c.available));
    for (const [kind, missing] of Object.entries(shortages)) {
      warnings.push(`${name}: ${missing} ${kind === "assertion_reason" ? "assertion–reason" : kind.toUpperCase() === "MCQ" ? "MCQ" : kind} question${missing > 1 ? "s" : ""} could not be filled from the selected chapters/concepts.`);
    }

    for (const [i, chapter] of chapters.entries()) {
      for (const kind of KINDS) {
        const n = alloc[i][kind];
        if (!n) continue;
        const pool = index.candidates({ examId: exam.id, subjectId: section.subjectId, chapter, kind, topics: chapter.topics }).filter((e) => !questions.some((q) => q.bankId === e.id));
        const picked = await pickQuestions({
          clients,
          ordered: spreadByTopic(pool, recentlyUsed),
          count: n,
          seen,
          map: (row) => {
            const q = rowToQuestion(row, { subjectId: section.subjectId === "biology" ? chapter.source : section.subjectId, chapterName: chapter.name });
            return q && (KINDS.includes(kind) ? (kind === "numerical" ? q.type === "numerical" : q.type === "mcq") : true) ? q : null;
          },
        });
        if (picked.length < n) warnings.push(`${name} · ${chapter.name}: only ${picked.length} of ${n} usable ${kind === "numerical" ? "numerical" : kind === "assertion_reason" ? "assertion–reason" : "MCQ"} questions.`);
        for (const q of picked) {
          questions.push({ ...q, id: uid("PQ"), sectionId: section.subjectId, marks: exam.marking.correct, negative: exam.marking.incorrect, examIds: [exam.id] });
        }
      }
    }
  }

  const sectionIds = [...new Set((config.sections ?? []).map((s) => s.subjectId))].filter((id) => questions.some((q) => q.sectionId === id));
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
    sections: sectionIds.map((id) => ({ subjectId: id, name: getSubject(id)?.name ?? id })),
    questions,
    config,
    stats: { fromBank: questions.length, aiGenerated: 0, drafts: 0 },
    warnings,
  };
  if (!questions.length) throw Object.assign(new Error(warnings[0] || "No questions match the selected chapters and concepts."), { status: 422, warnings });
  paper.sets = buildSets(paper, config.setCount ?? 1, config);
  return paper;
}

// One replacement question for the editor's "Regenerate" (same section, type and, if possible, chapter).
export async function regenerateQuestion({ index, clients, examId, section, syllabus, target, usedBankIds = [] }) {
  const subjectChapters = syllabus[section.subjectId] ?? [];
  const kind = target.format === "assertion_reason" ? "assertion_reason" : target.type === "numerical" ? "numerical" : "mcq";
  const used = new Set(usedBankIds);
  const preferred = subjectChapters.filter((c) => c.name === target.chapter);
  const others = subjectChapters.filter((c) => (section.chapters ?? []).includes(c.name) && c.name !== target.chapter);
  for (const chapter of [...preferred, ...others]) {
    const pool = index.candidates({ examId, subjectId: section.subjectId, chapter, kind, topics: chapterTopics(section, chapter.name) }).filter((e) => !used.has(e.id));
    const [q] = await pickQuestions({
      clients,
      ordered: shuffle(pool),
      count: 1,
      seen: new Set([textKey(target)]),
      map: (row) => rowToQuestion(row, { subjectId: target.subjectId ?? section.subjectId, chapterName: chapter.name }),
    });
    if (q) return q;
  }
  throw Object.assign(new Error("No other question of this type is available for the selected chapters."), { status: 404 });
}

export { paperTotals };
