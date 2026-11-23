import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Download, Pencil, Eye, Layers, Plus, CircleCheck, TriangleAlert, Shuffle, Clock, Award, ListChecks, Database, Search, Cloud, LoaderCircle,
} from "lucide-react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge, { DIFFICULTY_COLOR, EXAM_COLOR } from "../components/ui/Badge";
import Tabs from "../components/ui/Tabs";
import Toggle from "../components/ui/Toggle";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import QuestionView from "../components/paper/QuestionView";
import QuestionForm from "../components/paper/QuestionForm";
import ExportDialog from "../components/paper/ExportDialog";
import { useToast } from "../context/ToastContext";
import { buildSets, getPaper, getSetView, paperTotals, regenerateQuestion, savePaper } from "../services/paperService";
import { defaultInstructions } from "../services/exportService";
import { getQuestionsSync } from "../services/questionService";
import { SET_LABELS, SUBJECT_SOURCES, getExam } from "../data/exams";
import { formatDate, optionLetter, uid } from "../utils/helpers";

// ── Add-question dialog: pick from bank or write a new one ─────
function AddQuestionDialog({ open, onClose, section, paper, onAdd }) {
  const [tab, setTab] = useState("bank");
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    if (!section) return [];
    const sources = SUBJECT_SOURCES[section.subjectId] ?? [section.subjectId];
    const used = new Set(paper.questions.map((q) => q.bankId).filter(Boolean));
    const term = search.trim().toLowerCase();
    return getQuestionsSync().filter(
      (q) =>
        sources.includes(q.subjectId) &&
        !used.has(q.id) &&
        (paper.examId !== "neet-ug" && paper.examId !== "kcet" ? true : q.type === "mcq") &&
        (!term || q.text.toLowerCase().includes(term) || q.chapter.toLowerCase().includes(term))
    );
  }, [section, paper, search]);

  if (!section) return null;
  const sources = SUBJECT_SOURCES[section.subjectId] ?? [section.subjectId];

  return (
    <Modal open={open} onClose={onClose} title={`Add question · ${section.name}`} size="lg">
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: "bank", label: "From question bank", count: candidates.length }, { value: "new", label: "Write new" }]} />
      {tab === "bank" ? (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question or chapter" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100" />
          </div>
          {candidates.length ? (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {candidates.map((q) => (
                <li key={q.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{q.text}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge>{q.chapter}</Badge>
                      <Badge color={DIFFICULTY_COLOR[q.difficulty]}>{q.difficulty}</Badge>
                      {q.type === "numerical" && <Badge color="cyan">Numerical</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="soft" icon={Plus} onClick={() => onAdd({ ...q, bankId: q.id })}>Add</Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Database} title="No unused bank questions" message="Write a new one instead, or add more to the question bank." />
          )}
        </>
      ) : (
        <QuestionForm
          initial={{ subjectId: sources[0], examIds: [paper.examId], type: "mcq" }}
          subjectOptions={sources}
          submitLabel="Add to paper"
          onCancel={onClose}
          onSubmit={(data) => onAdd({ ...data, source: "manual" })}
        />
      )}
    </Modal>
  );
}

// ── Regenerate-sets dialog ─────────────────────────────────────
function SetsDialog({ open, onClose, paper, onApply }) {
  const [count, setCount] = useState(paper.sets.length);
  const [shuffleQuestions, setShuffleQuestions] = useState(paper.config?.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState(paper.config?.shuffleOptions ?? true);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Paper sets"
      description="Rebuilds sets B–H with a new random order. Set A keeps the master order."
      size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Shuffle} onClick={() => onApply(count, { shuffleQuestions, shuffleOptions })}>Rebuild sets</Button></>}
    >
      <p className="mb-2 text-sm font-medium text-slate-700">Number of sets</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {SET_LABELS.map((label, i) => (
          <button key={label} type="button" onClick={() => setCount(i + 1)} className={`h-10 w-10 rounded-lg border text-sm font-bold ${count === i + 1 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-600"}`}>{i + 1}</button>
        ))}
      </div>
      <div className="space-y-4 rounded-xl bg-slate-50 p-3">
        <Toggle id="sd-q" checked={shuffleQuestions} onChange={setShuffleQuestions} label="Shuffle question order" />
        <Toggle id="sd-o" checked={shuffleOptions} onChange={setShuffleOptions} label="Shuffle MCQ options" />
      </div>
    </Modal>
  );
}

