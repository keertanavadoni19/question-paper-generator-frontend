// Editable Word (.docx) export. Uses the same blocks and layout as the live preview
// (documentRenderer.js), mapped to native Word formatting: fonts, sizes, colours,
// highlight, alignment, line/paragraph spacing, indents, lists, tables, images,
// page size/orientation/margins, page border, header/footer, page numbers and watermark.
// Word paginates the file itself, so page breaks can differ slightly from the preview.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, LevelFormat, Packer, PageBorderDisplay, PageBorderOffsetFrom,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, WidthType,
} from "docx";
import { ImageWatermark, TextWatermark } from "docx/watermarks";
import { buildBlocks, makeContext, optionColumnsFor, paperImageUrls, paperInstructions } from "./documentRenderer";
import { latexToText, segments } from "../utils/richText";
import { MM_TO_PX, PAPER_SIZES, numberLabel, optionLabel, sectionHeading, setDisplay } from "./paperLayout";

const twips = (mm) => Math.round(mm * 56.6929);
const hex = (color) => String(color || "#000000").replace("#", "").slice(0, 6).toUpperCase();
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const LINE = (size = 6, color = "333333") => ({ style: BorderStyle.SINGLE, size, color });
const ALL_LINES = (b) => ({ top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b });

function runStyle(s, extra = {}) {
  return {
    font: s.fontFamily,
    size: Math.round(s.fontSize * 2),
    bold: s.bold,
    italics: s.italic,
    underline: s.underline ? {} : undefined,
    color: hex(s.color),
    shading: s.highlight ? { type: ShadingType.CLEAR, color: "auto", fill: hex(s.highlight) } : undefined,
    ...extra,
  };
}

function paraStyle(s, extra = {}) {
  return {
    alignment: ALIGN[s.align] ?? AlignmentType.LEFT,
    spacing: { before: Math.round(s.spaceBefore * 20), after: Math.round(s.spaceAfter * 20), line: Math.round(s.lineHeight * 240) },
    indent: s.indent ? { left: twips(s.indent) } : undefined,
    ...extra,
  };
}

const text = (s, value, extra) => new TextRun({ ...runStyle(s, extra), text: String(value ?? "") });
const para = (s, children, extra) => new Paragraph({ ...paraStyle(s, extra), children });

// Question content: text with line breaks, LaTeX as readable Unicode, {{IMG::url}} as embedded pictures.
function rich(s, value, ctx, extra = {}) {
  const runs = [];
  for (const seg of segments(value)) {
    if (seg.type === "image") {
      const img = ctx.images?.get(seg.value);
      if (img) {
        const maxW = Math.min(ctx.metrics.contentWidth * 0.9, 150) * MM_TO_PX;
        const maxH = 60 * MM_TO_PX;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        runs.push(new TextRun({ break: 1 }), new ImageRun({ type: img.type, data: img.data, transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) } }), new TextRun({ break: 1 }));
      } else {
        runs.push(text(s, " [image] ", { ...extra, italics: true }));
      }
    } else if (seg.type === "math") {
      runs.push(text(s, latexToText(seg.value), extra));
    } else {
      seg.value.split("\n").forEach((line, i) => runs.push(new TextRun({ ...runStyle(s, extra), text: line, break: i ? 1 : 0 })));
    }
  }
  return runs;
}

// Downloads the question images once (Word files embed them). WebP is converted to PNG.
async function loadImages(urls) {
  const images = new Map();
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { referrerPolicy: "no-referrer" });
      if (!res.ok) return;
      let blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      let type = (/image\/(png|jpe?g|gif|bmp)/.exec(blob.type)?.[1] ?? "").replace("jpeg", "jpg");
      if (!type) {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
        type = "png";
      }
      images.set(url, { type, data: new Uint8Array(await blob.arrayBuffer()), width: bitmap.width, height: bitmap.height });
    } catch {
      /* unreachable image: exported as "[image]" */
    }
  }));
  return images;
}

function dataUrlImage(src, widthMm, heightMm) {
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(src ?? "");
  if (!match) return null;
  const type = match[1].toLowerCase().startsWith("jp") ? "jpg" : match[1].toLowerCase();
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  return new ImageRun({ type, data: bytes, transformation: { width: Math.round(widthMm * MM_TO_PX), height: Math.round(heightMm * MM_TO_PX) } });
}

