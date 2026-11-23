import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, UserPlus, CircleAlert } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import RoleSelector from "../components/auth/RoleSelector";
import PasswordStrength from "../components/auth/PasswordStrength";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import useAuthForm from "../hooks/useAuthForm";
import { validateSignupForm } from "../utils/validation";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const {
    values,
    setFieldValue,
    handleChange,
    handleBlur,
    handleSubmit,
    getError,
    isSubmitting,
    submitError,
  } = useAuthForm(
    { fullName: "", email: "", role: "", password: "", confirmPassword: "", agreeTerms: false },
    validateSignupForm
  );

  const onSubmit = async (data) => {
    await signup(data);
    // Send the user to Login with a success message and their email pre-filled.
    navigate("/login", { state: { registered: true, email: data.email } });
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start generating JEE, NEET and KCET papers.">
      {submitError && <Alert type="error">{submitError}</Alert>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          id="signup-name"
          name="fullName"
          label="Full name"
          icon={User}
          placeholder="e.g. Priya Sharma"
          autoComplete="name"
          value={values.fullName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={getError("fullName")}
        />

        <Input
          id="signup-email"
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

        <RoleSelector
          value={values.role}
          onChange={(role) => setFieldValue("role", role)}
          error={getError("role")}
        />

        <div>
          <Input
            id="signup-password"
            name="password"
            type="password"
            label="Password"
            icon={Lock}
            placeholder="Create a strong password"
            autoComplete="new-password"
            value={values.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={getError("password")}
          />
          <PasswordStrength password={values.password} />
        </div>

        <Input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          label="Confirm password"
          icon={Lock}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={getError("confirmPassword")}
        />

        <div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="agreeTerms"
              checked={values.agreeTerms}
              onChange={handleChange}
              onBlur={handleBlur}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <span>
              I agree to the <span className="font-medium text-indigo-600">Terms of Service</span> and{" "}
              <span className="font-medium text-indigo-600">Privacy Policy</span>
            </span>
          </label>
          {getError("agreeTerms") && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {getError("agreeTerms")}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={isSubmitting} loadingText="Creating account…" icon={UserPlus}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
