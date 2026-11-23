import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, FileText, Copy, Trash2, Eye, Layers } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import SearchInput from "../components/ui/SearchInput";
import Badge, { EXAM_COLOR } from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deletePaper, duplicatePaper, listPapers, paperTotals } from "../services/paperService";
import { EXAMS, getExam } from "../data/exams";
import { formatDate } from "../utils/helpers";

export default function Papers() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [papers, setPapers] = useState(null);
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listPapers(user).then(setPapers);
  }, [user]);

  const filtered = useMemo(() => {
    if (!papers) return [];
    const term = search.trim().toLowerCase();
    return papers.filter(
      (p) =>
        (!examFilter || p.examId === examFilter) &&
        (!statusFilter || p.status === statusFilter) &&
        (!term || p.title.toLowerCase().includes(term) || p.createdBy.name.toLowerCase().includes(term))
    );
  }, [papers, search, examFilter, statusFilter]);

  const handleDuplicate = async (id) => {
    const copy = await duplicatePaper(id, user);
    setPapers((list) => [copy, ...list]);
    toast.success("Paper duplicated");
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deletePaper(toDelete.id);
    setPapers((list) => list.filter((p) => p.id !== toDelete.id));
    setDeleting(false);
    setToDelete(null);
    toast.success("Paper deleted");
  };

  return (
    <>
      <PageHeader
        title={isAdmin ? "All papers" : "My papers"}
        subtitle="Open a paper to preview, edit questions, switch sets and export."
        actions={<Button icon={Sparkles} onClick={() => navigate("/generate")}>Generate paper</Button>}
      />

      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_180px_160px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by title or author" />
          <Select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} placeholder="All exams" options={EXAMS.map((e) => ({ value: e.id, label: e.name }))} aria-label="Filter by exam" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Any status" options={[{ value: "draft", label: "Draft" }, { value: "final", label: "Final" }]} aria-label="Filter by status" />
        </div>

        {!papers ? (
          <Loader />
        ) : !filtered.length ? (
          <EmptyState
            icon={FileText}
            title={papers.length ? "No papers match your filters" : "No papers yet"}
            message={papers.length ? "Try clearing the search or filters." : "Generate your first paper — it takes less than a minute."}
            action={!papers.length && <Button size="sm" icon={Sparkles} onClick={() => navigate("/generate")}>Generate paper</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Paper</th>
                  <th className="px-4 py-3 font-semibold">Exam</th>
                  <th className="px-4 py-3 text-right font-semibold">Questions</th>
                  <th className="px-4 py-3 text-right font-semibold">Marks</th>
                  <th className="px-4 py-3 font-semibold">Sets</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const { questions, marks } = paperTotals(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="max-w-xs px-4 py-3">
                        <Link to={`/papers/${p.id}`} className="block truncate font-medium text-slate-900 hover:text-indigo-600">{p.title}</Link>
                        <span className="text-xs text-slate-500">by {p.createdBy.name}{p.stats?.drafts ? ` · ${p.stats.drafts} to review` : ""}</span>
                      </td>
                      <td className="px-4 py-3"><Badge color={EXAM_COLOR[p.examId]}>{getExam(p.examId)?.name}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums">{questions}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{marks}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-slate-600"><Layers className="h-3.5 w-3.5" />{p.sets.map((s) => s.label).join(" ")}</span></td>
                      <td className="px-4 py-3"><Badge color={p.status === "final" ? "green" : "slate"}>{p.status}</Badge></td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/papers/${p.id}`)} aria-label="Open" title="Open"><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDuplicate(p.id)} aria-label="Duplicate" title="Duplicate"><Copy className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(p)} aria-label="Delete" title="Delete" className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete paper?"
        message={`“${toDelete?.title}” and all its sets will be permanently deleted.`}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
