import { CircleAlert } from "lucide-react";

export default function Textarea({ id, label, hint, error, className = "", rows = 3, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={[
          "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
          "transition focus:outline-none focus:ring-4",
          error ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100",
        ].join(" ")}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
