import { useState } from "react";
import {
  Undo2, Redo2, Search, ZoomIn, ZoomOut, Maximize2, Minimize2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Pilcrow, FileDown, FileText, Printer, SeparatorHorizontal, Minus, Table2, Type, Image as ImageIcon, Upload, Trash2,
  Pencil, Layers, Plus, RotateCcw, ScrollText, Eraser,
} from "lucide-react";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { useToast } from "../../context/ToastContext";
import {
  ELEMENTS, FONT_FAMILIES, FONT_SIZES, HEADER_FIELDS, LINE_SPACINGS, MARGIN_PRESETS, NUMBER_FORMATS, PAGE_NUMBER_FORMATS, PAGE_NUMBER_POSITIONS,
  PAPER_SIZES, DEFAULT_STYLES, fontCss,
} from "../../services/paperLayout";
import { readImageFile } from "../../utils/image";

const TABS = [
  ["edit", "Edit"],
  ["numbering", "Numbering"],
  ["font", "Font"],
  ["paragraph", "Paragraph"],
  ["page", "Page layout"],
  ["headerFooter", "Header & footer"],
  ["insert", "Insert"],
  ["export", "Export"],
];

const control = "h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400";

function Group({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function IconToggle({ icon: Icon, label, active, onClick, disabled }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition disabled:opacity-40 ${active ? "border-indigo-300 bg-indigo-100 text-indigo-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, unit, width = "w-20" }) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max ?? n, Math.max(min ?? n, n)));
        }}
        className={`${control} ${width} tabular-nums`}
      />
      {unit && <span className="text-slate-400">{unit}</span>}
    </label>
  );
}

