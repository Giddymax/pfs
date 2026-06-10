import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<Client[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (clients ?? []).map((c) => ({
    "Client Code": c.client_code,
    "Full Name": c.full_name,
    "Phone": c.phone,
    "Alt Phone": c.alt_phone ?? "",
    "Gender": c.gender ?? "",
    "Date of Birth": c.date_of_birth ?? "",
    "Ghana Card Number": c.ghana_card_number ?? "",
    "Occupation": c.occupation ?? "",
    "Residential Address": c.residential_address ?? "",
    "Town": c.town ?? "",
    "Next of Kin Name": c.next_of_kin_name ?? "",
    "Next of Kin Phone": c.next_of_kin_phone ?? "",
    "Status": c.status,
    "SMS Opt-in": c.sms_opt_in ? "Yes" : "No",
    "Registered On": new Date(c.created_at).toLocaleDateString("en-GB"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 8 },
    { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Clients");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clients-${date}.xlsx"`,
    },
  });
}
