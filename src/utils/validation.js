// Validation rules for the auth forms.
// Each function returns an error message ("" means the value is valid).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;

export const ROLES = ["admin", "teacher"];

export function validateFullName(value) {
  const name = value.trim();
  if (!name) return "Full name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  if (!NAME_REGEX.test(name)) return "Name can contain only letters, spaces, . ' -";
  return "";
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return "Email is required";
  if (!EMAIL_REGEX.test(email)) return "Enter a valid email address";
  return "";
}

// strict = true  -> signup (enforce strong password rules)
// strict = false -> login  (only check it's not empty; never reveal rules on login)
export function validatePassword(value, { strict = false } = {}) {
  if (!value) return "Password is required";
  if (!strict) return "";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter";
  if (!/[a-z]/.test(value)) return "Add at least one lowercase letter";
  if (!/\d/.test(value)) return "Add at least one number";
  return "";
}

export function validateRole(value) {
  return ROLES.includes(value) ? "" : "Please select a role";
}

// Returns 0–4 for the password strength meter.
export function getPasswordStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

// Keeps only the fields that actually have an error.
function collectErrors(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, msg]) => msg));
}

export function validateLoginForm(values) {
  return collectErrors({
    role: validateRole(values.role),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  });
}

export function validateSignupForm(values) {
  return collectErrors({
    fullName: validateFullName(values.fullName),
    email: validateEmail(values.email),
    role: validateRole(values.role),
    password: validatePassword(values.password, { strict: true }),
    confirmPassword: !values.confirmPassword
      ? "Please confirm your password"
      : values.confirmPassword !== values.password
        ? "Passwords do not match"
        : "",
    agreeTerms: values.agreeTerms ? "" : "You must accept the terms to continue",
  });
}
