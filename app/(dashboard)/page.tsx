import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import { PageHeader, Card, LoanStatusBadge, EmptyState } from "@/components/ui";
import { ClientPhotoViewer } from "@/components/client-photo-viewer";
import { formatGHS } from "@/lib/loan";
import {
  ArrowUpRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  PiggyBank,
  Repeat,
  Layers,
  TrendingUp,
  Wallet,
  Banknote,
  Landmark,
  CreditCard,
  Lock,
  HandCoins,
  Percent,
  BadgePercent,
  Coins,
  Scale,
  MessageSquare,
  FileText,
  ArrowDownLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Loan, Client, Profile, Transaction } from "@/lib/types";

export default async function OverviewPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, restricted_pages").eq("id", user.id).single<Pick<Profile, "role" | "restricted_pages">>();
  if (profile?.role !== "admin") redirect("/clients");
  if (profile.restricted_pages?.includes("overview")) redirect("/clients");

  const settings = await getSettings();
  // Overview trimmed to four cards on request: Total Clients, Combined
  // Account Total, Total Withdrawals, Account Balance. Every other KPI
  // (including Total Revenue) stays fully computed — other pages still
  // depend on the same shared summary — only its Overview visibility is
  // switched off, so it can be turned back on here later without touching
  // any calculation.
  const defaultKpi = {
    total_clients:   { visible: true },
    total_savings:   { visible: false, calc: "dep" as const },
    total_susu:      { visible: false, calc: "dep" as const },
    combined_total:  { visible: true },
    total_revenue:   { visible: false, components: { interest: true, commission: true, susu_fees: true, card_fees: true, sms_fees: true, processing_fees: true } },
    gross_revenue:   { visible: true },
    net_revenue:     { visible: true },
    consolidated_fund: { visible: false },
    account_balance: { visible: true },
    total_withdrawals: { visible: true },
    loans_disbursed: { visible: false },
    loan_repayments: { visible: false },
    card_fees:           { visible: false },
    withdrawal_commission: { visible: false },
    susu_fees:           { visible: false },
    sms_fees:            { visible: false },
    processing_fees:     { visible: false },
    loan_interest:       { visible: false },
    cash_at_hand:    { visible: false },
    cash_at_bank:    { visible: false },
  };
  const raw = settings.overview_kpi ?? defaultKpi;
  const kpi = {
    ...defaultKpi,
    ...raw,
    total_savings:  { ...defaultKpi.total_savings,  ...raw.total_savings },
    total_susu:     { ...defaultKpi.total_susu,     ...raw.total_susu },
    total_revenue:  { ...defaultKpi.total_revenue, ...raw.total_revenue, components: { ...defaultKpi.total_revenue.components, ...raw.total_revenue?.components } },
  };
  const rc = kpi.total_revenue.components;

  const [
    summary,
    { count: clientCount },
    { data: loans },
    { data: recentClients },
    { data: recentTxns },
  ] = await Promise.all([
    computeAccountSummary(supabase, rc),
    supabase.from("clients").select("*", { count: "exact", head: true }),
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

  const {
    totalSavings, totalSusu, consolidatedFundDeposits, loanInterest, commission, susuFees, cardFees,
    totalSmsFees, processingFees, grossRevenue, totalRevenue, combinedTotal, totalWithdrawals, loansDisbursed,
    loanRepayments, accountBalance, cashAtBank, cashAtHand,
  } = summary;

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
            hint="All registered clients"
            tone="red"
            icon={<Users size={17} />}
          />
        )}
        {kpi.total_savings.visible && (
          <SummaryCard
            label="Total Savings"
            value={formatGHS(totalSavings)}
            hint="Total deposits — no withdrawals or deductions"
            tone="teal"
            icon={<PiggyBank size={17} />}
          />
        )}
        {kpi.total_susu.visible && (
          <SummaryCard
            label="Total Daily Susu"
            value={formatGHS(totalSusu)}
            hint="Total contributions — no withdrawals or deductions"
            tone="green"
            icon={<Repeat size={17} />}
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
              rc.sms_fees        && `SMS Fees ${formatGHS(totalSmsFees)}`,
              rc.processing_fees && `Processing Fees ${formatGHS(processingFees)}`,
              consolidatedFundDeposits > 0 && `Less Consolidated Fund ${formatGHS(consolidatedFundDeposits)}`,
            ].filter(Boolean).join(" + ")}
            tone="emerald"
            icon={<TrendingUp size={17} />}
          />
        )}
        {kpi.gross_revenue.visible && (
          <SummaryCard
            label="Gross Revenue"
            value={formatGHS(grossRevenue)}
            hint={[
              rc.interest        && `Interest ${formatGHS(loanInterest)}`,
              rc.commission      && `Commission ${formatGHS(commission)}`,
              rc.susu_fees       && `Susu Fees ${formatGHS(susuFees)}`,
              rc.card_fees       && `Card Fees ${formatGHS(cardFees)}`,
              rc.sms_fees        && `SMS Fees ${formatGHS(totalSmsFees)}`,
              rc.processing_fees && `Processing Fees ${formatGHS(processingFees)}`,
            ].filter(Boolean).join(" + ") || "Every revenue component, before the Consolidated Fund deduction"}
            tone="gold"
            icon={<TrendingUp size={17} />}
          />
        )}
        {kpi.net_revenue.visible && (
          <SummaryCard
            label="Net Revenue"
            value={formatGHS(totalRevenue)}
            hint={`Gross Revenue ${formatGHS(grossRevenue)} − Consolidated Fund ${formatGHS(consolidatedFundDeposits)} = ${formatGHS(totalRevenue)}`}
            tone="jade"
            icon={<Scale size={17} />}
          />
        )}
        {kpi.consolidated_fund.visible && (
          <SummaryCard
            label="PFS Consolidated Fund"
            value={formatGHS(consolidatedFundDeposits)}
            hint="SAV-00079 (PFS/26/0133) — company-owned, deducted from Total Revenue, excluded from Total Savings"
            tone="violet"
            icon={<Lock size={17} />}
          />
        )}
        {kpi.card_fees.visible && (
          <SummaryCard
            label="Card Fees"
            value={formatGHS(cardFees)}
            hint="Registration fees charged to new clients — included in Total Revenue"
            tone="pink"
            icon={<CreditCard size={17} />}
          />
        )}
        {kpi.loan_interest.visible && (
          <SummaryCard
            label="Loan Interest"
            value={formatGHS(loanInterest)}
            hint="Interest actually collected on repayments — counted only once repaid, not at disbursement. Included in Total Revenue"
            tone="sky"
            icon={<Percent size={17} />}
          />
        )}
        {kpi.withdrawal_commission.visible && (
          <SummaryCard
            label="Withdrawal Commission"
            value={formatGHS(commission)}
            hint="Charged on savings withdrawals only — susu is commission-exempt. Included in Total Revenue and Total Withdrawals"
            tone="indigo"
            icon={<BadgePercent size={17} />}
          />
        )}
        {kpi.susu_fees.visible && (
          <SummaryCard
            label="Susu Fees"
            value={formatGHS(susuFees)}
            hint="Day-31 completion fee plus early-withdrawal and emergency-claim penalties. Included in Total Revenue and Total Withdrawals"
            tone="lime"
            icon={<Coins size={17} />}
          />
        )}
        {kpi.sms_fees.visible && (
          <SummaryCard
            label="SMS Fees"
            value={formatGHS(totalSmsFees)}
            hint="Monthly SMS charges deducted from client balances. Included in Total Revenue and Total Withdrawals"
            tone="fuchsia"
            icon={<MessageSquare size={17} />}
          />
        )}
        {kpi.processing_fees.visible && (
          <SummaryCard
            label="Processing Fees"
            value={formatGHS(processingFees)}
            hint="Charged when a loan is activated, deducted from the client's balance. Included in Total Revenue and Total Withdrawals"
            tone="slate"
            icon={<FileText size={17} />}
          />
        )}
        {kpi.combined_total.visible && (
          <SummaryCard
            label="Combined Account Total"
            value={formatGHS(combinedTotal)}
            hint={`Savings ${formatGHS(totalSavings)} + Susu ${formatGHS(totalSusu)} — client deposits only, excludes revenue`}
            tone="orange"
            icon={<Layers size={17} />}
          />
        )}
        {kpi.total_withdrawals.visible && (
          <SummaryCard
            label="Total Withdrawals"
            value={formatGHS(totalWithdrawals)}
            hint="Every deduction from a client balance, all time — cash withdrawn plus every fee charged"
            tone="rust"
            icon={<ArrowUpFromLine size={17} />}
          />
        )}
        {kpi.loans_disbursed.visible && (
          <SummaryCard
            label="Loans Disbursed"
            value={formatGHS(loansDisbursed)}
            hint="Principal currently out on active/completed/defaulted loans — subtracted from Account Balance"
            tone="cyan"
            icon={<HandCoins size={17} />}
          />
        )}
        {kpi.loan_repayments.visible && (
          <SummaryCard
            label="Loan Repayments"
            value={formatGHS(loanRepayments)}
            hint="Cash actually received back — principal plus interest combined. Added back into Account Balance against Loans Disbursed"
            tone="lightgreen"
            icon={<ArrowDownLeft size={17} />}
          />
        )}
        {kpi.account_balance.visible && (
          <SummaryCard
            label="Account Balance"
            value={formatGHS(accountBalance)}
            hint="Actual cash position: client deposits + retained fees − loans out + repayments − expenditures"
            tone="purple"
            icon={<Wallet size={17} />}
          />
        )}
        {kpi.cash_at_hand.visible && (
          <SummaryCard
            label="Cash at Hand"
            value={formatGHS(cashAtHand)}
            hint="Account balance minus cash at bank"
            tone="amber"
            icon={<Banknote size={17} />}
          />
        )}
        {kpi.cash_at_bank.visible && (
          <SummaryCard
            label="Cash at Bank"
            value={formatGHS(cashAtBank)}
            hint="Total deposited to bank account"
            tone="blue"
            icon={<Landmark size={17} />}
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
                  <ClientPhotoViewer photoUrl={txn.client?.photo_url ?? null} alt={txn.client?.full_name ?? "Client"} isAdmin>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[11px] font-semibold text-[#0033AA]">
                      {txn.client?.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={txn.client.photo_url} alt={txn.client.full_name} className="h-full w-full object-cover" />
                        : (txn.client?.full_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  </ClientPhotoViewer>
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
                <li key={client.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#0033AA]/[0.03]">
                  <ClientPhotoViewer photoUrl={client.photo_url} alt={client.full_name} isAdmin>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[12px] font-semibold text-[#0033AA]">
                      {client.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                      ) : (
                        initials(client.full_name)
                      )}
                    </span>
                  </ClientPhotoViewer>
                  <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#0A2240]">{client.full_name}</p>
                    <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · <a href={`tel:${client.phone}`} className="hover:text-[#0033AA] hover:underline">{client.phone}</a></p>
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

const TONES = {
  red:     { tint: "bg-[#DC2626]/8",  icon: "text-[#DC2626]",  bar: "bg-[#DC2626]" },
  teal:    { tint: "bg-[#0D9488]/8",  icon: "text-[#0D9488]",  bar: "bg-[#0D9488]" },
  green:   { tint: "bg-[#16A34A]/8",  icon: "text-[#16A34A]",  bar: "bg-[#16A34A]" },
  orange:  { tint: "bg-[#EA580C]/8",  icon: "text-[#EA580C]",  bar: "bg-[#EA580C]" },
  emerald: { tint: "bg-[#15803D]/8",  icon: "text-[#15803D]",  bar: "bg-[#15803D]" },
  rust:    { tint: "bg-[#B3432B]/8",  icon: "text-[#B3432B]",  bar: "bg-[#B3432B]" },
  purple:  { tint: "bg-[#9333EA]/8",  icon: "text-[#9333EA]",  bar: "bg-[#9333EA]" },
  amber:   { tint: "bg-[#D97706]/8",  icon: "text-[#D97706]",  bar: "bg-[#D97706]" },
  blue:    { tint: "bg-[#1D4ED8]/8",  icon: "text-[#1D4ED8]",  bar: "bg-[#1D4ED8]" },
  pink:    { tint: "bg-[#DB2777]/8",  icon: "text-[#DB2777]",  bar: "bg-[#DB2777]" },
  violet:  { tint: "bg-[#7C3AED]/8",  icon: "text-[#7C3AED]",  bar: "bg-[#7C3AED]" },
  cyan:    { tint: "bg-[#0891B2]/8",  icon: "text-[#0891B2]",  bar: "bg-[#0891B2]" },
  sky:     { tint: "bg-[#0284C7]/8",  icon: "text-[#0284C7]",  bar: "bg-[#0284C7]" },
  indigo:  { tint: "bg-[#4F46E5]/8",  icon: "text-[#4F46E5]",  bar: "bg-[#4F46E5]" },
  lime:    { tint: "bg-[#65A30D]/8",  icon: "text-[#65A30D]",  bar: "bg-[#65A30D]" },
  fuchsia: { tint: "bg-[#C026D3]/8",  icon: "text-[#C026D3]",  bar: "bg-[#C026D3]" },
  slate:   { tint: "bg-[#475569]/8",  icon: "text-[#475569]",  bar: "bg-[#475569]" },
  lightgreen: { tint: "bg-[#22C55E]/8", icon: "text-[#22C55E]", bar: "bg-[#22C55E]" },
  gold:    { tint: "bg-[#B45309]/8",  icon: "text-[#B45309]",  bar: "bg-[#B45309]" },
  jade:    { tint: "bg-[#059669]/8",  icon: "text-[#059669]",  bar: "bg-[#059669]" },
} as const;

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: keyof typeof TONES;
  icon: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#0033AA]/8 bg-white p-5 shadow-[0_1px_2px_rgba(10,34,64,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(10,34,64,0.09)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.tint} ${t.icon}`}>
        {icon}
      </span>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/45">{label}</p>
      <p className="mt-1.5 break-words text-[1.65rem] font-bold tabular-nums leading-none text-[#0A2240] sm:text-[1.9rem]">{value}</p>
      {hint && <p className="mt-2 text-[11.5px] leading-snug text-[#0A2240]/45">{hint}</p>}
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
