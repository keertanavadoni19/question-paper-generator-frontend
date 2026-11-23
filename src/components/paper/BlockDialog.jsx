import { useState } from "react";
import { Minus, Plus, Upload } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { ELEMENTS } from "../../services/paperLayout";
import { readImageFile } from "../../utils/image";

const TITLES = { table: "Table", text: "Text / list", image: "Image" };
const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export const newBlock = (type) => {
  if (type === "table") return { type, header: true, rows: [["Column 1", "Column 2", "Column 3"], ["", "", ""], ["", "", ""]] };
  if (type === "text") return { type, text: "", list: "none", styleAs: "question" };
  if (type === "image") return { type, src: "", ratio: 1, width: 50, align: "center", alt: "" };
  return { type };
};

function Stepper({ label, value, onChange, min, max }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <Button size="icon" variant="secondary" icon={Minus} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} />
      <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
      <Button size="icon" variant="secondary" icon={Plus} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} />
    </div>
  );
}

// Create or edit an inserted table, text block or image.
export default function BlockDialog({ block, onSave, onClose }) {
  const [b, setB] = useState(() => structuredClone(block));
  const [error, setError] = useState("");
  const set = (key, value) => setB((prev) => ({ ...prev, [key]: value }));

  const resize = (rows, cols) =>
    set("rows", Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => b.rows[r]?.[c] ?? "")));
  const setCell = (r, c, value) => set("rows", b.rows.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row)));

  const pickImage = async (file) => {
    setError("");
    try {
      const { src, ratio } = await readImageFile(file, { maxSide: 1400 });
      setB((prev) => ({ ...prev, src, ratio, alt: prev.alt || file.name.replace(/\.[^.]+$/, "") }));
    } catch (err) {
      setError(err.message);
    }
  };

  const valid = b.type === "image" ? Boolean(b.src) : b.type === "text" ? Boolean(b.text?.trim()) : true;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${block.id ? "Edit" : "Insert"} ${TITLES[b.type].toLowerCase()}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave(b)}>{block.id ? "Save" : "Insert"}</Button></>}
    >
      {b.type === "table" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-5">
            <Stepper label="Rows" value={b.rows.length} min={1} max={30} onChange={(n) => resize(n, b.rows[0].length)} />
            <Stepper label="Columns" value={b.rows[0].length} min={1} max={8} onChange={(n) => resize(b.rows.length, n)} />
            <Toggle id="blk-head" checked={b.header} onChange={(v) => set("header", v)} label="Header row" />
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cellValue, c) => (
                      <td key={c} className="border border-slate-200 p-0">
                        <input
                          value={cellValue}
                          onChange={(e) => setCell(r, c, e.target.value)}
                          aria-label={`Row ${r + 1}, column ${c + 1}`}
                          className={`w-full min-w-[90px] px-2 py-1.5 focus:bg-indigo-50 focus:outline-none ${r === 0 && b.header ? "bg-slate-50 font-semibold" : ""}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {b.type === "text" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Text <span className="font-normal text-slate-500">(each line is a paragraph or list item)</span>
            <textarea autoFocus rows={6} value={b.text} onChange={(e) => set("text", e.target.value)} className={`${input} mt-1`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              List style
              <select value={b.list} onChange={(e) => set("list", e.target.value)} className={`${input} mt-1`}>
                <option value="none">Paragraphs</option>
                <option value="bullet">Bullet points</option>
                <option value="number">Numbered list</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Format like
              <select value={b.styleAs} onChange={(e) => set("styleAs", e.target.value)} className={`${input} mt-1`}>
                {ELEMENTS.map((el) => <option key={el.id} value={el.id}>{el.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {b.type === "image" && (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/40">
            <Upload className="h-4 w-4" />
            {b.src ? "Replace image" : "Choose an image (PNG, JPG…)"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
          </label>
          {b.src && (
            <div className="rounded-lg bg-slate-50 p-3" style={{ textAlign: b.align }}>
              <img src={b.src} alt={b.alt} className="inline-block max-h-48" style={{ width: `${b.width}%` }} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Width: {b.width}% of the text width
              <input type="range" min={10} max={100} step={5} value={b.width} onChange={(e) => set("width", Number(e.target.value))} className="mt-2 w-full accent-indigo-600" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Alignment
              <select value={b.align} onChange={(e) => set("align", e.target.value)} className={`${input} mt-1`}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Description (alt text)
            <input value={b.alt} onChange={(e) => set("alt", e.target.value)} className={`${input} mt-1`} />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
