// One-time (or re-runnable) setup: creates the ZZTEST fixture admin/staff
// users the integration suite signs in as, via the REAL Supabase Auth
// signup flow — not a hand-crafted auth.users row. A hand-seeded row hit an
// unexplained GoTrue password-verification mismatch (bcrypt hash verified
// correctly via direct SQL `crypt()`, but GoTrue's own comparison rejected
// it every time — root cause not chased further; sidestepped instead by
// letting GoTrue generate its own hash, which it can always verify).
//
// Run with: node tests/scripts/seed-test-users.mjs
// Safe to re-run — skips a user that already exists.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env.test") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const users = [
  { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD, label: "admin" },
  { email: process.env.TEST_STAFF_EMAIL, password: process.env.TEST_STAFF_PASSWORD, label: "staff" },
];

for (const u of users) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email: u.email, password: u.password });
  if (error) {
    console.log(`${u.label} (${u.email}): signUp error — ${error.message} (likely already exists, continuing)`);
    continue;
  }
  console.log(`${u.label} (${u.email}): signed up, id = ${data.user?.id}`);
}

console.log("\nNext: run the SQL in tests/scripts/finish-seed.sql (via the Supabase MCP execute_sql / SQL editor) to confirm the emails and set role/profile rows.");
