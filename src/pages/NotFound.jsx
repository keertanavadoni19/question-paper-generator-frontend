import { Link } from "react-router-dom";
import { FileQuestionMark } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <span className="mb-4 rounded-full bg-indigo-50 p-4 text-indigo-600"><FileQuestionMark className="h-8 w-8" /></span>
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Link to="/dashboard" className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Go to dashboard</Link>
    </div>
  );
}
