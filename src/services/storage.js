// Small localStorage wrapper used by the mock services.
// All keys are prefixed so they never clash with other apps on localhost:5173.

const PREFIX = "qpg:";

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key) ?? sessionStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value, { session = false } = {}) {
    try {
      (session ? sessionStorage : localStorage).setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn("Storage write failed", err);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      sessionStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  // Removes every app key — used by "Reset demo data" in Settings.
  clearAll() {
    for (const store of [localStorage, sessionStorage]) {
      Object.keys(store)
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => store.removeItem(key));
    }
  },
};
