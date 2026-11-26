// Analytics shared by the browser (mock mode) and the Node backend.
import { EXAMS, SUBJECTS } from "../data/exams.js";

const countBy = (list, getKey) =>
  list.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

// `bank` is either the question list (mock mode) or { total, byDifficulty } from the backend.
export function computeAnalytics(papers, bank) {
  const bankTotal = Array.isArray(bank) ? bank.length : bank?.total ?? 0;
  const bankDifficulty = (d) => (Array.isArray(bank) ? bank.filter((q) => q.difficulty === d).length : bank?.byDifficulty?.[d] ?? 0);
  const allQuestions = papers.flatMap((p) => p.questions);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - (7 - i) * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      label: start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      value: papers.filter((p) => {
        const t = new Date(p.createdAt);
        return t >= start && t <= end;
      }).length,
    };
  });

  const difficulty = countBy(allQuestions, (q) => q.difficulty);
  const subjects = countBy(allQuestions, (q) => q.sectionId);
  const chapters = countBy(allQuestions, (q) => q.chapter);
  const teachers = papers.reduce((acc, p) => {
    const key = p.createdBy.name;
    acc[key] ??= { name: key, papers: 0, questions: 0, sets: 0 };
    acc[key].papers += 1;
    acc[key].questions += p.questions.length;
    acc[key].sets += p.sets.length;
    return acc;
  }, {});

  return {
    totals: {
      papers: papers.length,
      questions: allQuestions.length,
      sets: papers.reduce((sum, p) => sum + p.sets.length, 0),
      bank: bankTotal,
      finalized: papers.filter((p) => p.status === "final").length,
      avgQuestions: papers.length ? Math.round(allQuestions.length / papers.length) : 0,
    },
    byExam: EXAMS.map((e) => ({ label: e.name, value: papers.filter((p) => p.examId === e.id).length })),
    weekly: weeks,
    difficulty: [
      { label: "Easy", value: difficulty.easy ?? 0, color: "#22c55e" },
      { label: "Medium", value: difficulty.medium ?? 0, color: "#f59e0b" },
      { label: "Hard", value: difficulty.hard ?? 0, color: "#ef4444" },
    ],
    sources: [
      { label: "Question bank", value: allQuestions.filter((q) => q.bankId).length, color: "#4f46e5" },
      { label: "AI generated", value: allQuestions.filter((q) => q.source === "ai" && !q.bankId).length, color: "#0891b2" },
      { label: "Written / edited manually", value: allQuestions.filter((q) => !q.bankId && q.source !== "ai" && !q.needsReview).length, color: "#d97706" },
      { label: "Drafts to review", value: allQuestions.filter((q) => q.needsReview).length, color: "#db2777" },
    ],
    subjects: Object.entries(subjects)
      .map(([id, value]) => ({ label: SUBJECTS[id]?.name ?? id, value, color: SUBJECTS[id]?.color }))
      .sort((a, b) => b.value - a.value),
    topChapters: Object.entries(chapters)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    teachers: Object.values(teachers).sort((a, b) => b.papers - a.papers),
    bankByDifficulty: ["easy", "medium", "hard"].map((d) => ({ label: d, value: bankDifficulty(d) })),
  };
}
