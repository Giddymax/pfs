import { redirect } from "next/navigation";
import { Search, Wallet, ArrowUpFromLine, Percent, Scale, Coins, MessageSquare, FileText, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SummaryControls } from "@/components/summary-controls";
import { TransactionLogTable } from "@/components/transaction-log-table";
import { AccountPicker } from "@/components/account-picker";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintWithdrawalsReportButton } from "@/components/print-withdrawals-report-button";
import { PageHeader, StatCard } from "@/components/ui";
import { getSettings } from "@/lib/settings/cache";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import { formatGHS, round2 } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface PeriodTransaction {
  id: string;
  created_at: string;
  type: "deposit" | "withdrawal" | "fee" | "reversal";
  amount: number;
  fee: number;
  bal_after: number;
  notes: string | null;
  client_id: string;
  client_full_name: string;
  client_code: string;
  account_id: string;
  account_number: string;
  product_type: "savings" | "susu";
  recorded_by_name: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  original_amount: number | null;
  reversed_by_name: string | null;
  reversed_at: string | null;
}

const DEFAULT_REVENUE_COMPONENTS = {
  interest: true,
  commission: true,
  susu_fees: true,
  card_fees: true,
  sms_fees: true,
  processing_fees: true,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string; q?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/");

  const isAdmin = profile.role === "admin";

  const params = await searchParams;
  const from = params.from ?? monthStartISO();
  const to = params.to ?? todayISO();
  const q = params.q?.trim() ?? "";

  const settings = await getSettings();
  const rc = { ...DEFAULT_REVENUE_COMPONENTS, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };

  const [
    { data: periodTxnRows, error: txnError },
    accountSummary,
    { data: susuDay31Rows },
    { data: paidEmergencyPenaltyRows },
    { data: smsFeeRows },
    { data: processingFeeRows },
  ] = await Promise.all([
    supabase.rpc("list_period_transactions", { p_from: from, p_to: to }),
    // Same shared calculation the Overview dashboard, Bank page, and Finance
    // page use, so "Account Balance" here always matches those screens.
    computeAccountSummary(supabase, rc),
    // Susu Fees below mirrors lib/finance/account-summary.ts's susuFees
    // formula exactly, just scoped to this period instead of all-time —
    // day-31 cycle fees...
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31)
      .gte("payment_date", from).lte("payment_date", to),
    // ...plus paid emergency-claim penalties (the early-withdrawal penalty
    // itself is already inside periodTxnRows as a susu withdrawal's fee, see
    // susuEarlyWithdrawalFee below).
    supabase.from("susu_claims").select("penalty_amount")
      .eq("claim_type", "emergency").eq("status", "paid")
      .gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59.999`),
    // SMS Charge — same source as account-summary.ts's totalSmsFees, scoped
    // to when each charge was actually recorded.
    supabase.from("sms_fee_charges").select("amount")
      .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59.999`),
    // Processing Fee — activate_loan() deducts this straight out of the
    // client's savings/susu balance at disbursement, via a type='fee'
    // transaction, same as susu/SMS fees above. Scoped by disbursement_date
    // since that's the moment activate_loan() actually charges it.
    supabase.from("loans").select("processing_fee")
      .gte("disbursement_date", from).lte("disbursement_date", to),
  ]);

  const allWithdrawals = ((periodTxnRows ?? []) as PeriodTransaction[]).filter((t) => t.type === "withdrawal");

  // Stat cards reflect the whole selected period regardless of the search box
  // below — search only narrows which rows are visible in the log table.
  const activeWithdrawals = allWithdrawals.filter((t) => !t.reversed_at);
  // Cash Paid to Clients — what a client actually walked away with in hand.
  // No longer what "Total Withdrawals" means (see below) — kept as its own
  // figure since it's still the most direct answer to "how much did we pay
  // out", same distinction lib/finance/account-summary.ts now draws between
  // withdrawalPrincipal and the broader totalWithdrawals. Excludes the
  // automatic susu day-31 fee sweep (0071_susu_day31_auto_sweep.sql) — it
  // posts as type='withdrawal' so it appears in the log below, but it's
  // company revenue, not client cash-out; it's already counted via
  // susuFees's susuDay31Rows source below, so excluding it here is what
  // keeps totalWithdrawals from double-counting it.
  const cashPaidToClients = round2(
    activeWithdrawals
      .filter((t) => !(t.notes ?? "").toLowerCase().includes("swept to company funds"))
      .reduce((s, t) => s + t.amount, 0)
  );
  // Commission mirrors the app-wide definition (lib/finance/account-summary.ts):
  // susu withdrawals are commission-exempt by construction (record_withdrawal
  // hard-codes fee=0 for susu); any fee on a susu row is an early-withdrawal
  // penalty, not a commission, so only savings-account fees count here.
  const withdrawalCommission = round2(
    activeWithdrawals.filter((t) => t.product_type === "savings").reduce((s, t) => s + t.fee, 0)
  );
  // The fee on a susu withdrawal (excluded from commission above) IS the
  // early-withdrawal penalty — the third source in susuFees, alongside the
  // two queries fetched above.
  const susuEarlyWithdrawalFee = round2(
    activeWithdrawals.filter((t) => t.product_type === "susu").reduce((s, t) => s + t.fee, 0)
  );
  const susuFees = round2(
    susuEarlyWithdrawalFee
    + round2((susuDay31Rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0))
    + round2((paidEmergencyPenaltyRows ?? []).reduce((s, r) => s + Number(r.penalty_amount ?? 0), 0))
  );
  const smsCharge = round2((smsFeeRows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0));
  const processingFee = round2((processingFeeRows ?? []).reduce((s, r) => s + Number(r.processing_fee ?? 0), 0));
  // Total Withdrawals — same broadened definition as
  // lib/finance/account-summary.ts's totalWithdrawals, scoped to this
  // period: every amount deducted from a client's balance, whether the
  // client withdrew it themselves or PFS charged it as a fee. Card Fees are
  // excluded (never deducted from any client balance — see that field's own
  // comment in account-summary.ts).
  const totalWithdrawals = round2(
    cashPaidToClients + withdrawalCommission + susuFees + smsCharge + processingFee
  );
  // The complement of Cash Paid to Clients within Total Withdrawals — what
  // PFS kept, rather than handed over.
  const totalFeesRetained = round2(totalWithdrawals - cashPaidToClients);

  const searchedWithdrawals = q
    ? allWithdrawals.filter((t) => {
        const term = q.toLowerCase();
        return (
          t.client_full_name?.toLowerCase().includes(term) ||
          t.client_code?.toLowerCase().includes(term) ||
          t.account_number?.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term)
        );
      })
    : allWithdrawals;

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Reports"
        title="Withdrawals"
        description={
          isAdmin
            ? "Search for an account to withdraw from directly, or review every amount deducted from a client's balance — cash withdrawn or company charges — for any date range you choose."
            : "Review every amount deducted from a client's balance — cash withdrawn or company charges — for any date range you choose. Recording a withdrawal is restricted to admins."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              endpoint="/api/reports/withdrawals/export"
              filename={`withdrawals-${from}-to-${to}.xlsx`}
              label="Export Excel"
              params={{ from, to, ...(q ? { q } : {}) }}
            />
            <PrintWithdrawalsReportButton
              transactions={searchedWithdrawals}
              from={from}
              to={to}
              accountBalance={accountSummary.accountBalance}
              totalWithdrawals={totalWithdrawals}
              cashPaidToClients={cashPaidToClients}
              totalFeesRetained={totalFeesRetained}
              withdrawalCommission={withdrawalCommission}
              susuFees={susuFees}
              smsCharge={smsCharge}
              processingFee={processingFee}
              printedBy={profile.full_name}
              companyPhone={settings.sms.company_tel ?? null}
            />
          </div>
        }
      />

      {/* Account picker — record a withdrawal directly from this page (admin only) */}
      {isAdmin && (
        <div className="mb-6">
          <AccountPicker mode="withdrawal" />
        </div>
      )}

      {/* Date controls */}
      <div className="mb-6">
        <SummaryControls from={from} to={to} preset={params.preset ?? "this_month"} />
      </div>

      {/* Period band */}
      <div className="mb-6 rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.03] px-5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0033AA]/50">Period</p>
        <p className="mt-0.5 text-[15px] font-semibold text-[#0A2240]">
          {fmtDate(from)} — {fmtDate(to)}
        </p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Account Balance"
          value={formatGHS(accountSummary.accountBalance)}
          hint="Actual cash position — matches Overview"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Total Withdrawals"
          value={formatGHS(totalWithdrawals)}
          hint="Every deduction from a client balance — cash withdrawn plus every fee charged"
          icon={<Layers size={16} />}
          highlight
        />
        <StatCard
          label="Cash Paid to Clients"
          value={formatGHS(cashPaidToClients)}
          hint={`${activeWithdrawals.length} withdrawal${activeWithdrawals.length !== 1 ? "s" : ""} in this period`}
          icon={<ArrowUpFromLine size={16} />}
        />
        <StatCard
          label="Total Fees & Charges Retained"
          value={formatGHS(totalFeesRetained)}
          hint="Commission + susu fees + SMS charge + processing fee"
          icon={<Scale size={16} />}
        />
        <StatCard
          label="Withdrawal Commission"
          value={formatGHS(withdrawalCommission)}
          hint="Savings withdrawals only — susu is commission-exempt"
          icon={<Percent size={16} />}
        />
        <StatCard
          label="Susu Fees"
          value={formatGHS(susuFees)}
          hint="Day-31 cycle fee + early-withdrawal + paid emergency penalties"
          icon={<Coins size={16} />}
        />
        <StatCard
          label="SMS Charge"
          value={formatGHS(smsCharge)}
          hint="SMS fees charged to clients in this period"
          icon={<MessageSquare size={16} />}
        />
        <StatCard
          label="Processing Fee"
          value={formatGHS(processingFee)}
          hint="Loan processing fees deducted at disbursement"
          icon={<FileText size={16} />}
        />
      </div>

      {/* Search */}
      <form className="mb-4 flex flex-wrap items-center gap-2 sm:max-w-md">
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to} />
        <input type="hidden" name="preset" value={params.preset ?? "this_month"} />
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0033AA]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search client, client ID, account number, or notes"
            className="w-full rounded-md border border-[#0033AA]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884]"
        >
          <Search size={14} />
          Search
        </button>
      </form>

      {/* Withdrawal log */}
      <TransactionLogTable
        transactions={searchedWithdrawals}
        error={txnError?.message ?? (txnError ? "Could not load the withdrawal log." : null)}
        title="Withdrawal log"
        description={`Every withdrawal recorded in this period, newest first — including reversed/edited entries the totals above net out.${q ? ` Filtered by "${q}".` : ""}`}
        showTypeFilter={false}
      />
    </div>
  );
}
