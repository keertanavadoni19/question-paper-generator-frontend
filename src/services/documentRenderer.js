// One renderer for the question paper document. The live preview, PDF and Print all use
// it, so what faculty see on screen is what they export:
//   buildBlocks()  → ordered list of document blocks (header, instructions, sections, questions…)
//   blockHtml()    → HTML for one block, styled by documentCss(layout)
//   measureBlocks() + paginate() → split blocks into pages of the chosen paper size/margins
//   pageChrome()   → running header, footer, page numbers, watermark and page border
// The Word (.docx) export (docxExport.js) reads the same blocks and layout.
import { getSetView, paperTotals, numberingOf } from "./paperService";
import { getLayout, pageMetrics, fontCss, numberLabel, sectionHeading, MM_TO_PX, HEADER_FIELDS } from "./paperLayout";
import { getExam } from "../data/exams";
import { escapeHtml as e, optionLetter } from "../utils/helpers";

// ── Instructions ───────────────────────────────────────────────
export function defaultInstructions(paper) {
  const exam = getExam(paper.examId);
  const { questions, marks } = paperTotals(paper);
  const plus = new Set(paper.questions.map((q) => q.marks));
  const minus = new Set(paper.questions.map((q) => q.negative ?? 0));
  const lines = [`This paper contains ${questions} questions for a total of ${marks} marks. Duration: ${paper.durationMinutes} minutes.`];
  if (plus.size <= 1) {
    const m = [...plus][0] ?? exam.marking.correct;
    lines.push(`Each correct answer carries +${m} mark${m === 1 ? "" : "s"}.`);
  } else {
    lines.push("Marks for each question are indicated against it.");
  }
  const neg = [...minus];
  if (neg.length === 1) lines.push(neg[0] < 0 ? `${neg[0]} mark is deducted for every incorrect answer.` : "There is no negative marking.");
  else lines.push("Negative marking applies as indicated for each section.");
  if (paper.questions.some((q) => q.type === "numerical")) lines.push("For numerical value questions, write the answer as an integer.");
  lines.push("Use of calculators and electronic devices is not permitted.");
  return lines;
}

export const paperInstructions = (paper) =>
  paper.instructions?.trim() ? paper.instructions.split("\n").map((l) => l.trim()).filter(Boolean) : defaultInstructions(paper);

const fill = (text, ctx) => String(text ?? "").replaceAll("{set}", ctx.setLabel).replaceAll("{title}", ctx.paper.title);

// ── CSS ────────────────────────────────────────────────────────
// Word's "single" line spacing is about 1.15 × the font size for common fonts.
export const CSS_LINE_FACTOR = 1.15;
export const PAGE_BORDER_MM = (24 * 25.4) / 72; // 24 pt

function elementCss(cls, s) {
  return `
  .qp-doc .qp-${cls} { font-family: ${fontCss(s.fontFamily)}; font-size: ${s.fontSize}pt; font-weight: ${s.bold ? 700 : 400};
    font-style: ${s.italic ? "italic" : "normal"}; text-decoration: ${s.underline ? "underline" : "none"}; color: ${s.color};
    text-align: ${s.align}; line-height: ${(s.lineHeight * CSS_LINE_FACTOR).toFixed(3)};
    margin: ${s.spaceBefore}pt 0 ${s.spaceAfter}pt 0; padding-left: ${s.indent}mm; }
  ${s.highlight ? `.qp-doc .qp-${cls} .t { background-color: ${s.highlight}; box-decoration-break: clone; -webkit-box-decoration-break: clone; }` : ""}`;
}

