import { ShieldCheck, GraduationCap, CircleAlert } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Manage users & question banks", icon: ShieldCheck },
  { value: "teacher", label: "Teacher", description: "Generate & download papers", icon: GraduationCap },
];

// Two clickable cards that behave like radio buttons (keyboard + screen-reader friendly,
// because underneath they ARE real radio inputs).
export default function RoleSelector({ name = "role", value, onChange, error }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">I am a</legend>

      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(({ value: optionValue, label, description, icon: Icon }) => {
          const selected = value === optionValue;
          return (
            <label
              key={optionValue}
              className={[
                "relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-indigo-100",
                selected
                  ? "border-indigo-500 bg-indigo-50"
                  : error
                    ? "border-red-300 hover:border-red-400"
                    : "border-slate-300 hover:border-slate-400",
              ].join(" ")}
            >
              <input
                type="radio"
                name={name}
                value={optionValue}
                checked={selected}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${selected ? "text-indigo-600" : "text-slate-500"}`} aria-hidden="true" />
                <span className={`text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-800"}`}>
                  {label}
                </span>
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">{description}</span>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
