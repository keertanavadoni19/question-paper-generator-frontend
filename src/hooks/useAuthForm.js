import { useState } from "react";

// Reusable form-state hook for Login and Signup.
// - values:   current input values
// - getError: returns a field's error only after the user has touched it
// - handleSubmit: validates everything, focuses the first bad field, then calls onSubmit
export default function useAuthForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const setFieldValue = (name, value) => {
    const next = { ...values, [name]: value };
    setValues(next);
    setErrors(validate(next)); // re-check live so errors disappear as soon as they're fixed
  };

  // Set several fields at once (e.g. "Fill demo account").
  const setManyValues = (changes) => {
    const next = { ...values, ...changes };
    setValues(next);
    setErrors(validate(next));
  };

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setFieldValue(name, type === "checkbox" ? checked : value);
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
    setErrors(validate(values));
  };

  const handleSubmit = (onSubmit) => async (e) => {
    e.preventDefault();
    setSubmitError("");

    const allErrors = validate(values);
    setErrors(allErrors);
    setTouched(Object.fromEntries(Object.keys(values).map((key) => [key, true])));

    const firstInvalid = Object.keys(allErrors)[0];
    if (firstInvalid) {
      document.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getError = (name) => (touched[name] ? errors[name] : undefined);

  return {
    values,
    setFieldValue,
    setManyValues,
    handleChange,
    handleBlur,
    handleSubmit,
    getError,
    isSubmitting,
    submitError,
  };
}