function cell(children, width, extra = {}) {
  return new TableCell({ children, width: { size: width, type: WidthType.DXA }, ...extra });
}

// List paragraphs: each list gets its own numbering instance so it restarts at 1.
function listParas(lines, kind, s, counter) {
  if (kind === "plain") return lines.map((l) => para(s, [text(s, l)]));
  const instance = counter.next++;
  const reference = kind === "bulleted" ? "qp-bullet" : "qp-number";
  return lines.map((l) => para(s, [text(s, l)], { numbering: { reference, level: 0, instance }, indent: { left: twips(s.indent) + 360, hanging: 360 } }));
}

function headerChildren(ctx) {
  const { paper, layout, totals, metrics } = ctx;
  const st = layout.styles;
  const h = layout.header;
  const join = (parts) => parts.filter((p) => p?.trim()).join("   |   ");
  const lines = [
    ["institution", h.university],
    ["institution", h.college],
    ["headerInfo", h.department],
    ["headerInfo", h.examination],
    ["title", paper.title],
    ["subject", join([h.subjectName, h.subjectCode && `Subject Code: ${h.subjectCode}`])],
    ["headerInfo", join([h.className && `Class: ${h.className}`, h.academicYear && `Academic Year: ${h.academicYear}`, h.semester && `Semester: ${h.semester}`, h.examDate && `Date: ${h.examDate}`, h.faculty && `Faculty: ${h.faculty}`])],
  ]
    .filter(([, v]) => v?.trim())
    .map(([key, v]) => para(st[key], [text(st[key], v.trim())]));

  const out = [];
  const width = twips(metrics.contentWidth);
  const logoH = 20;
  const logo = h.logo?.src ? dataUrlImage(h.logo.src, logoH * (h.logo.ratio || 1), logoH) : null;
  if (logo) {
    const side = twips(logoH * (h.logo.ratio || 1) + 2);
    out.push(new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [side, width - 2 * side, side],
      layout: TableLayoutType.FIXED,
      borders: NO_BORDERS,
      rows: [new TableRow({ children: [cell([new Paragraph({ children: [logo] })], side), cell(lines.length ? lines : [new Paragraph("")], width - 2 * side), cell([new Paragraph("")], side)] })],
    }));
  } else {
    out.push(...lines);
  }

  const m = st.meta;
  const third = Math.floor(width / 3);
  const metaCell = (children, align) => cell([para({ ...m, align, spaceBefore: 0, spaceAfter: 0 }, children)], third);
  out.push(new Table({
    width: { size: third * 3, type: WidthType.DXA },
    columnWidths: [third, third, third],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        metaCell([text(m, "Time: "), text(m, `${paper.durationMinutes} min`, { bold: true })], "left"),
        metaCell([text(m, "Max. Marks: "), text(m, totals.marks, { bold: true })], "center"),
        metaCell(h.showSetBadge ? [text(m, ` SET ${setDisplay(layout, ctx.setLabel)} `, { bold: true, border: LINE(12, "111111") })] : [], "right"),
      ],
    })],
  }));
  out.push(new Paragraph({ border: { bottom: LINE(12, "111111") }, spacing: { before: 0, after: 160 }, children: [] }));
  return out;
}

