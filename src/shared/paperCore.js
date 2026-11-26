// Paper logic shared by the browser app and the Node backend (backend/).
// Keep this file free of browser-only APIs and use explicit ".js" imports so Node can load it.
import { SET_LABELS } from "../data/exams.js";
import { shuffle } from "../utils/helpers.js";

// Shuffles until the arrangement differs from every one in `taken` (when that is possible).
function distinctShuffle(list, taken) {
  if (list.length < 2) return [...list];
  let best = shuffle(list);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const key = best.join("|");
    if (key !== list.join("|") && !taken.has(key)) return best;
    best = shuffle(list);
  }
  return best;
}

// Sets: Set A keeps the original order. Other sets shuffle questions within each section
// and/or shuffle MCQ options, so every set has its own arrangement and answer key.
// Every set contains the same questions (no duplicates within a paper).
export function buildSets(paper, count, { shuffleQuestions = true, shuffleOptions = true } = {}) {
  const sections = paper.sections.map((section) => paper.questions.filter((q) => q.sectionId === section.subjectId).map((q) => q.id));
  const takenOrders = sections.map((ids) => new Set([ids.join("|")]));
  const takenOptions = new Map(paper.questions.map((q) => [q.id, new Set([q.options.map((_, i) => i).join("|")])]));

  return SET_LABELS.slice(0, Math.min(Math.max(count, 1), 8)).map((label, index) => {
    const order = sections.flatMap((ids, s) => {
      if (index === 0 || !shuffleQuestions) return ids;
      const next = distinctShuffle(ids, takenOrders[s]);
      takenOrders[s].add(next.join("|"));
      return next;
    });
    const optionOrder = Object.fromEntries(
      paper.questions.map((q) => {
        const identity = q.options.map((_, i) => i);
        if (index === 0 || !shuffleOptions || q.type !== "mcq" || q.fixedOptions) return [q.id, identity];
        const perm = distinctShuffle(identity, takenOptions.get(q.id));
        takenOptions.get(q.id).add(perm.join("|"));
        return [q.id, perm];
      })
    );
    return { label, order, optionOrder };
  });
}

export function paperTotals(paper) {
  const questions = paper.questions.length;
  return { questions, marks: paper.questions.reduce((sum, q) => sum + (q.marks ?? 0), 0) };
}
