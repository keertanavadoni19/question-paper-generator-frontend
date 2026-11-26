import { useEffect, useMemo, useState } from "react";
import { Check, Search, Eye, X } from "lucide-react";
import Loader from "../ui/Loader";
import RichText from "../ui/RichText";
import { searchQuestions } from "../../services/questionService";
import { USE_MOCK } from "../../services/api";

const PAGE = 20;
export const FORMAT_OPTIONS = [
  { value: "", label: "All Question Types" },
  { value: "mtf", label: "Match the Following (MTF)" },
  { value: "ar", label: "Assertion & Reason (AR)" },
  { value: "mcq", label: "Standard MCQ (Single Correct)" },
  { value: "statement", label: "Statement Based" },
  { value: "diagram", label: "Diagram Based" },
  { value: "numerical", label: "Numerical / Section B (JEE)" },
];
const DIFF = [["", "All"], ["easy", "Easy"], ["medium", "Med"], ["hard", "Hard"]];
const LETTER = ["A", "B", "C", "D"];
const select = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function QuestionCard({ q, number, selected, onToggle }) {
  const diagram = /\{\{IMG::/.test(q.text);
  return (
    <article
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), onToggle())}
      className={`relative cursor-pointer rounded-2xl border bg-white p-4 transition ${selected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200 hover:border-indigo-300"}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-8 text-[11px] font-semibold uppercase tracking-wide">
        {diagram && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">Diagram</span>}
        {q.format === "assertion_reason" && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-200">A & R</span>}
        {q.format === "match" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-200">MTF</span>}
        {q.type === "numerical" && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-cyan-700 ring-1 ring-cyan-200">Numerical</span>}
        {q.difficulty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">{q.difficulty}</span>}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 normal-case tracking-normal text-slate-600">{q.chapter}</span>
        {q.concept && <span className="normal-case tracking-normal text-slate-400">• {q.concept}</span>}
      </div>
      <span className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <div className="paper-sheet text-[15px] leading-relaxed text-slate-900">
        {number && <b className="mr-1">Q{number}.</b>}
        <RichText text={q.text} />
      </div>
      {q.type === "mcq" ? (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <li key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1 text-sm ${i === Number(q.answer) ? "bg-emerald-50 ring-1 ring-emerald-200" : ""}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === Number(q.answer) ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{LETTER[i]}</span>
              <RichText text={o} className="min-w-0 pt-0.5" />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm"><span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">Answer: {q.answer}</span></p>
      )}
    </article>
  );
}

// Manual Fetch: browse the bank within the chosen chapters / concepts and tick questions.
// picked: question objects in the order they were picked.
export default function ManualQuestionPicker({ examId, subjectId, chapters, conceptsByChapter, picked, onToggle, onClear, allowNumerical }) {
  const [chapter, setChapter] = useState("");
  const [concept, setConcept] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [format, setFormat] = useState("");
  const [search, setSearch] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const pickedIds = useMemo(() => new Set(picked.map((q) => q.id)), [picked]);

  // Chapters / concepts in scope (concept list = chosen concepts, or all concepts of the chapter)
  const scopeChapters = chapter ? [chapter] : chapters;
  // conceptsByChapter: { [chapter]: { list: string[], restricted: boolean } }
  const conceptOptions = [...new Set(scopeChapters.flatMap((c) => conceptsByChapter[c]?.list ?? []))];
  const conceptParam = concept ? [concept] : scopeChapters.every((c) => conceptsByChapter[c]?.restricted) ? conceptOptions : [];

  useEffect(() => { setConcept(""); }, [chapter]);
  useEffect(() => { setLimit(PAGE); }, [chapter, concept, difficulty, format, search, subjectId]);

  const key = JSON.stringify([subjectId, scopeChapters, conceptParam, difficulty, format, search.trim(), limit]);
  useEffect(() => {
    if (showSelected || !scopeChapters.length) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      setError("");
      searchQuestions({ subjectId, examId, chapter: scopeChapters, concept: conceptParam, difficulty: USE_MOCK ? difficulty : "", format, search: search.trim(), limit, offset: 0 })
        .then((r) => alive && setResult(r))
        .catch((err) => alive && setError(err.message));
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, showSelected]);

  const list = showSelected ? picked : result?.items ?? [];

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Chapter
            <select value={chapter} onChange={(e) => setChapter(e.target.value)} className={`${select} mt-1 normal-case tracking-normal`}>
              <option value="">All chosen chapters ({chapters.length})</option>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Concept / sub-topic
            <select value={concept} onChange={(e) => setConcept(e.target.value)} className={`${select} mt-1 normal-case tracking-normal`}>
              <option value="">{conceptParam.length ? "Chosen concepts" : "All concepts"}</option>
              {conceptOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Difficulty level
            <div className="mt-1 flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white p-1" title={USE_MOCK ? undefined : "The question bank does not record difficulty"}>
              {DIFF.map(([v, l]) => (
                <button key={l} type="button" disabled={!USE_MOCK && v !== ""} onClick={() => setDifficulty(v)} className={`h-full flex-1 rounded-md text-xs font-semibold normal-case tracking-normal disabled:opacity-40 ${difficulty === v ? "bg-indigo-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Question type
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={`${select} mt-1 normal-case tracking-normal`}>
              {FORMAT_OPTIONS.filter((o) => allowNumerical || o.value !== "numerical").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions by text or keywords…" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
          <button type="button" onClick={() => setShowSelected((v) => !v)} disabled={!picked.length} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40 ${showSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            <Eye className="h-3.5 w-3.5" />Show selected only ({picked.length})
          </button>
          {picked.length > 0 && <button type="button" onClick={() => { onClear(); setShowSelected(false); }} className="inline-flex h-9 items-center gap-1 px-2 text-xs font-semibold text-red-600"><X className="h-3.5 w-3.5" />Clear selection</button>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!showSelected && !result && !error ? (
          <Loader label="Loading questions…" />
        ) : list.length ? (
          <>
            {!showSelected && <p className="text-xs text-slate-500">{result.total.toLocaleString("en-IN")} questions match · click a question to pick it</p>}
            {list.map((q) => (
              <QuestionCard key={q.id} q={q} number={showSelected ? picked.indexOf(q) + 1 : null} selected={pickedIds.has(q.id)} onToggle={() => onToggle(q)} />
            ))}
            {!showSelected && result.total > list.length && (
              <div className="text-center"><button type="button" onClick={() => setLimit((n) => n + PAGE)} className="rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Load more ({(result.total - list.length).toLocaleString("en-IN")} more)</button></div>
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">{showSelected ? "No questions picked yet." : "No questions match these filters."}</p>
        )}
      </div>
    </div>
  );
}