export function documentCss(layout) {
  const st = layout.styles;
  const opt = st.option;
  return `
  .qp-doc { color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .qp-doc * { box-sizing: border-box; }
  .qp-doc p, .qp-doc ol, .qp-doc ul, .qp-doc table { margin: 0; }
  .qp-doc .qp-block { display: flow-root; }
  .qp-doc .qp-page { position: relative; background: #fff; overflow: hidden; }
  .qp-doc .qp-content { position: absolute; }
  ${Object.entries(st).map(([cls, s]) => elementCss(cls, s)).join("")}
  .qp-doc .qp-head-table { width: 100%; border-collapse: collapse; }
  .qp-doc .qp-head-table td { vertical-align: middle; padding: 0; }
  .qp-doc .qp-logo { display: block; }
  .qp-doc .qp-metarow { width: 100%; border-collapse: collapse; margin-top: 4pt; }
  .qp-doc .qp-metarow td { padding: 1pt 0; width: 33.33%; }
  .qp-doc .qp-set { display: inline-block; border: 1.5pt solid currentColor; padding: 0 6pt; font-weight: 700; }
  .qp-doc .qp-rule { border-bottom: 1.5pt solid #111; margin: 3pt 0 8pt; }
  .qp-doc .qp-instr-box { border: 0.75pt solid #777; padding: 4pt 8pt; margin-bottom: ${st.instructions.spaceAfter}pt; }
  .qp-doc .qp-instr-box .qp-instructions { margin: 0; }
  .qp-doc .qp-list { padding-left: calc(${st.instructions.indent}mm + 16pt); }
  .qp-doc .qp-list li { margin: 1pt 0; }
  .qp-doc .qp-section.bar { background: #e5e7eb; padding: 2pt 6pt 2pt calc(6pt + ${st.section.indent}mm); }
  .qp-doc .qp-sec-note { font-style: italic; margin-top: -2pt; margin-bottom: 6pt; }
  .qp-doc .qp-num { font-weight: 700; }
  .qp-doc .qp-marks { float: right; margin: 0 0 0 8pt; padding: 0; }
  .qp-doc .qp-opts { border-collapse: collapse; width: calc(100% - ${opt.indent}mm); margin: ${opt.spaceBefore}pt 0 ${opt.spaceAfter}pt ${opt.indent}mm; }
  .qp-doc .qp-opts td.qp-option { margin: 0; padding: 1pt 8pt 1pt 0; vertical-align: top; width: 50%; }
  .qp-doc .qp-opts.single td.qp-option { width: 100%; }
  .qp-doc .qp-correct { background: #dcfce7; outline: 1px solid #86efac; }
  .qp-doc .qp-sol { font-family: ${fontCss(st.question.fontFamily)}; font-size: ${Math.max(8, st.question.fontSize - 1)}pt; background: #f1f5f9; padding: 3pt 6pt; margin: 0 0 8pt ${opt.indent}mm; color: #334155; }
  .qp-doc .qp-hr { border: 0; border-top: 1pt solid #111; margin: 6pt 0; }
  .qp-doc .qp-pb { height: 0; }
  .qp-doc .qp-table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; }
  .qp-doc .qp-table td, .qp-doc .qp-table th { border: 0.75pt solid #333; padding: 2pt 5pt; text-align: left; vertical-align: top; }
  .qp-doc .qp-table th { background: #f1f5f9; }
  .qp-doc .qp-key { border-collapse: collapse; width: 100%; margin: 0 0 4pt; }
  .qp-doc .qp-key th, .qp-doc .qp-key td { border: 0.75pt solid #555; padding: 1pt 3pt; text-align: center; }
  .qp-doc .qp-img { margin: 4pt 0 8pt; }
  .qp-doc .qp-img img { display: inline-block; }
  .qp-doc .qp-wm { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-35deg); white-space: nowrap;
    font-family: Arial, sans-serif; font-weight: 700; pointer-events: none; user-select: none; }
  .qp-doc .qp-border { position: absolute; border: 1.25pt solid #111; pointer-events: none; }
  .qp-doc .qp-runhead, .qp-doc .qp-runfoot { position: absolute; display: flex; gap: 8pt; margin: 0; padding: 0; }
  .qp-doc .qp-runhead > span, .qp-doc .qp-runfoot > span { flex: 1; }
  `;
}

// ── Blocks ─────────────────────────────────────────────────────
const LONG_OPTION = 38; // characters; longer options are listed one per line

export function optionColumns(options) {
  return options.some((o) => String(o).length > LONG_OPTION) ? 1 : 2;
}

