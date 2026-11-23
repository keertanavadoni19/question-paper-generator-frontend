import { useEffect, useState } from "react";
import { Plus, Trash2, Save, RotateCcw, ListTree } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Tabs from "../components/ui/Tabs";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { EXAMS, SUBJECTS, getExam } from "../data/exams";
import { getSyllabus, newChapter, resetSyllabus, saveChapters } from "../services/syllabusService";

const WEIGHTAGE = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function Syllabus() {
  const toast = useToast();
  const [examId, setExamId] = useState(EXAMS[0].id);
  const exam = getExam(examId);
  const [subjectId, setSubjectId] = useState(exam.subjects[0].subjectId);
  const [syllabus, setSyllabus] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("11");
  const [addError, setAddError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setSyllabus(null);
    getSyllabus(examId).then(setSyllabus);
  }, [examId]);

  useEffect(() => {
    if (syllabus) {
      setChapters(structuredClone(syllabus[subjectId] ?? []));
      setDirty(false);
    }
  }, [syllabus, subjectId]);

  const changeExam = (id) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setExamId(id);
    setSubjectId(getExam(id).subjects[0].subjectId);
  };
  const changeSubject = (id) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSubjectId(id);
  };

  const update = (id, changes) => {
    setChapters((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    setDirty(true);
  };
  const remove = (id) => {
    setChapters((list) => list.filter((c) => c.id !== id));
    setDirty(true);
  };
  const add = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 3) return setAddError("Chapter name must be at least 3 characters");
    if (chapters.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setAddError("This chapter already exists");
    setChapters((list) => [...list, newChapter(name, newClass)]);
    setNewName("");
    setAddError("");
    setDirty(true);
  };

  const save = async () => {
    if (chapters.some((c) => !c.name.trim())) return toast.error("Chapter names cannot be empty");
    setSaving(true);
    const saved = await saveChapters(examId, subjectId, chapters.map((c) => ({ ...c, name: c.name.trim() })));
    setSyllabus((s) => ({ ...s, [subjectId]: saved }));
    setSaving(false);
    toast.success(`${SUBJECTS[subjectId].name} syllabus saved for ${exam.name}`);
  };

  const reset = async () => {
    setConfirmReset(false);
    const fresh = await resetSyllabus(examId);
    setSyllabus(fresh);
    toast.success(`${exam.name} syllabus reset to default`);
  };

  const active = chapters.filter((c) => c.active).length;

  return (
    <>
      <PageHeader
        title="Syllabus management"
        subtitle="Control which chapters the generator can use for each exam and subject."
        actions={
          <>
            <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(true)}>Reset {exam.name}</Button>
            <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={examId} onChange={changeExam} tabs={EXAMS.map((e) => ({ value: e.id, label: e.name }))} />
        <Tabs value={subjectId} onChange={changeSubject} tabs={exam.subjects.map((s) => ({ value: s.subjectId, label: SUBJECTS[s.subjectId].name }))} />
      </div>

      {!syllabus ? (
        <Loader />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title={`${SUBJECTS[subjectId].name} · ${exam.name}`}
            subtitle={`${active} of ${chapters.length} chapters active${dirty ? " · unsaved changes" : ""}`}
            bodyClassName="p-0"
          >
            {chapters.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-12 px-4 py-2.5 font-semibold">On</th>
                      <th className="px-2 py-2.5 font-semibold">Chapter</th>
                      <th className="w-24 px-2 py-2.5 font-semibold">Class</th>
                      <th className="w-32 px-2 py-2.5 font-semibold">Weightage</th>
                      <th className="w-12 px-2 py-2.5"><span className="sr-only">Delete</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chapters.map((c) => (
                      <tr key={c.id} className={c.active ? "" : "bg-slate-50/70 text-slate-400"}>
                        <td className="px-4 py-2">
                          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={c.active} onChange={(e) => update(c.id, { active: e.target.checked })} aria-label={`Include ${c.name}`} />
                        </td>
                        <td className="px-2 py-2">
                          <input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" aria-label="Chapter name" />
                        </td>
                        <td className="px-2 py-2">
                          <select value={c.classLevel} onChange={(e) => update(c.id, { classLevel: Number(e.target.value) })} className="rounded-md border border-slate-200 bg-white px-2 py-1" aria-label="Class">
                            <option value={11}>11 / I PUC</option>
                            <option value={12}>12 / II PUC</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select value={c.weightage} onChange={(e) => update(c.id, { weightage: e.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-1" aria-label="Weightage">
                            {WEIGHTAGE.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ListTree} title="No chapters" message="Add a chapter using the form." />
            )}
          </Card>

          <div className="space-y-6">
            <Card title="Add chapter">
              <form onSubmit={add} className="space-y-3" noValidate>
                <Input id="sy-name" label="Chapter name" value={newName} onChange={(e) => { setNewName(e.target.value); setAddError(""); }} error={addError} placeholder="e.g. Experimental Skills" />
                <Select id="sy-class" label="Class" value={newClass} onChange={(e) => setNewClass(e.target.value)} options={[{ value: "11", label: "Class 11 / I PUC" }, { value: "12", label: "Class 12 / II PUC" }]} />
                <Button type="submit" icon={Plus} fullWidth variant="soft">Add chapter</Button>
              </form>
            </Card>

            <Card title="Weightage overview">
              <ul className="space-y-2 text-sm">
                {WEIGHTAGE.map((w) => (
                  <li key={w.value} className="flex justify-between">
                    <span className="text-slate-600">{w.label} weightage</span>
                    <span className="font-semibold tabular-nums">{chapters.filter((c) => c.active && c.weightage === w.value).length}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="text-slate-600">Class 11 / 12 split</span>
                  <span className="font-semibold tabular-nums">
                    {chapters.filter((c) => c.active && c.classLevel === 11).length} / {chapters.filter((c) => c.active && c.classLevel === 12).length}
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">Inactive chapters are hidden from paper configuration and never used by the generator.</p>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmReset} title={`Reset ${exam.name} syllabus?`} message="All subjects of this exam go back to the default chapter list. Custom chapters will be removed." confirmLabel="Reset" onCancel={() => setConfirmReset(false)} onConfirm={reset} />
    </>
  );
}
