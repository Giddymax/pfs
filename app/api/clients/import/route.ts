import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

interface ImportRow {
  "Full Name"?: unknown;
  "Phone"?: unknown;
  "Alt Phone"?: unknown;
  "Gender"?: unknown;
  "Date of Birth"?: unknown;
  "Ghana Card Number"?: unknown;
  "Occupation"?: unknown;
  "Residential Address"?: unknown;
  "Town"?: unknown;
  "Next of Kin Name"?: unknown;
  "Next of Kin Phone"?: unknown;
  "SMS Opt-in"?: unknown;
  [key: string]: unknown;
}

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

function parseGender(v: unknown): "male" | "female" | null {
  const s = str(v).toLowerCase();
  if (s === "male" || s === "m") return "male";
  if (s === "female" || s === "f") return "female";
  return null;
}

function parseSmsOptIn(v: unknown): boolean {
  const s = str(v).toLowerCase();
  if (s === "no" || s === "false" || s === "0") return false;
  return true; // default opt-in
}

function parseDate(v: unknown): string | null {
  if (v == null || str(v) === "") return null;
  // Excel date serial number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = str(v);
  // Accept YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  } catch {
    return NextResponse.json({ error: "Could not read the Excel file. Make sure it is a valid .xlsx or .xls file." }, { status: 400 });
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "The workbook has no sheets." }, { status: 400 });

  const rows: ImportRow[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "The sheet is empty." }, { status: 400 });
  }

  const succeeded: string[] = [];
  const failed: { row: number; name: string; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row
    const fullName = str(row["Full Name"]);
    const phone = str(row["Phone"]);

    if (!fullName) {
      failed.push({ row: rowNum, name: `Row ${rowNum}`, reason: "Full Name is required" });
      continue;
    }
    if (!phone) {
      failed.push({ row: rowNum, name: fullName, reason: "Phone is required" });
      continue;
    }

    const payload = {
      full_name: fullName,
      phone,
      alt_phone: str(row["Alt Phone"]) || null,
      gender: parseGender(row["Gender"]),
      date_of_birth: parseDate(row["Date of Birth"]),
      ghana_card_number: str(row["Ghana Card Number"]) || null,
      occupation: str(row["Occupation"]) || null,
      residential_address: str(row["Residential Address"]) || null,
      town: str(row["Town"]) || null,
      next_of_kin_name: str(row["Next of Kin Name"]) || null,
      next_of_kin_phone: str(row["Next of Kin Phone"]) || null,
      sms_opt_in: parseSmsOptIn(row["SMS Opt-in"]),
      created_by: user.id,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("clients")
      .insert(payload)
      .select("client_code")
      .single<{ client_code: string }>();

    if (insertError) {
      failed.push({ row: rowNum, name: fullName, reason: insertError.message });
    } else {
      succeeded.push(inserted.client_code);
    }
  }

  return NextResponse.json({
    imported: succeeded.length,
    failed: failed.length,
    errors: failed,
    client_codes: succeeded,
  });
}

// Template download — returns a blank .xlsx with the correct headers and sample row
export async function GET() {
  const sample = [{
    "Full Name": "Ama Owusu",
    "Phone": "0244000001",
    "Alt Phone": "",
    "Gender": "female",
    "Date of Birth": "1990-05-20",
    "Ghana Card Number": "GHA-123456789-0",
    "Occupation": "Trader",
    "Residential Address": "No. 5 Market Street",
    "Town": "Kumasi",
    "Next of Kin Name": "Kofi Owusu",
    "Next of Kin Phone": "0244000002",
    "SMS Opt-in": "Yes",
  }];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    { wch: 20 }, { wch: 20 }, { wch: 32 }, { wch: 18 }, { wch: 24 },
    { wch: 18 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Clients");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="client-import-template.xlsx"',
    },
  });
}
