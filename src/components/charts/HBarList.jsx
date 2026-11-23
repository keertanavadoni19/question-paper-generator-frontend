// Horizontal bars with direct labels — good for long category names (chapters, subjects).
// data = [{ label, value, color? }]
export default function HBarList({ data, color = "#4f46e5", suffix = "" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">No data yet.</p>;

  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${d.value}${suffix}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {d.value}
              {suffix}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
