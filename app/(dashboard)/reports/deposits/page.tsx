import { redirect } from "next/navigation";
import { Search, Wallet, ArrowDownToLine, PiggyBank, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SummaryControls } from "@/components/summary-controls";
import { TransactionLogTable } from "@/components/transaction-log-table";
import { AccountPicker } from "@/components/account-picker";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintDepositsReportButton } from "@/components/print-deposits-report-button";
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

export default async function DepositsPage({
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

  const params = await searchParams;
  const from = params.from ?? monthStartISO();
  const to = params.to ?? todayISO();
  const q = params.q?.trim() ?? "";

  const settings = await getSettings();
  const rc = { ...DEFAULT_REVENUE_COMPONENTS, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };

  const [{ data: periodTxnRows, error: txnError }, accountSummary] = await Promise.all([
    supabase.rpc("list_period_transactions", { p_from: from, p_to: to }),
    // Same shared calculation the Overview dashboard, Bank page, Finance
    // page, and Withdrawals page use, so "Account Balance" here always
    // matches those screens.
    computeAccountSummary(supabase, rc),
  ]);

  const allDeposits = ((periodTxnRows ?? []) as PeriodTransaction[]).filter((t) => t.type === "deposit");

  // Stat cards reflect the whole selected period regardless of the search box
  // below — search only narrows which rows are visible in the log table.
  const activeDeposits = allDeposits.filter((t) => !t.reversed_at);
  const totalDeposits = round2(activeDeposits.reduce((s, t) => s + t.amount, 0));
  const savingsDeposits = round2(
    activeDeposits.filter((t) => t.product_type === "savings").reduce((s, t) => s + t.amount, 0)
  );
  const susuDeposits = round2(
    activeDeposits.filter((t) => t.product_type === "susu").reduce((s, t) => s + t.amount, 0)
  );

  const searchedDeposits = q
    ? allDeposits.filter((t) => {
        const term = q.toLowerCase();
        return (
          t.client_full_name?.toLowerCase().includes(term) ||
          t.client_code?.toLowerCase().includes(term) ||
          t.account_number?.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term)
        );
      })
    : allDeposits;

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Reports"
        title="Deposits"
        description="Search for an account to deposit into directly, or review every deposit recorded across all accounts for any date range you choose."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              endpoint="/api/reports/deposits/export"
              filename={`deposits-${from}-to-${to}.xlsx`}
              label="Export Excel"
              params={{ from, to, ...(q ? { q } : {}) }}
            />
            <PrintDepositsReportButton
              transactions={searchedDeposits}
              from={from}
              to={to}
              accountBalance={accountSummary.accountBalance}
              totalDeposits={totalDeposits}
              savingsDeposits={savingsDeposits}
              susuDeposits={susuDeposits}
              printedBy={profile.full_name}
              companyPhone={settings.sms.company_tel ?? null}
            />
          </div>
        }
      />

      {/* Account picker — record a deposit directly from this page */}
      <div className="mb-6">
        <AccountPicker mode="deposit" />
      </div>

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
          label="Total deposits"
          value={formatGHS(totalDeposits)}
          hint={`${activeDeposits.length} deposit${activeDeposits.length !== 1 ? "s" : ""} in this period`}
          icon={<ArrowDownToLine size={16} />}
        />
        <StatCard
          label="Savings deposits"
          value={formatGHS(savingsDeposits)}
          hint="Savings accounts only"
          icon={<PiggyBank size={16} />}
        />
        <StatCard
          label="Daily Susu deposits"
          value={formatGHS(susuDeposits)}
          hint="Susu accounts only"
          icon={<Coins size={16} />}
          highlight
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

      {/* Deposit log */}
      <TransactionLogTable
        transactions={searchedDeposits}
        error={txnError?.message ?? (txnError ? "Could not load the deposit log." : null)}
        title="Deposit log"
        description={`Every deposit recorded in this period, newest first — including reversed/edited entries the totals above net out.${q ? ` Filtered by "${q}".` : ""}`}
        showTypeFilter={false}
      />
    </div>
  );
}
