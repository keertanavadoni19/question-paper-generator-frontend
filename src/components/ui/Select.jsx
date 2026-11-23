import { ChevronDown, CircleAlert } from "lucide-react";

// Reusable <select>. `options` = [{ value, label }] or plain strings.
export default function Select({ id, label, options = [], placeholder, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          aria-invalid={Boolean(error)}
          className={[
            "w-full appearance-none rounded-lg border bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900",
            "transition focus:outline-none focus:ring-4",
            error ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100",
          ].join(" ")}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const { value, label: text } = typeof opt === "string" ? { value: opt, label: opt } : opt;
            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
