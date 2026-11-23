import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpenCheck,
  Sparkles,
  FileText,
  Library,
  ListTree,
  ChartColumn,
  Users,
  Settings,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exams", label: "Exams", icon: BookOpenCheck },
  { to: "/generate", label: "Generate Paper", icon: Sparkles },
  { to: "/papers", label: "My Papers", icon: FileText },
  { to: "/question-bank", label: "Question Bank", icon: Library },
  { to: "/syllabus", label: "Syllabus", icon: ListTree, adminOnly: true },
  { to: "/analytics", label: "Analytics", icon: ChartColumn },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

// Fixed on desktop (lg+); slides in as a drawer on mobile.
export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-base font-bold text-slate-900" onClick={onClose}>
            <span className="rounded-lg bg-indigo-600 p-1.5 text-white">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            QP Generator
          </NavLink>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
          {items.map(({ to, label, icon: Icon, adminOnly }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {adminOnly && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">Admin</span>}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
          <p className="text-sm font-semibold">JEE · NEET · KCET</p>
          <p className="mt-1 text-xs text-indigo-100">Generate up to 8 shuffled sets with answer keys in one click.</p>
        </div>
      </aside>
    </>
  );
}
