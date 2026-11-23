import { useState } from "react";
import { Check, X, SlidersHorizontal } from "lucide-react";
import Button from "../ui/Button";
import { optionLetter } from "../../utils/helpers";

const field = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

// Edits a question in place on the page. Options are shown in the master (Set A) order;
// every set's answer key follows the correct answer chosen here.
export default function InlineQuestionEditor({ question, number, onSave, onCancel, onMore }) {
  const [q, setQ] = useState(() => ({ ...question, options: [...(question.options ?? [])] }));
  const [error, setError] = useState("");
  const set = (key, value) => setQ((prev) => ({ ...prev, [key]: value }));
  const setOption = (i, value) => setQ((prev) => ({ ...prev, options: prev.options.map((o, j) => (j === i ? value : o)) }));

  const save = () => {
    if (q.text.trim().length < 5) return setError("Question text is too short.");
    if (q.type === "mcq") {
      if (q.options.some((o) => !String(o).trim())) return setError("Fill in every option.");
      if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size < q.options.length) return setError("Options must be different.");
    } else if (String(q.answer).trim() === "" || Number.isNaN(Number(q.answer))) {
      return setError("Enter a numeric answer.");
    }
    const marks = Number(q.marks);
    if (!Number.isFinite(marks) || marks < 0) return setError("Marks must be 0 or more.");
    onSave({
      text: q.text.trim(),
      options: q.type === "mcq" ? q.options.map((o) => String(o).trim()) : [],
      answer: q.type === "mcq" ? Number(q.answer) : String(q.answer).trim(),
      marks,
      negative: Math.min(0, Number(q.negative) || 0),
      solution: q.solution?.trim() ?? "",
      needsReview: false,
    });
  };

  return (
    <div
      className="my-2 rounded-xl border-2 border-indigo-300 bg-indigo-50/40 p-3 font-sans"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Editing question {number}</p>
        {onMore && <Button size="sm" variant="ghost" icon={SlidersHorizontal} onClick={onMore}>Chapter, type…</Button>}
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Question
        <textarea autoFocus rows={3} value={q.text} onChange={(e) => set("text", e.target.value)} className={`${field} mt-1`} />
      </label>

      {q.type === "mcq" ? (
        <fieldset className="mt-2">
          <legend className="mb-1 text-xs font-medium text-slate-600">Options <span className="font-normal text-slate-500">(select the correct one)</span></legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <label key={i} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${Number(q.answer) === i ? "border-green-400 bg-green-50" : "border-slate-200 bg-white"}`}>
                <input type="radio" name={`ans-${q.id}`} className="accent-green-600" checked={Number(q.answer) === i} onChange={() => set("answer", i)} aria-label={`Option ${optionLetter(i)} is correct`} />
                <span className="text-xs font-bold text-slate-500">{optionLetter(i)}</span>
                <input value={opt} onChange={(e) => setOption(i, e.target.value)} className="min-w-0 flex-1 bg-transparent py-0.5 text-sm text-slate-900 focus:outline-none" aria-label={`Option ${optionLetter(i)}`} />
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="mt-2 block max-w-xs text-xs font-medium text-slate-600">
          Correct numerical answer
          <input value={q.answer} onChange={(e) => set("answer", e.target.value)} inputMode="decimal" className={`${field} mt-1`} />
        </label>
      )}

      <div className="mt-2 grid gap-2 sm:grid-cols-[110px_110px_1fr]">
        <label className="block text-xs font-medium text-slate-600">
          Marks (+)
          <input type="number" min={0} step={0.5} value={q.marks} onChange={(e) => set("marks", e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Negative (−)
          <input type="number" max={0} step={0.25} value={q.negative ?? 0} onChange={(e) => set("negative", e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Solution
          <input value={q.solution ?? ""} onChange={(e) => set("solution", e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-slate-500">Ctrl + Enter to save · Esc to cancel</span>
        <Button size="sm" variant="secondary" icon={X} onClick={onCancel}>Cancel</Button>
        <Button size="sm" icon={Check} onClick={save}>Save</Button>
      </div>
    </div>
  );
}
