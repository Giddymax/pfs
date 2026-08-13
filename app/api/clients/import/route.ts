import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

function parseAccountType(v: unknown): "savings" | "susu" | null {
  const s = str(v).toLowerCase().replace(/[\s_-]/g, "");
  if (s === "savings" || s === "sav" || s === "save") return "savings";
  if (s === "susu" || s === "dailysusu" || s === "sus" || s === "daily") return "susu";
  return null;
}

function parseAmount(v: unknown): number | null {
  if (v == null || str(v) === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

function parseBalance(v: unknown): number | null {
  if (v == null || str(v) === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n >= 0 ? n : null;
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
  return true;
}

function parseStatus(v: unknown): "active" | "inactive" | null {
  const s = str(v).toLowerCase();
  if (s === "active") return "active";
  if (s === "inactive") return "inactive";
  return null;
}

function parseDate(v: unknown): string | null {
  if (v == null || str(v) === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// Build a row accessor that matches column headers flexibly:
// - exact match first, then case-insensitive/punctuation-stripped match
function buildAccessor(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;
  }
  return function get(...candidates: string[]): unknown {
    for (const c of candidates) {
      if (row[c] !== undefined) return row[c];
      const nk = c.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized[nk] !== undefined) return normalized[nk];
    }
    return undefined;
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single<{ role: string; full_name: string }>();

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

  // Try each sheet and use the first one that has data rows
  let rows: Record<string, unknown>[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (parsed.length > 0) {
      rows = parsed;
      break;
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "The spreadsheet appears to be empty or has no data rows." }, { status: 400 });
  }

  // Admin "new client registered" SMS — imported clients are treated exactly
  // like a manual registration (app/(dashboard)/clients/new), one alert per
  // client. Sent in a batch after the row loop (not per-row inside it) so a
  // large spreadsheet doesn't serialize dozens of network round-trips onto
  // the import's response time.
  const settings = await getSettings();
  const notifyRegistration = shouldSendAdminSms(settings, "registration");
  const toNotify: { id: string; fullName: string; clientCode: string }[] = [];

  const succeeded: string[] = [];
  const failed: { row: number; name: string; reason: string }[] = [];
  const warnings: { row: number; name: string; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Skip completely blank rows
    const allEmpty = Object.values(row).every((v) => str(v) === "");
    if (allEmpty) continue;

    const get = buildAccessor(row);

    // Required fields — accept common name variations
    const fullName = str(
      get("Full Name", "Name", "Client Name", "FullName", "Full_Name", "Fullname", "CLIENT NAME", "CLIENT")
    );
    const phone = str(
      get("Phone", "Mobile", "Phone Number", "Mobile Number", "Tel", "Telephone", "Contact", "Contact Number", "PHONE", "MOBILE")
    );

    if (!fullName) {
      failed.push({ row: rowNum, name: `Row ${rowNum}`, reason: "Full Name is required (column not found or empty)" });
      continue;
    }
    if (!phone) {
      failed.push({ row: rowNum, name: fullName, reason: "Phone is required (column not found or empty)" });
      continue;
    }

    // Optional fields — accept common name variations
    const altPhone = str(
      get("Alt Phone", "Alt. Phone", "Alternative Phone", "Alt Mobile", "Second Phone", "Other Phone")
    );
    const gender = parseGender(
      get("Gender", "Sex", "GENDER")
    );
    const dateOfBirth = parseDate(
      get("Date of Birth", "DOB", "Birth Date", "Birthday", "Date Of Birth", "DateOfBirth")
    );
    const ghanaCard = str(
      get("Ghana Card Number", "Ghana Card", "Ghana Card No", "GhanaCard", "National ID", "NID", "ID Number")
    );
    const occupation = str(
      get("Occupation", "Job", "Work", "Profession", "OCCUPATION")
    );
    const address = str(
      get("Residential Address", "Address", "Home Address", "Residential", "Location", "ADDRESS")
    );
    const town = str(
      get("Town", "City", "District", "Area", "TOWN")
    );
    const nokName = str(
      get("Next of Kin Name", "Next of Kin", "NOK Name", "NOK", "Emergency Contact", "Emergency Contact Name")
    );
    const nokPhone = str(
      get("Next of Kin Phone", "NOK Phone", "Emergency Contact Phone", "Emergency Phone")
    );
    const smsOptIn = parseSmsOptIn(
      get("SMS Opt-in", "SMS", "SMS Opt In", "SMSOptIn", "Receive SMS", "sms_opt_in")
    );
    const status = parseStatus(
      get("Status", "STATUS", "Client Status")
    );
    // "Account" and "Type" alone are last-resort fallbacks, checked only if
    // none of the more specific header variants above them are present —
    // keeps this from ever winning against an actually-present "Account Type"
    // column, while still catching sparser real-world spreadsheets.
    const accountTypeRaw = get(
      "Account Type", "AccountType", "Account/Product Type", "Product Type",
      "Savings/Susu", "Savings Or Susu", "Product", "Account", "Type"
    );
    const accountType = parseAccountType(accountTypeRaw);
    const dailyContribution = parseAmount(
      get("Daily Contribution", "Daily Amount", "Contribution", "DailyContribution", "Daily")
    );
    const balance = parseBalance(
      get("Balance", "Account Balance", "Current Balance", "AccountBalance", "CurrentBalance")
    );
    const payload = {
      full_name: fullName,
      phone,
      alt_phone: altPhone || null,
      gender,
      date_of_birth: dateOfBirth,
      ghana_card_number: ghanaCard || null,
      occupation: occupation || null,
      residential_address: address || null,
      town: town || null,
      next_of_kin_name: nokName || null,
      next_of_kin_phone: nokPhone || null,
      sms_opt_in: smsOptIn,
      ...(status ? { status } : {}),
      created_by: user.id,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("clients")
      .insert(payload)
      .select("id, client_code")
      .single<{ id: string; client_code: string }>();

    if (insertError) {
      failed.push({ row: rowNum, name: fullName, reason: insertError.message });
      continue;
    }

    succeeded.push(inserted.client_code);
    if (notifyRegistration) {
      toNotify.push({ id: inserted.id, fullName, clientCode: inserted.client_code });
    }

    // Card fee — every Excel-imported client is treated as Old (Migrated),
    // regardless of any Client Type column in the spreadsheet: a zero-amount
    // row, so no registration fee is charged and the isMigrated flag (which
    // just checks whether any card_fees row for the client is > 0) reads
    // "Old (Migrated)" everywhere else in the app. Only the manual
    // /clients/new flow can register a client as "New".
    await supabase.from("card_fees").insert({
      client_id: inserted.id,
      amount: 0,
      charged_by: user.id,
    });

    // Create account if account type is specified. Every branch that does
    // NOT end in an account being created pushes a warning — previously this
    // failed silently, which is indistinguishable from "the Account Type
    // column was read correctly and just says nothing should be created."
    if (accountType === "savings") {
      await supabase.from("accounts").insert({
        client_id: inserted.id,
        product_type: "savings",
        account_number: "",
        balance: balance ?? 0,
        created_by: user.id,
      });
    } else if (accountType === "susu") {
      if (dailyContribution) {
        await supabase.from("accounts").insert({
          client_id: inserted.id,
          product_type: "susu",
          account_number: "",
          daily_contribution_amount: dailyContribution,
          balance: balance ?? 0,
          created_by: user.id,
        });
      } else {
        warnings.push({
          row: rowNum,
          name: fullName,
          reason: "Account Type was \"Susu\" but Daily Contribution was missing — no account was created for this client.",
        });
      }
    } else if (str(accountTypeRaw) !== "") {
      warnings.push({
        row: rowNum,
        name: fullName,
        reason: `Account Type "${str(accountTypeRaw)}" was not recognized (expected Savings or Susu) — no account was created for this client.`,
      });
    } else if (balance != null || dailyContribution != null) {
      warnings.push({
        row: rowNum,
        name: fullName,
        reason: "Balance/Daily Contribution was provided but no Account Type column was found — no account was created for this client.",
      });
    }
  }

  if (toNotify.length > 0) {
    await Promise.all(
      toNotify.map((c) =>
        sendSms({
          to: settings.sms.company_tel!,
          message: smsTemplates.clientRegisteredAdmin(c.fullName, c.clientCode, profile.full_name),
          event: "client_registered_admin",
          recipientType: "admin",
          relatedClientId: c.id,
        })
      )
    );
  }

  return NextResponse.json({
    imported: succeeded.length,
    failed: failed.length,
    warned: warnings.length,
    errors: failed,
    warnings,
    client_codes: succeeded,
  });
}

// Template download
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
    "Account Type": "savings",
    "Daily Contribution": "",
    "Balance": "50",
    "SMS Opt-in": "Yes",
  }];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [
    { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    { wch: 20 }, { wch: 20 }, { wch: 32 }, { wch: 18 }, { wch: 24 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
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
