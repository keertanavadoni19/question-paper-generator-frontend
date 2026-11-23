import { Clock, ListChecks, Award, ArrowRight } from "lucide-react";
import { SUBJECTS, examTotals } from "../../data/exams";
import Badge, { EXAM_COLOR } from "../ui/Badge";

const ACCENTS = {
  indigo: "from-indigo-500 to-violet-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-500 to-orange-600",
};

// Exam summary card used on Exams page and Dashboard.
export default function ExamCard({ exam, onSelect, compact = false, selected = false }) {
  const { questions, marks } = examTotals(exam);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(exam)}
      className={`group flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"}`}
    >
      <div className={`bg-gradient-to-br ${ACCENTS[exam.accent]} px-5 py-4 text-white`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{exam.name}</h3>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">{exam.conductedBy}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-white/85">{exam.fullName}</p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2">
            <ListChecks className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{questions}</p>
            <p className="text-[11px] text-slate-500">Questions</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <Award className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{marks}</p>
            <p className="text-[11px] text-slate-500">Marks</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <Clock className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{exam.durationMinutes}m</p>
            <p className="text-[11px] text-slate-500">{exam.durationLabel ? "Per subject" : "Duration"}</p>
          </div>
        </div>

        {!compact && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {exam.subjects.map((s) => (
                <Badge key={s.subjectId} color={EXAM_COLOR[exam.id]}>
                  {SUBJECTS[s.subjectId].name} · {s.mcq + s.numerical}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Marking: <span className="font-semibold text-green-700">+{exam.marking.correct}</span>
              {exam.marking.incorrect ? <> / <span className="font-semibold text-red-600">{exam.marking.incorrect}</span></> : " · no negative"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {exam.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          </>
        )}

        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-indigo-600">
          Generate {exam.name} paper <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
