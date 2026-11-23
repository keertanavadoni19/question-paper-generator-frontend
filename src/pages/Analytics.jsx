import { useEffect, useState } from "react";
import { FileText, Layers, CircleCheckBig, Library, Table } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import Button from "../components/ui/Button";
import BarChart from "../components/charts/BarChart";
import HBarList from "../components/charts/HBarList";
import DonutChart from "../components/charts/DonutChart";
import { useAuth } from "../context/AuthContext";
import { getAnalytics } from "../services/analyticsService";

export default function Analytics() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    getAnalytics(user).then(setData);
  }, [user]);

  if (!data) return <Loader label="Crunching numbers…" />;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={isAdmin ? "Usage across all teachers." : "Your paper generation activity."}
        actions={<Button variant="secondary" icon={Table} onClick={() => setShowTable((s) => !s)}>{showTable ? "Hide" : "Show"} data table</Button>}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Papers" value={data.totals.papers} icon={FileText} hint={`${data.totals.finalized} finalized`} />
          <StatCard label="Sets created" value={data.totals.sets} icon={Layers} tone="cyan" />
          <StatCard label="Questions used" value={data.totals.questions} icon={CircleCheckBig} tone="green" hint={`Avg ${data.totals.avgQuestions} per paper`} />
          <StatCard label="Bank size" value={data.totals.bank} icon={Library} tone="amber" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Papers generated per week" subtitle="Last 8 weeks" className="lg:col-span-2">
            <BarChart data={data.weekly} height={220} />
          </Card>
          <Card title="Papers by exam">
            <HBarList data={data.byExam} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Difficulty of questions used">
            <DonutChart data={data.difficulty} centerLabel="questions" />
          </Card>
          <Card title="Question source">
            <DonutChart data={data.sources} centerLabel="questions" />
          </Card>
          <Card title="Questions by subject">
            <HBarList data={data.subjects} />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Most used chapters">
            <HBarList data={data.topChapters} color="#0891b2" />
          </Card>
          {isAdmin ? (
            <Card title="Teacher activity" bodyClassName="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Teacher</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Papers</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Sets</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Questions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.teachers.map((t) => (
                    <tr key={t.name}>
                      <td className="px-5 py-2.5 font-medium text-slate-900">{t.name}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{t.papers}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{t.sets}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{t.questions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card title="Question bank by difficulty">
              <HBarList data={data.bankByDifficulty.map((d) => ({ ...d, label: d.label[0].toUpperCase() + d.label.slice(1) }))} color="#d97706" />
            </Card>
          )}
        </div>

        {showTable && (
          <Card title="Weekly data" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-2.5">Week starting</th><th className="px-5 py-2.5 text-right">Papers</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.weekly.map((w) => (
                  <tr key={w.label}><td className="px-5 py-2">{w.label}</td><td className="px-5 py-2 text-right tabular-nums">{w.value}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
