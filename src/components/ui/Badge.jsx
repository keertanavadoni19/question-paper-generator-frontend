const COLORS = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const DIFFICULTY_COLOR = { easy: "green", medium: "amber", hard: "red" };
export const EXAM_COLOR = { "jee-main": "indigo", "neet-ug": "emerald", kcet: "amber", assignment: "slate" };

export default function Badge({ color = "slate", children, className = "" }) {
  // single lowercase words like "easy" / "draft" / "admin" are shown capitalised
  const auto = typeof children === "string" && /^[a-z]+$/.test(children) ? "capitalize" : "";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${auto} ring-1 ring-inset ${COLORS[color] ?? COLORS.slate} ${className}`}>
      {children}
    </span>
  );
}
