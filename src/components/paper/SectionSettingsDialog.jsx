import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import { FONT_SIZES, sectionHeading } from "../../services/paperLayout";

const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function MarksRow({ section, questions, onApply }) {
  const first = questions[0];
  const [marks, setMarks] = useState(first?.marks ?? 4);
  const [negative, setNegative] = useState(first?.negative ?? 0);
  const mixed = new Set(questions.map((q) => `${q.marks}/${q.negative ?? 0}`)).size > 1;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block w-24 text-xs font-medium text-slate-600">
        Marks (+)
        <input type="number" min={0} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} className={`${input} mt-1`} />
      </label>
      <label className="block w-24 text-xs font-medium text-slate-600">
        Negative (−)
        <input type="number" max={0} step={0.25} value={negative} onChange={(e) => setNegative(e.target.value)} className={`${input} mt-1`} />
      </label>
      <Button size="sm" variant="soft" disabled={!questions.length} onClick={() => onApply(section.subjectId, Math.max(0, Number(marks) || 0), Math.min(0, Number(negative) || 0))}>
        Apply to {questions.length} question{questions.length === 1 ? "" : "s"}
      </Button>
      {mixed && <span className="text-xs text-amber-700">Questions currently have different marks.</span>}
    </div>
  );
}

// Per-section settings. Every change applies immediately (and can be undone).
export default function SectionSettingsDialog({ paper, layout, onClose, onLayout, onMoveSection, onApplyMarks, onAddQuestion }) {
  const setSection = (id, key, value) =>
    onLayout((l) => ({ ...l, sections: { ...l.sections, [id]: { ...l.sections[id], [key]: value } } }), `section-${id}-${key}`);

  return (
    <Modal open onClose={onClose} size="xl" title="Sections" description="Headings, order, instructions, marks and page breaks for each part of the paper." footer={<Button onClick={onClose}>Done</Button>}>
      <ol className="space-y-4">
        {paper.sections.map((section, index) => {
          const s = layout.sections[section.subjectId] ?? {};
          const questions = paper.questions.filter((q) => q.sectionId === section.subjectId);
          return (
            <li key={section.subjectId} className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Part {String.fromCharCode(65 + index)}</span>
                <span className="font-semibold text-slate-900">{section.name}</span>
                <span className="text-xs text-slate-500">{questions.length} questions</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" icon={ArrowUp} aria-label={`Move ${section.name} up`} disabled={index === 0} onClick={() => onMoveSection(index, -1)} />
                  <Button size="icon" variant="ghost" icon={ArrowDown} aria-label={`Move ${section.name} down`} disabled={index === paper.sections.length - 1} onClick={() => onMoveSection(index, 1)} />
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => onAddQuestion(section)}>Add question</Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                <label className="block text-xs font-medium text-slate-600">
                  Heading
                  <input value={s.heading ?? ""} placeholder={sectionHeading({ ...layout, sections: {} }, section, index)} onChange={(e) => setSection(section.subjectId, "heading", e.target.value)} className={`${input} mt-1`} />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Heading size
                  <select value={s.fontSize ?? ""} onChange={(e) => setSection(section.subjectId, "fontSize", e.target.value ? Number(e.target.value) : null)} className={`${input} mt-1`}>
                    <option value="">Default ({layout.styles.section.fontSize} pt)</option>
                    {FONT_SIZES.map((n) => <option key={n} value={n}>{n} pt</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600 md:col-span-2">
                  Section instructions <span className="font-normal text-slate-400">(optional, shown under the heading)</span>
                  <textarea rows={2} value={s.instructions ?? ""} onChange={(e) => setSection(section.subjectId, "instructions", e.target.value)} className={`${input} mt-1`} placeholder="e.g. Answer all questions. Each question carries 4 marks." />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <MarksRow section={section} questions={questions} onApply={onApplyMarks} />
                <Toggle id={`pb-${section.subjectId}`} checked={Boolean(s.pageBreakBefore)} onChange={(v) => setSection(section.subjectId, "pageBreakBefore", v)} label="Start on a new page" />
              </div>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
