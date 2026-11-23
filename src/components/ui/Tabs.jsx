// Segmented tab bar. `tabs` = [{ value, label, count? }]
export default function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div role="tablist" className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              active ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-indigo-100" : "bg-slate-200"}`}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
