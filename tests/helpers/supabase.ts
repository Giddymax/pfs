import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Real, authenticated Supabase clients for the ZZTEST fixture users — same
 * project the app itself runs against (see .env.test's header comment for
 * why there's no separate test project/branch). Signing in for real, rather
 * than faking a session, means is_admin()/is_staff_or_admin() and every RLS
 * policy are exercised exactly as they are in production — no shortcuts.
 */
async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing — check .env.test");
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Test sign-in failed for ${email}: ${error.message}`);
  }

  return client;
}

export async function adminClient(): Promise<SupabaseClient> {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD missing — check .env.test");
  return signIn(email, password);
}

export async function staffClient(): Promise<SupabaseClient> {
  const email = process.env.TEST_STAFF_EMAIL;
  const password = process.env.TEST_STAFF_PASSWORD;
  if (!email || !password) throw new Error("TEST_STAFF_EMAIL / TEST_STAFF_PASSWORD missing — check .env.test");
  return signIn(email, password);
}

export const TEST_ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
export const TEST_STAFF_ID = "bbbbbbbb-0000-0000-0000-000000000001";

// Every fixture row this suite creates carries this prefix in the client's
// full_name, so cleanup (deleteAllFixtures) can find and remove exactly the
// rows a test run created, and never anything real.
export const FIXTURE_PREFIX = "ZZTEST-AUDIT";

/**
 * Creates one throwaway client with a savings and a susu account, via the
 * app's own registration path (a plain insert — matches what the real
 * registration form does), tagged for guaranteed cleanup. Returns enough IDs
 * for a test to drive the RPCs directly.
 */
export async function createFixtureClient(
  supabase: SupabaseClient,
  opts: { label: string; dailyContribution?: number }
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fullName = `${FIXTURE_PREFIX} ${opts.label} ${suffix}`;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({
      full_name: fullName,
      phone: `0000${suffix}`.slice(-10),
      status: "active",
    })
    .select()
    .single();
  if (clientErr) throw new Error(`createFixtureClient: ${clientErr.message}`);

  const { data: savings, error: savingsErr } = await supabase
    .from("accounts")
    .insert({ client_id: client.id, product_type: "savings" })
    .select()
    .single();
  if (savingsErr) throw new Error(`createFixtureClient (savings account): ${savingsErr.message}`);

  const { data: susu, error: susuErr } = await supabase
    .from("accounts")
    .insert({
      client_id: client.id,
      product_type: "susu",
      daily_contribution_amount: opts.dailyContribution ?? 30,
    })
    .select()
    .single();
  if (susuErr) throw new Error(`createFixtureClient (susu account): ${susuErr.message}`);

  return { client, savingsAccount: savings, susuAccount: susu };
}

/**
 * Deletes every ZZTEST-tagged fixture row (clients cascade to their
 * accounts/transactions/susu data via existing FKs). Safe to call at the
 * start and end of a run — matches nothing real, ever, by construction of
 * FIXTURE_PREFIX.
 */
export async function deleteAllFixtures(supabase: SupabaseClient) {
  const { error } = await supabase.from("clients").delete().like("full_name", `${FIXTURE_PREFIX}%`);
  if (error) throw new Error(`deleteAllFixtures: ${error.message}`);
}
