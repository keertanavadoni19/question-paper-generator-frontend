import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  blockHtml, buildBlocks, documentCss, makeContext, measureBlocks, pageCapacity, pageChrome, paginate,
} from "../../services/documentRenderer";

// Extra styles for edit mode (selection, drop indicator, page-break marker). Outlines and
// shadows are used so the page layout is identical to the export.
const EDIT_CSS = `
  .qp-edit .qp-sel { cursor: pointer; }
  .qp-edit .qp-sel:hover { outline: 1px dashed #a5b4fc; outline-offset: 2px; }
  .qp-edit .qp-sel.is-selected { outline: 2px solid #6366f1; outline-offset: 2px; }
  .qp-edit .qp-sel.drop-before { box-shadow: 0 -3px 0 #4f46e5; }
  .qp-edit .qp-sel.drop-after { box-shadow: 0 3px 0 #4f46e5; }
  .qp-edit .qp-sel.dragging { opacity: .4; }
  .qp-edit .qp-pb { position: relative; outline: 1px dashed #818cf8; outline-offset: 3px; }
  .qp-edit .qp-pb::after { content: "Page break"; position: absolute; right: 0; top: -8px; font: 600 9px/1 system-ui, sans-serif;
    color: #4f46e5; background: #eef2ff; padding: 2px 4px; border-radius: 3px; }
`;

const selectable = (block) => block.kind === "question" || block.kind === "sectionHeading" || block.kind === "extra";
const selectionOf = (block) =>
  block.kind === "question" ? { type: "question", id: block.qid } : block.kind === "sectionHeading" ? { type: "section", id: block.sectionId } : { type: "block", id: block.block.id };

// Live, paginated preview of a paper. Uses the same renderer as PDF / Print export.
export default function DocumentPreview({
  paper, setLabel, showAnswers, showSolutions, editMode, zoom = 1,
  selection, onSelect, onActivate, onMove, editingId, renderEditor,
}) {
  const ctx = useMemo(() => makeContext(paper, setLabel), [paper, setLabel]);
  const blocks = useMemo(() => buildBlocks(paper, setLabel, { showAnswers, showSolutions }), [paper, setLabel, showAnswers, showSolutions]);
  const htmls = useMemo(() => blocks.map((b) => blockHtml(b, ctx)), [blocks, ctx]);
  const css = useMemo(() => documentCss(ctx.layout), [ctx.layout]);
  const [fontsReady, setFontsReady] = useState(0);
  const [layoutState, setLayoutState] = useState(null);
  const [drag, setDrag] = useState(null); // { id, sectionId }
  const [drop, setDrop] = useState(null); // { id, position }

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((n) => n + 1));
    return () => { alive = false; };
  }, []);

  // Measure every block at the page's content width, then split into pages.
  useLayoutEffect(() => {
    const heights = measureBlocks(document, htmls, ctx.metrics);
    setLayoutState({ blocks, htmls, ctx, pages: paginate(blocks, heights, pageCapacity(ctx.metrics)) });
  }, [blocks, htmls, ctx, css, fontsReady]);

  if (!layoutState) return <style>{css}</style>;
  const { pages, ctx: c } = layoutState;
  const { metrics } = c;
  const m = metrics.margins;
  const isSelected = (b) => selection && selectable(b) && selection.type === selectionOf(b).type && selection.id === selectionOf(b).id;

  const dragProps = (b) => {
    if (!editMode || b.kind !== "question" || editingId) return {};
    return {
      draggable: true,
      onDragStart: (ev) => {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", b.qid);
        setDrag({ id: b.qid, sectionId: b.sectionId });
      },
      onDragEnd: () => { setDrag(null); setDrop(null); },
      onDragOver: (ev) => {
        if (!drag || drag.sectionId !== b.sectionId || drag.id === b.qid) return;
        ev.preventDefault();
        const rect = ev.currentTarget.getBoundingClientRect();
        const position = ev.clientY - rect.top < rect.height / 2 ? "before" : "after";
        if (drop?.id !== b.qid || drop?.position !== position) setDrop({ id: b.qid, position });
      },
      onDrop: (ev) => {
        ev.preventDefault();
        if (drag && drop) onMove?.(drag.id, drop.id, drop.position);
        setDrag(null);
        setDrop(null);
      },
    };
  };

  return (
    <div className={`qp-doc ${editMode ? "qp-edit" : ""}`} style={{ zoom }}>
      <style>{css}{EDIT_CSS}</style>
      {pages.map((indices, p) => {
        const hasEditor = editingId && indices.some((i) => layoutState.blocks[i].qid === editingId);
        return (
          <div key={p} className="mx-auto mb-6 last:mb-0" style={{ width: `${metrics.width}mm` }}>
            <div
              className="qp-page shadow-[0_1px_3px_rgba(15,23,42,.15),0_8px_24px_-12px_rgba(15,23,42,.25)] ring-1 ring-slate-200"
              style={{ width: `${metrics.width}mm`, height: hasEditor ? "auto" : `${metrics.height}mm`, minHeight: `${metrics.height}mm` }}
            >
              <div dangerouslySetInnerHTML={{ __html: pageChrome(c, p + 1, pages.length) }} />
              <div
                className="qp-content"
                style={hasEditor
                  ? { position: "relative", margin: `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`, width: `${metrics.contentWidth}mm` }
                  : { top: `${m.top}mm`, left: `${m.left}mm`, width: `${metrics.contentWidth}mm`, height: `${metrics.contentHeight}mm` }}
              >
                {indices.map((i) => {
                  const b = layoutState.blocks[i];
                  if (b.qid && b.qid === editingId) {
                    return <div key={b.key} className="qp-block" style={{ zoom: 1 / zoom }}>{renderEditor?.(b.qid)}</div>;
                  }
                  if (!editMode || !selectable(b)) {
                    return <div key={b.key} className="qp-block" dangerouslySetInnerHTML={{ __html: layoutState.htmls[i] }} />;
                  }
                  const cls = [
                    "qp-block qp-sel",
                    isSelected(b) ? "is-selected" : "",
                    b.qid && drag?.id === b.qid ? "dragging" : "",
                    b.qid && drop?.id === b.qid ? `drop-${drop.position}` : "",
                  ].join(" ");
                  return (
                    <div
                      key={b.key}
                      className={cls}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected(b)}
                      onClick={() => onSelect?.(selectionOf(b))}
                      onDoubleClick={() => onActivate?.(selectionOf(b))}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") onActivate?.(selectionOf(b));
                        if (ev.key === " ") { ev.preventDefault(); onSelect?.(selectionOf(b)); }
                      }}
                      {...dragProps(b)}
                      dangerouslySetInnerHTML={{ __html: layoutState.htmls[i] }}
                    />
                  );
                })}
              </div>
            </div>
            <p className="mt-1.5 text-center font-sans text-[11px] text-slate-400" style={{ zoom: 1 / zoom }}>Page {p + 1} of {pages.length}</p>
          </div>
        );
      })}
    </div>
  );
}
