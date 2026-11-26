import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check, CircleCheck, LoaderCircle, TriangleAlert, Search, ArrowLeft, ArrowRight, Zap, Pencil, Minus, Plus, FileText, GraduationCap, BookOpen,
  Layers, Hash, Award, Command, Cloud, Info,
} from "lucide-react";

import Modal from "../components/ui/Modal";
import Loader from "../components/ui/Loader";
import ManualQuestionPicker from "../components/generate/ManualQuestionPicker";
import PreviewSaveStep, { lastHeader } from "../components/generate/PreviewSaveStep";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EXAMS, EXAM_CATEGORY, SUBJECTS, SUBJECT_SOURCES, getExam } from "../data/exams";
import { getSyllabus } from "../services/syllabusService";
import { getQuestionsSync } from "../services/questionService";
import { GENERATION_STEPS, deletePaper, generatePaper, savePaper } from "../services/paperService";
import { USE_MOCK } from "../services/api";
import { allocate, splitByWeight } from "../shared/allocation.js";

const STEP_INFO = {
  subject: { title: "Subject", label: "Exam Pattern & Subject Selection" },
  chapters: { title: "Chapters", label: "Chapter Selection" },
  concepts: { title: "Concepts", label: "Concept & Sub-Topic Selection" },
  perChapter: { title: "Questions per Chapter", label: "Questions per Chapter" },
  perType: { title: "Questions per Type", label: "Questions per Type" },
  select: { title: "Select Questions", label: "Manual Question Selection" },
  preview: { title: "Preview & Save", label: "Preview & Save" },
};
const FLOWS = {
  auto: ["subject", "chapters", "concepts", "perChapter", "perType", "preview"],
  manual: ["subject", "chapters", "concepts", "select", "preview"],
};
const CLASS_OPTIONS = [
  ["both", "Both (Class 11 / PUC-I + Class 12 / PUC-II)"],
  ["11", "Class 11 / PUC-I"],
  ["12", "Class 12 / PUC-II"],
];
const CLASS_LABEL = { both: "Class 11 + 12", 11: "Class 11", 12: "Class 12" };
const CLASS_HEADER = { both: "11th & 12th", 11: "11th", 12: "12th" };
const KIND_LABEL = { mcq: "MCQ (single correct)", assertion_reason: "Assertion–Reason", numerical: "Numerical value" };
const WEIGHT = { high: 3, medium: 2, low: 1 };
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
const fmt = (n) => (n === Infinity ? "∞" : Number(n).toLocaleString("en-IN"));
const examKinds = (exam) => (exam.questionTypes.includes("numerical") ? ["mcq", "assertion_reason", "numerical"] : ["mcq", "assertion_reason"]);
const patternOf = (exam, sid) => exam.subjects.find((s) => s.subjectId === sid) ?? { mcq: 0, numerical: 0 };

