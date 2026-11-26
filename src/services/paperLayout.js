// Document layout & formatting for a paper (fonts, numbering, page setup, header/footer,
// inserted blocks). Stored on the paper as `paper.layout` and saved with it, so the
// backend only needs to persist the extra field (PUT /papers/:id).
import { getExam } from "../data/exams";

export const FONT_FAMILIES = [
  { value: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { value: "Arial", css: "Arial, Helvetica, sans-serif" },
  { value: "Calibri", css: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  { value: "Cambria", css: "Cambria, Caladea, Georgia, serif" },
  { value: "Georgia", css: "Georgia, serif" },
  { value: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { value: "Garamond", css: 'Garamond, "EB Garamond", "Times New Roman", serif' },
  { value: "Book Antiqua", css: '"Book Antiqua", Palatino, "Palatino Linotype", serif' },
  { value: "Tahoma", css: "Tahoma, Verdana, sans-serif" },
  { value: "Segoe UI", css: '"Segoe UI", Arial, sans-serif' },
  { value: "Courier New", css: '"Courier New", Courier, monospace' },
];
export const fontCss = (family) => FONT_FAMILIES.find((f) => f.value === family)?.css ?? `"${family}", serif`;

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24];
export const LINE_SPACINGS = [1, 1.15, 1.5, 2];

// Sizes in millimetres (portrait)
export const PAPER_SIZES = {
  A4: { label: "A4 (210 × 297 mm)", w: 210, h: 297 },
  A3: { label: "A3 (297 × 420 mm)", w: 297, h: 420 },
  Letter: { label: "Letter (8.5 × 11 in)", w: 215.9, h: 279.4 },
  Legal: { label: "Legal (8.5 × 14 in)", w: 215.9, h: 355.6 },
};

// Same presets as Microsoft Word (mm)
export const MARGIN_PRESETS = {
  normal: { label: "Normal (2.54 cm)", top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  narrow: { label: "Narrow (1.27 cm)", top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  moderate: { label: "Moderate", top: 25.4, right: 19.05, bottom: 25.4, left: 19.05 },
  wide: { label: "Wide", top: 25.4, right: 50.8, bottom: 25.4, left: 50.8 },
  custom: { label: "Custom" },
};

// Document parts that can be formatted separately
export const ELEMENTS = [
  { id: "title", label: "Paper title" },
  { id: "institution", label: "College / university" },
  { id: "subject", label: "Subject name" },
  { id: "headerInfo", label: "Exam details" },
  { id: "instructions", label: "Instructions" },
  { id: "section", label: "Section headings" },
  { id: "question", label: "Questions" },
  { id: "option", label: "Answer options" },
  { id: "meta", label: "Marks & other info" },
];

export const NUMBER_FORMATS = [
  { value: "{n}.", label: "1." },
  { value: "Q{n}.", label: "Q1." },
  { value: "Question {n}.", label: "Question 1." },
  { value: "({n})", label: "(1)" },
];

export const PAGE_NUMBER_POSITIONS = [
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "none", label: "No page numbers" },
];

export const PAGE_NUMBER_FORMATS = [
  { value: "page-of", label: "Page 1 of 4" },
  { value: "page", label: "Page 1" },
  { value: "number", label: "1" },
];

// What the document contains (Preview & Save → "Output")
export const OUTPUT_MODES = [
  { value: "questions", label: "1. Questions" },
  { value: "answers", label: "2. Questions with Answers" },
  { value: "answers_solutions", label: "3. Questions with Answers & Solutions" },
  { value: "answers_after", label: "4. Questions after Answers & Solutions" },
  { value: "no_options", label: "5. Only Questions with No Options" },
  { value: "only_answers_solutions", label: "6. Only Answers & Solutions" },
  { value: "only_answers", label: "7. Only Answers" },
];

export const OPTION_LABELS = [
  { value: "num", label: "(1) (2) (3) (4)" },
  { value: "upper", label: "(A) (B) (C) (D)" },
  { value: "lower", label: "(a) (b) (c) (d)" },
];
export const OPTION_LAYOUTS = [
  { value: "line", label: "In a line" },
  { value: "two", label: "2 columns" },
  { value: "one", label: "1 column" },
  { value: "auto", label: "Auto fit" },
];
export const DIAGRAM_HEIGHTS = [200, 260, 300, 350];

export function optionLabel(layout, index) {
  if (layout.optionLabels === "num") return `(${index + 1})`;
  if (layout.optionLabels === "lower") return `(${String.fromCharCode(97 + index)})`;
  return `(${String.fromCharCode(65 + index)})`;
}

// Display name of a set: A, B, C… or P, Q, R…
const PQRS = ["P", "Q", "R", "S", "T", "U", "V", "W"];
export function setDisplay(layout, label) {
  if (layout?.setNames !== "pqrs") return label;
  return PQRS["ABCDEFGH".indexOf(label)] ?? label;
}

export const HEADER_FIELDS = [
  ["college", "College name"],
  ["university", "University name"],
  ["department", "Department"],
  ["examination", "Examination name"],
  ["academicYear", "Academic year"],
  ["semester", "Semester"],
  ["className", "Class"],
  ["subjectCode", "Subject code"],
  ["subjectName", "Subject name"],
  ["examDate", "Date of examination"],
  ["faculty", "Faculty name"],
];

const style = (overrides) => ({
  fontFamily: "Times New Roman",
  fontSize: 11,
  bold: false,
  italic: false,
  underline: false,
  color: "#111111",
  highlight: "",
  align: "left",
  lineHeight: 1.15,
  spaceBefore: 0,
  spaceAfter: 0,
  indent: 0,
  ...overrides,
});

export const DEFAULT_STYLES = {
  title: style({ fontSize: 15, bold: true, align: "center", spaceAfter: 2 }),
  institution: style({ fontSize: 14, bold: true, align: "center", spaceAfter: 1 }),
  subject: style({ fontSize: 12, bold: true, align: "center", spaceAfter: 2 }),
  headerInfo: style({ fontSize: 10.5, align: "center", spaceAfter: 2 }),
  instructions: style({ fontSize: 10, spaceAfter: 6 }),
  section: style({ fontSize: 12, bold: true, spaceBefore: 10, spaceAfter: 6 }),
  question: style({ fontSize: 11, spaceAfter: 2 }),
  option: style({ fontSize: 11, indent: 6, spaceAfter: 8 }),
  meta: style({ fontSize: 10, color: "#333333" }),
};

export function defaultLayout(paper) {
  const exam = paper ? getExam(paper.examId) : null;
  return {
    version: 1,
    numbering: { start: 1, scope: "continuous", format: "{n}." },
    page: {
      size: "A4",
      orientation: "portrait",
      margins: "moderate",
      custom: { top: 20, right: 18, bottom: 20, left: 18 },
      border: false,
      headerDistance: 10,
      footerDistance: 10,
    },
    header: {
      logo: null, // { src: dataURL, ratio: width / height }
      college: paper?.institute ?? "",
      university: "",
      department: "",
      examination: exam?.fullName ?? "",
      academicYear: "",
      semester: "",
      className: "",
      subjectCode: "",
      subjectName: "",
      examDate: "",
      faculty: "",
      showSetBadge: true,
    },
    runningHeader: "",
    footer: { text: "", pageNumbers: "bottom-center", format: "page-of" },
    watermark: { text: "", color: "#94a3b8", opacity: 0.18, emblem: false, emblemSize: 100 },
    output: "questions", // see OUTPUT_MODES
    showNumbers: true,
    imageBelow: false, // false = diagrams beside the question text
    diagramMaxHeight: 260, // px
    optionLabels: "upper",
    optionLayout: "auto",
    setNames: "letters", // letters (A, B, C…) | pqrs (P, Q, R…)
    instructionsList: "numbered", // numbered | bulleted | plain
    sectionBar: true,
    showMarks: false,
    endNote: "— End of Set {set} —",
    styles: DEFAULT_STYLES,
    sections: {}, // { [subjectId]: { heading, instructions, pageBreakBefore, fontSize } }
    blocks: [], // inserted page breaks, lines, tables, text and images
  };
}

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, extra) {
  if (!isObject(extra)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

// Full layout for a paper: saved settings on top of the defaults.
export const getLayout = (paper) => merge(defaultLayout(paper), paper?.layout);

// Page geometry in millimetres
export function pageMetrics(layout) {
  const size = PAPER_SIZES[layout.page.size] ?? PAPER_SIZES.A4;
  const landscape = layout.page.orientation === "landscape";
  const width = landscape ? size.h : size.w;
  const height = landscape ? size.w : size.h;
  const preset = MARGIN_PRESETS[layout.page.margins];
  const m = layout.page.margins === "custom" || !preset?.top ? layout.page.custom : preset;
  const margins = { top: +m.top || 0, right: +m.right || 0, bottom: +m.bottom || 0, left: +m.left || 0 };
  return {
    width,
    height,
    margins,
    contentWidth: Math.max(30, width - margins.left - margins.right),
    contentHeight: Math.max(30, height - margins.top - margins.bottom),
  };
}

export const MM_TO_PX = 96 / 25.4;

export function numberLabel(layout, n) {
  return (layout.numbering.format || "{n}.").replace("{n}", n);
}

export function sectionHeading(layout, section, index) {
  const custom = layout.sections[section.subjectId]?.heading?.trim();
  return custom || `PART ${String.fromCharCode(65 + index)} – ${section.name.toUpperCase()}`;
}
