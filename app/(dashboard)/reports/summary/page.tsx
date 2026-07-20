import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummaryControls } from "@/components/summary-controls";
import { PrintButton } from "@/components/print-button";
import { ExportCsvButton } from "@/components/export-csv-button";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface PeriodSummary {
  deposit_count: number;
  deposit_total: number;
  withdrawal_count: number;
  withdrawal_total: number;
  commission_total: number;
  repayment_count: number;
  repayment_total: number;
  new_client_count: number;
  loans_issued_count: number;
  loans_issued_total: number;
  card_fee_count: number;
  card_fee_total: number;
  sms_cost_total: number;
  net_inflow: number;
}

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
  product_type: "savings" | "susu" | "fixed_deposit";
  recorded_by_name: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  original_amount: number | null;
  reversed_by_name: string | null;
  reversed_at: string | null;
}

const PRODUCT_LABEL: Record<PeriodTransaction["product_type"], string> = {
  savings: "Savings",
  susu: "Daily Susu",
  fixed_deposit: "Fixed Deposit",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
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
  const to   = params.to   ?? todayISO();

  const [{ data: summary, error }, { data: periodTxnRows, error: txnError }] = await Promise.all([
    supabase.rpc("compute_period_summary", { p_from: from, p_to: to }).single<PeriodSummary>(),
    supabase.rpc("list_period_transactions", { p_from: from, p_to: to }),
  ]);
  const periodTransactions = (periodTxnRows ?? []) as PeriodTransaction[];

  // Split the aggregate deposit total by product — same predicate as
  // compute_period_summary's deposit_total (type='deposit', not reversed),
  // so savingsDepositTotal + susuDepositTotal always equals summary.deposit_total.
  const savingsDeposits = periodTransactions.filter((t) => t.type === "deposit" && t.product_type === "savings" && !t.reversed_at);
  const susuDeposits = periodTransactions.filter((t) => t.type === "deposit" && t.product_type === "susu" && !t.reversed_at);
  const savingsDepositTotal = savingsDeposits.reduce((s, t) => s + t.amount, 0);
  const susuDepositTotal = susuDeposits.reduce((s, t) => s + t.amount, 0);

  const printedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      {/* ── Screen header ── */}
      <div className="mb-6 print:hidden">
        <p className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#0033AA]/50">Reports</p>
        <h1 className="text-[26px] font-bold text-[#0A2240]">Transaction Summary</h1>
        <p className="mt-1 text-[14px] text-[#0A2240]/50">
          Financial activity summary for any date range you choose.
        </p>
      </div>

      {/* ── Date controls (client component) ── */}
      <div className="mb-6 print:hidden">
        <SummaryControls from={from} to={to} preset={params.preset ?? "this_month"} />
      </div>

      {/* ══════════════════════════════════════
          PRINTABLE SHEET  —  id="pfs-summary-sheet"
          ══════════════════════════════════════ */}
      <div id="pfs-summary-sheet" className="space-y-5">

        {/* Watermark (print only) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <PrintWatermark />

        {/* Print-only letterhead */}
        <div className="hidden print:flex print:items-start print:justify-between print:pb-4">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div className="leading-tight">
              <p className="text-[17px] font-bold tracking-[0.08em] text-[#0033AA]">PRIME</p>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0A2240]/70">FINANCIAL SERVICE</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-[#0A2240]/45">
            <p className="font-semibold text-[#0A2240]/60">Transaction Summary Report</p>
            <p>Printed: {printedAt}</p>
            <p>By: {profile.full_name}</p>
          </div>
        </div>

        {/* Period band — visible on screen and print */}
        <div className="rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.03] px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0033AA]/50">Period</p>
          <p className="mt-0.5 text-[15px] font-semibold text-[#0A2240]">
            {fmtDate(from)} — {fmtDate(to)}
          </p>
        </div>

        {error || !summary ? (
          <div className="rounded-xl border border-[#B3432B]/20 bg-[#B3432B]/[0.04] px-5 py-10 text-center text-[13.5px] text-[#963522]">
            {error?.message ?? "Could not load the summary. Make sure the migration has been run."}
          </div>
        ) : (
          <>
            {/* Net movement highlight */}
            <div className={`rounded-xl border px-6 py-5 ${summary.net_inflow >= 0 ? "border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.05]" : "border-[#B3432B]/20 bg-[#B3432B]/[0.04]"}`}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/45">Net cash movement</p>
              <p className={`mt-1 break-words text-[24px] font-bold tabular-nums sm:text-[32px] ${summary.net_inflow >= 0 ? "text-[#1F6E4A]" : "text-[#963522]"}`}>
                {summary.net_inflow >= 0 ? "+" : ""}{formatGHS(summary.net_inflow)}
              </p>
              <p className="mt-0.5 text-[12px] text-[#0A2240]/40">
                Deposits + repayments + card fees − withdrawals − commission − loans disbursed
              </p>
            </div>

            {/* ─── Inflows ─── */}
            <Section title="Inflows" accent="#1F6E4A">
              <MetricRow
                label="Deposits (Savings)"
                amount={savingsDepositTotal}
                count={savingsDeposits.length}
                sign="+"
                color="text-[#1F6E4A]"
              />
              <MetricRow
                label="Deposits (Susu)"
                amount={susuDepositTotal}
                count={susuDeposits.length}
                sign="+"
                color="text-[#1F6E4A]"
              />
              <MetricRow
                label="Loan repayments received"
                amount={summary.repayment_total}
                count={summary.repayment_count}
                sign="+"
                color="text-[#1F6E4A]"
              />
              <MetricRow
                label="Card fees collected"
                amount={summary.card_fee_total}
                count={summary.card_fee_count}
                sign="+"
                color="text-[#1F6E4A]"
              />
              <TotalRow
                label="Total inflows"
                amount={summary.deposit_total + summary.repayment_total + summary.card_fee_total}
              />
            </Section>

            {/* ─── Outflows ─── */}
            <Section title="Outflows" accent="#963522">
              <MetricRow
                label="Withdrawals paid out"
                amount={summary.withdrawal_total}
                count={summary.withdrawal_count}
                sign="−"
                color="text-[#963522]"
              />
              <MetricRow
                label="Commission paid"
                amount={summary.commission_total}
                sign="−"
                color="text-[#963522]"
              />
              <MetricRow
                label="Loans disbursed"
                amount={summary.loans_issued_total}
                count={summary.loans_issued_count}
                sign="−"
                color="text-[#963522]"
              />
              <TotalRow
                label="Total outflows"
                amount={summary.withdrawal_total + summary.commission_total + summary.loans_issued_total}
                negative
              />
            </Section>

            {/* ─── Other activity ─── */}
            <Section title="Other activity" accent="#0033AA">
              <SimpleRow label="New clients registered" value={String(summary.new_client_count)} />
              <SimpleRow label="SMS charges" value={formatGHS(summary.sms_cost_total)} />
            </Section>

            {/* ─── Itemised transaction log (audit trail) ─── */}
            <div className="overflow-hidden rounded-xl border border-[#0A2240]/8 bg-white shadow-sm">
              <div
                className="border-b border-[#0A2240]/8 px-5 py-3"
                style={{ borderLeftWidth: 3, borderLeftColor: "#0A2240", borderLeftStyle: "solid" }}
              >
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]">
                  Transaction log ({periodTransactions.length})
                </h2>
                <p className="mt-0.5 text-[11.5px] text-[#0A2240]/45 print:hidden">
                  Every deposit, withdrawal, fee, and reversal recorded in this period, newest first — including
                  reversed/edited entries the totals above net out.
                </p>
              </div>
              {txnError ? (
                <div className="px-5 py-8 text-center text-[13px] text-[#963522]">
                  {txnError?.message ?? "Could not load the transaction log."}
                </div>
              ) : periodTransactions.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-[#0A2240]/45">
                  No transactions were recorded in this period.
                </div>
              ) : (
                <div className="pfs-table-scroll">
                  <table className="w-full min-w-[820px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#0A2240]/45">
                        <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                        <th className="px-4 py-2.5 font-semibold">Client</th>
                        <th className="px-4 py-2.5 font-semibold">Account</th>
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Amount</th>
                        <th className="px-4 py-2.5 font-semibold">Balance after</th>
                        <th className="px-4 py-2.5 font-semibold">Recorded by</th>
                        <th className="px-4 py-2.5 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {periodTransactions.map((txn) => (
                        <tr key={txn.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/70">{fmtDateTime(txn.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-[#0A2240]">{txn.client_full_name}</p>
                            <p className="text-[11px] text-[#0A2240]/40">{txn.client_code}</p>
                          </td>
                          <td className="px-4 py-2.5 text-[#0A2240]/70">
                            {PRODUCT_LABEL[txn.product_type]}
                            {txn.account_number ? ` · ${txn.account_number}` : ""}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-full border border-[#0033AA]/12 px-2 py-0.5 text-[10.5px] font-medium capitalize text-[#0A2240]/55">
                              {txn.type}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">
                            <span className={txn.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"}>
                              {txn.type === "deposit" ? "+" : "−"} {formatGHS(txn.amount)}
                            </span>
                            {txn.fee > 0 && (
                              <span className="ml-1 font-normal text-[#0A2240]/40">(+{formatGHS(txn.fee)} fee)</span>
                            )}
                            <PeriodTxnFlags txn={txn} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[#0A2240]/70">{formatGHS(txn.bal_after)}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/70">{txn.recorded_by_name ?? "—"}</td>
                          <td className="px-4 py-2.5 text-[#0A2240]/55">{txn.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── Print footer ─── */}
            <div className="hidden border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40 print:flex print:items-center print:justify-between">
              <p>Prime Financial Service — confidential</p>
              <p>{printedAt}</p>
            </div>
          </>
        )}
      </div>

      {/* Floating print/export buttons on screen (outside the sheet so they don't print) */}
      <div className="mt-6 flex flex-wrap justify-end gap-2 print:hidden">
        <ExportCsvButton
          endpoint="/api/reports/summary/export"
          filename={`period-summary-${from}-to-${to}.xlsx`}
          label="Export Excel"
          params={{ from, to }}
        />
        <PrintButton label="Print summary" />
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function PeriodTxnFlags({ txn }: { txn: PeriodTransaction }) {
  if (txn.reversed_at) {
    return (
      <span className="ml-1.5 inline-block rounded-full border border-[#B3432B]/20 bg-[#B3432B]/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#963522]">
        Reversed{txn.reversed_by_name ? ` by ${txn.reversed_by_name}` : ""}
      </span>
    );
  }
  if (txn.edited_at) {
    return (
      <span className="ml-1.5 inline-block rounded-full border border-[#0062E1]/20 bg-[#0062E1]/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0A4DA6]">
        Edited{txn.original_amount != null ? ` from ${formatGHS(txn.original_amount)}` : ""}
        {txn.edited_by_name ? ` by ${txn.edited_by_name}` : ""}
      </span>
    );
  }
  return null;
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#0A2240]/8 bg-white shadow-sm">
      <div
        className="border-b border-[#0A2240]/8 px-5 py-3"
        style={{ borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: "solid" }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: accent }}>
          {title}
        </h2>
      </div>
      <ul className="divide-y divide-[#0A2240]/6">{children}</ul>
    </div>
  );
}

function MetricRow({
  label,
  amount,
  count,
  sign,
  color,
}: {
  label: string;
  amount: number;
  count?: number;
  sign: "+" | "−";
  color: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-[14px] text-[#0A2240]">{label}</p>
        {count != null && (
          <p className="text-[12px] text-[#0A2240]/40">{count} transaction{count !== 1 ? "s" : ""}</p>
        )}
      </div>
      <p className={`text-[14px] font-semibold tabular-nums ${color}`}>
        {sign} {formatGHS(amount)}
      </p>
    </li>
  );
}

function TotalRow({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 bg-[#0A2240]/[0.025] px-5 py-3.5">
      <p className="text-[13.5px] font-semibold text-[#0A2240]">{label}</p>
      <p className={`text-[14px] font-bold tabular-nums ${negative ? "text-[#963522]" : "text-[#1F6E4A]"}`}>
        {formatGHS(amount)}
      </p>
    </li>
  );
}

function SimpleRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <p className="text-[14px] text-[#0A2240]">{label}</p>
      <p className="text-[14px] font-semibold tabular-nums text-[#0A2240]">{value}</p>
    </li>
  );
}
