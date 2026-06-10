import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FixedDeposit } from "@/lib/types";

const TERM_OPTIONS = [3, 6, 9, 12, 18, 24];

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const clientId = body?.client_id;
  const principal = Number(body?.principal);
  const annualRate = Number(body?.annual_rate_percent);
  const termMonths = Number(body?.term_months);

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(principal) || principal <= 0) {
    return NextResponse.json({ error: "Principal must be greater than zero" }, { status: 400 });
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return NextResponse.json({ error: "Annual rate cannot be negative" }, { status: 400 });
  }
  if (!TERM_OPTIONS.includes(termMonths)) {
    return NextResponse.json({ error: "Term must be one of 3, 6, 9, 12, 18, 24 months" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("open_fixed_deposit", {
      p_client_id: clientId,
      p_principal: principal,
      p_annual_rate: annualRate,
      p_term_months: termMonths,
      p_created_by: user.id,
    })
    .single<FixedDeposit>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ fixed_deposit: data });
}
