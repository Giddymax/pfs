import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { BulkDeleteClientsTool } from "@/components/bulk-delete-clients-tool";
import type { Profile } from "@/lib/types";

export default async function BulkDeleteClientsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") redirect("/clients");

  return (
    <div>
      <PageHeader
        back="/clients"
        eyebrow="Clients — Admin"
        title="Bulk delete clients"
        description="Filter clients by registration date, status, or balance, review exactly who matches, and permanently remove them. This cannot be undone."
      />
      <BulkDeleteClientsTool />
    </div>
  );
}
