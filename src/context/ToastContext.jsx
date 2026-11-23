import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const STYLES = {
  success: { Icon: CircleCheck, cls: "text-green-600" },
  error: { Icon: CircleAlert, cls: "text-red-600" },
  info: { Icon: Info, cls: "text-indigo-600" },
};

// Small notification popups: const toast = useToast(); toast.success("Saved");
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), 3500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => show("success", m),
      error: (m) => show("error", m),
      info: (m) => show("info", m),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite">
        {toasts.map(({ id, type, message }) => {
          const { Icon, cls } = STYLES[type];
          return (
            <div key={id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden="true" />
              <span className="flex-1">{message}</span>
              <button type="button" onClick={() => dismiss(id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