function questionChildren(block, ctx) {
  const { layout, metrics } = ctx;
  const st = layout.styles;
  const q = block.q;
  const s = st.question;
  const runs = [...(layout.showNumbers === false ? [] : [text(s, numberLabel(layout, q.number), { bold: true }), text(s, " ")]), ...rich(s, q.text, ctx)];
  const tabStops = [];
  if (layout.showMarks) {
    runs.push(new TextRun({ ...runStyle(st.meta), text: `\t[${q.marks}${q.negative ? `, ${q.negative}` : ""}]` }));
    tabStops.push({ type: TabStopType.RIGHT, position: twips(metrics.contentWidth - s.indent) });
  }
  const out = [para(s, runs, { keepNext: true, keepLines: true, tabStops })];
  const o = st.option;
  const label = (i) => optionLabel(layout, i);
  const answerLine = () => para({ ...o, bold: true }, [text(o, `Ans: ${q.type === "mcq" ? label(q.correctIndex) : q.answer}`, { bold: true })]);
  if (block.hideOptions) {
    // "Only questions with no options"
  } else if (q.type === "mcq") {
    const cols = optionColumnsFor(layout, q.displayOptions);
    const width = twips(metrics.contentWidth - o.indent);
    const colW = Math.floor(width / cols);
    const rows = [];
    for (let i = 0; i < q.displayOptions.length; i += cols) {
      const cells = q.displayOptions.slice(i, i + cols).map((opt, j) =>
        cell([para({ ...o, indent: 0, spaceBefore: 0, spaceAfter: 0 }, [text(o, `${label(i + j)} `), ...rich(o, opt, ctx)], { keepNext: true })], colW)
      );
      while (cells.length < cols) cells.push(cell([new Paragraph("")], colW));
      rows.push(new TableRow({ children: cells, cantSplit: true }));
    }
    out.push(new Table({
      width: { size: colW * cols, type: WidthType.DXA },
      columnWidths: Array(cols).fill(colW),
      layout: TableLayoutType.FIXED,
      indent: { size: twips(o.indent), type: WidthType.DXA },
      borders: NO_BORDERS,
      rows,
    }));
    out.push(new Paragraph({ spacing: { before: 0, after: Math.round(o.spaceAfter * 20), line: 120 }, children: [] }));
  } else if (!block.answerLine) {
    out.push(para(o, [text(o, "Answer: ____________")]));
  }
  if (block.answerLine) out.push(answerLine());
  if (block.showSolutions && q.solution) out.push(para({ ...o, italic: false }, [text(o, "Solution: ", { bold: true }), ...rich(o, q.solution, ctx)]));
  return out;
}

function extraChildren(b, ctx, counter) {
  const st = ctx.layout.styles;
  switch (b.type) {
    case "pageBreak":
      return [new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0, line: 120 }, children: [] })];
    case "hr":
      return [new Paragraph({ border: { bottom: LINE(8, "111111") }, spacing: { before: 120, after: 120 }, children: [] })];
    case "text": {
      const s = st[b.styleAs] ?? st.question;
      const lines = String(b.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (b.list && b.list !== "none") return listParas(lines, b.list === "bullet" ? "bulleted" : "numbered", s, counter);
      return lines.map((l) => para(s, [text(s, l)]));
    }
    case "table": {
      const rows = (b.rows ?? []).filter((r) => r.length);
      if (!rows.length) return [];
      const cols = Math.max(...rows.map((r) => r.length));
      const width = twips(ctx.metrics.contentWidth);
      const colW = Math.floor(width / cols);
      const s = st.question;
      return [
        new Table({
          width: { size: colW * cols, type: WidthType.DXA },
          columnWidths: Array(cols).fill(colW),
          layout: TableLayoutType.FIXED,
          borders: ALL_LINES(LINE(6, "333333")),
          rows: rows.map((r, ri) => new TableRow({
            tableHeader: ri === 0 && b.header,
            children: Array.from({ length: cols }, (_, ci) =>
              cell([para({ ...s, indent: 0, spaceBefore: 0, spaceAfter: 0 }, [text(s, r[ci] ?? "", ri === 0 && b.header ? { bold: true } : {})])], colW,
                ri === 0 && b.header ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: "F1F5F9" } } : {})
            ),
          })),
        }),
        new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
      ];
    }
    case "image": {
      const w = (ctx.metrics.contentWidth * Math.min(100, Math.max(5, b.width || 50))) / 100;
      const img = dataUrlImage(b.src, w, w / (b.ratio || 1));
      return img ? [new Paragraph({ alignment: ALIGN[b.align] ?? AlignmentType.CENTER, spacing: { before: 80, after: 160 }, children: [img] })] : [];
    }
    default:
      return [];
  }
}

