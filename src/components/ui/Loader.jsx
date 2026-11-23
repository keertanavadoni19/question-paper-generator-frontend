import { LoaderCircle } from "lucide-react";

export default function Loader({ label = "Loading…", fullPage = false }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${fullPage ? "min-h-screen" : "py-16"}`} role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" />
      {label}
    </div>
  );
}
