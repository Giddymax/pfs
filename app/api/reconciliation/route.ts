import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const entryDate = body?.entry_date;
  const openingCashAtHand = Number(body?.opening_cash_at_hand);
  const depositReceived = Number(body?.deposit_received);
  const withdrawalPaid = Number(body?.withdrawal_paid);
  const cashIssuedOut = Number(body?.cash_issued_out);
  const cashAtBank = Number(body?.cash_at_bank);
  const debtOwedRaw = body?.debt_owed;
  const debtOwed = debtOwedRaw === null || debtOwedRaw === undefined || debtOwedRaw === ""
    ? null
    : Number(debtOwedRaw);

  if (typeof entryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  }
  for (const [label, value] of [
    ["Opening cash at hand", openingCashAtHand],
    ["Deposit received", depositReceived],
    ["Withdrawal paid out", withdrawalPaid],
    ["Cash issued out", cashIssuedOut],
    ["Cash at bank", cashAtBank],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: `${label} must be zero or greater` }, { status: 400 });
    }
  }
  if (debtOwed !== null && !Number.isFinite(debtOwed)) {
    return NextResponse.json({ error: "Debt owed must be a number" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cash_reconciliations")
    .insert({
      entry_date: entryDate,
      opening_cash_at_hand: openingCashAtHand,
      deposit_received: depositReceived,
      withdrawal_paid: withdrawalPaid,
      cash_issued_out: cashIssuedOut,
      cash_at_bank: cashAtBank,
      debt_owed: debtOwed,
      recorded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "An entry for this date already exists" : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ entry: data });
}
