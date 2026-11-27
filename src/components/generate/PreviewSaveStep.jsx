import { useEffect, useRef, useState } from "react";
import { ArrowLeft, AlignCenter, Shuffle, Upload, Trash2, FileDown, FileText, Printer, PencilRuler, CircleCheck, Minus, Plus, FileImage, ListChecks } from "lucide-react";
import Toggle from "../ui/Toggle";
import Button from "../ui/Button";
import DocumentPreview from "../paper/DocumentPreview";
import QuestionCards from "../paper/QuestionCards";
import { buildSets, savePaper } from "../../services/paperService";
import { exportPdf, exportWord, printPaper } from "../../services/exportService";
import { DIAGRAM_HEIGHTS, FONT_FAMILIES, MM_TO_PX, OPTION_LABELS, OPTION_LAYOUTS, OUTPUT_MODES, getLayout, pageMetrics, setDisplay } from "../../services/paperLayout";
import { SET_LABELS } from "../../data/exams";
import { readImageFile } from "../../utils/image";
import { storage } from "../../services/storage";

const FONT_SIZES_PX = [12, 13, 14, 15, 16];
const LINE = [["Compact", 1], ["Standard", 1.15], ["Relaxed", 1.5]];
const control = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function Section({ title, hint, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2.5">
        {Icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Icon className="h-4 w-4" /></span>}
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
const Label = ({ children }) => <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;

function Segmented({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {options.map(([label, v]) => (
        <button key={label} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${value === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>
      ))}
    </div>
  );
}

function Stepper({ label, value, onChange, min = 0, max = 9999, suffix }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-9 items-center rounded-lg border border-slate-300 bg-white">
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="px-3 text-slate-500 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
        <input type="number" value={value} min={min} max={max} aria-label={label} onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); }} className="min-w-0 flex-1 bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none" />
        {suffix && <span className="pr-1 text-xs text-slate-400">{suffix}</span>}
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="px-3 text-slate-500 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// Last header used (college, tagline, logo…) so the next paper starts with it.
export const rememberHeader = (layout) => storage.set("lastHeader", { header: layout.header, watermark: layout.watermark });
export const lastHeader = () => storage.get("lastHeader");

// Step "Preview & Save": settings on the left, the live paper on the right. Every change is saved.
export default function PreviewSaveStep({ paper: initial, onBack, onStatus, onOpenEditor, onFinish, toast }) {
  const [paper, setPaper] = useState(initial);
  const [setLabel, setSetLabel] = useState("A");
  const [exportScope, setExportScope] = useState("current");
  const [busy, setBusy] = useState("");
  const [fit, setFit] = useState(0.7);
  const [view, setView] = useState("paper"); // "paper" | "cards"
  const viewport = useRef(null);
  const timer = useRef(null);
  const latest = useRef(initial);
  const layout = getLayout(paper);
  const pageWidthPx = pageMetrics(layout).width * MM_TO_PX;

  useEffect(() => {
    const el = viewport.current;
    if (!el) return undefined;
    const update = () => setFit(Math.max(0.3, Math.min(1.2, (el.clientWidth - 24) / pageWidthPx)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidthPx]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next) => {
    latest.current = next;
    setPaper(next);
    onStatus?.("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const saved = await savePaper(next);
        if (latest.current === next) {
          latest.current = saved;
          setPaper(saved);
        }
        onStatus?.("saved");
      } catch (err) {
        onStatus?.("error");
        toast?.error(err.message || "Could not save the draft");
      }
    }, 500);
  };
  const setLayout = (fn) => {
    const nextLayout = fn(getLayout(latest.current));
    commit({ ...latest.current, layout: nextLayout });
    rememberHeader(nextLayout);
  };
  const setStyles = (fn) => setLayout((l) => ({ ...l, styles: Object.fromEntries(Object.entries(l.styles).map(([k, v]) => [k, fn(k, v)])) }));

  const setCount = paper.sets.length;
  const setNames = SET_LABELS.slice(0, setCount).map((l) => setDisplay(layout, l));
  const rebuildSets = (n) => {
    const cfg = { ...paper.config, setCount: n };
    commit({ ...latest.current, config: cfg, sets: buildSets(latest.current, n, cfg) });
    if (!SET_LABELS.slice(0, n).includes(setLabel)) setSetLabel("A");
  };
  const marks = paper.questions[0]?.marks ?? 4;
  const qPx = Math.round((layout.styles.question.fontSize * 4) / 3);

  const doExport = async (kind) => {
    setBusy(kind);
    const options = { sets: exportScope === "all" ? SET_LABELS.slice(0, setCount) : [setLabel] };
    try {
      if (kind === "word") await exportWord(latest.current, options);
      else if (kind === "print") await printPaper(latest.current, options);
      else await exportPdf(latest.current, options);
      toast?.info(kind === "word" ? "Word file downloaded." : kind === "print" ? "Print dialog opened." : "Print dialog opened — choose “Save as PDF”.");
    } catch (err) {
      toast?.error(err.message || "Export failed");
    } finally {
      setBusy("");
    }
  };

  const uploadLogo = async (file) => {
    try {
      const logo = await readImageFile(file, { maxSide: 500 });
      setLayout((l) => ({ ...l, header: { ...l.header, logo } }));
    } catch (err) {
      toast?.error(err.message);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-3 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-1">
        <Section title="Layout & alignment" hint="Every change shows on the paper on the right." icon={AlignCenter}>
          <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{paper.questions.length} questions</span>
          <Button variant="secondary" fullWidth icon={ArrowLeft} onClick={onBack}>Back</Button>
          <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-indigo-800"><Shuffle className="h-4 w-4" />Generate {setCount} set{setCount > 1 ? "s" : ""} ({setNames.join(", ")})</p>
            <div className="flex flex-wrap gap-1">
              {SET_LABELS.map((l, i) => (
                <button key={l} type="button" aria-pressed={setCount === i + 1} onClick={() => rebuildSets(i + 1)} className={`h-8 w-8 rounded-lg border text-xs font-bold ${setCount === i + 1 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600"}`}>{i + 1}</button>
              ))}
            </div>
            <div className="mt-2"><Segmented value={layout.setNames} options={[["P, Q, R, S", "pqrs"], ["A, B, C, D", "letters"]]} onChange={(v) => setLayout((l) => ({ ...l, setNames: v }))} /></div>
          </div>
          <div>
            <Label>Output</Label>
            <select value={layout.output} onChange={(e) => setLayout((l) => ({ ...l, output: e.target.value }))} className={control} aria-label="Output">
              {OUTPUT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </Section>

        <Section title="Show or hide">
          <Toggle id="ps-num" checked={layout.showNumbers !== false} onChange={(v) => setLayout((l) => ({ ...l, showNumbers: v }))} label="Question numbers" description="Print 1, 2, 3… before each question." />
          <Toggle id="ps-marks" checked={layout.showMarks} onChange={(v) => setLayout((l) => ({ ...l, showMarks: v }))} label="Marks on each question" description={`Show [${marks}] beside every question.`} />
          <Toggle id="ps-img" checked={layout.imageBelow} onChange={(v) => setLayout((l) => ({ ...l, imageBelow: v }))} label="Image below question" description="Move diagrams under the question text." />
        </Section>

        <Section title="Header" hint="College details printed at the top.">
          {[["college", "College name"], ["university", "Tagline / place"], ["examination", "Examination name"], ["className", "Class"]].map(([k, label]) => (
            <div key={k}><Label>{label}</Label><input aria-label={label} value={layout.header[k] ?? ""} onChange={(e) => setLayout((l) => ({ ...l, header: { ...l.header, [k]: e.target.value } }))} className={control} /></div>
          ))}
          <div className="flex items-center gap-2">
            {layout.header.logo?.src && <img src={layout.header.logo.src} alt="College logo" className="h-10 w-auto rounded border border-slate-200" />}
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />{layout.header.logo?.src ? "Replace logo" : "Upload college logo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </label>
            {layout.header.logo?.src && <button type="button" aria-label="Remove logo" onClick={() => setLayout((l) => ({ ...l, header: { ...l.header, logo: null } }))} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
          </div>
        </Section>

        <Section title="Typography" hint="Font, size and spacing of the text.">
          <div>
            <Label>Font style</Label>
            <select value={layout.styles.question.fontFamily} onChange={(e) => setStyles((_, s) => ({ ...s, fontFamily: e.target.value }))} className={control} aria-label="Font style">
              {FONT_FAMILIES.slice(0, 8).map((f) => <option key={f.value} value={f.value}>{f.value}{f.value === "Times New Roman" ? " (Standard)" : ""}</option>)}
            </select>
          </div>
          <div>
            <Label>Font size</Label>
            <select value={FONT_SIZES_PX.includes(qPx) ? qPx : ""} onChange={(e) => { const pt = Number(e.target.value) * 0.75; setStyles((k, s) => (k === "question" || k === "option" ? { ...s, fontSize: pt } : s)); }} className={control} aria-label="Font size">
              {!FONT_SIZES_PX.includes(qPx) && <option value="">Custom ({qPx}px)</option>}
              {FONT_SIZES_PX.map((px) => <option key={px} value={px}>{px === 13 ? "Standard (13px)" : px < 13 ? `Small (${px}px)` : `Large (${px}px)`}</option>)}
            </select>
          </div>
          <div>
            <Label>Line height</Label>
            <Segmented value={layout.styles.question.lineHeight} options={LINE} onChange={(v) => setStyles((k, s) => (k === "question" || k === "option" ? { ...s, lineHeight: v } : s))} />
          </div>
          <div>
            <Label>Diagram max height</Label>
            <Segmented value={layout.diagramMaxHeight} options={DIAGRAM_HEIGHTS.map((h) => [h === 260 ? "260 ★" : String(h), h])} onChange={(v) => setLayout((l) => ({ ...l, diagramMaxHeight: v }))} />
          </div>
        </Section>

        <Section title="Numbers and marks">
          <Stepper label="Start numbering at Q.#" value={layout.numbering.start} min={1} max={9999} onChange={(v) => setLayout((l) => ({ ...l, numbering: { ...l.numbering, start: v } }))} />
          <Stepper label="Duration" value={paper.durationMinutes} min={10} max={600} suffix="min" onChange={(v) => commit({ ...latest.current, durationMinutes: v })} />
          <Stepper label="Marks per question" value={marks} min={0} max={100} onChange={(v) => commit({ ...latest.current, questions: latest.current.questions.map((q) => ({ ...q, marks: v })) })} />
        </Section>

        <Section title="Watermark" hint="A faint college emblem behind the text.">
          <Toggle id="ps-emblem" checked={layout.watermark.emblem} onChange={(v) => setLayout((l) => ({ ...l, watermark: { ...l.watermark, emblem: v, opacity: v && l.watermark.opacity > 0.3 ? 0.08 : l.watermark.opacity } }))} label="Show college emblem" description={layout.header.logo?.src ? "Turn off for a plain paper." : "Upload a college logo in Header first."} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Opacity {Math.round(layout.watermark.opacity * 100)}%
              <input type="range" min={0.03} max={0.3} step={0.01} value={layout.watermark.opacity} onChange={(e) => setLayout((l) => ({ ...l, watermark: { ...l.watermark, opacity: Number(e.target.value) } }))} className="mt-2 w-full accent-indigo-600" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Size {layout.watermark.emblemSize}%
              <input type="range" min={40} max={150} step={5} value={layout.watermark.emblemSize} onChange={(e) => setLayout((l) => ({ ...l, watermark: { ...l.watermark, emblemSize: Number(e.target.value) } }))} className="mt-2 w-full accent-indigo-600" />
            </label>
          </div>
        </Section>

        <Section title="Options" hint="How the four choices are labelled and arranged.">
          <div><Label>Option numbering</Label><Segmented value={layout.optionLabels} options={OPTION_LABELS.map((o) => [o.label, o.value])} onChange={(v) => setLayout((l) => ({ ...l, optionLabels: v }))} /></div>
          <div><Label>Options layout</Label><Segmented value={layout.optionLayout} options={OPTION_LAYOUTS.map((o) => [o.label, o.value])} onChange={(v) => setLayout((l) => ({ ...l, optionLayout: v }))} /></div>
        </Section>

        <Section title="Save & download">
          <Segmented value={exportScope} options={[["Current set", "current"], ["All sets", "all"]]} onChange={setExportScope} />
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" icon={FileDown} loading={busy === "pdf"} onClick={() => doExport("pdf")}>PDF</Button>
            <Button size="sm" variant="secondary" icon={FileText} loading={busy === "word"} onClick={() => doExport("word")}>Word</Button>
            <Button size="sm" variant="secondary" icon={Printer} loading={busy === "print"} onClick={() => doExport("print")}>Print</Button>
          </div>
          <Button variant="secondary" fullWidth icon={PencilRuler} onClick={() => onOpenEditor(latest.current)}>Open in full editor</Button>
          <Button fullWidth icon={CircleCheck} className="!bg-emerald-600 hover:!bg-emerald-700" onClick={() => onFinish(latest.current)}>Save & finish</Button>
        </Section>
      </aside>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="View">
            {[["paper", "Paper view", FileImage], ["cards", "Edit questions", ListChecks]].map(([v, label, Icon]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
            ))}
          </div>
          {view === "paper" ? (
            <>
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Set</span>
              {SET_LABELS.slice(0, setCount).map((l) => (
                <button key={l} type="button" aria-pressed={setLabel === l} onClick={() => setSetLabel(l)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold ${setLabel === l ? "bg-indigo-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{setDisplay(layout, l)}</button>
              ))}
            </>
          ) : (
            <span className="text-xs text-slate-500">Click a pencil to edit · click a letter to set the correct answer · changes apply to every set</span>
          )}
        </div>
        <div ref={viewport} className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 px-3 py-5 xl:max-h-[calc(100vh-11rem)]">
          {view === "paper"
            ? <DocumentPreview paper={paper} setLabel={setLabel} zoom={fit} />
            : <QuestionCards paper={paper} onChange={(fn) => commit(fn(latest.current))} />}
        </div>
      </div>
    </div>
  );
}