function answerKeyBlocks(view, setLabel, scope) {
  const blocks = [{ key: `key-title-${setLabel}`, kind: "heading", text: `Answer Key – Set ${setLabel}`, breakBefore: true, keepWithNext: true }];
  const groups = scope === "section" ? view.map((s) => ({ label: s.name, questions: s.questions })) : [{ label: "", questions: view.flatMap((s) => s.questions) }];
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.questions.length; i += 10) {
      blocks.push({ key: `key-${setLabel}-${gi}-${i}`, kind: "keyRow", label: i === 0 ? g.label : "", questions: g.questions.slice(i, i + 10) });
    }
  });
  return blocks;
}

function solutionBlocks(view, setLabel, breakBefore) {
  const all = view.flatMap((s) => s.questions);
  return [
    { key: `sol-title-${setLabel}`, kind: "heading", text: `Solutions – Set ${setLabel}`, breakBefore, keepWithNext: true },
    ...all.map((q) => ({ key: `sol-${setLabel}-${q.id}`, kind: "solution", q })),
  ];
}

// Ordered document blocks for one set of a paper.
export function buildBlocks(paper, setLabel, opts = {}) {
  const { showAnswers = false, showSolutions = false, includeAnswerKey = false, includeSolutions = false, answerKeyOnly = false } = opts;
  const layout = getLayout(paper);
  const view = getSetView(paper, setLabel);
  const { scope } = numberingOf(paper);
  const extras = layout.blocks ?? [];
  const anchored = (anchor) => extras.filter((b) => b.after === anchor).map((b) => ({ key: `x-${b.id}`, kind: "extra", block: b, breakAfter: b.type === "pageBreak" }));

  const blocks = [{ key: "head", kind: "paperHeader" }];
  if (answerKeyOnly) {
    blocks.push(...answerKeyBlocks(view, setLabel, scope).map((b, i) => (i === 0 ? { ...b, breakBefore: false } : b)));
    if (includeSolutions) blocks.push(...solutionBlocks(view, setLabel, true));
    return blocks;
  }

  blocks.push({ key: "instructions", kind: "instructions" }, ...anchored("start"));
  view.forEach((section, index) => {
    const settings = layout.sections[section.subjectId] ?? {};
    blocks.push({
      key: `sec-${section.subjectId}`,
      kind: "sectionHeading",
      section,
      index,
      sectionId: section.subjectId,
      breakBefore: Boolean(settings.pageBreakBefore),
      keepWithNext: true,
    });
    blocks.push(...anchored(`section:${section.subjectId}`));
    section.questions.forEach((q) => {
      blocks.push({ key: `q-${q.id}`, kind: "question", q, qid: q.id, sectionId: section.subjectId, showAnswers, showSolutions });
      blocks.push(...anchored(`q:${q.id}`));
    });
  });
  blocks.push(...anchored("end"));
  if (layout.endNote?.trim()) blocks.push({ key: "end-note", kind: "endNote" });
  if (includeAnswerKey) blocks.push(...answerKeyBlocks(view, setLabel, scope));
  if (includeSolutions) blocks.push(...solutionBlocks(view, setLabel, !includeAnswerKey));
  return blocks;
}

// ── HTML for one block ─────────────────────────────────────────
const t = (text) => `<span class="t">${e(text)}</span>`;
const answerText = (q) => (q.type === "mcq" ? optionLetter(q.correctIndex) : e(q.answer));

export function makeContext(paper, setLabel) {
  const layout = getLayout(paper);
  return { paper, layout, setLabel, exam: getExam(paper.examId), metrics: pageMetrics(layout), totals: paperTotals(paper) };
}

