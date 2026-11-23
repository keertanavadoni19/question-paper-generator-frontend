import { useState } from "react";

// Simple responsive column chart (single series). data = [{ label, value }]
export default function BarChart({ data, color = "#4f46e5", height = 200, valueLabel = "papers" }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = max >= 2 ? [max, Math.round(max / 2), 0] : [max, "", 0];

  return (
    <div className="relative">
      <div className="flex gap-2" style={{ height }}>
        {/* y-axis labels */}
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-slate-400">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>

        <div className="relative flex flex-1 items-end gap-[2px] border-b border-slate-200 pb-0">
          {/* recessive gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-100" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />

          {data.map((d, i) => (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end px-[3px]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value ? 4 : 0,
                  background: color,
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
              {hover === i && (
                <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow">
                  <span className="font-semibold tabular-nums">{d.value}</span> {valueLabel} · {d.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-7 mt-1.5 flex gap-[2px]">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center text-[11px] text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
