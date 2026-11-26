import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Sparkles, ChevronLeft, ChevronRight, Library, ChevronDown } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import SearchInput from "../components/ui/SearchInput";
import Badge, { DIFFICULTY_COLOR } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import QuestionForm from "../components/paper/QuestionForm";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { bankStats, createQuestion, deleteQuestion, searchQuestions, updateQuestion } from "../services/questionService";
import { useSubjectChapters } from "../services/syllabusService";
import { USE_MOCK } from "../services/api";
import RichText from "../components/ui/RichText";
import { generateQuestion, canGenerate } from "../services/mockAi";
import { EXAMS, SUBJECTS, getExam } from "../data/exams";
import { chaptersFor } from "../data/syllabus";
import { optionLetter } from "../utils/helpers";

const PAGE_SIZE = 10;
const BANK_SUBJECTS = ["physics", "chemistry", "mathematics", "botany", "zoology"];

// ── "Generate with AI" dialog ─────────────────────────────────
function AiGenerateDialog({ open, onClose, onSave }) {
  const [subjectId, setSubjectId] = useState("physics");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState(5);
  const [type, setType] = useState("mcq");
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");

  const chapters = chaptersFor(subjectId).map((c) => c.name);

  const generate = () => {
    setMessage("");
    const list = [];
    const chosen = chapter ? [chapter] : chapters.filter((c) => canGenerate(subjectId, c));
    for (let i = 0; i < count; i += 1) {
      const q = generateQuestion({ subjectId, chapters: chosen, type, examId: "jee-main" });
      if (q) list.push({ ...q, examIds: type === "numerical" ? ["jee-main"] : EXAMS.filter((e) => e.subjects.some((s) => s.subjectId === subjectId || (s.subjectId === "biology" && ["botany", "zoology"].includes(subjectId)))).map((e) => e.id) });
    }
    if (!list.length) setMessage("The offline demo AI has no templates for this subject/chapter. Connect the backend AI (VITE_USE_MOCK=false) to generate any chapter.");
    setDrafts(list);
    setSelected(list.map((q) => q.id));
  };

  const close = () => {
    setDrafts([]);
    setMessage("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Generate questions with AI"
      description="Preview AI-written questions, then add the ones you like to the bank."
      size="lg"
      footer={drafts.length ? (
        <>
          <Button variant="secondary" onClick={generate} icon={Sparkles}>Regenerate</Button>
          <Button onClick={() => { onSave(drafts.filter((d) => selected.includes(d.id))); close(); }} disabled={!selected.length}>
            Add {selected.length} to bank
          </Button>
        </>
      ) : null}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Select id="ai-subject" label="Subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapter(""); }} options={BANK_SUBJECTS.map((id) => ({ value: id, label: SUBJECTS[id].name }))} />
        <Select id="ai-chapter" label="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Any chapter" options={chapters} className="sm:col-span-2" />
        <Select id="ai-count" label="How many" value={count} onChange={(e) => setCount(Number(e.target.value))} options={[3, 5, 10].map((n) => ({ value: n, label: String(n) }))} />
        <Select id="ai-type" label="Type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "mcq", label: "MCQ" }, { value: "numerical", label: "Numerical" }]} />
        <div className="flex items-end sm:col-span-3">
          <Button icon={Sparkles} onClick={generate}>Generate</Button>
        </div>
      </div>

      {message && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}

      {drafts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {drafts.map((q) => (
            <li key={q.id}>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={selected.includes(q.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, q.id] : s.filter((id) => id !== q.id)))} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block text-slate-800">{q.text}</span>
                  {q.type === "mcq" ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      {q.options.map((o, i) => <span key={i} className={`mr-3 ${i === q.answer ? "font-semibold text-green-700" : ""}`}>({optionLetter(i)}) {o}</span>)}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs font-semibold text-green-700">Answer: {q.answer}</span>
                  )}
                  <span className="mt-1.5 flex gap-1.5"><Badge>{q.chapter}</Badge><Badge color={DIFFICULTY_COLOR[q.difficulty]}>{q.difficulty}</Badge></span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function QuestionBank() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [result, setResult] = useState(null); // { items, total } for the current page
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState({ search: "", subjectId: "", examId: "", difficulty: "", type: "", chapter: "" });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  const chapterOptions = useSubjectChapters(filters.subjectId).map((c) => c.name);

  // Server-side search & paging (the real bank has ~80,000 questions); typing is debounced.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setError("");
      searchQuestions({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
        .then((r) => alive && setResult(r))
        .catch((err) => {
          if (!alive) return;
          setError(err.message);
          setResult({ items: [], total: 0 });
        });
    }, filters.search ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters, page, reload]);

  useEffect(() => {
    bankStats().then(setStats).catch(() => setStats(null));
  }, [reload]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value, ...(key === "subjectId" ? { chapter: "" } : {}) }));
    setPage(1);
  };

  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = result?.items ?? [];
  // With the shared Supabase bank only admins change or delete questions.
  const canModify = (q) => isAdmin || (USE_MOCK && q.createdBy === user.id);

  const handleCreate = async (data) => {
    await createQuestion(data, user);
    setReload((n) => n + 1);
    setFormOpen(false);
    toast.success(USE_MOCK ? "Question added to bank" : "Question added to the bank (pending review)");
  };

  const handleUpdate = async (data) => {
    const updated = await updateQuestion(editing.id, data);
    setResult((r) => ({ ...r, items: r.items.map((q) => (q.id === updated.id ? updated : q)) }));
    setEditing(null);
    toast.success("Question updated");
  };

  const handleDelete = async () => {
    await deleteQuestion(toDelete.id);
    setReload((n) => n + 1);
    setToDelete(null);
    toast.success("Question deleted");
  };

  const handleAiSave = async (drafts) => {
    const created = [];
    for (const d of drafts) created.push(await createQuestion({ ...d, source: "ai" }, user));
    setReload((n) => n + 1);
    toast.success(`${created.length} AI question${created.length > 1 ? "s" : ""} added`);
  };

  const counts = stats ? BANK_SUBJECTS.map((id) => ({ id, n: stats.bySubject?.[id] ?? 0 })) : [];

  return (
    <>
      <PageHeader
        title="Question bank"
        subtitle="Questions here are used first when generating papers. AI fills any gaps."
        actions={
          <>
            <Button variant="secondary" icon={Sparkles} onClick={() => setAiOpen(true)}>Generate with AI</Button>
            <Button icon={Plus} onClick={() => setFormOpen(true)}>Add question</Button>
          </>
        }
      />

      {stats && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter("subjectId", "")} className={`rounded-full px-3 py-1 text-sm font-medium ${!filters.subjectId ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            All <span className="opacity-75">{stats.total.toLocaleString("en-IN")}</span>
          </button>
          {counts.map(({ id, n }) => (
            <button key={id} type="button" onClick={() => setFilter("subjectId", id)} className={`rounded-full px-3 py-1 text-sm font-medium ${filters.subjectId === id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {SUBJECTS[id].name} <span className="opacity-75">{n.toLocaleString("en-IN")}</span>
            </button>
          ))}
        </div>
      )}

      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-5">
          <SearchInput value={filters.search} onChange={(v) => setFilter("search", v)} placeholder="Search text, chapter or ID" className="md:col-span-2" />
          <Select value={filters.chapter} onChange={(e) => setFilter("chapter", e.target.value)} placeholder="All chapters" options={filters.subjectId ? chapterOptions : []} disabled={!filters.subjectId} aria-label="Filter by chapter" />
          <Select value={filters.examId} onChange={(e) => setFilter("examId", e.target.value)} placeholder="All exams" options={EXAMS.map((e) => ({ value: e.id, label: e.name }))} aria-label="Filter by exam" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={filters.difficulty} onChange={(e) => setFilter("difficulty", e.target.value)} disabled={!USE_MOCK} title={USE_MOCK ? undefined : "The question bank does not record difficulty"} placeholder="Level" options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} aria-label="Filter by difficulty" />
            <Select value={filters.type} onChange={(e) => setFilter("type", e.target.value)} placeholder="Type" options={[{ value: "mcq", label: "MCQ" }, { value: "numerical", label: "Numerical" }]} aria-label="Filter by type" />
          </div>
        </div>

        {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        {!result ? (
          <Loader />
        ) : !pageItems.length ? (
          <EmptyState icon={Library} title="No questions found" message="Change the filters or add a new question." action={<Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Add question</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {pageItems.map((q) => (
                <li key={q.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => setExpanded(expanded === q.id ? null : q.id)} className="mt-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Toggle details" aria-expanded={expanded === q.id}>
                      <ChevronDown className={`h-4 w-4 transition ${expanded === q.id ? "rotate-180" : ""}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <RichText as="div" text={q.text} className={`text-sm text-slate-800 ${expanded === q.id ? "" : "line-clamp-3"}`} />
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-400">{q.id}</span>
                        <Badge color="slate">{SUBJECTS[q.subjectId]?.name}</Badge>
                        <Badge>{q.chapter}</Badge>
                        {q.concept && <Badge color="slate" className="font-normal">{q.concept}</Badge>}
                        {q.difficulty && <Badge color={DIFFICULTY_COLOR[q.difficulty]}>{q.difficulty}</Badge>}
                        {q.type === "numerical" && <Badge color="cyan">Numerical</Badge>}
                        {q.format === "assertion_reason" && <Badge color="indigo">Assertion–Reason</Badge>}
                        {q.reviewStatus === "pending" && <Badge color="amber">Pending review</Badge>}
                        {q.source === "ai" && <Badge color="pink">AI</Badge>}
                        <span className="text-[11px] text-slate-400">{q.examIds?.map((id) => getExam(id)?.name).join(" · ")}</span>
                      </div>
                      {expanded === q.id && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                          {q.type === "mcq" ? (
                            <ol className="grid gap-1 sm:grid-cols-2">
                              {q.options.map((o, i) => (
                                <li key={i} className={i === Number(q.answer) ? "font-semibold text-green-700" : "text-slate-700"}>({optionLetter(i)}) <RichText text={o} />{i === Number(q.answer) ? " ✓" : ""}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="font-semibold text-green-700">Answer: {q.answer}</p>
                          )}
                          {q.solution && <div className="mt-2 text-slate-600"><b>Solution:</b> <RichText as="div" text={q.solution} /></div>}
                        </div>
                      )}
                    </div>
                    {canModify(q) && (
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(q)} aria-label="Edit question" title="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(q)} aria-label="Delete question" title="Delete" className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString("en-IN")}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="tabular-nums">{page} / {pages}</span>
                <Button size="icon" variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add question" size="lg">
        {formOpen && <QuestionForm submitLabel="Add question" onCancel={() => setFormOpen(false)} onSubmit={handleCreate} />}
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit question" size="lg">
        {editing && <QuestionForm key={editing.id} initial={editing} onCancel={() => setEditing(null)} onSubmit={handleUpdate} />}
      </Modal>
      <ConfirmDialog open={Boolean(toDelete)} title="Delete question?" message="This removes it from the bank. Papers that already use it keep their copy." onCancel={() => setToDelete(null)} onConfirm={handleDelete} />
      <AiGenerateDialog open={aiOpen} onClose={() => setAiOpen(false)} onSave={handleAiSave} />
    </>
  );
}
