import { FileText, Sparkles, Check } from "lucide-react";

const HIGHLIGHTS = [
  "JEE Main, NEET UG & KCET pattern papers",
  "Chapter-wise and difficulty-wise control",
  "Instant answer keys and PDF export",
];

// Shared page shell for Login and Signup.
// Mobile: just the form card. Large screens (lg+): brand panel on the left, form on the right.
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      {/* Brand panel — hidden on small screens */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="rounded-lg bg-white/15 p-2">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          QP Generator
        </div>

        <div>
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI-powered
          </p>
          <h2 className="text-4xl font-bold leading-tight">
            Exam-ready question papers in minutes.
          </h2>
          <ul className="mt-8 space-y-3 text-indigo-100">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="rounded-full bg-white/20 p-1">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-indigo-200">© {new Date().getFullYear()} QP Generator</p>

        {/* decorative blur circles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          {/* Logo shown only on mobile, since the brand panel is hidden there */}
          <div className="mb-8 flex items-center justify-center gap-2 text-lg font-bold text-slate-900 lg:hidden">
            <span className="rounded-lg bg-indigo-600 p-2 text-white">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            QP Generator
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
