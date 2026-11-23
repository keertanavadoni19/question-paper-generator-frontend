import { useMemo, useState } from "react";
import { Replace, Search } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { getLayout, HEADER_FIELDS, sectionHeading } from "../../services/paperLayout";
import { paperInstructions } from "../../services/documentRenderer";
import { getSetView } from "../../services/paperService";
import { optionLetter } from "../../utils/helpers";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Every editable piece of text in the paper: { key, label, value, apply(paper, newValue) }.
function textTargets(paper, setLabel, includeSolutions) {
  const layout = getLayout(paper);
  const numbers = Object.fromEntries(getSetView(paper, setLabel).flatMap((s) => s.questions.map((q) => [q.id, q.number])));
  const withLayout = (p, fn) => ({ ...p, layout: fn(getLayout(p)) });
  const updateQ = (p, id, fn) => ({ ...p, questions: p.questions.map((q) => (q.id === id ? fn(q) : q)) });
  const targets = [
    { key: "title", label: "Paper title", value: paper.title, apply: (p, v) => ({ ...p, title: v }) },
    { key: "instructions", label: "Instructions", value: paperInstructions(paper).join("\n"), apply: (p, v) => ({ ...p, instructions: v }) },
  ];
  HEADER_FIELDS.forEach(([key, label]) => {
    targets.push({ key: `h-${key}`, label: `Header · ${label}`, value: layout.header[key] ?? "", apply: (p, v) => withLayout(p, (l) => ({ ...l, header: { ...l.header, [key]: v } })) });
  });
  targets.push(
    { key: "run", label: "Running header", value: layout.runningHeader, apply: (p, v) => withLayout(p, (l) => ({ ...l, runningHeader: v })) },
    { key: "foot", label: "Footer", value: layout.footer.text, apply: (p, v) => withLayout(p, (l) => ({ ...l, footer: { ...l.footer, text: v } })) },
  );
  paper.sections.forEach((section, i) => {
    const id = section.subjectId;
    targets.push({
      key: `sec-${id}`,
      label: `Section heading · ${section.name}`,
      value: sectionHeading(layout, section, i),
      apply: (p, v) => withLayout(p, (l) => ({ ...l, sections: { ...l.sections, [id]: { ...l.sections[id], heading: v } } })),
    });
    targets.push({
      key: `secnote-${id}`,
      label: `Section instructions · ${section.name}`,
      value: layout.sections[id]?.instructions ?? "",
      apply: (p, v) => withLayout(p, (l) => ({ ...l, sections: { ...l.sections, [id]: { ...l.sections[id], instructions: v } } })),
    });
  });
  paper.questions.forEach((q) => {
    const n = numbers[q.id] ?? "?";
    targets.push({ key: `q-${q.id}`, label: `Q${n} · question`, value: q.text, qid: q.id, apply: (p, v) => updateQ(p, q.id, (x) => ({ ...x, text: v })) });
    (q.options ?? []).forEach((opt, i) => {
      targets.push({ key: `q-${q.id}-o${i}`, label: `Q${n} · option ${optionLetter(i)} (Set A order)`, value: String(opt), qid: q.id, apply: (p, v) => updateQ(p, q.id, (x) => ({ ...x, options: x.options.map((o, j) => (j === i ? v : o)) })) });
    });
    if (includeSolutions && q.solution) {
      targets.push({ key: `q-${q.id}-sol`, label: `Q${n} · solution`, value: q.solution, qid: q.id, apply: (p, v) => updateQ(p, q.id, (x) => ({ ...x, solution: v })) });
    }
  });
  (layout.blocks ?? []).forEach((b, bi) => {
    const setBlock = (p, fn) => withLayout(p, (l) => ({ ...l, blocks: l.blocks.map((x) => (x.id === b.id ? fn(x) : x)) }));
    if (b.type === "text") targets.push({ key: `b-${b.id}`, label: `Inserted text ${bi + 1}`, value: b.text, apply: (p, v) => setBlock(p, (x) => ({ ...x, text: v })) });
    if (b.type === "table") {
      b.rows.forEach((row, r) => row.forEach((cell, c) => {
        targets.push({ key: `b-${b.id}-${r}-${c}`, label: `Table ${bi + 1} · row ${r + 1}, col ${c + 1}`, value: cell, apply: (p, v) => setBlock(p, (x) => ({ ...x, rows: x.rows.map((rr, ri) => (ri === r ? rr.map((cc, ci) => (ci === c ? v : cc)) : rr)) })) });
      }));
    }
  });
  return targets;
}

export default function FindReplaceDialog({ paper, setLabel, onApply, onClose, onShow }) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [solutions, setSolutions] = useState(false);

  const regex = useMemo(() => {
    if (!find) return null;
    const body = escapeRegex(find);
    return new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, `gu${matchCase ? "" : "i"}`);
  }, [find, matchCase, wholeWord]);

  const matches = useMemo(() => {
    if (!regex) return [];
    return textTargets(paper, setLabel, solutions)
      .map((t) => ({ ...t, count: (String(t.value).match(regex) ?? []).length }))
      .filter((t) => t.count > 0);
  }, [paper, setLabel, regex, solutions]);
  const total = matches.reduce((n, m) => n + m.count, 0);

  const replaceIn = (target, p) => target.apply(p, String(target.value).replace(regex, () => replace));
  const replaceOne = (target) => onApply(replaceIn(target, paper), `Replaced ${target.count} in ${target.label}`);
  const replaceAll = () => onApply(matches.reduce((p, t) => replaceIn(t, p), paper), `Replaced ${total} match${total === 1 ? "" : "es"}`);

  const snippet = (value) => {
    const text = String(value);
    regex.lastIndex = 0;
    const m = regex.exec(text);
    if (!m) return text.slice(0, 80);
    const start = Math.max(0, m.index - 30);
    return (
      <>
        {start > 0 && "…"}{text.slice(start, m.index)}
        <mark className="rounded bg-amber-200 px-0.5 text-slate-900">{m[0]}</mark>
        {text.slice(m.index + m[0].length, m.index + m[0].length + 40)}{m.index + m[0].length + 40 < text.length && "…"}
      </>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Find and replace"
      description="Searches questions, options, headings, instructions, header and footer."
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={Replace} disabled={!total} onClick={replaceAll}>Replace all ({total})</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Find
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Replace with
          <input value={replace} onChange={(e) => setReplace(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <Toggle id="fr-case" checked={matchCase} onChange={setMatchCase} label="Match case" />
        <Toggle id="fr-word" checked={wholeWord} onChange={setWholeWord} label="Whole words" />
        <Toggle id="fr-sol" checked={solutions} onChange={setSolutions} label="Include solutions" />
      </div>

      <p className="mt-4 text-sm text-slate-600">{find ? <><b>{total}</b> match{total === 1 ? "" : "es"} in {matches.length} place{matches.length === 1 ? "" : "s"}</> : "Type something to search."}</p>
      {matches.length > 0 && (
        <ul className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
          {matches.map((m) => (
            <li key={m.key} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">{m.label}{m.count > 1 ? ` · ${m.count}×` : ""}</p>
                <p className="truncate text-sm text-slate-800">{snippet(m.value)}</p>
              </div>
              {m.qid && onShow && <Button size="sm" variant="ghost" onClick={() => onShow(m.qid)}>Show</Button>}
              <Button size="sm" variant="soft" onClick={() => replaceOne(m)}>Replace</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
