import { createContext, useContext, useMemo, useState } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

// Holds the logged-in user for the whole app. Any component can call useAuth().
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      async login(credentials) {
        const loggedIn = await authService.login(credentials);
        setUser(loggedIn);
        return loggedIn;
      },
      signup: authService.signup,
      logout() {
        authService.logout();
        setUser(null);
      },
      async updateProfile(changes) {
        const updated = await authService.updateProfile(user.id, changes);
        setUser(updated);
        return updated;
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
