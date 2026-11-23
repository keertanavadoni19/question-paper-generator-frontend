import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Download, Pencil, Eye, Layers, Plus, CircleCheck, TriangleAlert, Shuffle, Clock, Award, ListChecks, Database, Search, Cloud, LoaderCircle,
  ArrowUp, ArrowDown, Copy, RefreshCw, SlidersHorizontal, Trash2, X,
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
import QuestionForm from "../components/paper/QuestionForm";
import ExportDialog from "../components/paper/ExportDialog";
import DocumentPreview from "../components/paper/DocumentPreview";
import EditorToolbar from "../components/paper/EditorToolbar";
import InlineQuestionEditor from "../components/paper/InlineQuestionEditor";
import SectionSettingsDialog from "../components/paper/SectionSettingsDialog";
import FindReplaceDialog from "../components/paper/FindReplaceDialog";
import BlockDialog, { newBlock } from "../components/paper/BlockDialog";
import { useToast } from "../context/ToastContext";
import {
  buildSets, duplicateQuestion, getPaper, getSetView, moveQuestion, numberingOf, paperTotals, regenerateQuestion, removeQuestion, savePaper, stepQuestion, updateQuestion,
} from "../services/paperService";
import { defaultInstructions } from "../services/exportService";
import { getLayout, pageMetrics, MM_TO_PX } from "../services/paperLayout";
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

// ── Instructions dialog ────────────────────────────────────────
function InstructionsDialog({ paper, onSave, onClose }) {
  const [text, setText] = useState(paper.instructions?.trim() ? paper.instructions : defaultInstructions(paper).join("\n"));
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Instructions"
      description="One instruction per line. They are shown in the box below the paper header."
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => onSave("")}>Use standard instructions</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(text.trim())}>Save</Button>
        </>
      }
    >
      <textarea autoFocus rows={9} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100" />
    </Modal>
  );
}

