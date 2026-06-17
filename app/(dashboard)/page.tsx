import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, LoanStatusBadge, EmptyState } from "@/components/ui";
import { formatGHS, round2 } from "@/lib/loan";
import type { Loan, Client } from "@/lib/types";

interface ReconciliationTotal {
  total: number;
}

export default async function OverviewPage() {
  const supabase = await createClient();

  const [
    { count: clientCount },
    // Per-category totals — queried directly so a stale/broken RPC never zeroes them out
    { data: savingsRows },
    { data: susuRows },
    { data: fdRows },
    // Revenue components
    { data: cardFeeRows },
    { data: smsRows },
    { data: commissionRows },
    { data: susuFeeRows },
    { data: processingFeeRows },
    { data: loanInterestRows },
    // Account-balance comes from the reconciliation RPC (single formula, all ledger items)
    reconResult,
    // Cash at bank — sum(deposits) − sum(withdrawals) from bank_transactions
    { data: bankTxnRows },
    // Recent items
    { data: loans },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("balance").eq("product_type", "savings"),
    supabase.from("accounts").select("dep").eq("product_type", "susu"),
    supabase.from("fixed_deposits").select("principal").not("status", "in", '("withdrawn","rolled_over")'),
    supabase.from("card_fees").select("amount"),
    supabase.from("sms_log").select("cost"),
    supabase.from("transactions").select("fee").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31),
    supabase.from("loans").select("processing_fee"),
    supabase.from("loans").select("total_interest").in("status", ["active", "completed", "defaulted"]),
    supabase.rpc("compute_reconciliation").single<ReconciliationTotal>(),
    supabase.from("bank_transactions").select("type, amount"),
    supabase
      .from("loans")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<Loan[]>(),
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<Client[]>(),
  ]);

  // Per-category totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sum = (rows: any[] | null, key: string) =>
    round2((rows ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r[key] ?? 0), 0));

  const totalSavings  = sum(savingsRows,      "balance");
  const totalSusu     = sum(susuRows,         "dep");
  const totalFD       = sum(fdRows,           "principal");
  const combined      = round2(totalSavings + totalSusu + totalFD);

  // Revenue components
  const cardFees        = sum(cardFeeRows,      "amount");
  const smsCharges      = sum(smsRows,          "cost");
  const commission      = sum(commissionRows,   "fee");
  const susuFees        = sum(susuFeeRows,      "amount");
  const processingFees  = sum(processingFeeRows,"processing_fee");
  const loanInterest    = sum(loanInterestRows, "total_interest");
  const totalRevenue    = round2(loanInterest + commission + susuFees + cardFees + smsCharges + processingFees);

  // Cash position
  const accountBalance = reconResult.data?.total ?? round2(combined);
  const rawCashAtBank = round2(
    (bankTxnRows ?? []).reduce((s, t) => {
      const amt = Number((t as { type: string; amount: number }).amount ?? 0);
      return (t as { type: string; amount: number }).type === "deposit" ? s + amt : s - amt;
    }, 0)
  );
  const cashAtBank = Math.min(rawCashAtBank, accountBalance);
  const cashAtHand = Math.max(round2(accountBalance - rawCashAtBank), 0);

  const recentLoans = loans ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Good to see you back"
        description="A snapshot of all accounts, revenue and cash position."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Total Clients"
          value={String(clientCount ?? 0)}
          color="bg-[#DC2626]"
        />
        <SummaryCard
          label="Total Savings"
          value={formatGHS(totalSavings)}
          hint="Total deposits — no deductions"
          color="bg-[#0D9488]"
        />
        <SummaryCard
          label="Total Daily Susu"
          value={formatGHS(totalSusu)}
          hint="Total contributions from all susu clients (gross)"
          color="bg-[#16A34A]"
        />
        <SummaryCard
          label="Total Fixed Deposits"
          value={formatGHS(totalFD)}
          hint="Principal only — no interest added"
          color="bg-[#7C3AED]"
        />
        <SummaryCard
          label="Combined Account Total"
          value={formatGHS(combined)}
          hint={`Savings ${formatGHS(totalSavings)} + Susu ${formatGHS(totalSusu)} + FD ${formatGHS(totalFD)}`}
          color="bg-[#EA580C]"
        />
        <SummaryCard
          label="Total Revenue"
          value={formatGHS(totalRevenue)}
          hint={`Interest ${formatGHS(loanInterest)} + Commission ${formatGHS(commission)} + Susu Fees ${formatGHS(susuFees)} + Card Fees ${formatGHS(cardFees)} + SMS ${formatGHS(smsCharges)} + Processing Fees ${formatGHS(processingFees)}`}
          color="bg-[#15803D]"
        />
        <SummaryCard
          label="Account Balance"
          value={formatGHS(accountBalance)}
          hint={`Combined Total – withdrawals – commission – SMS – susu fees – loans + repayments – FD interest + card fees ${formatGHS(cardFees)} + processing fees ${formatGHS(processingFees)}`}
          color="bg-[#9333EA]"
        />
        <SummaryCard
          label="Cash at Hand"
          value={formatGHS(cashAtHand)}
          hint="Account balance – cash at bank"
          color="bg-[#D97706]"
        />
        <SummaryCard
          label="Cash at Bank"
          value={formatGHS(cashAtBank)}
          hint="Total deposited to bank account"
          color="bg-[#1D4ED8]"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Recent loans</h2>
            <Link href="/loans" className="flex items-center gap-1 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState title="No loans yet" description="Loans you issue will show up here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {recentLoans.map((loan) => (
                <li key={loan.id}>
                  <Link
                    href={`/loans/${loan.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[#0033AA]/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#0A2240]">
                        {loan.client?.full_name ?? "—"}
                      </p>
                      <p className="text-[12px] text-[#0A2240]/45">
                        {loan.loan_code} · {formatGHS(loan.principal)} · {loan.tenor_months} months
                      </p>
                    </div>
                    <LoanStatusBadge status={loan.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Recently registered clients</h2>
            <Link href="/clients" className="flex items-center gap-1 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState title="No clients yet" description="Register your first client to get started." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {recentClients.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#0033AA]/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[12px] font-semibold text-[#0033AA]">
                      {client.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                      ) : (
                        initials(client.full_name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#0A2240]">{client.full_name}</p>
                      <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · {client.phone}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl ${color} p-5 text-white`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/80">{label}</p>
      <p className="mt-2 break-words text-[1.6rem] font-bold tabular-nums leading-none sm:text-[2rem]">{value}</p>
      {hint && <p className="mt-2 text-[11.5px] leading-snug text-white/75">{hint}</p>}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