function headerHtml(ctx) {
  const { paper, layout, totals } = ctx;
  const h = layout.header;
  const line = (cls, text) => (text?.trim() ? `<p class="qp-${cls}">${t(text.trim())}</p>` : "");
  const joined = (parts) => parts.filter((p) => p?.trim()).join("   |   ");
  const subject = joined([h.subjectName, h.subjectCode && `Subject Code: ${h.subjectCode}`]);
  const details = joined([h.academicYear && `Academic Year: ${h.academicYear}`, h.semester && `Semester: ${h.semester}`, h.examDate && `Date: ${h.examDate}`, h.faculty && `Faculty: ${h.faculty}`]);
  const text = [
    line("institution", h.university),
    line("institution", h.college),
    line("headerInfo", h.department),
    line("headerInfo", h.examination),
    line("title", paper.title),
    line("subject", subject),
    line("headerInfo", details),
  ].join("");
  const logoH = 20;
  const logo = h.logo?.src
    ? `<img class="qp-logo" src="${e(h.logo.src)}" alt="Logo" style="height:${logoH}mm;width:${(logoH * (h.logo.ratio || 1)).toFixed(2)}mm">`
    : "";
  const side = h.logo?.src ? `${(logoH * (h.logo.ratio || 1) + 2).toFixed(2)}mm` : "0";
  const top = logo
    ? `<table class="qp-head-table"><tr><td style="width:${side}">${logo}</td><td>${text}</td><td style="width:${side}"></td></tr></table>`
    : text;
  const meta = `<table class="qp-metarow qp-meta"><tr>
      <td>Time: <b>${paper.durationMinutes} min</b></td>
      <td style="text-align:center">Max. Marks: <b>${totals.marks}</b></td>
      <td style="text-align:right">${h.showSetBadge ? `<span class="qp-set">SET ${e(ctx.setLabel)}</span>` : ""}</td>
    </tr></table>`;
  return `${top}${meta}<div class="qp-rule"></div>`;
}

function listHtml(items, kind, cls) {
  if (kind === "plain") return items.map((l) => `<p class="${cls}">${t(l)}</p>`).join("");
  const tag = kind === "bulleted" ? "ul" : "ol";
  return `<${tag} class="${cls} qp-list" style="list-style-type:${kind === "bulleted" ? "disc" : "decimal"}">${items.map((l) => `<li>${t(l)}</li>`).join("")}</${tag}>`;
}

