import { getPasswordStrength } from "../../utils/validation";

const LEVELS = [
  { label: "Too weak", color: "bg-red-500" },
  { label: "Weak", color: "bg-red-500" },
  { label: "Fair", color: "bg-amber-500" },
  { label: "Good", color: "bg-lime-500" },
  { label: "Strong", color: "bg-green-600" },
];

// 4-bar meter shown under the Signup password field.
export default function PasswordStrength({ password }) {
  if (!password) return null;
  const score = getPasswordStrength(password);
  const { label, color } = LEVELS[score];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`h-1.5 flex-1 rounded-full transition-colors ${bar <= score ? color : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Strength: <span className="font-medium text-slate-700">{label}</span> · use 8+ characters with
        upper &amp; lowercase letters and a number
      </p>
    </div>
  );
}
