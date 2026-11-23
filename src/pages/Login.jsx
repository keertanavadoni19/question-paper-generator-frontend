import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, ShieldCheck, GraduationCap } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import RoleSelector from "../components/auth/RoleSelector";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import useAuthForm from "../hooks/useAuthForm";
import { validateLoginForm } from "../utils/validation";
import { useAuth } from "../context/AuthContext";
import { USE_MOCK } from "../services/api";

const DEMO_ACCOUNTS = [
  { role: "admin", email: "admin@qpgen.com", password: "Admin@123", label: "Admin demo", icon: ShieldCheck },
  { role: "teacher", email: "teacher@qpgen.com", password: "Teacher@123", label: "Teacher demo", icon: GraduationCap },
];

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const justRegistered = location.state?.registered;

  const {
    values,
    setFieldValue,
    setManyValues,
    handleChange,
    handleBlur,
    handleSubmit,
    getError,
    isSubmitting,
    submitError,
  } = useAuthForm(
    { role: "", email: location.state?.email ?? "", password: "", remember: true },
    validateLoginForm
  );

  const onSubmit = async (data) => {
    await login(data);
    navigate(location.state?.from ?? "/dashboard", { replace: true });
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to generate and manage your question papers.">
      {justRegistered && <Alert type="success">Account created successfully. Please log in.</Alert>}
      {submitError && <Alert type="error">{submitError}</Alert>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <RoleSelector value={values.role} onChange={(role) => setFieldValue("role", role)} error={getError("role")} />

        <Input
          id="login-email"
          name="email"
          type="email"
          label="Email address"
          icon={Mail}
          placeholder="you@school.edu"
          autoComplete="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={getError("email")}
        />

        <Input
          id="login-password"
          name="password"
          type="password"
          label="Password"
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={getError("password")}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-slate-600">
            <input type="checkbox" name="remember" checked={values.remember} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
            Remember me
          </label>
          <button type="button" className="font-medium text-indigo-600 hover:text-indigo-500" title="Connect your backend to enable password reset">
            Forgot password?
          </button>
        </div>

        <Button type="submit" fullWidth loading={isSubmitting} loadingText="Logging in…" icon={LogIn}>
          Log in
        </Button>
      </form>

      {USE_MOCK && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts (mock mode) — click to fill:</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(({ label, icon, ...account }) => (
              <Button key={account.role} variant="secondary" size="sm" icon={icon} onClick={() => setManyValues(account)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
