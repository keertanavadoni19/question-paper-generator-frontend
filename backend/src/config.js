// Backend configuration, read from backend/.env (see .env.example) or the process environment.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const bool = (v, fallback) => (v === undefined || v === "" ? fallback : /^(1|true|yes|on)$/i.test(v));
const num = (v, fallback) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));

// What each Supabase project holds (found in Supabase_All_Databases/*.dump).
// The backend also discovers subject/class from the data itself, so this is only used for labels.
export const DB_LABELS = {
  1: "Chemistry · Class 11",
  2: "Chemistry · Class 12",
  3: "Mathematics · Class 11",
  4: "Mathematics · Class 12",
  5: "Biology · Class 12",
  6: "Biology · Class 11",
  7: "Physics · Class 11 + app data (users, papers)",
  8: "Physics · Class 12",
};

export function loadConfig(overrides = {}) {
  const databases = Object.keys(DB_LABELS).map((key) => {
    const id = Number(key);
    return {
      id,
      label: DB_LABELS[id],
      url: env[`SUPABASE_DB${id}_URL`]?.trim() || "",
      key: env[`SUPABASE_DB${id}_SERVICE_KEY`]?.trim() || "",
    };
  });
  const config = {
    port: num(env.PORT, 5000),
    corsOrigins: (env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    jwtSecret: env.JWT_SECRET || "",
    jwtExpiresIn: env.JWT_EXPIRES_IN || "12h",
    databases,
    mainDb: num(env.MAIN_DB, 7), // project that holds users, papers, settings, question_usage
    allowSignup: bool(env.ALLOW_SIGNUP, false),
    includeLegacyChapters: bool(env.INCLUDE_LEGACY_CHAPTERS, false),
    minChapterQuestions: num(env.MIN_CHAPTER_QUESTIONS, 5),
    indexRefreshMinutes: num(env.INDEX_REFRESH_MINUTES, 30),
    pageSize: 1000, // rows per Supabase request (PostgREST default maximum)
    ...overrides,
  };
  config.problems = [
    ...databases.filter((d) => !d.url || !d.key).map((d) => `SUPABASE_DB${d.id}_URL / SUPABASE_DB${d.id}_SERVICE_KEY not set (${d.label})`),
    ...(config.jwtSecret.length < 32 ? ["JWT_SECRET must be at least 32 characters"] : []),
  ];
  return config;
}