function blockChildren(block, ctx, counter) {
  const { layout } = ctx;
  const st = layout.styles;
  switch (block.kind) {
    case "paperHeader":
      return headerChildren(ctx);
    case "instructions": {
      const s = st.instructions;
      const inner = [para({ ...s, spaceAfter: 2, indent: 0 }, [text(s, "Instructions", { bold: true })]), ...listParas(paperInstructions(ctx.paper), layout.instructionsList, { ...s, spaceAfter: 0 }, counter)];
      const width = twips(ctx.metrics.contentWidth);
      return [
        new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [width], layout: TableLayoutType.FIXED, borders: ALL_LINES(LINE(4, "777777")), rows: [new TableRow({ children: [cell(inner, width, { margins: { top: 60, bottom: 60, left: 140, right: 140 } })] })] }),
        new Paragraph({ spacing: { before: 0, after: Math.round(s.spaceAfter * 20), line: 120 }, children: [] }),
      ];
    }
    case "sectionHeading": {
      const settings = layout.sections[block.sectionId] ?? {};
      const s = { ...st.section, ...(Number(settings.fontSize) > 0 ? { fontSize: Number(settings.fontSize) } : {}) };
      const out = [para(s, [text(s, sectionHeading(layout, block.section, block.index))], {
        keepNext: true,
        pageBreakBefore: block.breakBefore,
        shading: layout.sectionBar ? { type: ShadingType.CLEAR, color: "auto", fill: "E5E7EB" } : undefined,
      })];
      const note = settings.instructions?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
      note.forEach((l) => out.push(para({ ...st.instructions, italic: true, spaceAfter: 4 }, [text({ ...st.instructions, italic: true }, l)], { keepNext: true })));
      return out;
    }
    case "question":
      return questionChildren(block, ctx);
    case "extra":
      return extraChildren(block.block, ctx, counter);
    case "endNote": {
      const s = { ...st.meta, align: "center", spaceBefore: 12 };
      return [para(s, [text(s, layout.endNote.replaceAll("{set}", ctx.setLabel).replaceAll("{title}", ctx.paper.title))])];
    }
    case "heading":
      return [para(st.section, [text(st.section, block.text)], { keepNext: true, pageBreakBefore: block.breakBefore, shading: layout.sectionBar ? { type: ShadingType.CLEAR, color: "auto", fill: "E5E7EB" } : undefined })];
    case "keyRow": {
      const s = { ...st.meta, align: "center", spaceBefore: 0, spaceAfter: 0 };
      const width = twips(ctx.metrics.contentWidth);
      const colW = Math.floor(width / 10);
      const row = (values, bold) => new TableRow({ cantSplit: true, children: values.map((v) => cell([para(s, [text(s, v, { bold })])], colW)) });
      const pad = (list) => [...list, ...Array(10 - list.length).fill("")];
      const out = block.label ? [para({ ...st.meta, bold: true, spaceBefore: 4, spaceAfter: 2 }, [text({ ...st.meta, bold: true }, block.label)], { keepNext: true })] : [];
      out.push(new Table({
        width: { size: colW * 10, type: WidthType.DXA },
        columnWidths: Array(10).fill(colW),
        layout: TableLayoutType.FIXED,
        borders: ALL_LINES(LINE(4, "555555")),
        rows: [row(pad(block.questions.map((q) => String(q.number))), true), row(pad(block.questions.map((q) => (q.type === "mcq" ? optionLabel(layout, q.correctIndex).replace(/[()]/g, "") : String(q.answer)))), false)],
      }));
      out.push(new Paragraph({ spacing: { before: 0, after: 80, line: 120 }, children: [] }));
      return out;
    }
    case "solution": {
      const q = block.q;
      const s = { ...st.question, spaceAfter: 4 };
      const ans = q.type === "mcq" ? optionLabel(layout, q.correctIndex).replace(/[()]/g, "") : q.answer;
      return [para(s, [text(s, numberLabel(layout, q.number), { bold: true }), text(s, ` (${ans}) `), ...rich(s, q.solution || "—", ctx)])];
    }
    default:
      return [];
  }
}

