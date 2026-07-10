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

  const rows = [
    ["Client Code", "Full Name", "Gender", "Date of Birth", "Phone", "Alt Phone", "Ghana Card", "Occupation", "Address", "Town", "Next of Kin", "Next of Kin Phone", "Status", "SMS Opt-In", "Registered"],
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
