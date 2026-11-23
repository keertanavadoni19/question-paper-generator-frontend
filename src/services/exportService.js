// Builds a print-ready HTML version of a paper and exports it as
//   • PDF  – opens the browser print dialog (choose "Save as PDF")
//   • Word – downloads a .doc file that opens in Microsoft Word / Google Docs
// No extra libraries needed. Swap in your backend's export endpoint later if you prefer.
import { getSetView, paperTotals } from "./paperService";
import { getExam } from "../data/exams";
import { downloadBlob, escapeHtml as e, optionLetter, safeFileName } from "../utils/helpers";

export function defaultInstructions(paper) {
  const exam = getExam(paper.examId);
  const { questions, marks } = paperTotals(paper);
  const lines = [
    `This paper contains ${questions} questions for a total of ${marks} marks. Duration: ${paper.durationMinutes} minutes.`,
    `Each correct answer carries +${exam.marking.correct} mark${exam.marking.correct > 1 ? "s" : ""}.`,
    exam.marking.incorrect < 0 ? `${exam.marking.incorrect} mark is deducted for every incorrect answer.` : "There is no negative marking.",
  ];
  if (paper.questions.some((q) => q.type === "numerical")) {
    lines.push("For numerical value questions, write the answer as an integer.");
  }
  lines.push("Use of calculators and electronic devices is not permitted.");
  return lines;
}

const css = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Times New Roman", Georgia, serif; color: #111; font-size: 11.5pt; line-height: 1.45; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { font-size: 16pt; margin: 0 0 2px; }
  .header h2 { font-size: 12.5pt; margin: 0; font-weight: normal; }
  .meta { width: 100%; font-size: 10.5pt; margin: 6px 0 10px; border-collapse: collapse; }
  .meta td { padding: 2px 0; }
  .set { display: inline-block; border: 2px solid #111; padding: 2px 10px; font-weight: bold; }
  .instructions { border: 1px solid #999; padding: 6px 12px; font-size: 10pt; margin-bottom: 12px; }
  .instructions ol { margin: 4px 0; padding-left: 18px; }
  .section-title { background: #eee; padding: 4px 8px; font-weight: bold; margin: 14px 0 8px; font-size: 12pt; }
  .q { margin: 0 0 10px; page-break-inside: avoid; }
  .q-text { margin: 0 0 4px; }
  .opts { width: 100%; border-collapse: collapse; margin-left: 18px; }
  .opts td { width: 50%; padding: 1px 6px 1px 0; vertical-align: top; }
  .key { border-collapse: collapse; width: 100%; font-size: 10pt; }
  .key th, .key td { border: 1px solid #555; padding: 3px 6px; text-align: center; }
  .sol { font-size: 10pt; margin: 0 0 6px; }
  .page-break { page-break-before: always; }
  .footer { text-align: center; font-size: 9pt; color: #555; margin-top: 18px; }
`;

function paperBody(paper, setLabel, { includeAnswerKey, includeSolutions, answerKeyOnly }) {
  const exam = getExam(paper.examId);
  const view = getSetView(paper, setLabel);
  const { questions, marks } = paperTotals(paper);
  const instructions = paper.instructions?.trim()
    ? paper.instructions.split("\n").filter(Boolean)
    : defaultInstructions(paper);

  const header = `
    <div class="header">
      ${paper.institute ? `<h1>${e(paper.institute)}</h1>` : ""}
      <h2><b>${e(paper.title)}</b></h2>
      <div>${e(exam.fullName)}</div>
    </div>
    <table class="meta"><tr>
      <td>Time: <b>${paper.durationMinutes} min</b></td>
      <td style="text-align:center">Questions: <b>${questions}</b> &nbsp; | &nbsp; Max. Marks: <b>${marks}</b></td>
      <td style="text-align:right"><span class="set">SET ${setLabel}</span></td>
    </tr></table>`;

  const keyTable = () => {
    const all = view.flatMap((s) => s.questions);
    const rows = [];
    for (let i = 0; i < all.length; i += 10) {
      const chunk = all.slice(i, i + 10);
      rows.push(`<tr>${chunk.map((q) => `<th>${q.number}</th>`).join("")}</tr>`);
      rows.push(`<tr>${chunk.map((q) => `<td>${q.type === "mcq" ? optionLetter(q.correctIndex) : e(q.answer)}</td>`).join("")}</tr>`);
    }
    return `<h3>Answer Key – Set ${setLabel}</h3><table class="key">${rows.join("")}</table>`;
  };

  const solutions = () =>
    `<h3>Solutions – Set ${setLabel}</h3>` +
    view
      .flatMap((s) => s.questions)
      .map((q) => `<p class="sol"><b>Q${q.number}.</b> (${q.type === "mcq" ? optionLetter(q.correctIndex) : e(q.answer)}) ${e(q.solution || "—")}</p>`)
      .join("");

  if (answerKeyOnly) {
    return `${header}${keyTable()}${includeSolutions ? solutions() : ""}`;
  }

  const sections = view
    .map(
      (section, index) => `
      <div class="section-title">PART ${String.fromCharCode(65 + index)} – ${e(section.name.toUpperCase())}</div>
      ${section.questions
        .map(
          (q) => `
        <div class="q">
          <p class="q-text"><b>${q.number}.</b> ${e(q.text)}</p>
          ${
            q.type === "mcq"
              ? `<table class="opts"><tr>${q.displayOptions
                  .map((opt, i) => `<td>(${optionLetter(i)}) ${e(opt)}</td>${i === 1 ? "</tr><tr>" : ""}`)
                  .join("")}</tr></table>`
              : `<p style="margin-left:18px">Answer: ____________</p>`
          }
        </div>`
        )
        .join("")}`
    )
    .join("");

  const extras = [
    includeAnswerKey ? `<div class="page-break"></div>${keyTable()}` : "",
    includeSolutions ? solutions() : "",
  ].join("");

  return `${header}
    <div class="instructions"><b>Instructions</b><ol>${instructions.map((l) => `<li>${e(l)}</li>`).join("")}</ol></div>
    ${sections}
    <div class="footer">— End of Set ${setLabel} —</div>
    ${extras}`;
}

export function buildPaperHtml(paper, { sets = ["A"], includeAnswerKey = false, includeSolutions = false, answerKeyOnly = false, forWord = false } = {}) {
  const body = sets
    .map((label, i) => `${i > 0 ? '<div class="page-break"></div>' : ""}${paperBody(paper, label, { includeAnswerKey, includeSolutions, answerKeyOnly })}`)
    .join("");
  const wordHead = forWord
    ? `xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`
    : "";
  return `<!DOCTYPE html><html ${wordHead}><head><meta charset="utf-8"><title>${e(paper.title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

export function exportPdf(paper, options) {
  const html = buildPaperHtml(paper, options);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
}

export function exportWord(paper, options) {
  const html = buildPaperHtml(paper, { ...options, forWord: true });
  const suffix = options.answerKeyOnly ? "_AnswerKey" : options.sets.length === 1 ? `_Set${options.sets[0]}` : "_AllSets";
  downloadBlob("﻿" + html, `${safeFileName(paper.title)}${suffix}.doc`, "application/msword");
}
