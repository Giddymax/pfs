import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Admin-only, for now (momo-mini-app-brief.md §3). The sidebar hides the
// MoMo pill from staff, but that's UX, not enforcement — this redirect is
// the real guard, mirroring the same pattern app/(dashboard)/page.tsx
// already uses for its own admin-only Overview page.
export default async function MomoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();

  if (!profile || profile.role !== "admin") redirect("/");

  return <>{children}</>;
}
