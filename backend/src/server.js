// Starts the QP Generator API: node src/server.js (or `npm run server` from the project root)
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
for (const p of config.problems) console.warn(`[config] ${p}`);

const configured = config.databases.filter((d) => d.url && d.key);
const clients = new Map(configured.map((d) => [d.id, createClient(d.url, d.key, { auth: { persistSession: false, autoRefreshToken: false } })]));
if (!clients.has(config.mainDb)) console.warn(`[config] MAIN_DB=${config.mainDb} is not configured: login and papers will not work.`);
if (!config.jwtSecret) {
  console.error("[config] JWT_SECRET is required. Copy backend/.env.example to backend/.env and fill it in.");
  process.exit(1);
}

const { app, index } = createApp({ config, clients });
app.listen(config.port, () => console.log(`QP Generator API on http://localhost:${config.port}/api  (${clients.size}/8 databases configured)`));

if (clients.size) {
  index.load().catch((err) => console.error("[index]", err.message));
  setInterval(() => index.load().catch(() => {}), config.indexRefreshMinutes * 60000).unref();
}