function extraHtml(b, ctx) {
  switch (b.type) {
    case "pageBreak":
      return `<div class="qp-pb"></div>`;
    case "hr":
      return `<hr class="qp-hr">`;
    case "text": {
      const cls = `qp-${b.styleAs || "question"}`;
      const lines = String(b.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return `<p class="${cls}">&nbsp;</p>`;
      return b.list && b.list !== "none" ? listHtml(lines, b.list === "bullet" ? "bulleted" : "numbered", cls) : lines.map((l) => `<p class="${cls}">${t(l)}</p>`).join("");
    }
    case "table": {
      const rows = b.rows ?? [];
      return `<table class="qp-table qp-question">${rows
        .map((row, ri) => `<tr>${row.map((cell) => (ri === 0 && b.header ? `<th>${t(cell)}</th>` : `<td>${t(cell)}</td>`)).join("")}</tr>`)
        .join("")}</table>`;
    }
    case "image": {
      if (!String(b.src ?? "").startsWith("data:image/")) return "";
      const w = (ctx.metrics.contentWidth * Math.min(100, Math.max(5, b.width || 50))) / 100;
      const h = w / (b.ratio || 1);
      return `<div class="qp-img" style="text-align:${e(b.align || "center")}"><img src="${e(b.src)}" alt="${e(b.alt || "Image")}" style="width:${w.toFixed(2)}mm;height:${h.toFixed(2)}mm"></div>`;
    }
    default:
      return "";
  }
}

export function blockHtml(block, ctx) {
  const { layout } = ctx;
  switch (block.kind) {
    case "paperHeader":
      return headerHtml(ctx);
    case "instructions": {
      const lines = paperInstructions(ctx.paper);
      return `<div class="qp-instr-box"><p class="qp-instructions" style="font-weight:700;margin:0 0 2pt">Instructions</p>${listHtml(lines, layout.instructionsList, "qp-instructions")}</div>`;
    }
    case "sectionHeading": {
      const settings = layout.sections[block.sectionId] ?? {};
      const size = Number(settings.fontSize) > 0 ? ` style="font-size:${Number(settings.fontSize)}pt"` : "";
      const note = settings.instructions?.trim()
        ? settings.instructions.split("\n").filter((l) => l.trim()).map((l) => `<p class="qp-instructions qp-sec-note">${t(l.trim())}</p>`).join("")
        : "";
      return `<p class="qp-section${layout.sectionBar ? " bar" : ""}"${size}>${t(sectionHeading(layout, block.section, block.index))}</p>${note}`;
    }
    case "question": {
      const q = block.q;
      const marks = layout.showMarks ? `<span class="qp-meta qp-marks">[${q.marks}${q.negative ? `, ${q.negative}` : ""}]</span>` : "";
      const head = `<p class="qp-question">${marks}<span class="qp-num">${e(numberLabel(layout, q.number))}</span> ${t(q.text)}</p>`;
      let body;
      if (q.type === "mcq") {
        const cols = optionColumns(q.displayOptions);
        const cells = q.displayOptions.map(
          (opt, i) => `<td class="qp-option${block.showAnswers && i === q.correctIndex ? " qp-correct" : ""}">(${optionLetter(i)}) ${t(opt)}</td>`
        );
        const rows = [];
        for (let i = 0; i < cells.length; i += cols) rows.push(`<tr>${cells.slice(i, i + cols).join("")}</tr>`);
        body = `<table class="qp-opts${cols === 1 ? " single" : ""}">${rows.join("")}</table>`;
      } else {
        body = `<p class="qp-option">Answer: ${block.showAnswers ? `<span class="qp-correct">&nbsp;${e(q.answer)}&nbsp;</span>` : "____________"}</p>`;
      }
      const sol = block.showSolutions && q.solution ? `<p class="qp-sol"><b>Solution:</b> ${e(q.solution)}</p>` : "";
      return head + body + sol;
    }
    case "extra":
      return extraHtml(block.block, ctx);
    case "endNote":
      return `<p class="qp-meta" style="text-align:center;margin-top:12pt">${t(fill(layout.endNote, ctx))}</p>`;
    case "heading":
      return `<p class="qp-section${layout.sectionBar ? " bar" : ""}">${t(block.text)}</p>`;
    case "keyRow": {
      const label = block.label ? `<p class="qp-meta" style="font-weight:700;margin:4pt 0 2pt">${t(block.label)}</p>` : "";
      return `${label}<table class="qp-key qp-meta"><tr>${block.questions.map((q) => `<th>${e(q.number)}</th>`).join("")}</tr><tr>${block.questions
        .map((q) => `<td>${answerText(q)}</td>`)
        .join("")}</tr></table>`;
    }
    case "solution": {
      const q = block.q;
      return `<p class="qp-question" style="margin-bottom:4pt"><b>${e(numberLabel(layout, q.number))}</b> (${answerText(q)}) ${t(q.solution || "—")}</p>`;
    }
    default:
      return "";
  }
}

// ── Page chrome (header / footer / page number / watermark / border) ──
export function pageNumberText(layout, n, total) {
  const f = layout.footer.format;
  return f === "number" ? `${n}` : f === "page" ? `Page ${n}` : `Page ${n} of ${total}`;
}

export function pageChrome(ctx, n, total) {
  const { layout, metrics } = ctx;
  const m = metrics.margins;
  const pos = layout.footer.pageNumbers;
  const num = pos === "none" ? "" : e(pageNumberText(layout, n, total));
  const parts = [];

  if (layout.watermark.text?.trim()) {
    const size = Math.round(Math.min(metrics.width, metrics.height) / 2.2 / Math.max(4, layout.watermark.text.length) * 2.83 * 1.6);
    parts.push(`<div class="qp-wm" style="font-size:${Math.max(28, size)}pt;color:${e(layout.watermark.color)};opacity:${Number(layout.watermark.opacity) || 0.18}">${e(layout.watermark.text.trim())}</div>`);
  }
  if (layout.page.border) {
    // 24 pt from the page edge, around header, body and footer (same as the Word export)
    parts.push(`<div class="qp-border" style="inset:${PAGE_BORDER_MM}mm"></div>`);
  }
  const runText = fill(layout.runningHeader, ctx).trim();
  if (runText || pos === "top-right") {
    parts.push(`<div class="qp-runhead qp-meta" style="top:${layout.page.headerDistance}mm;left:${m.left}mm;right:${m.right}mm"><span>${e(runText)}</span><span style="text-align:right">${pos === "top-right" ? num : ""}</span></div>`);
  }
  const footText = e(fill(layout.footer.text, ctx).trim());
  if (footText || (pos.startsWith("bottom") && num)) {
    const slots = { left: "", center: "", right: "" };
    if (pos.startsWith("bottom")) slots[pos.split("-")[1]] = num;
    if (footText) slots[slots.center ? "left" : "center"] = footText;
    parts.push(`<div class="qp-runfoot qp-meta" style="bottom:${layout.page.footerDistance}mm;left:${m.left}mm;right:${m.right}mm"><span style="text-align:left">${slots.left}</span><span style="text-align:center">${slots.center}</span><span style="text-align:right">${slots.right}</span></div>`);
  }
  return parts.join("");
}

// ── Pagination ─────────────────────────────────────────────────
// Blocks never split across pages. A block that does not fit starts a new page;
// headings stay with the first question after them; page breaks force a new page.
export function paginate(blocks, heights, capacity) {
  const pages = [[]];
  let used = 0;
  blocks.forEach((block, i) => {
    let page = pages[pages.length - 1];
    if (block.breakBefore && page.length) {
      page = [];
      pages.push(page);
      used = 0;
    }
    const next = blocks[i + 1];
    const need = block.keepWithNext && next && !next.breakBefore ? heights[i] + heights[i + 1] : heights[i];
    if (page.length && used + need > capacity + 0.5) {
      page = [];
      pages.push(page);
      used = 0;
    }
    page.push(i);
    used += heights[i];
    if (block.breakAfter) {
      pages.push([]);
      used = 0;
    }
  });
  while (pages.length > 1 && !pages[pages.length - 1].length) pages.pop();
  return pages;
}

// Renders blocks off-screen at the page's content width and returns their heights (px).
// The document must already contain documentCss(layout) inside a `.qp-doc` scope.
export function measureBlocks(doc, htmls, metrics) {
  const host = doc.createElement("div");
  host.className = "qp-doc";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "absolute", left: "-10000px", top: "0", width: `${metrics.contentWidth}mm`, visibility: "hidden" });
  host.innerHTML = htmls.map((h) => `<div class="qp-block">${h}</div>`).join("");
  doc.body.appendChild(host);
  const heights = [...host.children].map((el) => el.getBoundingClientRect().height);
  host.remove();
  return heights;
}