function ElementPicker({ value, onChange }) {
  return (
    <Group label="Apply to">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${control} min-w-[170px]`} aria-label="Document element to format">
        {ELEMENTS.map((el) => <option key={el.id} value={el.id}>{el.label}</option>)}
      </select>
    </Group>
  );
}

function ColorField({ label, value, onChange, onClear }) {
  return (
    <label className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-600" title={label}>
      <span className="h-4 w-4 rounded border border-slate-300" style={{ background: value || "repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%) 0 0 / 8px 8px" }} />
      {label}
      <input type="color" value={value || "#ffff00"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
      {onClear && value && (
        <button type="button" onClick={(e) => { e.preventDefault(); onClear(); }} className="relative z-10 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label={`Remove ${label.toLowerCase()}`}>
          <Eraser className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

// ── Panels ─────────────────────────────────────────────────────
function NumberingPanel({ layout, onLayout }) {
  const n = layout.numbering;
  const set = (patch, group) => onLayout((l) => ({ ...l, numbering: { ...l.numbering, ...patch } }), group);
  return (
    <>
      <Group label="Start numbering at">
        <NumberField label="" value={n.start} min={0} max={99999} onChange={(v) => set({ start: Math.floor(v) }, "num-start")} width="w-24" />
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set({ start: 1 })} disabled={n.start === 1}>Reset to 1</Button>
      </Group>
      <Group label="Scope">
        <select value={n.scope} onChange={(e) => set({ scope: e.target.value })} className={control} aria-label="Numbering scope">
          <option value="continuous">Continuous across sections</option>
          <option value="section">Restart in each section</option>
        </select>
      </Group>
      <Group label="Format">
        <select value={n.format} onChange={(e) => set({ format: e.target.value })} className={control} aria-label="Number format">
          {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label.replace("1", String(n.start))}</option>)}
        </select>
      </Group>
      <Group label="Marks">
        <Toggle id="tb-marks" checked={layout.showMarks} onChange={(v) => onLayout((l) => ({ ...l, showMarks: v }))} label="Show marks beside each question" />
      </Group>
    </>
  );
}

function FontPanel({ layout, onLayout, element, setElement }) {
  const s = layout.styles[element];
  const [custom, setCustom] = useState(false);
  const set = (patch, group) => onLayout((l) => ({ ...l, styles: { ...l.styles, [element]: { ...l.styles[element], ...patch } } }), group);
  const sizeInList = FONT_SIZES.includes(s.fontSize);
  return (
    <>
      <ElementPicker value={element} onChange={setElement} />
      <Group label="Font">
        <select value={s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className={`${control} w-44`} style={{ fontFamily: fontCss(s.fontFamily) }} aria-label="Font family">
          {FONT_FAMILIES.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.value}</option>)}
        </select>
        {custom || !sizeInList ? (
          <NumberField label="" value={s.fontSize} min={6} max={72} step={0.5} unit="pt" onChange={(v) => set({ fontSize: v }, `size-${element}`)} width="w-16" />
        ) : (
          <select value={s.fontSize} onChange={(e) => (e.target.value === "custom" ? setCustom(true) : set({ fontSize: Number(e.target.value) }))} className={`${control} w-20`} aria-label="Font size">
            {FONT_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="custom">Custom…</option>
          </select>
        )}
        <Button size="sm" variant="ghost" onClick={() => onLayout((l) => ({ ...l, styles: Object.fromEntries(Object.entries(l.styles).map(([k, v]) => [k, { ...v, fontFamily: s.fontFamily }])) }))}>
          Use this font everywhere
        </Button>
      </Group>
      <Group label="Style">
        <IconToggle icon={Bold} label="Bold" active={s.bold} onClick={() => set({ bold: !s.bold })} />
        <IconToggle icon={Italic} label="Italic" active={s.italic} onClick={() => set({ italic: !s.italic })} />
        <IconToggle icon={Underline} label="Underline" active={s.underline} onClick={() => set({ underline: !s.underline })} />
        <ColorField label="Text colour" value={s.color} onChange={(v) => set({ color: v }, `color-${element}`)} />
        <ColorField label="Highlight" value={s.highlight} onChange={(v) => set({ highlight: v }, `hl-${element}`)} onClear={() => set({ highlight: "" })} />
      </Group>
      <Group label="Reset">
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set(DEFAULT_STYLES[element])}>Reset {ELEMENTS.find((e) => e.id === element)?.label.toLowerCase()}</Button>
      </Group>
    </>
  );
}

function ParagraphPanel({ layout, onLayout, element, setElement }) {
  const s = layout.styles[element];
  const set = (patch, group) => onLayout((l) => ({ ...l, styles: { ...l.styles, [element]: { ...l.styles[element], ...patch } } }), group);
  return (
    <>
      <ElementPicker value={element} onChange={setElement} />
      <Group label="Alignment">
        <IconToggle icon={AlignLeft} label="Align left" active={s.align === "left"} onClick={() => set({ align: "left" })} />
        <IconToggle icon={AlignCenter} label="Align centre" active={s.align === "center"} onClick={() => set({ align: "center" })} />
        <IconToggle icon={AlignRight} label="Align right" active={s.align === "right"} onClick={() => set({ align: "right" })} />
        <IconToggle icon={AlignJustify} label="Justify" active={s.align === "justify"} onClick={() => set({ align: "justify" })} />
      </Group>
      <Group label="Spacing">
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Line
          <select value={s.lineHeight} onChange={(e) => set({ lineHeight: Number(e.target.value) })} className={`${control} w-20`} aria-label="Line spacing">
            {[...new Set([...LINE_SPACINGS, s.lineHeight])].sort().map((v) => <option key={v} value={v}>{v.toFixed(v === 1.15 ? 2 : 1)}</option>)}
          </select>
        </label>
        <NumberField label="Before" value={s.spaceBefore} min={0} max={72} unit="pt" onChange={(v) => set({ spaceBefore: v }, `sb-${element}`)} width="w-16" />
        <NumberField label="After" value={s.spaceAfter} min={0} max={72} unit="pt" onChange={(v) => set({ spaceAfter: v }, `sa-${element}`)} width="w-16" />
        <NumberField label="Indent" value={s.indent} min={0} max={80} step={0.5} unit="mm" onChange={(v) => set({ indent: v }, `in-${element}`)} width="w-16" />
      </Group>
      <Group label="Instruction list">
        <IconToggle icon={ListOrdered} label="Numbered list" active={layout.instructionsList === "numbered"} onClick={() => onLayout((l) => ({ ...l, instructionsList: "numbered" }))} />
        <IconToggle icon={List} label="Bullet points" active={layout.instructionsList === "bulleted"} onClick={() => onLayout((l) => ({ ...l, instructionsList: "bulleted" }))} />
        <IconToggle icon={Pilcrow} label="Plain paragraphs" active={layout.instructionsList === "plain"} onClick={() => onLayout((l) => ({ ...l, instructionsList: "plain" }))} />
      </Group>
      <Group label="Section headings">
        <Toggle id="tb-bar" checked={layout.sectionBar} onChange={(v) => onLayout((l) => ({ ...l, sectionBar: v }))} label="Grey heading bar" />
      </Group>
    </>
  );
}

function PagePanel({ layout, onLayout }) {
  const p = layout.page;
  const set = (patch, group) => onLayout((l) => ({ ...l, page: { ...l.page, ...patch } }), group);
  const preset = MARGIN_PRESETS[p.margins];
  const current = p.margins === "custom" ? p.custom : preset;
  const setMargin = (side, v) => set({ margins: "custom", custom: { ...current, [side]: v } }, `margin-${side}`);
  return (
    <>
      <Group label="Paper">
        <select value={p.size} onChange={(e) => set({ size: e.target.value })} className={control} aria-label="Paper size">
          {Object.entries(PAPER_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={p.orientation} onChange={(e) => set({ orientation: e.target.value })} className={control} aria-label="Orientation">
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </Group>
      <Group label="Margins">
        <select value={p.margins} onChange={(e) => set({ margins: e.target.value, ...(e.target.value === "custom" ? { custom: current } : {}) })} className={control} aria-label="Margins">
          {Object.entries(MARGIN_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {["top", "bottom", "left", "right"].map((side) => (
          <NumberField key={side} label={side[0].toUpperCase() + side.slice(1)} value={+current[side].toFixed(2)} min={0} max={80} step={0.5} unit="mm" onChange={(v) => setMargin(side, v)} width="w-16" />
        ))}
      </Group>
      <Group label="Header / footer distance">
        <NumberField label="Header" value={p.headerDistance} min={0} max={50} step={0.5} unit="mm" onChange={(v) => set({ headerDistance: v }, "hd")} width="w-16" />
        <NumberField label="Footer" value={p.footerDistance} min={0} max={50} step={0.5} unit="mm" onChange={(v) => set({ footerDistance: v }, "fd")} width="w-16" />
      </Group>
      <Group label="Border">
        <Toggle id="tb-border" checked={p.border} onChange={(v) => set({ border: v })} label="Page border" />
      </Group>
    </>
  );
}

function HeaderFooterPanel({ layout, onLayout }) {
  const toast = useToast();
  const h = layout.header;
  const setHeader = (patch, group) => onLayout((l) => ({ ...l, header: { ...l.header, ...patch } }), group);
  const setFooter = (patch, group) => onLayout((l) => ({ ...l, footer: { ...l.footer, ...patch } }), group);
  const uploadLogo = async (file) => {
    try {
      setHeader({ logo: await readImageFile(file, { maxSide: 500 }) });
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <div className="w-full space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {HEADER_FIELDS.map(([key, label]) => (
          <label key={key} className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {label}
            <input value={h[key] ?? ""} onChange={(e) => setHeader({ [key]: e.target.value }, `h-${key}`)} className={`${control} mt-1 w-full normal-case tracking-normal`} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Group label="Logo">
          {h.logo?.src && <img src={h.logo.src} alt="College logo" className="h-8 w-auto rounded border border-slate-200" />}
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="h-3.5 w-3.5" />{h.logo?.src ? "Replace" : "Upload logo"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </label>
          {h.logo?.src && <IconToggle icon={Trash2} label="Remove logo" onClick={() => setHeader({ logo: null })} />}
        </Group>
        <Group label="Set badge">
          <Toggle id="tb-set" checked={h.showSetBadge} onChange={(v) => setHeader({ showSetBadge: v })} label="Show “SET A” box" />
        </Group>
        <Group label="Running header (every page)" className="min-w-[200px] flex-1">
          <input value={layout.runningHeader} onChange={(e) => onLayout((l) => ({ ...l, runningHeader: e.target.value }), "runhead")} placeholder="e.g. {title} – Set {set}" className={`${control} w-full`} />
        </Group>
        <Group label="Footer text" className="min-w-[200px] flex-1">
          <input value={layout.footer.text} onChange={(e) => setFooter({ text: e.target.value }, "foot")} placeholder="e.g. Confidential – do not copy" className={`${control} w-full`} />
        </Group>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Group label="Page numbers">
          <select value={layout.footer.pageNumbers} onChange={(e) => setFooter({ pageNumbers: e.target.value })} className={control} aria-label="Page number position">
            {PAGE_NUMBER_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={layout.footer.format} onChange={(e) => setFooter({ format: e.target.value })} disabled={layout.footer.pageNumbers === "none"} className={control} aria-label="Page number format">
            {PAGE_NUMBER_FORMATS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Group>
        <Group label="End of paper note" className="min-w-[200px] flex-1">
          <input value={layout.endNote} onChange={(e) => onLayout((l) => ({ ...l, endNote: e.target.value }), "endnote")} placeholder="Leave empty to hide" className={`${control} w-full`} />
        </Group>
      </div>
      <p className="text-xs text-slate-500">Use <code className="rounded bg-slate-100 px-1">{"{set}"}</code> and <code className="rounded bg-slate-100 px-1">{"{title}"}</code> in the header, footer or end note.</p>
    </div>
  );
}

function InsertPanel({ layout, onLayout, insertTarget, onInsert, onEditInstructions }) {
  const w = layout.watermark;
  const setWm = (patch, group) => onLayout((l) => ({ ...l, watermark: { ...l.watermark, ...patch } }), group);
  return (
    <>
      <Group label={`Insert ${insertTarget}`}>
        <Button size="sm" variant="secondary" icon={SeparatorHorizontal} onClick={() => onInsert("pageBreak")}>Page break</Button>
        <Button size="sm" variant="secondary" icon={Minus} onClick={() => onInsert("hr")}>Line</Button>
        <Button size="sm" variant="secondary" icon={Table2} onClick={() => onInsert("table")}>Table</Button>
        <Button size="sm" variant="secondary" icon={Type} onClick={() => onInsert("text")}>Text / list</Button>
        <Button size="sm" variant="secondary" icon={ImageIcon} onClick={() => onInsert("image")}>Image</Button>
      </Group>
      <Group label="Instructions">
        <Button size="sm" variant="secondary" icon={ScrollText} onClick={onEditInstructions}>Edit instructions</Button>
      </Group>
      <Group label="Watermark">
        <input value={w.text} onChange={(e) => setWm({ text: e.target.value }, "wm")} placeholder="None" className={`${control} w-32`} aria-label="Watermark text" />
        {["DRAFT", "CONFIDENTIAL", "SAMPLE"].map((t) => (
          <Button key={t} size="sm" variant={w.text === t ? "soft" : "ghost"} onClick={() => setWm({ text: t })}>{t}</Button>
        ))}
        {w.text && <Button size="sm" variant="ghost" onClick={() => setWm({ text: "" })}>Remove</Button>}
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Opacity
          <input type="range" min={0.05} max={0.5} step={0.05} value={w.opacity} onChange={(e) => setWm({ opacity: Number(e.target.value) }, "wm-op")} className="w-20 accent-indigo-600" />
        </label>
      </Group>
    </>
  );
}

// ── Toolbar ────────────────────────────────────────────────────
export default function EditorToolbar({
  layout, onLayout, tab, onTab, editMode, onToggleEdit, onOpenSections, onAddQuestion, sections,
  canUndo, canRedo, onUndo, onRedo, onFind, zoomLabel, onZoomIn, onZoomOut, onZoomFit, fullscreen, onFullscreen,
  insertTarget, onInsert, onEditInstructions, onExport,
}) {
  const [element, setElement] = useState("question");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-2 py-1.5">
        <div role="tablist" aria-label="Editor tools" className="flex min-w-0 basis-full gap-0.5 overflow-x-auto sm:basis-0 sm:flex-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => onTab(tab === value ? null : value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === value ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconToggle icon={Undo2} label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
          <IconToggle icon={Redo2} label="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo} />
          <IconToggle icon={Search} label="Find and replace (Ctrl+H)" onClick={onFind} />
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <IconToggle icon={ZoomOut} label="Zoom out" onClick={onZoomOut} />
          <button type="button" onClick={onZoomFit} title="Fit to width" className="h-8 min-w-[52px] rounded-md px-1 text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-100">{zoomLabel}</button>
          <IconToggle icon={ZoomIn} label="Zoom in" onClick={onZoomIn} />
          <IconToggle icon={fullscreen ? Minimize2 : Maximize2} label={fullscreen ? "Exit full screen" : "Full screen"} onClick={onFullscreen} />
        </div>
      </div>

      {tab && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-3 py-3">
          {tab === "edit" && (
            <>
              <Group label="Mode">
                <Button size="sm" variant={editMode ? "soft" : "secondary"} icon={Pencil} onClick={onToggleEdit}>{editMode ? "Editing on" : "Turn on editing"}</Button>
              </Group>
              <Group label="Sections">
                <Button size="sm" variant="secondary" icon={Layers} onClick={onOpenSections}>Headings, order & marks</Button>
              </Group>
              <Group label="Add question to">
                {sections.map((s) => <Button key={s.subjectId} size="sm" variant="secondary" icon={Plus} onClick={() => onAddQuestion(s)}>{s.name}</Button>)}
              </Group>
              <p className="max-w-sm text-xs text-slate-500">
                {editMode ? "Click a question to select it, double-click to edit it on the page, or drag it to reorder." : "Turn on editing to change questions directly on the page."}
              </p>
            </>
          )}
          {tab === "numbering" && <NumberingPanel layout={layout} onLayout={onLayout} />}
          {tab === "font" && <FontPanel layout={layout} onLayout={onLayout} element={element} setElement={setElement} />}
          {tab === "paragraph" && <ParagraphPanel layout={layout} onLayout={onLayout} element={element} setElement={setElement} />}
          {tab === "page" && <PagePanel layout={layout} onLayout={onLayout} />}
          {tab === "headerFooter" && <HeaderFooterPanel layout={layout} onLayout={onLayout} />}
          {tab === "insert" && <InsertPanel layout={layout} onLayout={onLayout} insertTarget={insertTarget} onInsert={onInsert} onEditInstructions={onEditInstructions} />}
          {tab === "export" && (
            <Group label="Download">
              <Button size="sm" icon={FileDown} onClick={() => onExport("pdf")}>PDF</Button>
              <Button size="sm" variant="secondary" icon={FileText} onClick={() => onExport("word")}>Word (.docx)</Button>
              <Button size="sm" variant="secondary" icon={Printer} onClick={() => onExport("print")}>Print</Button>
              <span className="text-xs text-slate-500">Exports use the same fonts, numbering, margins and header/footer as this preview.</span>
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
