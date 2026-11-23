// Exam patterns (2026). Edit here if NTA / KEA change the pattern.
// Each subject entry says how many MCQ and numerical (integer-type) questions a full paper has.

export const SUBJECTS = {
  physics: { id: "physics", name: "Physics", short: "PHY", color: "#4f46e5" },
  chemistry: { id: "chemistry", name: "Chemistry", short: "CHE", color: "#0891b2" },
  mathematics: { id: "mathematics", name: "Mathematics", short: "MAT", color: "#d97706" },
  botany: { id: "botany", name: "Botany", short: "BOT", color: "#16a34a" },
  zoology: { id: "zoology", name: "Zoology", short: "ZOO", color: "#db2777" },
  biology: { id: "biology", name: "Biology", short: "BIO", color: "#16a34a" },
};

// KCET "Biology" draws questions from both Botany and Zoology chapters.
export const SUBJECT_SOURCES = {
  biology: ["botany", "zoology"],
};

export const EXAMS = [
  {
    id: "jee-main",
    name: "JEE Main",
    fullName: "Joint Entrance Examination (Main) – Paper 1 (B.E./B.Tech)",
    conductedBy: "NTA",
    stream: "Engineering",
    mode: "Computer Based Test",
    durationMinutes: 180,
    marking: { correct: 4, incorrect: -1, unattempted: 0 },
    questionTypes: ["mcq", "numerical"],
    accent: "indigo",
    subjects: [
      { subjectId: "physics", mcq: 20, numerical: 5 },
      { subjectId: "chemistry", mcq: 20, numerical: 5 },
      { subjectId: "mathematics", mcq: 20, numerical: 5 },
    ],
    notes: [
      "Each subject: Section A – 20 MCQs, Section B – 5 numerical value questions (all compulsory).",
      "Numerical answers are entered as integers.",
    ],
  },
  {
    id: "neet-ug",
    name: "NEET UG",
    fullName: "National Eligibility cum Entrance Test (Undergraduate)",
    conductedBy: "NTA",
    stream: "Medical",
    mode: "Pen & Paper (OMR)",
    durationMinutes: 180,
    marking: { correct: 4, incorrect: -1, unattempted: 0 },
    questionTypes: ["mcq"],
    accent: "emerald",
    subjects: [
      { subjectId: "physics", mcq: 45, numerical: 0 },
      { subjectId: "chemistry", mcq: 45, numerical: 0 },
      { subjectId: "botany", mcq: 45, numerical: 0 },
      { subjectId: "zoology", mcq: 45, numerical: 0 },
    ],
    notes: ["180 compulsory MCQs, no optional section.", "Single correct option per question."],
  },
  {
    id: "kcet",
    name: "KCET",
    fullName: "Karnataka Common Entrance Test",
    conductedBy: "KEA",
    stream: "Engineering / Medical",
    mode: "Pen & Paper (OMR)",
    durationMinutes: 80,
    durationLabel: "80 min per subject",
    marking: { correct: 1, incorrect: 0, unattempted: 0 },
    questionTypes: ["mcq"],
    accent: "amber",
    subjects: [
      { subjectId: "physics", mcq: 60, numerical: 0 },
      { subjectId: "chemistry", mcq: 60, numerical: 0 },
      { subjectId: "mathematics", mcq: 60, numerical: 0 },
      { subjectId: "biology", mcq: 60, numerical: 0 },
    ],
    notes: [
      "Each subject is a separate 80-minute paper of 60 MCQs.",
      "No negative marking. PCM for engineering, PCB for medical.",
    ],
  },
];

export const getExam = (examId) => EXAMS.find((exam) => exam.id === examId);
export const getSubject = (subjectId) => SUBJECTS[subjectId];

export function examTotals(exam, subjects = exam.subjects) {
  const questions = subjects.reduce((sum, s) => sum + (s.mcq || 0) + (s.numerical || 0), 0);
  return { questions, marks: questions * exam.marking.correct };
}

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const QUESTION_TYPES = { mcq: "MCQ (single correct)", numerical: "Numerical value" };
export const SET_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];