const HISTORY_LIMIT = 60;
const BLOCK_LABELS = { pageBreak: "Page break", hr: "Horizontal line", table: "Table", text: "Text", image: "Image" };

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
  const [exportFormat, setExportFormat] = useState(null);
  const [setsOpen, setSetsOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [blockDialog, setBlockDialog] = useState(null); // { block, anchor, index }

  const [tab, setTab] = useState("edit");
  const [selection, setSelection] = useState(null); // { type: question|section|block, id }
  const [inlineId, setInlineId] = useState(null);
  const [zoomMode, setZoomMode] = useState("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const paperRef = useRef(null);
  const past = useRef([]);
  const future = useRef([]);
  const lastGroup = useRef({ key: null, at: 0 });
  const saveTimer = useRef(null);
  const [, setHistoryTick] = useState(0);
  const viewport = useRef(null);
  const shell = useRef(null);

  useEffect(() => {
    getPaper(paperId).then((p) => { paperRef.current = p; setPaper(p); }).catch((err) => setError(err.message));
  }, [paperId]);

  // Saves shortly after the last change (several quick edits = one save).
  const persist = useCallback((next) => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await savePaper(next);
        if (paperRef.current === next) {
          paperRef.current = saved;
          setPaper(saved);
        }
      } catch (err) {
        toast.error(err.message || "Could not save changes");
      } finally {
        setSaving(false);
      }
    }, 450);
  }, [toast]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Applies a change: updates the preview at once, records undo history and auto-saves.
  // Changes with the same `group` within 1.5 s (typing, colour dragging) form one undo step.
  const commit = useCallback((next, message, { group } = {}) => {
    const prev = paperRef.current;
    if (!prev || next === prev) return;
    const now = Date.now();
    const merge = group && lastGroup.current.key === group && now - lastGroup.current.at < 1500;
    if (!merge) {
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), prev];
      future.current = [];
    }
    lastGroup.current = { key: group ?? null, at: now };
    paperRef.current = next;
    setPaper(next);
    setHistoryTick((n) => n + 1);
    persist(next);
    if (message) toast.success(message);
  }, [persist, toast]);

  const restore = useCallback((from, to) => {
    if (!from.current.length || !paperRef.current) return;
    const target = from.current[from.current.length - 1];
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, paperRef.current];
    lastGroup.current = { key: null, at: 0 };
    paperRef.current = target;
    setPaper(target);
    setInlineId(null);
    setHistoryTick((n) => n + 1);
    persist(target);
  }, [persist]);
  const undo = useCallback(() => restore(past, future), [restore]);
  const redo = useCallback(() => restore(future, past), [restore]);

  // Keyboard shortcuts (not while typing in a field)
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "h") { e.preventDefault(); setFindOpen(true); return; }
      if (typing) return;
      if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (key === "y" || (key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Fit-to-width zoom follows the preview's width
  const layout = useMemo(() => (paper ? getLayout(paper) : null), [paper]);
  const pageWidthPx = layout ? pageMetrics(layout).width * MM_TO_PX : 800;
  const loaded = paper !== null;
  useEffect(() => {
    const el = viewport.current;
    if (!el) return undefined;
    const update = () => setFitZoom(Math.max(0.3, Math.min(1.5, (el.clientWidth - 32) / pageWidthPx)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidthPx, loaded, fullscreen]);
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const stepZoom = (d) => setZoomMode(Math.round(Math.max(0.3, Math.min(2, zoom + d)) * 10) / 10);

  // Full screen: overlay, plus the browser's full-screen mode where available
  const toggleFullscreen = () => {
    if (fullscreen) {
      if (document.fullscreenElement) document.exitFullscreen?.();
      setFullscreen(false);
    } else {
      setFullscreen(true);
      shell.current?.requestFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keep the selected block in view (e.g. after "Show" in find & replace)
  useEffect(() => {
    if (!selection) return;
    requestAnimationFrame(() => document.querySelector(".qp-sel.is-selected")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [selection]);

  const view = useMemo(() => (paper ? getSetView(paper, setLabel) : []), [paper, setLabel]);

  if (error) {
    return <EmptyState icon={TriangleAlert} title="Paper not found" message={error} action={<Button onClick={() => navigate("/papers")}>Back to papers</Button>} />;
  }
  if (!paper) return <Loader label="Loading paper…" />;

  const exam = getExam(paper.examId);
  const { questions: totalQ, marks } = paperTotals(paper);
  const drafts = paper.questions.filter((q) => q.needsReview).length;
  const allViewQuestions = view.flatMap((s) => s.questions);
  const numberOf = (id) => allViewQuestions.find((q) => q.id === id)?.number;
  const { scope } = numberingOf(paper);

  // ── mutations ──
  const onLayout = (fn, group) => commit({ ...paperRef.current, layout: fn(getLayout(paperRef.current)) }, null, { group });

  const handleEditSave = (data) => {
    commit(updateQuestion(paper, editing.id, data), "Question updated");
    setEditing(null);
  };
  const handleInlineSave = (data) => {
    commit(updateQuestion(paper, inlineId, data), "Question updated");
    setInlineId(null);
  };
  const handleDelete = () => {
    const id = deleting.id;
    setDeleting(null);
    if (selection?.id === id) setSelection(null);
    commit(removeQuestion(paper, id), "Question removed from all sets");
  };
  const handleRegenerate = async (q) => {
    setBusyId(q.id);
    try {
      const fresh = await regenerateQuestion(paperRef.current, q.id);
      const { id: _id, sectionId: _s, ...data } = fresh;
      commit(updateQuestion(paperRef.current, q.id, data), "Question regenerated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };
  const handleAdd = (data) => {
    const id = uid("PQ");
    const existing = paper.questions.find((q) => q.sectionId === addingTo.subjectId);
    const question = { ...data, id, sectionId: addingTo.subjectId, marks: existing?.marks ?? exam.marking.correct, negative: existing?.negative ?? exam.marking.incorrect };
    const next = {
      ...paper,
      questions: [...paper.questions, question],
      sets: paper.sets.map((s) => ({ ...s, order: [...s.order, id], optionOrder: { ...s.optionOrder, [id]: question.options.map((_, i) => i) } })),
    };
    setAddingTo(null);
    setSelection({ type: "question", id });
    commit(next, "Question added to all sets");
  };
  const handleRebuildSets = (count, opts) => {
    const next = { ...paper, config: { ...paper.config, ...opts, setCount: count }, sets: buildSets(paper, count, opts) };
    setSetsOpen(false);
    if (!next.sets.some((s) => s.label === setLabel)) setSetLabel("A");
    commit(next, `${count} set${count > 1 ? "s" : ""} ready`);
  };
  const toggleStatus = () => commit({ ...paper, status: paper.status === "final" ? "draft" : "final" }, paper.status === "final" ? "Moved back to draft" : "Marked as final");

  const moveSection = (index, step) => {
    const sections = [...paper.sections];
    const [moved] = sections.splice(index, 1);
    sections.splice(index + step, 0, moved);
    commit({ ...paper, sections }, null, {});
  };
  const applyMarks = (sectionId, plus, minus) =>
    commit({ ...paper, questions: paper.questions.map((q) => (q.sectionId === sectionId ? { ...q, marks: plus, negative: minus } : q)) }, "Marks updated");

  // Inserted blocks go after the selected question / section heading / block, else at the end.
  const blocks = layout.blocks ?? [];
  const insertPoint = () => {
    if (selection?.type === "question") return { anchor: `q:${selection.id}`, index: blocks.length };
    if (selection?.type === "section") return { anchor: `section:${selection.id}`, index: blocks.length };
    if (selection?.type === "block") {
      const i = blocks.findIndex((b) => b.id === selection.id);
      if (i >= 0) return { anchor: blocks[i].after, index: i + 1 };
    }
    return { anchor: "end", index: blocks.length };
  };
  const insertTarget = selection?.type === "question" ? `after Q${numberOf(selection.id)}`
    : selection?.type === "section" ? "at start of section"
      : selection?.type === "block" ? "after selected item" : "at end of paper";
  const addBlock = (data, { anchor, index }) => {
    const block = { ...data, id: uid("blk"), after: anchor };
    onLayout((l) => ({ ...l, blocks: [...l.blocks.slice(0, index), block, ...l.blocks.slice(index)] }));
    setSelection({ type: "block", id: block.id });
    if (!editMode) setEditMode(true);
    toast.success(`${BLOCK_LABELS[data.type]} inserted ${insertTarget}`);
  };
  const onInsert = (type) => {
    const point = insertPoint();
    if (type === "pageBreak" || type === "hr") addBlock({ type }, point);
    else setBlockDialog({ block: newBlock(type), ...point });
  };
  const saveBlock = (data) => {
    if (blockDialog.block.id) onLayout((l) => ({ ...l, blocks: l.blocks.map((b) => (b.id === data.id ? data : b)) }));
    else addBlock(data, blockDialog);
    setBlockDialog(null);
  };
  const deleteBlock = (id) => {
    onLayout((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== id) }));
    setSelection(null);
  };

  const activate = (sel) => {
    setSelection(sel);
    if (sel.type === "question") setInlineId(sel.id);
    if (sel.type === "section") setSectionsOpen(true);
    if (sel.type === "block") {
      const b = blocks.find((x) => x.id === sel.id);
      if (b && ["table", "text", "image"].includes(b.type)) setBlockDialog({ block: b });
    }
  };

  const selectedQuestion = selection?.type === "question" ? paper.questions.find((q) => q.id === selection.id) : null;
  const selectedSection = selection?.type === "section" ? paper.sections.find((s) => s.subjectId === selection.id) : null;
  const selectedBlock = selection?.type === "block" ? blocks.find((b) => b.id === selection.id) : null;
  const sectionIds = selectedQuestion ? view.find((s) => s.subjectId === selectedQuestion.sectionId)?.questions.map((q) => q.id) ?? [] : [];
  const selectedIndex = selectedQuestion ? sectionIds.indexOf(selectedQuestion.id) : -1;

  const selectionBar = editMode && (selectedQuestion || selectedSection || selectedBlock) && (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
      {selectedQuestion && (
        <>
          <span className="mr-1 font-semibold text-indigo-900">Q{numberOf(selectedQuestion.id)} selected</span>
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setInlineId(selectedQuestion.id)}>Edit</Button>
          <Button size="sm" variant="ghost" icon={ArrowUp} disabled={selectedIndex <= 0} onClick={() => commit(stepQuestion(paper, setLabel, selectedQuestion.id, -1))}>Up</Button>
          <Button size="sm" variant="ghost" icon={ArrowDown} disabled={selectedIndex < 0 || selectedIndex >= sectionIds.length - 1} onClick={() => commit(stepQuestion(paper, setLabel, selectedQuestion.id, 1))}>Down</Button>
          <Button size="sm" variant="ghost" icon={Copy} onClick={() => commit(duplicateQuestion(paper, selectedQuestion.id), "Question duplicated in all sets")}>Duplicate</Button>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={busyId === selectedQuestion.id} loadingText="AI…" onClick={() => handleRegenerate(selectedQuestion)}>Regenerate</Button>
          <Button size="sm" variant="ghost" icon={SlidersHorizontal} onClick={() => setEditing(selectedQuestion)}>Details</Button>
          <Button size="sm" variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(selectedQuestion)}>Delete</Button>
        </>
      )}
      {selectedSection && (
        <>
          <span className="mr-1 font-semibold text-indigo-900">{selectedSection.name} section</span>
          <Button size="sm" variant="secondary" icon={Layers} onClick={() => setSectionsOpen(true)}>Section settings</Button>
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAddingTo(selectedSection)}>Add question</Button>
        </>
      )}
      {selectedBlock && (
        <>
          <span className="mr-1 font-semibold text-indigo-900">{BLOCK_LABELS[selectedBlock.type]} selected</span>
          {["table", "text", "image"].includes(selectedBlock.type) && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setBlockDialog({ block: selectedBlock })}>Edit</Button>}
          <Button size="sm" variant="ghost" icon={Trash2} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteBlock(selectedBlock.id)}>Remove</Button>
        </>
      )}
      <button type="button" onClick={() => setSelection(null)} className="ml-auto rounded p-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700" aria-label="Clear selection"><X className="h-4 w-4" /></button>
    </div>
  );

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
                key={paper.title}
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
            <Button variant={editMode ? "soft" : "secondary"} icon={editMode ? Eye : Pencil} onClick={() => { setEditMode((m) => !m); setInlineId(null); }}>
              {editMode ? "Done editing" : "Edit paper"}
            </Button>
            <Button variant="secondary" icon={Shuffle} onClick={() => setSetsOpen(true)}>Sets</Button>
            <Button variant="secondary" icon={CircleCheck} onClick={toggleStatus}>{paper.status === "final" ? "Mark draft" : "Mark final"}</Button>
            <Button icon={Download} onClick={() => setExportFormat("pdf")}>Export</Button>
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
        {/* Editor + document */}
        <div
          ref={shell}
          className={fullscreen ? "fixed inset-0 z-40 flex flex-col gap-3 overflow-hidden bg-slate-100 p-3" : "min-w-0 space-y-3 xl:col-span-3"}
        >
          <EditorToolbar
            layout={layout}
            onLayout={onLayout}
            tab={tab}
            onTab={setTab}
            editMode={editMode}
            onToggleEdit={() => { setEditMode((m) => !m); setInlineId(null); }}
            onOpenSections={() => setSectionsOpen(true)}
            onAddQuestion={setAddingTo}
            sections={paper.sections}
            canUndo={past.current.length > 0}
            canRedo={future.current.length > 0}
            onUndo={undo}
            onRedo={redo}
            onFind={() => setFindOpen(true)}
            zoomLabel={`${Math.round(zoom * 100)}%`}
            onZoomIn={() => stepZoom(0.1)}
            onZoomOut={() => stepZoom(-0.1)}
            onZoomFit={() => setZoomMode("fit")}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            insertTarget={insertTarget}
            onInsert={onInsert}
            onEditInstructions={() => setInstructionsOpen(true)}
            onExport={setExportFormat}
          />
          {selectionBar}
          <div ref={viewport} className={`overflow-auto rounded-2xl border border-slate-200 bg-slate-100 px-4 py-6 ${fullscreen ? "min-h-0 flex-1" : "max-h-[calc(100vh-7rem)]"}`}>
            <DocumentPreview
              paper={paper}
              setLabel={setLabel}
              showAnswers={showAnswers}
              showSolutions={showSolutions}
              editMode={editMode}
              zoom={zoom}
              selection={selection}
              onSelect={setSelection}
              onActivate={activate}
              onMove={(id, targetId, position) => commit(moveQuestion(paper, setLabel, id, targetId, position))}
              editingId={editMode ? inlineId : null}
              renderEditor={(qid) => {
                const q = paper.questions.find((x) => x.id === qid);
                return q && (
                  <InlineQuestionEditor
                    key={qid}
                    question={q}
                    number={numberOf(qid)}
                    onSave={handleInlineSave}
                    onCancel={() => setInlineId(null)}
                    onMore={() => { setInlineId(null); setEditing(q); }}
                  />
                );
              }}
            />
          </div>
        </div>

        {/* Side panel: answer key + composition */}
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card title={`Answer key · Set ${setLabel}`} bodyClassName="p-4">
            <div className="max-h-[340px] space-y-3 overflow-y-auto">
              {(scope === "section" ? view : [{ subjectId: "all", name: "", questions: allViewQuestions }]).map((group) => (
                <div key={group.subjectId}>
                  {group.name && <p className="mb-1 text-xs font-semibold text-slate-500">{group.name}</p>}
                  <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                    {group.questions.map((q) => (
                      <div key={q.id} className={`rounded-md border py-1 ${q.needsReview ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                        <span className="block text-[10px] text-slate-400">{q.number}</span>
                        <span className="font-bold text-slate-900">{q.type === "mcq" ? optionLetter(q.correctIndex) : q.answer}</span>
                      </div>
                    ))}
                  </div>
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

      {sectionsOpen && (
        <SectionSettingsDialog
          paper={paper}
          layout={layout}
          onClose={() => setSectionsOpen(false)}
          onLayout={onLayout}
          onMoveSection={moveSection}
          onApplyMarks={applyMarks}
          onAddQuestion={(s) => { setSectionsOpen(false); setAddingTo(s); }}
        />
      )}

      {findOpen && (
        <FindReplaceDialog
          paper={paper}
          setLabel={setLabel}
          onApply={(next, message) => commit(next, message)}
          onClose={() => setFindOpen(false)}
          onShow={(qid) => { setEditMode(true); setSelection({ type: "question", id: qid }); setFindOpen(false); }}
        />
      )}

      {instructionsOpen && (
        <InstructionsDialog
          paper={paper}
          onClose={() => setInstructionsOpen(false)}
          onSave={(text) => { commit({ ...paper, instructions: text }, "Instructions updated"); setInstructionsOpen(false); }}
        />
      )}

      {blockDialog && <BlockDialog block={blockDialog.block} onSave={saveBlock} onClose={() => setBlockDialog(null)} />}

      {exportFormat && (
        <ExportDialog
          open
          onClose={() => setExportFormat(null)}
          paper={paper}
          initialSet={setLabel}
          initialFormat={exportFormat}
          onExported={(f, err) => {
            if (err) toast.error(err.message || "Export failed");
            else toast.info(f === "word" ? "Word file downloaded." : f === "print" ? "Print dialog opened." : "Print dialog opened — choose “Save as PDF”.");
          }}
        />
      )}
    </>
  );
}
