// Concept selection helpers shared by the Generate page (UI) and the paper generator.
//
// Per section, the UI keeps `conceptSelections`:
//   { [chapterName]: { mode: "manual", selected: string[] } | { mode: "auto", seed: number } }
// A chapter with no entry uses all of its concepts.
// The generation config receives the resolved form (see resolveConcepts):
//   section.concepts = { [chapterName]: { mode: "manual" | "auto", selected: string[] } }

const WEIGHT = { high: 3, medium: 2, low: 1 };

export const newSeed = () => Math.floor(Math.random() * 1_000_000);

// How many questions each selected chapter is likely to get, shared out by weightage.
export function expectedQuestions(section) {
  const total = (section.mcq || 0) + (section.numerical || 0);
  const chosen = section.available.filter((c) => section.chapters.includes(c.name));
  const weightSum = chosen.reduce((sum, c) => sum + (WEIGHT[c.weightage] ?? 2), 0) || 1;
  return Object.fromEntries(chosen.map((c) => [c.name, (total * (WEIGHT[c.weightage] ?? 2)) / weightSum]));
}

// Automatic mode: picks enough concepts to cover the questions expected from the chapter
// (about 1.5 concepts per question, at least 2), spread evenly across the chapter so
// the same opening concepts are not chosen every time. The seed rotates the starting point.
export function autoSelectConcepts(concepts, expected, seed = 0) {
  const n = concepts.length;
  if (!n) return [];
  const count = Math.min(n, Math.max(2, Math.ceil(expected * 1.5)));
  const stride = n / count;
  const offset = seed % n;
  const indices = new Set(Array.from({ length: count }, (_, i) => (offset + Math.floor(i * stride)) % n));
  return concepts.filter((_, i) => indices.has(i));
}

// Selected concepts for one chapter, or null when the chapter is unrestricted.
export function selectedConcepts(chapter, selection, expected) {
  if (!selection || !chapter?.concepts?.length) return null;
  if (selection.mode === "auto") return autoSelectConcepts(chapter.concepts, expected, selection.seed);
  return chapter.concepts.filter((c) => selection.selected.includes(c));
}

// Resolved concept filters for the chapters currently selected in a section.
export function resolveConcepts(section) {
  const expected = expectedQuestions(section);
  const resolved = {};
  for (const chapter of section.available) {
    const selection = section.conceptSelections?.[chapter.name];
    if (!section.chapters.includes(chapter.name)) continue;
    const selected = selectedConcepts(chapter, selection, expected[chapter.name] ?? 0);
    if (selected) resolved[chapter.name] = { mode: selection.mode, selected };
  }
  return resolved;
}

// Question filter for the generator. Questions from a concept-restricted chapter must be
// tagged with one of the chosen concepts; other chapters are unaffected.
export function matchesConcepts(question, concepts) {
  const filter = concepts?.[question.chapter];
  return !filter || filter.selected.includes(question.concept);
}
