import { useState } from "react";
import { FileDown, FileText, Printer } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { exportPdf, exportWord, printPaper } from "../../services/exportService";

const FORMATS = [
  { value: "pdf", label: "PDF", hint: "Print dialog → “Save as PDF”", icon: FileDown },
  { value: "word", label: "Word (.docx)", hint: "Editable in MS Word / Google Docs", icon: FileText },
  { value: "print", label: "Print", hint: "Send straight to a printer", icon: Printer },
];

// Exports use the paper's layout (fonts, numbering, page setup, header/footer) — the same as the preview.
export default function ExportDialog({ open, onClose, paper, initialSet = "A", initialFormat = "pdf", onExported }) {
  const [format, setFormat] = useState(initialFormat);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("paper");
  const [sets, setSets] = useState([initialSet]);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [includeSolutions, setIncludeSolutions] = useState(false);

  const allLabels = paper.sets.map((s) => s.label);
  const toggleSet = (label) =>
    setSets((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label].sort()));

  const handleExport = async () => {
    const options = { sets, includeAnswerKey, includeSolutions, answerKeyOnly: content === "key" };
    setBusy(true);
    try {
      if (format === "word") await exportWord(paper, options);
      else if (format === "print") await printPaper(paper, options);
      else await exportPdf(paper, options);
      onExported?.(format);
      onClose();
    } catch (err) {
      onExported?.(format, err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export paper"
      description={paper.title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={format === "print" ? Printer : FileDown} onClick={handleExport} disabled={!sets.length} loading={busy} loadingText="Preparing…">
            Export {sets.length > 1 ? `${sets.length} sets` : `Set ${sets[0] ?? ""}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Format</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {FORMATS.map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                className={`rounded-xl border p-3 text-left transition ${format === value ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300"}`}
              >
                <Icon className={`mb-1 h-5 w-5 ${format === value ? "text-indigo-600" : "text-slate-500"}`} />
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Content</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" className="accent-indigo-600" checked={content === "paper"} onChange={() => setContent("paper")} />Question paper</label>
            <label className="flex items-center gap-2"><input type="radio" className="accent-indigo-600" checked={content === "key"} onChange={() => setContent("key")} />Answer key only</label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Sets</p>
            <button type="button" className="text-xs font-medium text-indigo-600" onClick={() => setSets(sets.length === allLabels.length ? [initialSet] : allLabels)}>
              {sets.length === allLabels.length ? "Clear" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleSet(label)}
                aria-pressed={sets.includes(label)}
                className={`h-10 w-10 rounded-lg border text-sm font-bold transition ${sets.includes(label) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {!sets.length && <p className="mt-1 text-xs text-red-600">Select at least one set.</p>}
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          {content === "paper" && (
            <Toggle id="exp-key" checked={includeAnswerKey} onChange={setIncludeAnswerKey} label="Append answer key" description="Adds the key on a new page after each set" />
          )}
          <Toggle id="exp-sol" checked={includeSolutions} onChange={setIncludeSolutions} label="Include solutions" description="Short explanation for each question" />
        </div>
      </div>
    </Modal>
  );
}
