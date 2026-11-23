import { USE_MOCK, request } from "./api";
import { getMockUsers, saveMockUsers } from "./authService";
import { sleep } from "../utils/helpers";

const strip = ({ password: _password, ...user }) => user;

export async function listUsers() {
  if (!USE_MOCK) return request("/users");
  await sleep(300);
  return getMockUsers().map(strip);
}

export async function updateUser(userId, changes) {
  if (!USE_MOCK) return request(`/users/${userId}`, { method: "PATCH", body: changes });
  await sleep(300);
  const users = getMockUsers().map((u) => (u.id === userId ? { ...u, ...changes } : u));
  saveMockUsers(users);
  return strip(users.find((u) => u.id === userId));
}

export async function deleteUser(userId) {
  if (!USE_MOCK) return request(`/users/${userId}`, { method: "DELETE" });
  await sleep(300);
  saveMockUsers(getMockUsers().filter((u) => u.id !== userId));
}
