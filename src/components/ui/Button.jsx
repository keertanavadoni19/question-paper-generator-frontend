import { LoaderCircle } from "lucide-react";

const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-300 disabled:bg-indigo-400",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300 disabled:bg-red-400",
  soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus-visible:ring-indigo-200",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  icon: "p-2",
};

// Reusable button. Shows a spinner and disables itself while `loading` is true,
// so the user can't submit twice.
export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  fullWidth = false,
  icon: Icon,
  disabled,
  className = "",
  ...props
}) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold whitespace-nowrap",
        "transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <LoaderCircle className={`${iconSize} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconSize} aria-hidden="true" />
      )}
      {loading ? (loadingText ?? children ?? "Please wait…") : children}
    </button>
  );
}
