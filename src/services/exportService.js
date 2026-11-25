// Exports a paper exactly as the live preview lays it out (same renderer, fonts,
// margins, page breaks, header/footer and page numbers):
//   • PDF   – opens the browser print dialog with "Save as PDF"
//   • Print – same paginated document, straight to the printer
//   • Word  – an editable .docx built with the `docx` library (see docxExport.js)
// Swap in your backend's export endpoint later if you prefer.
import { printCss, renderPagesHtml } from "./documentRenderer";
import { downloadBlob, escapeHtml as e, safeFileName } from "../utils/helpers";

export { defaultInstructions } from "./documentRenderer";

function exportSuffix(options) {
  if (options.answerKeyOnly) return "_AnswerKey";
  return options.sets.length === 1 ? `_Set${options.sets[0]}` : "_AllSets";
}

// Opens a hidden frame, paginates the paper inside it (so measurements use the
// print document's own fonts and CSS), then prints it.
export async function printPaper(paper, options) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "1200px", height: "800px", border: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(paper.title)}${e(exportSuffix(options))}</title><style>${printCss(paper)}</style></head><body class="qp-doc"></body></html>`);
  doc.close();
  await doc.fonts?.ready;
  await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  doc.body.innerHTML = renderPagesHtml(doc, paper, options);
  await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

export const exportPdf = printPaper;

export async function exportWord(paper, options) {
  const { buildDocx } = await import("./docxExport");
  const blob = await buildDocx(paper, options);
  downloadBlob(blob, `${safeFileName(paper.title)}${exportSuffix(options)}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
