import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ExamCard from "../components/paper/ExamCard";
import { EXAMS, SUBJECTS, examTotals } from "../data/exams";

export default function ExamSelection() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Select an exam" subtitle="Each exam comes with its official pattern pre-loaded. You can customise everything on the next step." />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {EXAMS.map((exam) => (
          <ExamCard key={exam.id} exam={exam} onSelect={() => navigate(`/generate?exam=${exam.id}`)} />
        ))}
      </div>

      <Card title="Pattern comparison" className="mt-8" bodyClassName="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Exam</th>
              <th className="px-5 py-3 font-semibold">Subjects (questions)</th>
              <th className="px-5 py-3 text-right font-semibold">Total Q</th>
              <th className="px-5 py-3 text-right font-semibold">Marks</th>
              <th className="px-5 py-3 font-semibold">Marking</th>
              <th className="px-5 py-3 font-semibold">Duration</th>
              <th className="px-5 py-3 font-semibold">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EXAMS.map((exam) => {
              const { questions, marks } = examTotals(exam);
              return (
                <tr key={exam.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-slate-900">{exam.name}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {exam.subjects.map((s) => `${SUBJECTS[s.subjectId].name} (${s.mcq}${s.numerical ? ` + ${s.numerical} NV` : ""})`).join(", ")}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{questions}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{marks}</td>
                  <td className="px-5 py-3">+{exam.marking.correct} / {exam.marking.incorrect || "0"}</td>
                  <td className="px-5 py-3">{exam.durationLabel ?? `${exam.durationMinutes} min`}</td>
                  <td className="px-5 py-3 text-slate-600">{exam.mode}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">NV = numerical value questions. KCET candidates take Physics, Chemistry and either Mathematics or Biology.</p>
      </Card>
    </>
  );
}
