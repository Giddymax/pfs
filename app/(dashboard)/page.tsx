import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { PageHeader, Card, LoanStatusBadge, EmptyState } from "@/components/ui";
import { formatGHS, round2 } from "@/lib/loan";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { Loan, Client, Profile, Transaction } from "@/lib/types";

export default async function OverviewPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") redirect("/clients");

  const settings = await getSettings();
  const defaultKpi = {
    total_clients:   { visible: true },
    total_savings:   { visible: true, calc: "dep" as const },
    total_susu:      { visible: true, calc: "dep" as const },
    total_fd:        { visible: true },
    combined_total:  { visible: true },
    total_revenue:   { visible: true, components: { interest: true, commission: true, susu_fees: true, card_fees: true, sms_fees: true, processing_fees: true, investment_revenue: true } },
    account_balance: { visible: true },
    cash_at_hand:    { visible: true },
    cash_at_bank:    { visible: true },
  };
  const raw = settings.overview_kpi ?? defaultKpi;
  const kpi = {
    ...defaultKpi,
    ...raw,
    total_savings:  { ...defaultKpi.total_savings,  ...raw.total_savings },
    total_susu:     { ...defaultKpi.total_susu,     ...raw.total_susu },
    total_revenue:  { ...defaultKpi.total_revenue, ...raw.total_revenue, components: { ...defaultKpi.total_revenue.components, ...raw.total_revenue?.components } },
  };

  const [
    { count: clientCount },
    // Per-category totals — queried directly so a stale/broken RPC never zeroes them out
    { data: savingsRows },
    { data: susuRows },
    { data: fdRows },
    // Revenue components
    { data: commissionRows },
    { data: susuFeeRows },
    { data: processingFeeRows },
    { data: collectedInterest },
    { data: investmentRows },
    // Withdrawal amounts (not fees — those are commissionRows)
    { data: withdrawalRows },
    // Loan disbursements & repayments
    { data: loanPrincipalRows },
    { data: repaymentRows },
    // SMS fee deductions
    { data: smsFeeRows },
    // Cash at bank — sum(deposits) − sum(withdrawals) from bank_transactions
    { data: bankTxnRows },
    // Recent items
    { data: loans },
    { data: recentClients },
    { data: recentTxns },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("accounts").select("balance, dep").eq("product_type", "savings"),
    supabase.from("accounts").select("balance, dep").eq("product_type", "susu"),
    supabase.from("fixed_deposits").select("principal").not("status", "in", '("withdrawn","rolled_over")'),
    supabase.from("transactions").select("fee").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31),
    supabase.from("loans").select("processing_fee"),
    supabase.rpc("compute_collected_loan_interest"),
    supabase.from("investments").select("amount_invested, revenue_made, status"),
    supabase.from("transactions").select("amount").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("loans").select("principal").in("status", ["active", "completed", "defaulted"]),
    supabase.from("loan_repayments").select("amount"),
    supabase.from("sms_fee_charges").select("amount"),
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
    supabase
      .from("transactions")
      .select("*, account:accounts(account_number, product_type), client:clients(full_name, photo_url, client_code)")
      .is("reversed_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Per-category totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sum = (rows: any[] | null, key: string) =>
    round2((rows ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r[key] ?? 0), 0));

  const totalSavings  = sum(savingsRows, "dep");
  const totalSusu     = sum(susuRows,   "dep");
  const totalFD       = sum(fdRows,     "principal");
  const combined      = round2(totalSavings + totalSusu + totalFD);

  // Revenue components
  const rc = kpi.total_revenue.components;
  const cardFees        = round2((clientCount ?? 0) * 20);
  const commission      = sum(commissionRows,   "fee");
  const susuFees        = sum(susuFeeRows,      "amount");
  const processingFees  = sum(processingFeeRows, "processing_fee");
  const loanInterest    = round2(Number(collectedInterest ?? 0));
  const investmentList = (investmentRows ?? []) as { amount_invested: number; revenue_made: number; status: string }[];
  const activeInvestmentTotal = round2(
    investmentList.filter((e) => e.status === "active").reduce((s, e) => s + Number(e.amount_invested), 0)
  );
  const returnedInvestmentRevenue = round2(
    investmentList.filter((e) => e.status === "returned").reduce((s, e) => s + Number(e.revenue_made), 0)
  );

  // Account balance components
  const totalWithdrawals  = sum(withdrawalRows,    "amount");
  const totalLoansPaid    = sum(loanPrincipalRows, "principal");
  const totalRepayments   = sum(repaymentRows,     "amount");
  const totalSmsFees      = sum(smsFeeRows,        "amount");

  const revenueBeforeInvestments = round2(
    (rc.interest           ? loanInterest               : 0) +
    (rc.commission         ? commission                 : 0) +
    (rc.susu_fees          ? susuFees                   : 0) +
    (rc.card_fees          ? cardFees                   : 0) +
    (rc.sms_fees           ? totalSmsFees               : 0) +
    (rc.processing_fees    ? processingFees             : 0) +
    (rc.investment_revenue ? returnedInvestmentRevenue  : 0)
  );
  const investmentDeductedFromRevenue = round2(Math.min(activeInvestmentTotal, revenueBeforeInvestments));
  const investmentDeductedFromAccount = round2(Math.max(activeInvestmentTotal - revenueBeforeInvestments, 0));
  const totalRevenue = round2(revenueBeforeInvestments - investmentDeductedFromRevenue);

  // Account Balance = Combined Total - (Withdrawals + Commissions) - Susu Fees - SMS Fees - Loans + Repayments + Card Fees + Processing Fees
  const accountBalance = round2(
    combined
    - (totalWithdrawals + commission)
    - susuFees
    - totalSmsFees
    - totalLoansPaid
    + totalRepayments
    + cardFees
    + processingFees
    + returnedInvestmentRevenue
    - investmentDeductedFromAccount
  );
  const rawCashAtBank = round2(
    (bankTxnRows ?? []).reduce((s, t) => {
      const amt = Number((t as { type: string; amount: number }).amount ?? 0);
      return (t as { type: string; amount: number }).type === "deposit" ? s + amt : s - amt;
    }, 0)
  );
  const cashAtBank = Math.min(rawCashAtBank, accountBalance);
  const cashAtHand = Math.max(round2(accountBalance - rawCashAtBank), 0);

  const recentLoans = loans ?? [];

  type TxnRow = Transaction & {
    account: { account_number: string; product_type: string } | null;
    client: { full_name: string; photo_url: string | null; client_code: string } | null;
  };
  const latestTxns = (recentTxns ?? []) as TxnRow[];

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Good to see you back"
        description="A snapshot of all accounts, revenue and cash position."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpi.total_clients.visible && (
          <SummaryCard
            label="Total Clients"
            value={String(clientCount ?? 0)}
            color="bg-[#DC2626]"
          />
        )}
        {kpi.total_savings.visible && (
          <SummaryCard
            label="Total Savings"
            value={formatGHS(totalSavings)}
            hint="Total deposits — no withdrawals or deductions"
            color="bg-[#0D9488]"
          />
        )}
        {kpi.total_susu.visible && (
          <SummaryCard
            label="Total Daily Susu"
            value={formatGHS(totalSusu)}
            hint="Total contributions — no withdrawals or deductions"
            color="bg-[#16A34A]"
          />
        )}
        {kpi.total_fd.visible && (
          <SummaryCard
            label="Total Fixed Deposits"
            value={formatGHS(totalFD)}
            hint="Principal only — no interest added"
            color="bg-[#7C3AED]"
          />
        )}
        {kpi.combined_total.visible && (
          <SummaryCard
            label="Combined Account Total"
            value={formatGHS(combined)}
            hint={`Savings ${formatGHS(totalSavings)} + Susu ${formatGHS(totalSusu)} + FD ${formatGHS(totalFD)}`}
            color="bg-[#EA580C]"
          />
        )}
        {kpi.total_revenue.visible && (
          <SummaryCard
            label="Total Revenue"
            value={formatGHS(totalRevenue)}
            hint={[
              rc.interest        && `Interest ${formatGHS(loanInterest)}`,
              rc.commission      && `Commission ${formatGHS(commission)}`,
              rc.susu_fees       && `Susu Fees ${formatGHS(susuFees)}`,
              rc.card_fees       && `Card Fees ${formatGHS(cardFees)}`,
              rc.sms_fees           && `SMS Fees ${formatGHS(totalSmsFees)}`,
              rc.processing_fees    && `Processing Fees ${formatGHS(processingFees)}`,
              rc.investment_revenue && `Returned Investment Revenue ${formatGHS(returnedInvestmentRevenue)}`,
              investmentDeductedFromRevenue > 0 && `Active Investments -${formatGHS(investmentDeductedFromRevenue)}`,
              investmentDeductedFromAccount > 0 && `Account Balance Used ${formatGHS(investmentDeductedFromAccount)}`,
            ].filter(Boolean).join(" + ")}
            color="bg-[#15803D]"
          />
        )}
        {kpi.account_balance.visible && (
          <SummaryCard
            label="Account Balance"
            value={formatGHS(accountBalance)}
            hint={`${formatGHS(combined)} - Wdr/Comm ${formatGHS(totalWithdrawals + commission)} - Susu Fees ${formatGHS(susuFees)} - SMS Fees ${formatGHS(totalSmsFees)} - Loans ${formatGHS(totalLoansPaid)} + Repayments ${formatGHS(totalRepayments)} + Card Fees ${formatGHS(cardFees)} + Returned Investment Revenue ${formatGHS(returnedInvestmentRevenue)} - Investment Overflow ${formatGHS(investmentDeductedFromAccount)}`}
            color="bg-[#9333EA]"
          />
        )}
        {kpi.cash_at_hand.visible && (
          <SummaryCard
            label="Cash at Hand"
            value={formatGHS(cashAtHand)}
            hint="Money not deposited to bank — account balance minus cash at bank"
            color="bg-[#D97706]"
          />
        )}
        {kpi.cash_at_bank.visible && (
          <SummaryCard
            label="Cash at Bank"
            value={formatGHS(cashAtBank)}
            hint="Total deposited to bank account"
            color="bg-[#1D4ED8]"
          />
        )}
      </div>

      {/* Recent transactions */}
      <Card className="mb-6">
        <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Recent transactions</h2>
          <Link href="/accounts/savings" className="flex items-center gap-1 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]">
            View accounts <ArrowUpRight size={13} />
          </Link>
        </div>
        {latestTxns.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No transactions yet" description="Deposits and withdrawals across all accounts will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-[#0033AA]/6">
            {latestTxns.map((txn) => {
              const isDeposit = txn.type === "deposit";
              const dt = new Date(txn.created_at);
              const dateStr = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              return (
                <li key={txn.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDeposit ? "bg-[#1F6E4A]/10" : "bg-[#B3432B]/10"}`}>
                    {isDeposit
                      ? <ArrowDownToLine size={14} className="text-[#1F6E4A]" />
                      : <ArrowUpFromLine size={14} className="text-[#B3432B]" />}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[11px] font-semibold text-[#0033AA]">
                    {txn.client?.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={txn.client.photo_url} alt={txn.client.full_name} className="h-full w-full object-cover" />
                      : (txn.client?.full_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-[#0A2240]">
                      {txn.client?.full_name ?? "—"}
                      <span className="ml-1.5 text-[11.5px] font-normal text-[#0A2240]/40">{txn.account?.account_number}</span>
                    </p>
                    <p className="text-[11.5px] text-[#0A2240]/45 capitalize">{txn.account?.product_type ?? "—"} · {dateStr} · {timeStr}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[14px] font-semibold tabular-nums ${isDeposit ? "text-[#1F6E4A]" : "text-[#B3432B]"}`}>
                      {isDeposit ? "+" : "−"}{formatGHS(txn.amount)}
                    </p>
                    {txn.fee > 0 && (
                      <p className="text-[11px] text-[#0A2240]/40">fee {formatGHS(txn.fee)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

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
                      <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · <a href={`tel:${client.phone}`} className="hover:text-[#0033AA] hover:underline">{client.phone}</a></p>
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
