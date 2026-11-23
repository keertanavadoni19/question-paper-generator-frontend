import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Layers, Library, CircleCheckBig, Sparkles, ArrowRight, Plus, ListTree, ChartColumn } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge, { EXAM_COLOR } from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import BarChart from "../components/charts/BarChart";
import ExamCard from "../components/paper/ExamCard";
import { useAuth } from "../context/AuthContext";
import { getAnalytics } from "../services/analyticsService";
import { listPapers } from "../services/paperService";
import { EXAMS, getExam } from "../data/exams";
import { timeAgo } from "../utils/helpers";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    Promise.all([getAnalytics(user), listPapers(user)]).then(([analytics, list]) => {
      setStats(analytics);
      setPapers(list.slice(0, 5));
    });
  }, [user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const quickActions = [
    { label: "Generate a paper", desc: "AI builds a paper from the exam pattern", icon: Sparkles, to: "/generate", tone: "bg-indigo-600 text-white" },
    { label: "Add questions", desc: "Grow your question bank", icon: Plus, to: "/question-bank", tone: "bg-cyan-50 text-cyan-700" },
    isAdmin
      ? { label: "Manage syllabus", desc: "Chapters & weightage per exam", icon: ListTree, to: "/syllabus", tone: "bg-amber-50 text-amber-700" }
      : { label: "View analytics", desc: "Your paper activity", icon: ChartColumn, to: "/analytics", tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.fullName.split(" ")[0]} 👋`}
        subtitle={isAdmin ? "Here's what's happening across your institute." : "Here's a summary of your question papers."}
        actions={<Button icon={Sparkles} onClick={() => navigate("/generate")}>Generate paper</Button>}
      />

      {!stats ? (
        <Loader />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Papers generated" value={stats.totals.papers} icon={FileText} hint={`${stats.totals.finalized} finalized`} />
            <StatCard label="Paper sets" value={stats.totals.sets} icon={Layers} tone="cyan" hint="Across all papers" />
            <StatCard label="Questions used" value={stats.totals.questions} icon={CircleCheckBig} tone="green" hint={`~${stats.totals.avgQuestions} per paper`} />
            <StatCard label="Question bank" value={stats.totals.bank} icon={Library} tone="amber" hint="Available questions" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map(({ label, desc, icon: Icon, to, tone }) => (
              <Link key={to} to={to} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Recent papers" className="lg:col-span-3" bodyClassName="p-0" actions={<Link to="/papers" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">View all</Link>}>
              {papers.length ? (
                <ul className="divide-y divide-slate-100">
                  {papers.map((p) => (
                    <li key={p.id}>
                      <Link to={`/papers/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className="rounded-lg bg-slate-100 p-2 text-slate-500"><FileText className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{p.title}</span>
                          <span className="block text-xs text-slate-500">
                            {p.questions.length} questions · {p.sets.length} set{p.sets.length > 1 ? "s" : ""} · {timeAgo(p.createdAt)}
                          </span>
                        </span>
                        <Badge color={EXAM_COLOR[p.examId]}>{getExam(p.examId)?.name}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={FileText} title="No papers yet" message="Generate your first question paper in under a minute." action={<Button size="sm" icon={Sparkles} onClick={() => navigate("/generate")}>Generate paper</Button>} />
              )}
            </Card>

            <Card title="Papers per week" subtitle="Last 8 weeks" className="lg:col-span-2">
              <BarChart data={stats.weekly} />
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Start with an exam</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {EXAMS.map((exam) => (
                <ExamCard key={exam.id} exam={exam} compact onSelect={() => navigate(`/generate?exam=${exam.id}`)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
