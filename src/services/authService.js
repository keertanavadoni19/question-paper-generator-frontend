import { USE_MOCK, request } from "./api";
import { storage } from "./storage";
import { sleep, uid } from "../utils/helpers";

// ── Mock user store ─────────────────────────────────────────────
// Demo accounts (shown on the Login page):
//   admin@qpgen.com   / Admin@123   (Admin)
//   teacher@qpgen.com / Teacher@123 (Teacher)
const SEED_USERS = [
  { id: "u-admin", fullName: "Anita Rao", email: "admin@qpgen.com", password: "Admin@123", role: "admin", status: "active", createdAt: "2026-06-01T09:00:00.000Z" },
  { id: "u-teacher", fullName: "Rahul Verma", email: "teacher@qpgen.com", password: "Teacher@123", role: "teacher", status: "active", createdAt: "2026-06-05T09:00:00.000Z" },
  { id: "u-t2", fullName: "Meera Iyer", email: "meera@qpgen.com", password: "Teacher@123", role: "teacher", status: "active", createdAt: "2026-07-12T09:00:00.000Z" },
  { id: "u-t3", fullName: "Karthik Gowda", email: "karthik@qpgen.com", password: "Teacher@123", role: "teacher", status: "inactive", createdAt: "2026-08-20T09:00:00.000Z" },
];

export function getMockUsers() {
  let users = storage.get("users");
  if (!users) {
    users = SEED_USERS;
    storage.set("users", users);
  }
  return users;
}
export const saveMockUsers = (users) => storage.set("users", users);

const publicUser = ({ password: _password, ...user }) => user;

// ── Session helpers ────────────────────────────────────────────
function saveSession(user, token, remember) {
  storage.remove("session");
  storage.remove("token");
  storage.set("session", user, { session: !remember });
  storage.set("token", token, { session: !remember });
}

export function getCurrentUser() {
  return storage.get("session");
}

export function logout() {
  storage.remove("session");
  storage.remove("token");
}

// ── API ────────────────────────────────────────────────────────
export async function login({ email, password, role, remember }) {
  if (!USE_MOCK) {
    const data = await request("/auth/login", { method: "POST", body: { email, password, role } });
    saveSession(data.user, data.token, remember);
    return data.user;
  }

  await sleep(700);
  const user = getMockUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) throw new Error("Invalid email or password.");
  if (user.role !== role) throw new Error(`This account is registered as ${user.role === "admin" ? "an Admin" : "a Teacher"}. Select the correct role.`);
  if (user.status !== "active") throw new Error("Your account is inactive. Please contact the administrator.");

  const safe = publicUser(user);
  saveSession(safe, `mock-${uid("token")}`, remember);
  return safe;
}

export async function signup({ fullName, email, password, role }) {
  if (!USE_MOCK) {
    return request("/auth/signup", { method: "POST", body: { fullName, email, password, role } });
  }

  await sleep(900);
  const users = getMockUsers();
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const user = {
    id: uid("u"),
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    password, // mock only — a real backend must hash passwords
    role,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  saveMockUsers([...users, user]);
  return publicUser(user);
}

export async function updateProfile(userId, changes) {
  if (!USE_MOCK) return request(`/users/${userId}`, { method: "PATCH", body: changes });
  await sleep(400);
  const users = getMockUsers().map((u) => (u.id === userId ? { ...u, ...changes } : u));
  saveMockUsers(users);
  const updated = publicUser(users.find((u) => u.id === userId));
  const remember = Boolean(localStorage.getItem("qpg:session"));
  storage.set("session", updated, { session: !remember });
  return updated;
}
