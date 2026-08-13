import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, Profile } from "@/lib/types";

// Admin-only alert (never sent to the client) that a new client has been
// registered. Separate from the client-facing SMS gating in
// shouldSendClientSms — registration doesn't touch a client's own opt-in,
// since the message never goes to them.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await getSettings();
  if (!shouldSendAdminSms(settings, "registration")) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const [{ data: client }, { data: profile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single<Client>(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single<Pick<Profile, "full_name">>(),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const message = smsTemplates.clientRegisteredAdmin(client.full_name, client.client_code, profile?.full_name);
  await sendSms({
    to: settings.sms.company_tel!,
    message,
    event: "client_registered_admin",
    recipientType: "admin",
    relatedClientId: client.id,
  });

  return NextResponse.json({ ok: true, sent: true });
}
