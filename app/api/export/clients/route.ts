import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Client[]>();

  const clientIds = (clients ?? []).map((c) => c.id);

  // Regular accounts take priority; fall back to the client's active FD principal
  const balanceByClient = new Map<string, number>();
  if (clientIds.length > 0) {
    const [{ data: fds }, { data: accounts }] = await Promise.all([
      supabase
        .from("fixed_deposits")
        .select("client_id, principal")
        .in("client_id", clientIds)
        .not("status", "in", '("withdrawn","rolled_over")')
        .order("created_at", { ascending: true })
        .returns<{ client_id: string; principal: number }[]>(),
      supabase
        .from("accounts")
        .select("client_id, balance")
        .in("client_id", clientIds)
        .order("created_at", { ascending: true })
        .returns<{ client_id: string; balance: number }[]>(),
    ]);
    for (const fd of fds ?? []) balanceByClient.set(fd.client_id, fd.principal);
    for (const acc of accounts ?? []) balanceByClient.set(acc.client_id, acc.balance);
  }

  const rows = [
    ["Client Code", "Full Name", "Gender", "Date of Birth", "Phone", "Alt Phone", "Ghana Card", "Occupation", "Address", "Town", "Next of Kin", "Next of Kin Phone", "Status", "Balance", "SMS Opt-In", "Registered"],
    ...(clients ?? []).map((c) => [
      c.client_code,
      c.full_name,
      c.gender ?? "",
      c.date_of_birth ?? "",
      c.phone,
      c.alt_phone ?? "",
      c.ghana_card_number ?? "",
      c.occupation ?? "",
      c.residential_address ?? "",
      c.town ?? "",
      c.next_of_kin_name ?? "",
      c.next_of_kin_phone ?? "",
      c.status,
      balanceByClient.get(c.id) ?? "",
      c.sms_opt_in ? "Yes" : "No",
      new Date(c.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