function pageNumberRuns(layout, s) {
  const f = layout.footer.format;
  const r = (children) => new TextRun({ ...runStyle(s), children });
  if (f === "number") return [r([PageNumber.CURRENT])];
  if (f === "page") return [r(["Page ", PageNumber.CURRENT])];
  return [r(["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES_IN_SECTION])];
}

function headerFooter(ctx) {
  const { layout, metrics } = ctx;
  const s = layout.styles.meta;
  const width = twips(metrics.contentWidth);
  const fill = (v) => String(v ?? "").replaceAll("{set}", ctx.setLabel).replaceAll("{title}", ctx.paper.title).trim();
  const pos = layout.footer.pageNumbers;
  const tabs = [{ type: TabStopType.CENTER, position: Math.round(width / 2) }, { type: TabStopType.RIGHT, position: width }];
  const base = { ...s, align: "left", indent: 0, spaceBefore: 0, spaceAfter: 0 };

  const headRuns = [];
  const runText = fill(layout.runningHeader);
  if (runText) headRuns.push(text(s, runText));
  if (pos === "top-right") headRuns.push(new TextRun({ ...runStyle(s), text: "\t\t" }), ...pageNumberRuns(layout, s));
  if (layout.watermark.text?.trim()) {
    headRuns.push(new TextWatermark({ text: layout.watermark.text.trim(), font: "Arial", bold: true, color: hex(layout.watermark.color), opacity: Number(layout.watermark.opacity) || 0.18, layout: "diagonal" }));
  }

  const logo = layout.header.logo;
  const emblem = layout.watermark.emblem && /^data:image\/(png|jpe?g);base64,/.exec(logo?.src ?? "");
  if (emblem) {
    const w = (Math.min(metrics.width, metrics.height) * 0.6 * (Number(layout.watermark.emblemSize) || 100)) / 100;
    headRuns.push(new ImageWatermark({
      type: emblem[1].startsWith("jp") ? "jpg" : "png",
      data: Uint8Array.from(atob(logo.src.split(",")[1]), (c) => c.charCodeAt(0)),
      transformation: { width: Math.round(w * MM_TO_PX), height: Math.round((w / (logo.ratio || 1)) * MM_TO_PX) },
      washout: true,
    }));
  }
  const slots = { left: [], center: [], right: [] };
  if (pos.startsWith("bottom")) slots[pos.split("-")[1]] = pageNumberRuns(layout, s);
  const footText = fill(layout.footer.text);
  if (footText) slots[slots.center.length ? "left" : "center"] = [text(s, footText)];
  const footRuns = [...slots.left, new TextRun({ ...runStyle(s), text: "\t" }), ...slots.center, new TextRun({ ...runStyle(s), text: "\t" }), ...slots.right];

  return {
    headers: headRuns.length ? { default: new Header({ children: [para(base, headRuns, { tabStops: tabs })] }) } : undefined,
    footers: footText || pos.startsWith("bottom") ? { default: new Footer({ children: [para(base, footRuns, { tabStops: tabs })] }) } : undefined,
  };
}

function sectionProperties(ctx) {
  const { layout, metrics } = ctx;
  const size = PAPER_SIZES[layout.page.size] ?? PAPER_SIZES.A4;
  const m = metrics.margins;
  const border = { style: BorderStyle.SINGLE, size: 10, color: "111111", space: 24 }; // 24 pt from the page edge, like the preview
  return {
    page: {
      size: { width: twips(size.w), height: twips(size.h), orientation: layout.page.orientation === "landscape" ? "landscape" : "portrait" },
      margin: { top: twips(m.top), right: twips(m.right), bottom: twips(m.bottom), left: twips(m.left), header: twips(layout.page.headerDistance), footer: twips(layout.page.footerDistance) },
      pageNumbers: { start: 1 },
      borders: layout.page.border
        ? { pageBorderTop: border, pageBorderRight: border, pageBorderBottom: border, pageBorderLeft: border, pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE } }
        : undefined,
    },
  };
}

export async function buildDocx(paper, { sets = ["A"], ...opts } = {}) {
  const counter = { next: 1 };
  const images = await loadImages(paperImageUrls(paper));
  const sections = sets.map((label) => {
    const ctx = { ...makeContext(paper, label), images };
    const blocks = buildBlocks(paper, label, opts);
    return {
      properties: sectionProperties(ctx),
      ...headerFooter(ctx),
      children: blocks.flatMap((b) => blockChildren(b, ctx, counter)),
    };
  });
  const listLevel = (format, textValue) => ({
    level: 0,
    format,
    text: textValue,
    alignment: AlignmentType.LEFT,
  });
  const doc = new Document({
    creator: "QP Generator",
    title: paper.title,
    description: "Question paper exported from QP Generator",
    numbering: {
      config: [
        { reference: "qp-number", levels: [listLevel(LevelFormat.DECIMAL, "%1.")] },
        { reference: "qp-bullet", levels: [listLevel(LevelFormat.BULLET, "•")] },
      ],
    },
    sections,
  });
  return Packer.toBlob(doc);
}
