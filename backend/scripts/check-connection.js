// Checks every configured Supabase project: npm run check (inside backend/)
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "../src/config.js";

const config = loadConfig();
let failed = 0;
for (const d of config.databases) {
  if (!d.url || !d.key) {
    console.log(`DB${d.id}  ✗ not configured            ${d.label}`);
    failed += 1;
    continue;
  }
  const db = createClient(d.url, d.key, { auth: { persistSession: false } });
  const { count, error } = await db.from("questions").select("id", { count: "exact", head: true });
  const extra = d.id === config.mainDb ? await db.from("users").select("id", { count: "exact", head: true }) : null;
  if (error || extra?.error) {
    failed += 1;
    console.log(`DB${d.id}  ✗ ${(error ?? extra.error).message}   ${d.label}`);
  } else {
    console.log(`DB${d.id}  ✓ ${String(count).padStart(6)} questions${extra ? `, ${extra.count} users` : ""}   ${d.label}`);
  }
}
if (config.jwtSecret.length < 32) console.log("JWT_SECRET  ✗ set a random value of at least 32 characters");
process.exit(failed ? 1 : 0);
