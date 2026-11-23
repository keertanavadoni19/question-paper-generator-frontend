// Central API client. Every service checks USE_MOCK:
//   true  -> uses mock data in localStorage (works with no backend)
//   false -> calls your backend at VITE_API_URL with the same function names
import { storage } from "./storage";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = storage.get("token");
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}
