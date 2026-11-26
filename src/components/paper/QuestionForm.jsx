import { useState } from "react";
import { CircleAlert } from "lucide-react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import { EXAMS, SUBJECTS } from "../../data/exams";
import { useSubjectChapters } from "../../services/syllabusService";
import { optionLetter } from "../../utils/helpers";

const BANK_SUBJECTS = ["physics", "chemistry", "mathematics", "botany", "zoology"];

const EMPTY = {
  subjectId: "physics",
  chapter: "",
  concept: "",
  type: "mcq",
  difficulty: "medium",
  text: "",
  options: ["", "", "", ""],
  answer: 0,
  solution: "",
  examIds: ["jee-main", "neet-ug", "kcet"],
};

function validate(q) {
  const errors = {};
  if (!q.chapter) errors.chapter = "Select a chapter";
  if (q.text.trim().length < 10) errors.text = "Question must be at least 10 characters";
  if (q.type === "mcq") {
    if (q.options.some((o) => !String(o).trim())) errors.options = "All four options are required";
    else if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size < 4) errors.options = "Options must be different";
  } else if (String(q.answer).trim() === "" || Number.isNaN(Number(q.answer))) {
    errors.answer = "Enter a numeric answer";
  }
  if (!q.examIds.length) errors.examIds = "Select at least one exam";
  return errors;
}

// Reusable add/edit form for a question (used in Question Bank and Paper editor).
// `lockSubject` keeps the subject fixed when editing inside a paper section.
export default function QuestionForm({ initial, onSubmit, onCancel, submitLabel = "Save question", lockSubject = false, subjectOptions }) {
  const [q, setQ] = useState(() => {
    const base = { ...EMPTY, ...initial };
    return { ...base, options: base.options?.length === 4 ? [...base.options] : ["", "", "", ""], examIds: base.examIds ?? EMPTY.examIds };
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const subjects = subjectOptions ?? BANK_SUBJECTS;
  const chapterList = useSubjectChapters(q.subjectId);
  const chapters = chapterList.map((c) => c.name);
  const concepts = chapterList.find((c) => c.name === q.chapter)?.concepts ?? [];

  const set = (field, value) => setQ((prev) => ({ ...prev, [field]: value }));

  const changeType = (type) => setQ((prev) => ({ ...prev, type, answer: type === "mcq" ? 0 : "" }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(q);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSubmit({
        ...q,
        text: q.text.trim(),
        options: q.type === "mcq" ? q.options.map((o) => String(o).trim()) : [],
        answer: q.type === "mcq" ? Number(q.answer) : String(q.answer).trim(),
        concept: q.concept || undefined,
        needsReview: false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="qf-subject"
          label="Subject"
          value={q.subjectId}
          disabled={lockSubject}
          onChange={(e) => setQ((prev) => ({ ...prev, subjectId: e.target.value, chapter: "", concept: "" }))}
          options={subjects.map((id) => ({ value: id, label: SUBJECTS[id].name }))}
        />
        <Select id="qf-chapter" label="Chapter" value={q.chapter} placeholder="Select chapter" onChange={(e) => setQ((prev) => ({ ...prev, chapter: e.target.value, concept: "" }))} options={chapters} error={errors.chapter} />
        {concepts.length > 0 && (
          <Select id="qf-concept" label="Concept (optional)" value={q.concept ?? ""} placeholder="Not tagged" onChange={(e) => set("concept", e.target.value)} options={concepts} className="sm:col-span-2" />
        )}
        <Select id="qf-type" label="Question type" value={q.type} onChange={(e) => changeType(e.target.value)} options={[{ value: "mcq", label: "MCQ (single correct)" }, { value: "numerical", label: "Numerical value" }]} />
        <Select id="qf-difficulty" label="Difficulty" value={q.difficulty} onChange={(e) => set("difficulty", e.target.value)} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
      </div>

      <Textarea id="qf-text" label="Question" rows={3} value={q.text} onChange={(e) => set("text", e.target.value)} error={errors.text} placeholder="Type the question. Use Unicode for symbols, e.g. x², √, π, Δ, →" />

      {q.type === "mcq" ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Options <span className="font-normal text-slate-500">(select the correct one)</span></legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg border p-1.5 pl-2.5 ${Number(q.answer) === i ? "border-green-400 bg-green-50" : "border-slate-200"}`}>
                <input type="radio" name="qf-correct" checked={Number(q.answer) === i} onChange={() => set("answer", i)} className="h-4 w-4 accent-green-600" aria-label={`Mark option ${optionLetter(i)} correct`} />
                <span className="text-sm font-semibold text-slate-500">{optionLetter(i)}</span>
                <input
                  value={opt}
                  onChange={(e) => set("options", q.options.map((o, j) => (j === i ? e.target.value : o)))}
                  className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder={`Option ${optionLetter(i)}`}
                  aria-label={`Option ${optionLetter(i)}`}
                />
              </div>
            ))}
          </div>
          {errors.options && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600"><CircleAlert className="h-3.5 w-3.5" />{errors.options}</p>
          )}
        </fieldset>
      ) : (
        <Input id="qf-answer" label="Correct answer (integer / decimal)" inputMode="decimal" value={q.answer} onChange={(e) => set("answer", e.target.value)} error={errors.answer} placeholder="e.g. 40" />
      )}

      <Textarea id="qf-solution" label="Solution / explanation" rows={2} value={q.solution} onChange={(e) => set("solution", e.target.value)} placeholder="Optional, shown in the answer key with solutions" />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Use in exams</legend>
        <div className="flex flex-wrap gap-3">
          {EXAMS.map((exam) => (
            <label key={exam.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
                checked={q.examIds.includes(exam.id)}
                onChange={(e) => set("examIds", e.target.checked ? [...q.examIds, exam.id] : q.examIds.filter((id) => id !== exam.id))}
              />
              {exam.name}
            </label>
          ))}
        </div>
        {errors.examIds && <p className="mt-1 text-xs text-red-600">{errors.examIds}</p>}
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