function Stepper({ value, onChange, max = 999, label, invalid }) {
  return (
    <div className={`inline-flex items-center rounded-lg border ${invalid ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}>
      <button type="button" aria-label={`Fewer ${label}`} className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)}><Minus className="h-3.5 w-3.5" /></button>
      <input type="number" min={0} max={max} value={value} aria-label={label} onChange={(e) => onChange(clamp(Math.floor(Number(e.target.value) || 0), 0, max))} className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums text-slate-900 focus:outline-none" />
      <button type="button" aria-label={`More ${label}`} className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// Card with a round check (chapter / concept grids)
function PickCard({ selected, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-indigo-950 bg-indigo-950 text-white shadow-md" : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{title}</span>
        {subtitle && <span className={`mt-0.5 block truncate text-[11px] ${selected ? "text-indigo-200" : "text-slate-500"}`}>{subtitle}</span>}
      </span>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-white bg-white text-indigo-950" : "border-slate-300"}`}>
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

function SubjectSwitch({ subjects, value, onChange, badge }) {
  if (subjects.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {subjects.map((sid) => (
        <button key={sid} type="button" aria-pressed={value === sid} onClick={() => onChange(sid)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${value === sid ? "bg-indigo-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-indigo-300"}`}>
          {SUBJECTS[sid].name}{badge?.(sid) !== undefined && <span className="ml-1.5 opacity-70">{badge(sid)}</span>}
        </button>
      ))}
    </div>
  );
}

export default function GeneratePaper() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [examId, setExamId] = useState(params.get("exam") ?? "");
  const exam = getExam(examId);

  // ── Generation configuration (kept while moving between steps) ──
  const [mode, setMode] = useState(null); // "auto" | "manual"
  const [stepKey, setStepKey] = useState("subject");
  const [reached, setReached] = useState(0);
  const [title, setTitle] = useState("");
  const [classFilter, setClassFilter] = useState("both");
  const [subjects, setSubjects] = useState([]);
  const [syllabus, setSyllabus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [chapters, setChapters] = useState({}); // { sid: [names] }
  const [conceptSel, setConceptSel] = useState({}); // { sid: { chapter: [concepts] } } — empty = all concepts
  const [chapterCounts, setChapterCounts] = useState({});
  const [typeCounts, setTypeCounts] = useState({});
  const [typeTouched, setTypeTouched] = useState({});
  const [picked, setPicked] = useState({}); // { sid: [questions] } (Manual Fetch)
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [modePrompt, setModePrompt] = useState(null); // { examId, subjects }
  const [showErrors, setShowErrors] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [progress, setProgress] = useState(null);
  const [draft, setDraft] = useState(null); // { key, paper }
  const [saveState, setSaveState] = useState("saved");
  const draftRef = useRef(null);

  const flow = FLOWS[mode ?? "auto"];
  const stepIndex = flow.indexOf(stepKey);

  // Load chapters, concepts and counts for the chosen exam
  useEffect(() => {
    if (!exam) return undefined;
    let alive = true;
    setSyllabus(null);
    setLoadError("");
    getSyllabus(exam.id)
      .then((data) => alive && setSyllabus(Object.fromEntries(Object.entries(data).map(([sid, list]) => [sid, list.filter((c) => c.active !== false)]))))
      .catch((err) => alive && setLoadError(err.message || "Could not load the syllabus."));
    return () => { alive = false; };
  }, [exam]);

  const bank = useMemo(() => (USE_MOCK ? getQuestionsSync() : []), []);
  const inClass = (c) => classFilter === "both" || String(c.classLevel) === classFilter;
  const chapterList = (sid) => (syllabus?.[sid] ?? []).filter(inClass);
  const chapterByName = (sid, name) => (syllabus?.[sid] ?? []).find((c) => c.name === name);
  const chosen = (sid) => (chapters[sid] ?? []).filter((n) => chapterList(sid).some((c) => c.name === n));
  const conceptsOf = (sid, name) => conceptSel[sid]?.[name] ?? [];
  const resolved = (sid) => Object.fromEntries(chosen(sid).filter((n) => conceptsOf(sid, n).length).map((n) => [n, { mode: "manual", selected: conceptsOf(sid, n) }]));

  function availability(sid, name) {
    const ch = chapterByName(sid, name);
    const filter = conceptsOf(sid, name);
    const kinds = examKinds(exam);
    if (!USE_MOCK && ch?.counts) {
      const out = { mcq: 0, assertion_reason: 0, numerical: 0 };
      const src = filter.length ? filter.map((t) => ch.conceptCounts?.[t]).filter(Boolean) : [ch.counts];
      for (const c of src) for (const k of kinds) out[k] += c[k] ?? 0;
      return { ...out, total: kinds.reduce((s, k) => s + out[k], 0), unlimited: false };
    }
    const sources = SUBJECT_SOURCES[sid] ?? [sid];
    const inBank = bank.filter((q) => sources.includes(q.subjectId) && q.chapter === name && (!filter.length || filter.includes(q.concept))).length;
    return { mcq: Infinity, assertion_reason: Infinity, numerical: kinds.includes("numerical") ? Infinity : 0, total: Infinity, bank: inBank, unlimited: true };
  }
  const chapterBankCount = (sid, c) => (USE_MOCK ? bank.filter((q) => (SUBJECT_SOURCES[sid] ?? [sid]).includes(q.subjectId) && q.chapter === c.name).length : c.counts?.total ?? 0);

  const subjectTotal = (sid) => (mode === "manual" ? (picked[sid] ?? []).length : chosen(sid).reduce((s, n) => s + (chapterCounts[sid]?.[n] || 0), 0));
  const grandTotal = subjects.reduce((s, sid) => s + subjectTotal(sid), 0);
  const marksTotal = exam ? grandTotal * exam.marking.correct : 0;
  const patternTotal = (sid) => patternOf(exam, sid).mcq + patternOf(exam, sid).numerical;

  function defaultChapterCounts(sid) {
    const names = chosen(sid);
    const { counts } = splitByWeight(patternTotal(sid), names.map((n) => WEIGHT[chapterByName(sid, n)?.weightage] ?? 2), names.map((n) => availability(sid, n).total));
    return Object.fromEntries(names.map((n, i) => [n, counts[i]]));
  }
  function defaultTypeCounts(sid) {
    const total = subjectTotal(sid);
    const p = patternOf(exam, sid);
    const numerical = examKinds(exam).includes("numerical") && p.mcq + p.numerical ? Math.round((total * p.numerical) / (p.mcq + p.numerical)) : 0;
    return { mcq: total - numerical, assertion_reason: 0, numerical };
  }
  const typesFor = (sid) => (typeTouched[sid] && typeCounts[sid]) || defaultTypeCounts(sid);

  // ── validation ──
  function errorsFor(key) {
    const out = [];
    if (key === "subject") {
      if (!exam || !subjects.length) out.push("Click a subject block to choose the exam and subject.");
      else if (!mode) out.push("Choose Auto Fetch or Manual Fetch.");
      if (exam && !syllabus) out.push(loadError || "Loading the syllabus…");
    }
    if (key === "chapters") for (const sid of subjects) if (!chosen(sid).length) out.push(`${SUBJECTS[sid].name}: select at least one chapter.`);
    if (key === "perChapter") {
      for (const sid of subjects) {
        if (!subjectTotal(sid)) out.push(`${SUBJECTS[sid].name}: set at least one question.`);
        for (const n of chosen(sid)) {
          const want = chapterCounts[sid]?.[n] || 0;
          const a = availability(sid, n);
          if (want > a.total) out.push(`${SUBJECTS[sid].name} · ${n}: only ${fmt(a.total)} questions available for the chosen concepts (${want} requested).`);
        }
      }
    }
    if (key === "perType") {
      for (const sid of subjects) {
        const t = typesFor(sid);
        if (sum(t) !== subjectTotal(sid)) out.push(`${SUBJECTS[sid].name}: question types add up to ${sum(t)}, but you chose ${subjectTotal(sid)} questions.`);
        else if (!USE_MOCK) {
          const names = chosen(sid).filter((n) => (chapterCounts[sid]?.[n] || 0) > 0);
          const { shortages } = allocate(names.map((n) => chapterCounts[sid][n]), t, names.map((n) => availability(sid, n)));
          for (const [k, missing] of Object.entries(shortages)) out.push(`${SUBJECTS[sid].name}: ${missing} ${KIND_LABEL[k]} question${missing > 1 ? "s" : ""} can't be filled from the chosen chapters and concepts.`);
        }
      }
    }
    if (key === "select" && !grandTotal) out.push("Pick at least one question.");
    return out;
  }
  const stepErrors = errorsFor(stepKey);

  // ── navigation ──
  const goTo = (key) => {
    const target = flow.indexOf(key);
    for (let i = 0; i < target; i += 1) {
      if (errorsFor(flow[i]).length) {
        setStepKey(flow[i]);
        setShowErrors(true);
        return;
      }
    }
    if (key === "perChapter") {
      setChapterCounts((prev) => {
        const next = { ...prev };
        for (const sid of subjects) if (!next[sid] || !chosen(sid).some((n) => next[sid][n] > 0)) next[sid] = defaultChapterCounts(sid);
        return next;
      });
    }
    setShowErrors(false);
    setSearch("");
    setStepKey(key);
    setReached((r) => Math.max(r, target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nextKey = flow[stepIndex + 1];
  const prevKey = flow[stepIndex - 1];
  const proceed = () => (stepErrors.length ? setShowErrors(true) : goTo(nextKey));

  // Ctrl+K quick jump
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJumpOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── step 1: choose exam + subject block, then the fetch mode ──
  const chooseBlock = (e, sids) => setModePrompt({ examId: e.id, subjects: sids });
  const applyBlock = (chosenMode) => {
    const { examId: id, subjects: sids } = modePrompt;
    const changed = id !== examId || sids.join() !== subjects.join();
    if (changed) {
      setExamId(id);
      setParams({ exam: id });
      setSubjects(sids);
      setActive(sids[0]);
      setChapters({});
      setConceptSel({});
      setChapterCounts({});
      setTypeCounts({});
      setTypeTouched({});
      setPicked({});
      setReached(0);
    }
    setMode(chosenMode);
    setModePrompt(null);
    setShowErrors(false);
    setStepKey("chapters");
    setReached((r) => Math.max(r, 1));
  };

  // ── generation (on entering Preview & Save) ──
  const subjectLabel = subjects.length > 1 ? "All Subjects" : SUBJECTS[subjects[0]]?.name ?? "";
  const buildConfig = () => ({
    examId: exam.id,
    title: title.trim() || `${exam.name} ${subjectLabel} Test`,
    institute: lastHeader()?.header?.college ?? "",
    instructions: "",
    durationMinutes: exam.durationMinutes,
    difficulty: { easy: 30, medium: 50, hard: 20 },
    setCount: 4,
    shuffleQuestions: true,
    shuffleOptions: true,
    mode: mode === "manual" ? "manual" : "custom",
    classFilter,
    sections: subjects
      .filter((sid) => subjectTotal(sid) > 0)
      .map((sid) => {
        if (mode === "manual") {
          const list = picked[sid] ?? [];
          return {
            subjectId: sid,
            chapters: [...new Set(list.map((q) => q.chapter))],
            questionIds: list.map((q) => q.id),
            mcq: list.filter((q) => q.type === "mcq").length,
            numerical: list.filter((q) => q.type === "numerical").length,
          };
        }
        const names = chosen(sid).filter((n) => (chapterCounts[sid]?.[n] || 0) > 0);
        const t = typesFor(sid);
        const conc = resolved(sid);
        return {
          subjectId: sid,
          chapters: names,
          chapterCounts: Object.fromEntries(names.map((n) => [n, chapterCounts[sid][n]])),
          typeCounts: t,
          mcq: t.mcq + t.assertion_reason,
          numerical: t.numerical,
          concepts: Object.fromEntries(Object.entries(conc).filter(([n]) => names.includes(n))),
        };
      }),
  });

  useEffect(() => {
    if (stepKey !== "preview" || !exam) return;
    const config = buildConfig();
    const key = JSON.stringify(config);
    if (draftRef.current?.key === key) return;
    let alive = true;
    (async () => {
      try {
        setProgress(0);
        const old = draftRef.current?.paper;
        const generated = await generatePaper(config, user, setProgress);
        if (old) deletePaper(old.id).catch(() => {});
        const remembered = lastHeader();
        const paper = {
          ...generated,
          layout: {
            setNames: "pqrs",
            ...(remembered?.watermark ? { watermark: remembered.watermark } : {}),
            header: {
              ...(remembered?.header ?? {}),
              college: remembered?.header?.college || generated.institute || "",
              examination: `${exam.name.toUpperCase()} EXAMINATION`,
              subjectName: subjects.map((s) => SUBJECTS[s].name).join(", "),
              className: CLASS_HEADER[classFilter],
            },
            endNote: `*** End of ${exam.name} Examination ***`,
          },
        };
        const saved = await savePaper(paper);
        if (!alive) return;
        draftRef.current = { key, paper: saved };
        setDraft(draftRef.current);
        setSaveState("saved");
        setProgress(null);
        if (generated.warnings?.length) toast.info(generated.warnings.slice(0, 2).join(" "));
      } catch (err) {
        if (!alive) return;
        setProgress(null);
        toast.error(err.message || "Generation failed");
        setStepKey(prevKey);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // ── renderers per step ──
  const current = subjects.includes(active) ? active : subjects[0];

  const stepSubject = (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Assessment title (optional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grand Mock Test #1" className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Target class
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            {CLASS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[...EXAMS].sort((a, b) => ["neet-ug", "jee-main", "kcet", "assignment"].indexOf(a.id) - ["neet-ug", "jee-main", "kcet", "assignment"].indexOf(b.id)).map((e) => {
          const blocks = e.subjects.map((s) => [s.subjectId]);
          if (e.allSubjects) blocks.push(e.subjects.map((s) => s.subjectId));
          return (
            <div key={e.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${e.id === examId ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-indigo-950 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{EXAM_CATEGORY[e.id]}</span>
                <span className="text-xs font-semibold text-slate-500">{blocks.length} Blocks</span>
              </div>
              <p className="mt-3 text-lg font-extrabold uppercase text-slate-900">{e.name}</p>
              <p className="text-xs text-slate-500">{e.fullName}</p>
              <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Click subject block to open:</p>
              <div className="space-y-1.5">
                {blocks.map((sids) => {
                  const on = e.id === examId && sids.join() === subjects.join();
                  return (
                    <button key={sids.join()} type="button" onClick={() => chooseBlock(e, sids)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${on ? "border-indigo-950 bg-indigo-950 text-white" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-300 hover:bg-white"}`}>
                      {sids.length > 1 ? "All Subjects" : SUBJECTS[sids[0]].name}
                      <ArrowRight className="h-4 w-4 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const stepChapters = current && syllabus && (() => {
    const all = chapterList(current);
    const sel = chosen(current);
    const term = search.trim().toLowerCase();
    const shown = term ? all.filter((c) => c.name.toLowerCase().includes(term)) : all;
    const setSel = (names) => setChapters((m) => ({ ...m, [current]: names }));
    return (
      <div>
        <SubjectSwitch subjects={subjects} value={current} onChange={setActive} badge={(sid) => chosen(sid).length} />
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${all.length} ${SUBJECTS[current].name} chapters…`} className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => setSel(all.map((c) => c.name))} className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-bold text-white">Select All ({all.length})</button>
          <button type="button" onClick={() => setSel([])} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Clear</button>
          <span className="text-xs text-slate-500">{sel.length} selected</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => {
            const on = sel.includes(c.name);
            return <PickCard key={c.id} selected={on} title={c.name} subtitle={`${fmt(chapterBankCount(current, c))} questions · Class ${c.classLevel}`} onClick={() => setSel(on ? sel.filter((n) => n !== c.name) : [...sel, c.name])} />;
          })}
        </div>
        {!shown.length && <p className="py-8 text-center text-sm text-slate-500">No chapters match “{search}”.</p>}
      </div>
    );
  })();

  const stepConcepts = current && syllabus && (() => {
    const names = chosen(current);
    const cards = names.flatMap((n) => (chapterByName(current, n)?.concepts ?? []).map((t) => ({ chapter: n, concept: t })));
    const term = search.trim().toLowerCase();
    const shown = term ? cards.filter((c) => c.concept.toLowerCase().includes(term) || c.chapter.toLowerCase().includes(term)) : cards;
    const selectedCount = names.reduce((s, n) => s + conceptsOf(current, n).length, 0);
    const toggle = ({ chapter, concept }) => setConceptSel((m) => {
      const list = m[current]?.[chapter] ?? [];
      return { ...m, [current]: { ...(m[current] ?? {}), [chapter]: list.includes(concept) ? list.filter((x) => x !== concept) : [...list, concept] } };
    });
    const count = (chapter, concept) => chapterByName(current, chapter)?.conceptCounts?.[concept]?.total;
    return (
      <div>
        <SubjectSwitch subjects={subjects} value={current} onChange={setActive} badge={(sid) => chosen(sid).reduce((s, n) => s + conceptsOf(sid, n).length, 0)} />
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search target concepts…" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setConceptSel((m) => ({ ...m, [current]: Object.fromEntries(names.map((n) => [n, [...(chapterByName(current, n)?.concepts ?? [])]])) }))} className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-bold text-white">Select All ({cards.length})</button>
          <button type="button" onClick={() => setConceptSel((m) => ({ ...m, [current]: {} }))} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Clear</button>
          <span className="flex items-center gap-1 text-xs text-slate-500"><Info className="h-3.5 w-3.5" />{selectedCount ? `${selectedCount} selected` : "None selected = every concept of the chosen chapters"}</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <PickCard key={`${c.chapter}|${c.concept}`} selected={conceptsOf(current, c.chapter).includes(c.concept)} title={c.concept} subtitle={`${c.chapter}${count(c.chapter, c.concept) ? ` · ${count(c.chapter, c.concept)} Qs` : ""}`} onClick={() => toggle(c)} />
          ))}
        </div>
        {!cards.length && <p className="py-8 text-center text-sm text-slate-500">These chapters have no concepts listed — all their questions will be used.</p>}
      </div>
    );
  })();

  const stepPerChapter = current && syllabus && (() => {
    const names = chosen(current);
    const set = (n, v) => setChapterCounts((m) => ({ ...m, [current]: { ...(m[current] ?? {}), [n]: v } }));
    return (
      <div>
        <SubjectSwitch subjects={subjects} value={current} onChange={setActive} badge={subjectTotal} />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600"><b className="text-slate-900">{SUBJECTS[current].name}</b>: {subjectTotal(current)} questions · exam pattern {patternTotal(current)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setChapterCounts((m) => ({ ...m, [current]: defaultChapterCounts(current) }))} className="rounded-full bg-indigo-950 px-3 py-1 text-xs font-bold text-white">Spread {patternTotal(current)} (exam pattern)</button>
            <button type="button" onClick={() => setChapterCounts((m) => ({ ...m, [current]: {} }))} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Clear</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Chapter</th><th className="px-3 py-2">Concepts</th><th className="px-3 py-2 text-right">Available</th><th className="px-3 py-2 text-right">Questions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {names.map((n) => {
                const a = availability(current, n);
                const v = chapterCounts[current]?.[n] || 0;
                const cs = conceptsOf(current, n);
                return (
                  <tr key={n} className={v ? "" : "text-slate-400"}>
                    <td className="px-3 py-2 font-semibold text-slate-800">{n}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={cs.join(", ")}>{cs.length ? `${cs.length} chosen` : "All"}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{a.unlimited ? `${a.bank} in bank + AI` : fmt(a.total)}</td>
                    <td className="px-3 py-2 text-right"><Stepper value={v} max={a.unlimited ? 200 : Math.min(200, a.total)} label={`questions from ${n}`} invalid={v > a.total} onChange={(x) => set(n, x)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  })();

  const stepPerType = exam && (
    <div className="space-y-4">
      {subjects.map((sid) => {
        const total = subjectTotal(sid);
        const t = typesFor(sid);
        const kinds = examKinds(exam);
        const names = chosen(sid).filter((n) => (chapterCounts[sid]?.[n] || 0) > 0);
        const avail = Object.fromEntries(kinds.map((k) => [k, names.reduce((s, n) => s + availability(sid, n)[k], 0)]));
        const set = (k, v) => { setTypeTouched((m) => ({ ...m, [sid]: true })); setTypeCounts((m) => ({ ...m, [sid]: { ...typesFor(sid), [k]: v } })); };
        return (
          <div key={sid} className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{SUBJECTS[sid].name}</p>
              <span className={`text-sm font-semibold tabular-nums ${sum(t) === total ? "text-emerald-700" : "text-red-600"}`}>{sum(t)} / {total}{sum(t) === total ? " ✓" : ""}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {kinds.map((k) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">{KIND_LABEL[k]}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Stepper value={t[k] ?? 0} max={total} label={`${KIND_LABEL[k]} for ${SUBJECTS[sid].name}`} invalid={(t[k] ?? 0) > avail[k]} onChange={(v) => set(k, v)} />
                    <span className="text-[11px] text-slate-500">{avail[k] === Infinity ? "AI fills" : `${fmt(avail[k])} avail.`}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-3 text-xs font-semibold">
              <button type="button" className="text-indigo-700" onClick={() => setTypeTouched((m) => ({ ...m, [sid]: false }))}>Use exam pattern ratio</button>
              <button type="button" className="text-slate-500" onClick={() => { setTypeTouched((m) => ({ ...m, [sid]: true })); setTypeCounts((m) => ({ ...m, [sid]: { mcq: total, assertion_reason: 0, numerical: 0 } })); }}>All MCQ</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const stepSelect = current && syllabus && (
    <div>
      <SubjectSwitch subjects={subjects} value={current} onChange={setActive} badge={(sid) => (picked[sid] ?? []).length} />
      <ManualQuestionPicker
        key={current}
        examId={exam.id}
        subjectId={current}
        chapters={chosen(current)}
        conceptsByChapter={Object.fromEntries(chosen(current).map((n) => [n, { list: conceptsOf(current, n).length ? conceptsOf(current, n) : chapterByName(current, n)?.concepts ?? [], restricted: conceptsOf(current, n).length > 0 }]))}
        picked={picked[current] ?? []}
        allowNumerical={examKinds(exam).includes("numerical")}
        onToggle={(q) => setPicked((m) => {
          const list = m[current] ?? [];
          return { ...m, [current]: list.some((x) => x.id === q.id) ? list.filter((x) => x.id !== q.id) : [...list, q] };
        })}
        onClear={() => setPicked((m) => ({ ...m, [current]: [] }))}
      />
    </div>
  );

  // ── header texts per step ──
  const subjectTitle = subjects.length > 1 ? "All Subjects" : SUBJECTS[current]?.name ?? "";
  const headings = {
    subject: ["Exam Pattern & Subject Selection", "Select exam blueprint and click your subject block to proceed with chapter selection."],
    chapters: [`Chapter Selection • ${subjectTitle}`, `Select syllabus chapters strictly belonging to ${subjectTitle}. (${subjects.reduce((s, sid) => s + chosen(sid).length, 0)} selected)`],
    concepts: ["Concept & Sub-Topic Selection", `Displaying concepts strictly belonging to the ${subjects.reduce((s, sid) => s + chosen(sid).length, 0)} chosen chapters.`],
    perChapter: [`Questions per Chapter • ${subjectTitle}`, "How many questions to take from each chosen chapter."],
    perType: ["Questions per Type", "Split each subject's questions between MCQ, assertion–reason and numerical."],
    select: [`Manual Question Selection • ${subjectTitle}`, "Hand-pick questions from your selected syllabus. Filter by chapter, concept, difficulty and question type."],
    preview: ["Question Paper Generator", "Every change shows on the paper on the right and is saved as a draft."],
  };
  const proceedLabel = nextKey ? `Proceed to ${STEP_INFO[nextKey].title} (Step ${stepIndex + 2})` : "";
  const contents = { subject: stepSubject, chapters: stepChapters, concepts: stepConcepts, perChapter: stepPerChapter, perType: stepPerType, select: stepSelect };

  const stepsNav = (
    <nav aria-label="Your steps" className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3 shadow-sm">
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-700">Your steps</p>
      <ol className="flex gap-1 overflow-x-auto lg:flex-col">
        {flow.map((key, i) => {
          const isActive = key === stepKey;
          const done = i < stepIndex || (i <= reached && !isActive && !errorsFor(key).length && i < flow.length - 1);
          const open = i <= reached;
          const sub = key === "subject" ? (exam ? `${exam.name}${subjects.length ? ` · ${subjectLabel}` : ""}` : "")
            : key === "chapters" ? (subjects.length ? `${subjects.reduce((s, sid) => s + chosen(sid).length, 0)} chapters` : "")
              : key === "concepts" ? `${subjects.reduce((s, sid) => s + chosen(sid).reduce((a, n) => a + conceptsOf(sid, n).length, 0), 0) || "All"} concepts`
                : key === "select" ? `${grandTotal} picked` : "";
          return (
            <li key={key} className="shrink-0">
              <button type="button" disabled={!open} onClick={() => goTo(key)} aria-current={isActive ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${isActive ? "border-amber-200 bg-amber-50" : "border-transparent hover:bg-white"} ${open ? "" : "cursor-not-allowed opacity-50"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${isActive ? "bg-indigo-950 text-white" : done ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-500"}`}>
                  {done && !isActive ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-sm font-bold text-slate-900">{STEP_INFO[key].title}</span>
                  {sub && <span className="block truncate text-[11px] text-slate-500">{sub}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const paperCard = (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-950 to-indigo-900 p-4 text-white shadow-lg">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-indigo-200">Your paper</p>
      <dl className="space-y-2.5">
        {[
          [FileText, "Exam", exam?.name ?? "—"],
          [BookOpen, "Subject", subjects.length ? subjectLabel : "—"],
          [GraduationCap, "Class", CLASS_LABEL[classFilter]],
          [Layers, "Chapters", subjects.reduce((s, sid) => s + chosen(sid).length, 0) || "—"],
        ].map(([Icon, k, v]) => (
          <div key={k} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><Icon className="h-3.5 w-3.5" /></span>
            <div><dt className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">{k}</dt><dd className="text-sm font-bold">{v}</dd></div>
          </div>
        ))}
      </dl>
      {grandTotal > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300"><Hash className="h-3 w-3" />Questions</p><p className="text-xl font-extrabold">{grandTotal}</p></div>
          <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300"><Award className="h-3 w-3" />Marks</p><p className="text-xl font-extrabold">{marksTotal}</p></div>
        </div>
      )}
    </div>
  );

  const tip = <p className="px-1 text-[11px] text-slate-500">Tip: press <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Ctrl</kbd> + <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">K</kbd> to jump anywhere.</p>;

  // ── Preview & Save: full-width settings + paper ──
  if (stepKey === "preview") {
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => goTo(prevKey)} aria-label="Back" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Exam generator</p>
              <h1 className="text-xl font-extrabold text-slate-900">Question Paper Generator</h1>
            </div>
          </div>
          <span className="rounded-full bg-indigo-950 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Step {stepIndex + 1} of {flow.length}</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              {saveState === "saving" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : saveState === "error" ? <TriangleAlert className="h-3.5 w-3.5 text-red-600" /> : <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Draft saved"}
            </span>
            <button type="button" onClick={() => setJumpOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><Command className="h-3.5 w-3.5" />Quick jump <kbd className="font-mono text-[10px] text-slate-400">Ctrl K</kbd></button>
          </div>
        </div>
        {draft ? (
          <PreviewSaveStep
            key={draft.paper.id}
            paper={draft.paper}
            toast={toast}
            onStatus={setSaveState}
            onBack={() => goTo(prevKey)}
            onOpenEditor={(p) => navigate(`/papers/${p.id}`)}
            onFinish={(p) => { toast.success(`“${p.title}” saved.`); navigate(`/papers/${p.id}`); }}
          />
        ) : (
          <Loader label="Generating your paper…" />
        )}
        {renderDialogs()}
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        {/* Auto / Manual fetch */}
        <Modal open={Boolean(modePrompt)} onClose={() => setModePrompt(null)} size="lg" title="Choose Question Acquisition Mode" description="Select how you would like to source questions for this examination.">
          {modePrompt && (
            <>
              <p className="-mt-2 mb-4 text-[11px] font-bold uppercase tracking-wider text-indigo-700">{modePrompt.subjects.length > 1 ? "All Subjects" : SUBJECTS[modePrompt.subjects[0]].name} • {getExam(modePrompt.examId).name}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["auto", Zap, "Auto Fetch Mode", "Specify chapter quotas and question type breakdowns. The system automatically balances, samples, and generates your paper.", "Use Auto Fetch", "bg-amber-50 border-amber-200", "text-amber-600"],
                  ["manual", Pencil, "Manual Fetch Mode", "Hand-pick every single question. Filter by chapter, concept, difficulty and question type (MTF, AR, MCQ).", "Use Manual Fetch", "bg-indigo-50/60 border-indigo-200", "text-indigo-600"],
                ].map(([value, Icon, heading, text, cta, tone, iconTone]) => (
                  <div key={value} className={`flex flex-col rounded-2xl border p-4 ${tone} ${mode === value ? "ring-2 ring-indigo-300" : ""}`}>
                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm"><Icon className={`h-5 w-5 ${iconTone}`} /></span>
                    <p className="font-extrabold text-slate-900">{heading}</p>
                    <p className="mt-1 flex-1 text-sm text-slate-600">{text}</p>
                    <button type="button" onClick={() => applyBlock(value)} className="mt-4 rounded-xl bg-indigo-950 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-indigo-900">{cta} →</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>

        {/* Quick jump */}
        <Modal open={jumpOpen} onClose={() => setJumpOpen(false)} size="sm" title="Quick jump" description="Go to any step you have reached.">
          <ul className="space-y-1">
            {flow.map((key, i) => (
              <li key={key}>
                <button type="button" disabled={i > reached} onClick={() => { setJumpOpen(false); goTo(key); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span>{STEP_INFO[key].title}
                </button>
              </li>
            ))}
            <li className="border-t border-slate-100 pt-1"><button type="button" onClick={() => navigate("/papers")} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">My papers</button></li>
            <li><button type="button" onClick={() => navigate("/question-bank")} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">Question bank</button></li>
          </ul>
        </Modal>

        {/* Generation progress */}
        <Modal open={progress !== null} onClose={() => {}} title="Generating your paper" description={`${grandTotal} questions`} size="sm">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${((progress ?? 0) / GENERATION_STEPS.length) * 100}%` }} />
          </div>
          <ol className="space-y-3">
            {GENERATION_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                {progress > i ? <CircleCheck className="h-5 w-5 text-green-600" /> : progress === i ? <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" /> : <span className="h-5 w-5 rounded-full border border-slate-300" />}
                <span className={progress > i ? "text-slate-500" : progress === i ? "font-medium text-slate-900" : "text-slate-400"}>{s}</span>
              </li>
            ))}
          </ol>
        </Modal>
      </>
    );
  }

  const [heading, subheading] = headings[stepKey];
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {stepsNav}
          <div className="hidden space-y-3 lg:block">{paperCard}{tip}</div>
        </aside>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="min-w-0">
              {stepKey !== "subject" && <span className="mb-2 inline-block rounded-full bg-indigo-950 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Step {stepIndex + 1} of {flow.length}</span>}
              <h1 className={`font-extrabold text-slate-900 ${stepKey === "subject" ? "text-center text-2xl" : "text-2xl"}`}>{heading}</h1>
              <p className={`mt-1 text-sm text-slate-500 ${stepKey === "subject" ? "text-center" : ""}`}>{subheading}</p>
            </div>
            {stepKey === "chapters" && (
              <div className="flex shrink-0 rounded-full bg-slate-100 p-1">
                {[["auto", Zap, "Auto fetch"], ["manual", Pencil, "Manual fetch"]].map(([v, Icon, l]) => (
                  <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${mode === v ? "bg-indigo-950 text-white" : "text-slate-600"}`}><Icon className="h-3.5 w-3.5" />{l}</button>
                ))}
              </div>
            )}
            {stepKey === "select" && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{subjectTotal(current)} Questions Selected</span>
                <button type="button" onClick={proceed} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-800">✓ Done selection →</button>
              </div>
            )}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {exam && !syllabus && stepKey !== "subject" ? (loadError ? <p className="text-sm text-red-600">{loadError}</p> : <Loader label="Loading syllabus…" />) : contents[stepKey]}
          </div>

          {showErrors && stepErrors.length > 0 && (
            <div className="mx-4 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6" role="alert">
              <p className="mb-1 flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" />Please fix before continuing</p>
              <ul className="list-disc space-y-0.5 pl-6">{stepErrors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          {stepKey !== "subject" && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-6">
              <button type="button" onClick={() => goTo(prevKey)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5" />Back to {STEP_INFO[prevKey].title}</button>
              {stepKey === "select" && <span className="hidden text-xs text-slate-500 sm:inline">{grandTotal} questions picked</span>}
              <button type="button" onClick={proceed} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white ${stepKey === "select" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-indigo-950 hover:bg-indigo-900"}`}>
                {stepKey === "select" ? "✓ Done selection — proceed to Preview & Save" : proceedLabel} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>
      </div>
      <div className="mt-4 space-y-3 lg:hidden">{paperCard}</div>
      {renderDialogs()}
    </>
  );
}
