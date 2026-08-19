import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSusuQualification } from "@/lib/susu/qualification";

// Returns whatever the withdrawal form needs to render correctly for a
// given account, once it's been picked from the account-picker search —
// for susu this means running the same qualification check the account
// detail page uses (lib/susu/qualification.ts), so a susu account's
// "qualified" vs. "emergency" withdrawal flow is identical everywhere.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, product_type, balance, daily_contribution_amount, status")
    .eq("id", id)
    .single<{ id: string; product_type: "savings" | "susu"; balance: number; daily_contribution_amount: number | null; status: string }>();

  if (error || !account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (account.status === "closed") return NextResponse.json({ error: "This account is closed" }, { status: 400 });

  if (account.product_type !== "susu") {
    return NextResponse.json({
      product_type: account.product_type,
      balance: account.balance,
    });
  }

  const { isQualified, emergencyCycle } = await computeSusuQualification(supabase, id, account.balance);

  return NextResponse.json({
    product_type: "susu",
    balance: account.balance,
    daily_contribution_amount: account.daily_contribution_amount,
    is_qualified: isQualified,
    emergency_cycle: emergencyCycle,
  });
}
