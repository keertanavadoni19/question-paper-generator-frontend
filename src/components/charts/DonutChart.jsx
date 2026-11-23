import { useState } from "react";

// Donut with a legend that always shows label, value and % (never colour alone).
// data = [{ label, value, color }]
export default function DonutChart({ data, size = 160, thickness = 22, centerLabel = "total" }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total ? 2 : 0; // 2px surface gap between segments

  let offset = 0;
  const segments = data.map((d, i) => {
    const length = total ? (d.value / total) * circumference : 0;
    const seg = { ...d, i, dash: Math.max(0, length - gap), offset };
    offset += length;
    return seg;
  });

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(", ")}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.i ? thickness + 4 : thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              onMouseEnter={() => setHover(s.i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default transition-all"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tabular-nums text-slate-900">{active ? active.value : total}</span>
          <span className="text-xs text-slate-500">{active ? active.label : centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-slate-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-500">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
