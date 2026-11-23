import { Pencil, RefreshCw, Trash2, TriangleAlert, Sparkles, Database } from "lucide-react";
import Badge, { DIFFICULTY_COLOR } from "../ui/Badge";
import Button from "../ui/Button";
import { optionLetter } from "../../utils/helpers";

// One question as it appears on the paper. In edit mode it shows edit / regenerate / delete actions.
export default function QuestionView({ question: q, showAnswers, showSolutions, editMode, onEdit, onRegenerate, onDelete, busy }) {
  const options = q.displayOptions ?? q.options;
  const correct = q.correctIndex ?? q.answer;

  return (
    <article className={`group rounded-xl border p-4 transition ${q.needsReview ? "border-amber-300 bg-amber-50/40" : "border-transparent hover:border-slate-200"}`}>
      <div className="flex gap-3">
        <span className="w-8 shrink-0 pt-0.5 text-right font-bold text-slate-900">{q.number ?? "•"}.</span>
        <div className="min-w-0 flex-1">
          <p className="paper-sheet text-[15px] leading-relaxed text-slate-900">{q.text}</p>

          {q.type === "mcq" ? (
            <ol className="paper-sheet mt-2 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
              {options.map((opt, i) => {
                const isCorrect = showAnswers && i === Number(correct);
                return (
                  <li key={i} className={`rounded-md px-2 py-0.5 ${isCorrect ? "bg-green-50 font-semibold text-green-800 ring-1 ring-green-300" : "text-slate-700"}`}>
                    ({optionLetter(i)}) {opt}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="paper-sheet mt-2 text-[15px] text-slate-600">
              Answer: {showAnswers ? <span className="rounded bg-green-50 px-2 font-semibold text-green-800 ring-1 ring-green-300">{q.answer}</span> : "__________"}
            </p>
          )}

          {showSolutions && q.solution && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Solution: </span>
              {q.solution}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge color="slate">{q.chapter}</Badge>
            <Badge color={DIFFICULTY_COLOR[q.difficulty]}>{q.difficulty}</Badge>
            {q.type === "numerical" && <Badge color="cyan">Numerical</Badge>}
            {q.bankId && <Badge color="indigo"><Database className="h-3 w-3" />Bank</Badge>}
            {q.source === "ai" && <Badge color="pink"><Sparkles className="h-3 w-3" />AI</Badge>}
            {q.needsReview && <Badge color="amber"><TriangleAlert className="h-3 w-3" />Needs review</Badge>}
            <span className="text-xs text-slate-400">+{q.marks}{q.negative ? ` / ${q.negative}` : ""}</span>

            {editMode && (
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(q)} disabled={busy}>Edit</Button>
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => onRegenerate(q)} loading={busy} loadingText="AI…">Regenerate</Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(q)} disabled={busy} className="text-red-600 hover:bg-red-50 hover:text-red-700">Delete</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
