import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ChevronDown, Check, CircleCheck, LoaderCircle, Database, WandSparkles, TriangleAlert } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Toggle from "../components/ui/Toggle";
import Tabs from "../components/ui/Tabs";
import Modal from "../components/ui/Modal";
import Loader from "../components/ui/Loader";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EXAMS, SUBJECTS, SUBJECT_SOURCES, SET_LABELS, getExam } from "../data/exams";
import { getSyllabus } from "../services/syllabusService";
import { getQuestionsSync } from "../services/questionService";
import { GENERATION_STEPS, generatePaper } from "../services/paperService";

const PRESETS = [
  { label: "Easy", mix: { easy: 50, medium: 35, hard: 15 } },
  { label: "Balanced", mix: { easy: 30, medium: 50, hard: 20 } },
  { label: "Tough", mix: { easy: 15, medium: 45, hard: 40 } },
];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function SectionRow({ section, exam, mode, onChange, bankCount }) {
  const [open, setOpen] = useState(false);
  const subject = SUBJECTS[section.subjectId];
  const pattern = exam.subjects.find((s) => s.subjectId === section.subjectId);
  const total = section.mcq + section.numerical;
  const allChapters = section.available;

  const toggleChapter = (name) =>
    onChange({ chapters: section.chapters.includes(name) ? section.chapters.filter((c) => c !== name) : [...section.chapters, name] });

  return (
    <div className={`rounded-xl border ${section.enabled ? "border-slate-200" : "border-dashed border-slate-200 bg-slate-50/60"}`}>
      <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <label className="flex min-w-[150px] flex-1 items-center gap-3">
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={section.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} />
          <span>
            <span className="block text-sm font-semibold text-slate-900">{subject.name}</span>
            <span className="block text-xs text-slate-500">
              {section.chapters.length}/{allChapters.length} chapters · <Database className="inline h-3 w-3" /> {bankCount} in bank
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">
            MCQ
            <input
              type="number"
              min={0}
              max={100}
              disabled={!section.enabled || mode === "full"}
              value={section.mcq}
              onChange={(e) => onChange({ mcq: clamp(Number(e.target.value) || 0, 0, 100) })}
              className="ml-1 w-16 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </label>
          {pattern.numerical > 0 && (
            <label className="text-xs text-slate-500">
              Numerical
              <input
                type="number"
                min={0}
                max={25}
                disabled={!section.enabled || mode === "full"}
                value={section.numerical}
                onChange={(e) => onChange({ numerical: clamp(Number(e.target.value) || 0, 0, 25) })}
                className="ml-1 w-14 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
          )}
          <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-900">{section.enabled ? total : 0}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={!section.enabled}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            aria-expanded={open}
            aria-label={`Choose ${subject.name} chapters`}
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && section.enabled && (
        <div className="border-t border-slate-100 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Chapters to include</p>
            <div className="flex gap-3 text-xs font-medium">
              <button type="button" className="text-indigo-600" onClick={() => onChange({ chapters: allChapters.map((c) => c.name) })}>All</button>
              <button type="button" className="text-slate-500" onClick={() => onChange({ chapters: [] })}>None</button>
              <button type="button" className="text-slate-500" onClick={() => onChange({ chapters: allChapters.filter((c) => c.classLevel === 11).map((c) => c.name) })}>Class 11</button>
              <button type="button" className="text-slate-500" onClick={() => onChange({ chapters: allChapters.filter((c) => c.classLevel === 12).map((c) => c.name) })}>Class 12</button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {allChapters.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={section.chapters.includes(c.name)} onChange={() => toggleChapter(c.name)} />
                <span className="flex-1">{c.name}</span>
                <span className="text-[11px] text-slate-400">XI{c.classLevel === 12 ? "I" : ""}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {section.enabled && !section.chapters.length && (
        <p className="flex items-center gap-1 px-4 pb-3 text-xs text-red-600"><TriangleAlert className="h-3.5 w-3.5" />Select at least one chapter.</p>
      )}
    </div>
  );
}

export default function GeneratePaper() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const examId = params.get("exam") ?? "";
  const exam = getExam(examId);

  const [mode, setMode] = useState("full");
  const [sections, setSections] = useState(null);
  const [details, setDetails] = useState({ title: "", institute: "", durationMinutes: 0, instructions: "" });
  const [difficulty, setDifficulty] = useState(PRESETS[1].mix);
  const [setCount, setSetCount] = useState(4);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null); // null = idle, number = current step

  // Load the pattern + active syllabus chapters whenever the exam changes
  useEffect(() => {
    if (!exam) return;
    let cancelled = false;
    setSections(null);
    getSyllabus(exam.id).then((syllabus) => {
      if (cancelled) return;
      setSections(
        exam.subjects.map((s) => {
          const available = (syllabus[s.subjectId] ?? []).filter((c) => c.active);
          // KCET: candidates write PCM or PCB, so Biology starts switched off
          const enabled = !(exam.id === "kcet" && s.subjectId === "biology");
          return { ...s, enabled, available, chapters: available.map((c) => c.name) };
        })
      );
      setDetails((d) => ({ ...d, title: `${exam.name} Practice Paper`, durationMinutes: exam.durationMinutes }));
      setMode("full");
    });
    return () => {
      cancelled = true;
    };
  }, [exam]);

  const bank = useMemo(() => getQuestionsSync(), []);
  const bankCount = (section) => {
    const sources = SUBJECT_SOURCES[section.subjectId] ?? [section.subjectId];
    return bank.filter((q) => sources.includes(q.subjectId) && section.chapters.includes(q.chapter)).length;
  };

  const updateSection = (subjectId, changes) =>
    setSections((list) => list.map((s) => (s.subjectId === subjectId ? { ...s, ...changes } : s)));

  const switchMode = (next) => {
    setMode(next);
    if (next === "full") {
      setSections((list) => list.map((s) => {
        const pattern = exam.subjects.find((p) => p.subjectId === s.subjectId);
        return { ...s, mcq: pattern.mcq, numerical: pattern.numerical };
      }));
    }
  };

  const setMix = (field, value) => {
    setDifficulty((prev) => {
      const next = { ...prev, [field]: clamp(value, 0, 100) };
      const other = field === "easy" ? "hard" : "easy";
      if (next.easy + next.hard > 100) next[other] = 100 - next[field];
      next.medium = 100 - next.easy - next.hard;
      return next;
    });
  };

  const enabled = sections?.filter((s) => s.enabled && s.mcq + s.numerical > 0) ?? [];
  const totalQuestions = enabled.reduce((sum, s) => sum + s.mcq + s.numerical, 0);
  const totalMarks = exam ? totalQuestions * exam.marking.correct : 0;
  const bankTotal = enabled.reduce((sum, s) => sum + Math.min(bankCount(s), s.mcq + s.numerical), 0);

  const validate = () => {
    const found = {};
    if (!details.title.trim()) found.title = "Paper title is required";
    if (!details.durationMinutes || details.durationMinutes < 10) found.duration = "Duration must be at least 10 minutes";
    if (!enabled.length) found.sections = "Select at least one subject with questions";
    if (enabled.some((s) => !s.chapters.length)) found.sections = "Every selected subject needs at least one chapter";
    setErrors(found);
    return !Object.keys(found).length;
  };

  const handleGenerate = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const config = {
      examId: exam.id,
      title: details.title,
      institute: details.institute,
      instructions: details.instructions,
      durationMinutes: Number(details.durationMinutes),
      difficulty,
      setCount,
      shuffleQuestions,
      shuffleOptions,
      mode,
      sections: enabled.map(({ subjectId, chapters, mcq, numerical }) => ({ subjectId, chapters, mcq, numerical })),
    };
    try {
      setProgress(0);
      const paper = await generatePaper(config, user, setProgress);
      toast.success(`Generated “${paper.title}” with ${paper.sets.length} set${paper.sets.length > 1 ? "s" : ""}.`);
      navigate(`/papers/${paper.id}`);
    } catch (err) {
      setProgress(null);
      toast.error(err.message || "Generation failed");
    }
  };

  // ── Step 0: no exam chosen yet ─────────────────────────────
  if (!exam) {
    return (
      <>
        <PageHeader title="Generate question paper" subtitle="Step 1 — choose the entrance exam." />
        <div className="grid gap-4 md:grid-cols-3">
          {EXAMS.map((e) => (
            <button key={e.id} type="button" onClick={() => setParams({ exam: e.id })} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md">
              <p className="text-lg font-bold text-slate-900">{e.name}</p>
              <p className="mt-1 text-sm text-slate-500">{e.stream} · {e.conductedBy}</p>
              <p className="mt-3 text-sm text-slate-600">{e.subjects.map((s) => SUBJECTS[s.subjectId].name).join(", ")}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Generate ${exam.name} paper`}
        subtitle={exam.fullName}
        actions={<Tabs value={exam.id} onChange={(id) => setParams({ exam: id })} tabs={EXAMS.map((e) => ({ value: e.id, label: e.name }))} />}
      />

      {!sections ? (
        <Loader label="Loading syllabus…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {/* 1. Paper details */}
            <Card title="1. Paper details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="g-title" label="Paper title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} error={errors.title} className="sm:col-span-2" />
                <Input id="g-inst" label="Institute / school name" placeholder="Shown on the paper header" value={details.institute} onChange={(e) => setDetails({ ...details, institute: e.target.value })} />
                <Input id="g-dur" type="number" label="Duration (minutes)" value={details.durationMinutes} onChange={(e) => setDetails({ ...details, durationMinutes: Number(e.target.value) })} error={errors.duration} />
                <Textarea id="g-ins" label="Custom instructions (optional)" rows={3} className="sm:col-span-2" hint="One instruction per line. Leave empty to use the standard instructions for this exam." value={details.instructions} onChange={(e) => setDetails({ ...details, instructions: e.target.value })} />
              </div>
            </Card>

            {/* 2. Subjects & chapters */}
            <Card
              title="2. Subjects, chapters & question count"
              subtitle={mode === "full" ? "Using the official exam pattern" : "Custom counts per subject"}
              actions={<Tabs value={mode} onChange={switchMode} tabs={[{ value: "full", label: "Full pattern" }, { value: "custom", label: "Custom" }]} />}
            >
              <div className="space-y-3">
                {sections.map((s) => (
                  <SectionRow key={s.subjectId} section={s} exam={exam} mode={mode} bankCount={bankCount(s)} onChange={(changes) => updateSection(s.subjectId, changes)} />
                ))}
              </div>
              {errors.sections && <p className="mt-3 text-sm text-red-600">{errors.sections}</p>}
            </Card>

            {/* 3. Difficulty */}
            <Card title="3. Difficulty mix" actions={<div className="flex gap-1">{PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant={difficulty.easy === p.mix.easy && difficulty.hard === p.mix.hard ? "soft" : "ghost"} onClick={() => setDifficulty(p.mix)}>{p.label}</Button>
            ))}</div>}>
              <div className="mb-5 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
                <div className="bg-green-500" style={{ width: `${difficulty.easy}%` }} />
                <div className="border-x-2 border-white bg-amber-500" style={{ width: `${difficulty.medium}%` }} />
                <div className="bg-red-500" style={{ width: `${difficulty.hard}%` }} />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  ["easy", "Easy", "accent-green-600"],
                  ["medium", "Medium (auto)", "accent-amber-500"],
                  ["hard", "Hard", "accent-red-600"],
                ].map(([key, label, accent]) => (
                  <label key={key} className="block">
                    <span className="flex justify-between text-sm"><span className="font-medium text-slate-700">{label}</span><span className="font-semibold tabular-nums">{difficulty[key]}%</span></span>
                    <input type="range" min={0} max={100} step={5} value={difficulty[key]} disabled={key === "medium"} onChange={(e) => setMix(key, Number(e.target.value))} className={`mt-2 w-full ${accent} disabled:opacity-50`} />
                  </label>
                ))}
              </div>
            </Card>

            {/* 4. Sets */}
            <Card title="4. Paper sets" subtitle="Each set has the same questions in a different order, with its own answer key.">
              <p className="mb-2 text-sm font-medium text-slate-700">Number of sets</p>
              <div className="flex flex-wrap gap-2">
                {SET_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSetCount(i + 1)}
                    aria-pressed={setCount === i + 1}
                    className={`h-11 w-11 rounded-xl border text-sm font-bold transition ${setCount === i + 1 ? "border-indigo-600 bg-indigo-600 text-white shadow" : i < setCount ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Sets: {SET_LABELS.slice(0, setCount).join(", ")}</p>
              <div className="mt-5 space-y-4 rounded-xl bg-slate-50 p-4">
                <Toggle id="g-shq" checked={shuffleQuestions} onChange={setShuffleQuestions} label="Shuffle question order" description="Within each subject, for sets B onwards" />
                <Toggle id="g-sho" checked={shuffleOptions} onChange={setShuffleOptions} label="Shuffle MCQ options" description="Answer keys update automatically" />
              </div>
            </Card>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card title="Summary">
              <dl className="space-y-3 text-sm">
                {[
                  ["Exam", exam.name],
                  ["Subjects", enabled.map((s) => SUBJECTS[s.subjectId].short).join(" · ") || "—"],
                  ["Questions", totalQuestions],
                  ["Total marks", totalMarks],
                  ["Marking", `+${exam.marking.correct} / ${exam.marking.incorrect || 0}`],
                  ["Duration", `${details.durationMinutes || 0} min`],
                  ["Sets", `${setCount} (${SET_LABELS.slice(0, setCount).join(", ")})`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-semibold tabular-nums text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-indigo-600" />Up to <b>{bankTotal}</b> from your question bank</p>
                <p className="flex items-center gap-2"><WandSparkles className="h-3.5 w-3.5 text-pink-600" /><b>{Math.max(0, totalQuestions - bankTotal)}</b> generated by AI</p>
              </div>

              <Button fullWidth icon={Sparkles} className="mt-5" onClick={handleGenerate} disabled={!totalQuestions}>
                Generate paper
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">You can edit every question before exporting.</p>
            </Card>
          </div>
        </div>
      )}

      {/* Progress dialog */}
      <Modal open={progress !== null} onClose={() => {}} title="Generating your paper" description={`${totalQuestions} questions · ${setCount} set${setCount > 1 ? "s" : ""}`} size="sm">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${((progress ?? 0) / GENERATION_STEPS.length) * 100}%` }} />
        </div>
        <ol className="space-y-3">
          {GENERATION_STEPS.map((step, i) => {
            const done = progress > i;
            const active = progress === i;
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                {done ? <CircleCheck className="h-5 w-5 text-green-600" /> : active ? <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300" />}
                <span className={done ? "text-slate-500" : active ? "font-medium text-slate-900" : "text-slate-400"}>{step}</span>
                {done && <Check className="sr-only" />}
              </li>
            );
          })}
        </ol>
      </Modal>
    </>
  );
}
