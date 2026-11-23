import { CircleAlert, CircleCheck } from "lucide-react";

const STYLES = {
  error: { box: "border-red-200 bg-red-50 text-red-700", Icon: CircleAlert },
  success: { box: "border-green-200 bg-green-50 text-green-700", Icon: CircleCheck },
};

// Reusable banner for form-level messages (e.g. "Invalid email or password").
export default function Alert({ type = "error", children }) {
  const { box, Icon } = STYLES[type];
  return (
    <div role={type === "error" ? "alert" : "status"} className={`mb-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
