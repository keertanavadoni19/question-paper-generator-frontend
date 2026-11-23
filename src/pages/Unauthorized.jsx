import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 rounded-full bg-red-50 p-4 text-red-600"><ShieldAlert className="h-8 w-8" /></span>
      <h1 className="text-xl font-bold text-slate-900">Admins only</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">This section is available to Admin accounts. Ask your administrator if you need access.</p>
      <Link to="/dashboard" className="mt-6 text-sm font-semibold text-indigo-600 hover:text-indigo-500">Back to dashboard</Link>
    </div>
  );
}
