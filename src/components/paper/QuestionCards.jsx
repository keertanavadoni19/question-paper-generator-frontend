import { useMemo, useState } from "react";
import { BarChart3, Check, Pencil, PencilLine, Trash2, X } from "lucide-react";
import RichText from "../ui/RichText";
import ConfirmDialog from "../ui/ConfirmDialog";
import InlineQuestionEditor from "./InlineQuestionEditor";
import { getSetView, removeQuestion, updateQuestion } from "../../services/paperService";
import { conceptsFor } from "../../data/concepts";
import { optionLetter } from "../../utils/helpers";

const LEVELS = ["easy", "medium", "hard"];
const LEVEL_STYLE = { easy: "bg-blue-600", medium: "bg-amber-500", hard: "bg-red-600" };
const pencilBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-400 text-white shadow-sm transition hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300";

// One editable line (question, option, answer or solution): shows the text with a pencil
// button; the pencil turns it into a text box with Save / Cancel.
function EditableRow({ value, placeholder, onSave, multiline, label, lead, className = "", validate }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const editing = draft !== null;

  const save = () => {
    const text = draft.trim();
    const problem = validate?.(text);
    if (problem) return setError(problem);
    if (text !== String(value ?? "")) onSave(text);
    setDraft(null);
    setError("");
  };
  const cancel = () => { setDraft(null); setError(""); };

  return (
    <div className={`flex items-start gap-3 border-t border-slate-100 px-4 py-3 ${className}`}>
      {lead}
      <div className="min-w-0 flex-1 pt-1 text-[15px] text-slate-900">
        {editing ? (
          <>
            {multiline ? (
              <textarea autoFocus rows={3} value={draft} aria-label={label} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }}
                className="w-full rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            ) : (
              <input autoFocus value={draft} aria-label={label} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter") save(); }}
                className="w-full rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </>
        ) : value ? (
          <RichText text={String(value)} />
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
      </div>
      {editing ? (
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={save} aria-label={`Save ${label}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={cancel} aria-label="Cancel" className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setDraft(String(value ?? ""))} aria-label={`Edit ${label}`} title={`Edit ${label}`} className={pencilBtn}><PencilLine className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function QuestionCard({ q, onChange, onDelete }) {
  const [fullEdit, setFullEdit] = useState(false);
  const topics = useMemo(() => conceptsFor(q.subjectId ?? q.sectionId, q.chapter), [q.subjectId, q.sectionId, q.chapter]);
  const level = LEVELS.includes(q.difficulty) ? q.difficulty : "medium";
  const nextLevel = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
  const update = (data) => onChange({ ...data, needsReview: false });

  if (fullEdit) {
    return (
      <InlineQuestionEditor question={q} number={q.number} onCancel={() => setFullEdit(false)}
        onSave={(data) => { update(data); setFullEdit(false); }} />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white font-sans shadow-sm">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => onChange({ difficulty: nextLevel })} title={`Change to ${nextLevel}`}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white ${LEVEL_STYLE[level]}`}>
          <BarChart3 className="h-3.5 w-3.5" />Level: <span className="capitalize">{level}</span>
        </button>
        {q.chapter && <span className="truncate text-xs text-slate-500">{q.chapter}</span>}
        {q.needsReview && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Needs review</span>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"><Trash2 className="h-3.5 w-3.5" />Delete</button>
          <button type="button" onClick={() => setFullEdit(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Pencil className="h-3.5 w-3.5" />Edit</button>
        </div>
      </header>

      <EditableRow label={`question ${q.number}`} value={q.text} multiline
        lead={<span className="pt-1 text-[15px] font-semibold text-slate-900">Q{q.number}.</span>}
        validate={(t) => (t.length < 5 ? "Question text is too short." : "")}
        onSave={(text) => update({ text })} />

      {q.type === "mcq" ? (
        q.options.map((opt, i) => {
          const correct = Number(q.answer) === i;
          return (
            <EditableRow key={i} label={`option ${optionLetter(i)}`} value={opt}
              validate={(t) => (!t ? "Option cannot be empty." : q.options.some((o, j) => j !== i && String(o).trim().toLowerCase() === t.toLowerCase()) ? "Options must be different." : "")}
              onSave={(text) => update({ options: q.options.map((o, j) => (j === i ? text : o)) })}
              lead={
                <button type="button" onClick={() => !correct && update({ answer: i })} aria-pressed={correct}
                  title={correct ? "Correct answer" : "Mark as correct answer"}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${correct ? "bg-green-500 text-white" : "bg-slate-100 text-slate-600 ring-1 ring-slate-300 hover:bg-green-100"}`}>
                  {optionLetter(i)}
                </button>
              } />
          );
        })
      ) : (
        <EditableRow label="answer" value={q.answer} placeholder="Enter answer"
          lead={<span className="pt-1 text-xs font-semibold uppercase tracking-wide text-green-700">Answer</span>}
          validate={(t) => (t === "" || Number.isNaN(Number(t)) ? "Enter a numeric answer." : "")}
          onSave={(answer) => update({ answer })} />
      )}

      <EditableRow label="solution" value={q.solution} placeholder="Enter solution here" multiline className="bg-green-50/70"
        onSave={(solution) => update({ solution })} />

      {topics.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-indigo-900 underline underline-offset-2">Select Topic</p>
          <div className="flex flex-wrap gap-2">
            {topics.map((t, i) => (
              <button key={t} type="button" aria-pressed={q.concept === t} onClick={() => onChange({ concept: t })}
                className={`rounded-md px-2.5 py-1.5 text-xs transition ${q.concept === t ? "bg-blue-600 font-semibold text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                {i + 1}. {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// Card view of every question in the paper (master order). Faculty can fix the question,
// each option, the correct answer, the solution, the level and the topic right here.
// Edits apply to every set; each set's answer key follows the new correct answer.
export default function QuestionCards({ paper, onChange }) {
  const [deleting, setDeleting] = useState(null);
  const sections = useMemo(() => getSetView(paper, paper.sets[0]?.label), [paper]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {sections.map((section) => (
        <section key={section.subjectId} className="space-y-4">
          <h3 className="text-center text-lg font-bold text-indigo-950">
            {section.name} <span className="text-sm font-medium text-slate-500">· {section.questions.length} questions</span>
          </h3>
          {section.questions.map((q) => (
            <QuestionCard key={q.id} q={q}
              onChange={(data) => onChange((p) => updateQuestion(p, q.id, data))}
              onDelete={() => setDeleting(q)} />
          ))}
        </section>
      ))}
      <ConfirmDialog open={Boolean(deleting)} title="Remove question?" confirmLabel="Remove"
        message={`Question ${deleting?.number ?? ""} will be removed from every set of this paper. The question bank is not affected.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { onChange((p) => removeQuestion(p, deleting.id)); setDeleting(null); }} />
    </div>
  );
}