export default function PaperPreview() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");
  const [setLabel, setSetLabel] = useState("A");
  const [editMode, setEditMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);

  useEffect(() => {
    getPaper(paperId).then(setPaper).catch((err) => setError(err.message));
  }, [paperId]);

  // Every change is saved immediately (auto-save).
  const commit = useCallback(async (next, message) => {
    setPaper(next);
    setSaving(true);
    try {
      const saved = await savePaper(next);
      setPaper(saved);
      if (message) toast.success(message);
    } catch (err) {
      toast.error(err.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  }, [toast]);

  const view = useMemo(() => (paper ? getSetView(paper, setLabel) : []), [paper, setLabel]);

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Paper not found" message={error} action={<Button onClick={() => navigate("/papers")}>Back to papers</Button>} />;
  }
  if (!paper) return <Loader label="Loading paper…" />;

  const exam = getExam(paper.examId);
  const { questions: totalQ, marks } = paperTotals(paper);
  const drafts = paper.questions.filter((q) => q.needsReview).length;
  const instructions = paper.instructions?.trim() ? paper.instructions.split("\n").filter(Boolean) : defaultInstructions(paper);

  // ── mutations ──
  const replaceQuestion = (id, data) => ({
    ...paper,
    questions: paper.questions.map((q) => (q.id === id ? { ...q, ...data, id, sectionId: q.sectionId, marks: q.marks, negative: q.negative } : q)),
  });

  const handleEditSave = async (data) => {
    await commit(replaceQuestion(editing.id, data), "Question updated");
    setEditing(null);
  };

  const handleDelete = async () => {
    const id = deleting.id;
    const next = {
      ...paper,
      questions: paper.questions.filter((q) => q.id !== id),
      sets: paper.sets.map((s) => {
        const { [id]: _removed, ...optionOrder } = s.optionOrder;
        return { ...s, order: s.order.filter((qid) => qid !== id), optionOrder };
      }),
    };
    setDeleting(null);
    await commit(next, "Question removed");
  };

  const handleRegenerate = async (q) => {
    setBusyId(q.id);
    try {
      const fresh = await regenerateQuestion(paper, q.id);
      await commit(replaceQuestion(q.id, fresh), "Question regenerated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async (data) => {
    const id = uid("PQ");
    const question = { ...data, id, sectionId: addingTo.subjectId, marks: exam.marking.correct, negative: exam.marking.incorrect };
    const next = {
      ...paper,
      questions: [...paper.questions, question],
      sets: paper.sets.map((s) => ({ ...s, order: [...s.order, id], optionOrder: { ...s.optionOrder, [id]: question.options.map((_, i) => i) } })),
    };
    setAddingTo(null);
    await commit(next, "Question added to all sets");
  };

  const handleRebuildSets = async (count, opts) => {
    const next = { ...paper, config: { ...paper.config, ...opts, setCount: count }, sets: buildSets(paper, count, opts) };
    setSetsOpen(false);
    if (!next.sets.some((s) => s.label === setLabel)) setSetLabel("A");
    await commit(next, `${count} set${count > 1 ? "s" : ""} ready`);
  };

  const toggleStatus = () => commit({ ...paper, status: paper.status === "final" ? "draft" : "final" }, paper.status === "final" ? "Moved back to draft" : "Marked as final");

  const allViewQuestions = view.flatMap((s) => s.questions);

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4">
        <Link to="/papers" className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All papers
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge color={EXAM_COLOR[paper.examId]}>{exam.name}</Badge>
              <Badge color={paper.status === "final" ? "green" : "slate"}>{paper.status}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                {saving ? <><LoaderCircle className="h-3 w-3 animate-spin" />Saving…</> : <><Cloud className="h-3 w-3" />Saved</>}
              </span>
            </div>
            {editMode ? (
              <input
                defaultValue={paper.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== paper.title && commit({ ...paper, title: e.target.value.trim() }, "Title updated")}
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-2xl font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                aria-label="Paper title"
              />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{paper.title}</h1>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><ListChecks className="h-4 w-4" />{totalQ} questions</span>
              <span className="inline-flex items-center gap-1"><Award className="h-4 w-4" />{marks} marks</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{paper.durationMinutes} min</span>
              <span className="inline-flex items-center gap-1"><Layers className="h-4 w-4" />{paper.sets.length} sets</span>
              <span>by {paper.createdBy.name} · {formatDate(paper.createdAt)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={editMode ? "soft" : "secondary"} icon={editMode ? Eye : Pencil} onClick={() => setEditMode((m) => !m)}>
              {editMode ? "Done editing" : "Edit paper"}
            </Button>
            <Button variant="secondary" icon={Shuffle} onClick={() => setSetsOpen(true)}>Sets</Button>
            <Button variant="secondary" icon={CircleCheck} onClick={toggleStatus}>{paper.status === "final" ? "Mark draft" : "Mark final"}</Button>
            <Button icon={Download} onClick={() => setExportOpen(true)}>Export</Button>
          </div>
        </div>
      </div>

      {drafts > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <b>{drafts}</b> question{drafts > 1 ? "s are" : " is a"} placeholder draft{drafts > 1 ? "s" : ""} — your question bank didn&apos;t have enough questions for the selected chapters. Edit them, regenerate, or connect the AI backend.
          </span>
          {!editMode && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditMode(true)}>Review now</Button>}
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-sm font-medium text-slate-500">Set</span>
          <Tabs value={setLabel} onChange={setSetLabel} tabs={paper.sets.map((s) => ({ value: s.label, label: s.label }))} />
        </div>
        <div className="flex flex-wrap gap-5">
          <Toggle id="pv-ans" checked={showAnswers} onChange={setShowAnswers} label="Show answers" />
          <Toggle id="pv-sol" checked={showSolutions} onChange={setShowSolutions} label="Show solutions" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        {/* Paper sheet */}
        <div className="min-w-0 xl:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="paper-sheet border-b-2 border-slate-900 px-4 py-5 text-center sm:px-8">
              {paper.institute && <p className="text-lg font-bold uppercase tracking-wide">{paper.institute}</p>}
              <p className="text-base font-semibold">{paper.title}</p>
              <p className="text-sm text-slate-600">{exam.fullName}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>Time: <b>{paper.durationMinutes} min</b></span>
                <span>Max. Marks: <b>{marks}</b></span>
                <span className="rounded border-2 border-slate-900 px-3 py-0.5 font-bold">SET {setLabel}</span>
              </div>
            </div>

            <div className="paper-sheet mx-4 mt-4 rounded-lg border border-slate-300 px-4 py-3 text-sm sm:mx-8">
              <p className="mb-1 font-bold">Instructions</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-slate-700">
                {instructions.map((line) => <li key={line}>{line}</li>)}
              </ol>
            </div>

            <div className="sticky top-16 z-10 mt-4 flex gap-2 overflow-x-auto border-y border-slate-100 bg-white/95 px-4 py-2 backdrop-blur sm:px-8">
              {view.map((section, i) => (
                <a key={section.subjectId} href={`#section-${section.subjectId}`} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                  Part {String.fromCharCode(65 + i)} · {section.name} ({section.questions.length})
                </a>
              ))}
            </div>

            <div className="px-2 pb-6 sm:px-4">
              {view.map((section, i) => (
                <section key={section.subjectId} id={`section-${section.subjectId}`} className="scroll-mt-32">
                  <div className="mx-2 mb-2 mt-6 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2 sm:mx-4">
                    <h2 className="paper-sheet font-bold uppercase">Part {String.fromCharCode(65 + i)} – {section.name}</h2>
                    {editMode && <Button size="sm" variant="soft" icon={Plus} onClick={() => setAddingTo(section)}>Add question</Button>}
                  </div>
                  {section.questions.length ? (
                    section.questions.map((q) => (
                      <QuestionView
                        key={q.id}
                        question={q}
                        showAnswers={showAnswers}
                        showSolutions={showSolutions}
                        editMode={editMode}
                        busy={busyId === q.id}
                        onEdit={() => setEditing(paper.questions.find((x) => x.id === q.id))}
                        onRegenerate={handleRegenerate}
                        onDelete={setDeleting}
                      />
                    ))
                  ) : (
                    <p className="px-6 py-4 text-sm text-slate-500">No questions in this section.</p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel: answer key + composition */}
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card title={`Answer key · Set ${setLabel}`} bodyClassName="p-4">
            <div className="grid max-h-[340px] grid-cols-5 gap-1.5 overflow-y-auto text-center text-xs">
              {allViewQuestions.map((q) => (
                <div key={q.id} className={`rounded-md border py-1 ${q.needsReview ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                  <span className="block text-[10px] text-slate-400">{q.number}</span>
                  <span className="font-bold text-slate-900">{q.type === "mcq" ? optionLetter(q.correctIndex) : q.answer}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Composition" bodyClassName="p-4">
            <ul className="space-y-2 text-sm">
              {view.map((s) => (
                <li key={s.subjectId} className="flex justify-between"><span className="text-slate-600">{s.name}</span><span className="font-semibold tabular-nums">{s.questions.length}</span></li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <p>Easy {paper.questions.filter((q) => q.difficulty === "easy").length} · Medium {paper.questions.filter((q) => q.difficulty === "medium").length} · Hard {paper.questions.filter((q) => q.difficulty === "hard").length}</p>
              <p>From bank {paper.stats?.fromBank ?? 0} · AI {paper.stats?.aiGenerated ?? 0} · Drafts {drafts}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit question" size="lg">
        {editing && (
          <QuestionForm
            key={editing.id}
            initial={editing}
            lockSubject
            subjectOptions={[editing.subjectId]}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={handleEditSave}
          />
        )}
      </Modal>

      <AddQuestionDialog open={Boolean(addingTo)} onClose={() => setAddingTo(null)} section={addingTo} paper={paper} onAdd={handleAdd} />

      <ConfirmDialog open={Boolean(deleting)} title="Remove question?" message="It will be removed from every set of this paper. The question bank is not affected." confirmLabel="Remove" onCancel={() => setDeleting(null)} onConfirm={handleDelete} />

      {setsOpen && <SetsDialog open onClose={() => setSetsOpen(false)} paper={paper} onApply={handleRebuildSets} />}

      {exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} paper={paper} initialSet={setLabel} onExported={(f) => toast.info(f === "pdf" ? "Print dialog opened — choose “Save as PDF”." : "Word file downloaded.")} />}
    </>
  );
}
