import { useState } from "react";
import { Check, Hand, Shuffle, WandSparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { autoSelectConcepts, newSeed } from "../../utils/concepts";

const MODES = [
  { value: "manual", label: "Select manually", hint: "Tick the concepts to include", icon: Hand },
  { value: "auto", label: "Automatic", hint: "Spread across the chapter by question count", icon: WandSparkles },
];

// Concept selection for one chapter. Mount it only while open (it keeps a draft until Save).
// selection: { mode: "manual", selected } | { mode: "auto", seed } | undefined (= all concepts)
// expected:  questions this chapter is likely to get, used by automatic mode.
// counts (optional): { [concept]: { total } } — questions available per concept in the bank
export default function ConceptPicker({ chapter, subjectName, selection, expected, counts, onSave, onClose }) {
  const concepts = chapter.concepts;
  const [mode, setMode] = useState(selection?.mode ?? "manual");
  const [picked, setPicked] = useState(() => (selection?.mode === "manual" ? selection.selected : concepts));
  const [seed, setSeed] = useState(() => (selection?.mode === "auto" ? selection.seed : newSeed()));

  const autoPicked = autoSelectConcepts(concepts, expected, seed);
  const toggle = (concept) => setPicked((list) => (list.includes(concept) ? list.filter((c) => c !== concept) : [...list, concept]));
  const save = () => onSave(mode === "manual" ? { mode, selected: concepts.filter((c) => picked.includes(c)) } : { mode, seed });
  const expectedLabel = expected < 1 ? "less than 1 question" : `about ${Math.round(expected)} question${Math.round(expected) === 1 ? "" : "s"}`;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={chapter.name}
      description={`${subjectName} · Class ${chapter.classLevel} · ${concepts.length} concepts`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => onSave(null)}>Use all concepts</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={mode === "manual" && !picked.length}>Save concepts</Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Concept selection mode" className="grid gap-2 sm:grid-cols-2">
        {MODES.map(({ value, label, hint, icon: Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(value)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300"}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
              <span>
                <span className={`block text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-800"}`}>{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "manual" ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600"><b className="tabular-nums text-slate-900">{picked.length}</b> of {concepts.length} selected</p>
            <div className="flex gap-3 text-xs font-medium">
              <button type="button" className="text-indigo-600" onClick={() => setPicked(concepts)}>Select all</button>
              <button type="button" className="text-slate-500" onClick={() => setPicked([])}>Clear selection</button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {concepts.map((concept) => (
              <label key={concept} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${picked.includes(concept) ? "border-indigo-200 bg-indigo-50/60 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={picked.includes(concept)} onChange={() => toggle(concept)} />
                <span className="flex-1">{concept}</span>
                {counts?.[concept] && <span className="text-[11px] tabular-nums text-slate-400">{counts[concept].total}</span>}
              </label>
            ))}
          </div>
          {!picked.length && <p className="mt-2 text-xs text-red-600">Select at least one concept, or choose “Use all concepts”.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 p-3">
            <p className="max-w-md text-xs text-slate-600">
              This chapter is expected to get <b>{expectedLabel}</b> with the current counts. <b>{autoPicked.length}</b> of {concepts.length} concepts are picked, spread across the chapter. The picks update if you change the question count.
            </p>
            <Button size="sm" variant="secondary" icon={Shuffle} onClick={() => setSeed((s) => s + 1 + (newSeed() % Math.max(1, concepts.length - 1)))}>Reshuffle</Button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {concepts.map((concept) => {
              const on = autoPicked.includes(concept);
              return (
                <li key={concept} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? "border-pink-200 bg-pink-50/60 font-medium text-slate-900" : "border-dashed border-slate-200 text-slate-400"}`}>
                  {on ? <Check className="h-4 w-4 shrink-0 text-pink-600" /> : <span className="h-4 w-4 shrink-0" />}
                  {concept}
                  {on && <Badge color="pink" className="ml-auto">Auto</Badge>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