export const pageCapacity = (metrics) => metrics.contentHeight * MM_TO_PX - 1;

// ── Print / PDF ────────────────────────────────────────────────
function pageHtml(ctx, inner, n, total) {
  const { metrics } = ctx;
  const m = metrics.margins;
  return `<div class="qp-page" style="width:${metrics.width}mm;height:${metrics.height}mm">${pageChrome(ctx, n, total)}<div class="qp-content" style="top:${m.top}mm;left:${m.left}mm;width:${metrics.contentWidth}mm;height:${metrics.contentHeight}mm">${inner}</div></div>`;
}

// Paginates every requested set inside `doc` and returns the page HTML.
// Page numbers restart for each set (each set is handed out separately).
export function renderPagesHtml(doc, paper, { sets = ["A"], ...opts } = {}) {
  return sets
    .map((label) => {
      const ctx = makeContext(paper, label);
      const blocks = buildBlocks(paper, label, opts);
      const htmls = blocks.map((b) => blockHtml(b, ctx));
      const pages = paginate(blocks, measureBlocks(doc, htmls, ctx.metrics), pageCapacity(ctx.metrics));
      return pages.map((idx, p) => pageHtml(ctx, idx.map((i) => `<div class="qp-block">${htmls[i]}</div>`).join(""), p + 1, pages.length)).join("");
    })
    .join("");
}

export function printCss(paper) {
  const layout = getLayout(paper);
  const metrics = pageMetrics(layout);
  return `${documentCss(layout)}
  @page { size: ${metrics.width}mm ${metrics.height}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .qp-doc .qp-page { break-after: page; page-break-after: always; height: ${(metrics.height - 0.4).toFixed(2)}mm !important; }
  .qp-doc .qp-page:last-child { break-after: auto; page-break-after: auto; }
  @media screen { body { background: #e2e8f0; } .qp-doc .qp-page { margin: 12px auto; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }`;
}

export { HEADER_FIELDS };
