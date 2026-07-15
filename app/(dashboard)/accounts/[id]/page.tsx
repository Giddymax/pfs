import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Banknote, CalendarDays, PiggyBank, ReceiptText, UserRound, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, AccountStatusBadge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { RecordTransactionForm } from "@/components/record-transaction-form";
import { EditTransactionButton } from "@/components/edit-transaction-button";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { RecalculateAccountButton } from "@/components/recalculate-account-button";
import { EditCodeButton } from "@/components/edit-code-button";
import { PrintTransactionHistoryButton, type TxnWithAccount } from "@/components/print-transaction-history-button";
import { PrintAccountStatementButton } from "@/components/print-account-statement-button";
import { ExportCsvButton } from "@/components/export-csv-button";
import { SusuContributionForm } from "@/components/susu-contribution-form";
import { SusuWithdrawalForm } from "@/components/susu-withdrawal-form";
import { SusuClaimRequestButton } from "@/components/susu-claim-request-button";
import { SusuClaimActions } from "@/components/susu-claim-actions";
import { ResetSusuButton } from "@/components/reset-susu-button";
import { ClearTransactionsButton } from "@/components/clear-transactions-button";
import { getSettings } from "@/lib/settings/cache";
import { formatGHS } from "@/lib/loan";
import type { Account, Client, CommissionTier, Profile, SusuClaim, SusuCycle, SusuPayment, Transaction } from "@/lib/types";

const PRODUCT_LABEL: Record<Account["product_type"], string> = {
  savings: "Savings account",
  susu: "Daily susu account",
  fixed_deposit: "Fixed deposit account",
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  type TxnRow = Transaction & { recorder: { full_name: string } | null };

  const [{ data: account }, { data: transactions }, { data: profile }, { data: tierRow }, settings] = await Promise.all([
    supabase.from("accounts").select("*, client:clients(*)").eq("id", id).single<Account & { client: Client }>(),
    supabase
      .from("transactions")
      .select("*, recorder:recorded_by(full_name)")
      .eq("account_id", id)
      .order("created_at", { ascending: false })
      .returns<TxnRow[]>(),
    getCurrentProfile(supabase),
    supabase.from("settings").select("value").eq("key", "commission_tiers").maybeSingle<{ value: CommissionTier[] }>(),
    getSettings(),
  ]);

  if (!account) notFound();

  const isAdmin = profile?.role === "admin";
  const isStaffOrAdmin = profile?.role === "admin" || profile?.role === "staff";
  const companyPhone = settings.sms.company_tel ?? null;
  const allTransactions = transactions ?? [];
  const txnsWithAccount = allTransactions.map(({ account: _acct, ...rest }) => ({
    ...rest,
    account: { account_number: account.account_number, product_type: account.product_type as string },
  })) as TxnWithAccount[];
  const isSusu = account.product_type === "susu";
  const commissionTiers = account.product_type === "savings" ? (tierRow?.value ?? null) : null;

  let cycles: SusuCycle[] = [];
  let claims: SusuClaim[] = [];
  let payments: SusuPayment[] = [];
  if (isSusu) {
    const [{ data: cycleRows }, { data: claimRows }, { data: paymentRows }] = await Promise.all([
      supabase.from("susu_cycles").select("*").eq("account_id", id).order("cycle_number", { ascending: false }).returns<SusuCycle[]>(),
      supabase.from("susu_claims").select("*").eq("account_id", id).order("requested_at", { ascending: false }).returns<SusuClaim[]>(),
      supabase.from("susu_payments").select("*").eq("account_id", id).order("day_in_cycle", { ascending: false }).returns<SusuPayment[]>(),
    ]);
    cycles = cycleRows ?? [];
    claims = claimRows ?? [];
    payments = paymentRows ?? [];
  }

  const activeCycle = cycles.find((c) => c.status === "in_progress") ?? null;
  // Max day recorded in the active cycle (payments ordered desc by day_in_cycle)
  const dayInCycle = activeCycle
    ? Math.max(0, ...payments.filter((p) => p.cycle_id === activeCycle.id).map((p) => p.day_in_cycle))
    : 0;
  // Client contributes 30 days; day 31 is the company fee — cap display at 30
  const CLIENT_DAYS = 30;
  const clientDayInCycle = Math.min(dayInCycle, CLIENT_DAYS);
  const liveClaimStatuses: SusuClaim["status"][] = ["pending_admin", "approved"];
  const claimedCycleIds = new Set(claims.filter((c) => liveClaimStatuses.includes(c.status) || c.status === "paid").map((c) => c.cycle_id));
  const normalCycle = cycles.find((c) => c.status === "complete" && !claimedCycleIds.has(c.id)) ?? null;
  const emergencyCycle =
    activeCycle && !claims.some((c) => c.cycle_id === activeCycle.id && c.claim_type === "emergency" && c.status !== "rejected")
      ? activeCycle
      : null;
  // Qualified only when a complete unclaimed cycle exists (full 31-day cycle finished)
  const isQualifiedToWithdraw = account.balance > 0 && normalCycle !== null;

  // Susu KPI values — grounded in the live account balance so deletions always reflect correctly
  const daily = account.daily_contribution_amount ?? 0;
  const companyFeeAmount = normalCycle
    ? (normalCycle.company_fee ?? daily)
    : account.balance >= daily ? daily : 0;
  const clientCycleBalance = normalCycle
    ? Math.max(normalCycle.total_collected - (normalCycle.company_fee ?? daily), 0)
    : Math.max(account.balance - companyFeeAmount, 0);

  return (
    <div>
      <PageHeader
        back={account.product_type === "fixed_deposit" ? "/fixed-deposits" : `/accounts/${account.product_type}`}
        eyebrow={PRODUCT_LABEL[account.product_type]}
        title={account.account_number}
        description={`Opened ${formatDate(account.opening_date)} · ${account.client.full_name}`}
        action={
          isStaffOrAdmin && (
            <div className="flex flex-wrap items-center gap-2.5">
              {account.product_type !== "fixed_deposit" && (
                isSusu ? (
                  <>
                    <SusuContributionForm accountId={account.id} dailyAmount={account.daily_contribution_amount} />
                    <SusuWithdrawalForm accountId={account.id} availableBalance={account.balance} dailyAmount={daily} isQualified={isQualifiedToWithdraw} emergencyCycle={emergencyCycle} />
                    <SusuClaimRequestButton accountId={account.id} normalCycle={normalCycle} emergencyCycle={emergencyCycle} />
                    {isAdmin && <ResetSusuButton accountId={account.id} />}
                  </>
                ) : (
                  <>
                    <RecordTransactionForm accountId={account.id} kind="deposit" />
                    <RecordTransactionForm accountId={account.id} kind="withdrawal" commissionTiers={commissionTiers} />
                  </>
                )
              )}
              {isAdmin && account.product_type !== "fixed_deposit" && <RecalculateAccountButton accountId={account.id} />}
              {isAdmin && <ClearTransactionsButton accountId={account.id} />}
              <ExportCsvButton
                endpoint="/api/export/transactions"
                filename={`transactions-${account.account_number}.csv`}
                label="Export CSV"
                params={{ account_id: account.id }}
              />
              <ExportCsvButton
                endpoint="/api/transactions/export"
                filename={`transactions-${account.account_number}.xlsx`}
                label="Export Excel"
                params={{ account_id: account.id }}
              />
              <PrintAccountStatementButton
                client={account.client}
                accountId={account.id}
                accountNumber={account.account_number}
                printedBy={profile?.full_name ?? null}
                companyPhone={companyPhone}
              />
              <PrintTransactionHistoryButton
                client={account.client}
                transactions={txnsWithAccount}
                printedBy={profile?.full_name}
                accountNumber={account.account_number}
                accountBalance={account.balance}
                companyPhone={companyPhone}
              />
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Balance" value={formatGHS(account.balance)} icon={<Wallet size={16} />} />
        <StatCard label="Lifetime deposits" value={formatGHS(account.dep)} icon={<PiggyBank size={16} />} />
        <StatCard label="Lifetime withdrawals" value={formatGHS(account.wdr)} icon={<Banknote size={16} />} />
        <StatCard label="Commission paid" value={formatGHS(account.comm)} icon={<ReceiptText size={16} />} />
      </div>

      {isSusu && (activeCycle || normalCycle) && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Client cycle balance"
            value={formatGHS(clientCycleBalance)}
            icon={<PiggyBank size={16} />}
            highlight={isQualifiedToWithdraw}
          />
          <StatCard
            label="Company fee (cycle)"
            value={formatGHS(companyFeeAmount)}
            icon={<ReceiptText size={16} />}
          />
        </div>
      )}

      {isSusu && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0033AA]/8 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} className="text-[#0033AA]/50" />
              <h2 className="text-[15px] font-semibold text-[#0033AA]">Susu cycle</h2>
            </div>
            {activeCycle && (
              <span className="text-[12.5px] text-[#0A2240]/50">
                Cycle {activeCycle.cycle_number} · day {clientDayInCycle} of {CLIENT_DAYS}
                {clientDayInCycle >= CLIENT_DAYS
                  ? " · complete"
                  : ` · ${formatGHS(activeCycle.total_collected)} collected`}
              </span>
            )}
            {normalCycle && !activeCycle && (
              <span className="rounded-full border border-[#1F6E4A]/25 bg-[#1F6E4A]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#1F6E4A]">
                Qualified to withdraw
              </span>
            )}
          </div>

          <div className="px-5 py-5">
            {activeCycle ? (
              <div className="mb-5">
                <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#0033AA]/8">
                  <div
                    className="susu-cycle-bar h-full rounded-full bg-[#0033AA] transition-[width]"
                    style={{ "--bar-width": `${Math.min((clientDayInCycle / CLIENT_DAYS) * 100, 100)}%` } as React.CSSProperties}
                  />
                </div>
                <p className="text-[12px] text-[#0A2240]/45">
                  {clientDayInCycle >= CLIENT_DAYS
                    ? "All 30 client days are complete. The company fee is retained automatically."
                    : `${CLIENT_DAYS - clientDayInCycle} day${CLIENT_DAYS - clientDayInCycle === 1 ? "" : "s"} remaining · company fee (1 day) is retained when the cycle closes.`}
                </p>
              </div>
            ) : (
              <p className="mb-5 text-[13.5px] text-[#0A2240]/50">No cycle has started on this account yet — record the first contribution to begin one.</p>
            )}

            <div className="border-t border-[#0033AA]/6 pt-4">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/40">Claims</p>
              {claims.length === 0 ? (
                <p className="text-[13px] text-[#0A2240]/45">No claims have been requested on this account.</p>
              ) : (
                <ul className="space-y-2.5">
                  {claims.map((claim) => (
                    <li key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#0033AA]/8 bg-[#0033AA]/[0.02] px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#0A2240]">
                          <span className="capitalize">{claim.claim_type} claim</span>
                          <SusuClaimStatusBadge status={claim.status} />
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
                          {formatGHS(claim.amount)}
                          {claim.penalty_amount > 0 ? ` · penalty ${formatGHS(claim.penalty_amount)}` : ""} · requested {formatDateTime(claim.requested_at)}
                        </p>
                      </div>
                      <SusuClaimActions claim={claim} isAdmin={isAdmin} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Status</p>
            <AccountStatusBadge status={account.status} />
          </div>

          <Link
            href={`/clients/${account.client.id}`}
            className="mb-5 flex items-center gap-3 rounded-lg border border-[#0033AA]/8 bg-[#0033AA]/[0.025] px-3.5 py-3 transition-colors hover:bg-[#0033AA]/[0.05]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-white text-[12px] font-semibold text-[#0033AA]">
              {account.client.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.client.photo_url} alt={account.client.full_name} className="h-full w-full object-cover" />
              ) : (
                <UserRound size={18} className="text-[#0033AA]/30" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#0A2240]">{account.client.full_name}</span>
              <span className="block text-[12px] text-[#0A2240]/45">
                {account.client.client_code} · <a href={`tel:${account.client.phone}`} className="hover:text-[#0033AA] hover:underline">{account.client.phone}</a>
              </span>
            </span>
            <ArrowUpRight size={15} className="shrink-0 text-[#0033AA]/30" />
          </Link>

          <div className="space-y-4 text-[13.5px]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Account number</p>
              <p className="flex items-center gap-1.5 text-[#0A2240]">
                {account.account_number}
                {isAdmin && (
                  <EditCodeButton
                    table="accounts"
                    id={account.id}
                    field="account_number"
                    label="Account number"
                    currentValue={account.account_number}
                  />
                )}
              </p>
            </div>
            <DetailRow label="Opening date" value={formatDate(account.opening_date)} />
            {account.product_type === "savings" && (
              <DetailRow
                label="Interest rate"
                value={account.interest_rate_annual != null ? `${account.interest_rate_annual}% p.a.` : "—"}
              />
            )}
            {account.product_type === "susu" && (
              <DetailRow
                label="Daily contribution"
                value={account.daily_contribution_amount != null ? `${formatGHS(account.daily_contribution_amount)} / day` : "—"}
              />
            )}
            {account.branch && <DetailRow label="Branch" value={account.branch} />}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Transaction history</h2>
            <span className="text-[12.5px] text-[#0A2240]/45">
              {allTransactions.length} entr{allTransactions.length === 1 ? "y" : "ies"}
            </span>
          </div>

          {allTransactions.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState title="No transactions recorded yet" description="Deposits and withdrawals on this account will appear here in chronological order." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {allTransactions.map((txn) => (
                <li key={txn.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14px] font-medium text-[#0A2240]">
                      <span className={txn.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"}>
                        {txn.type === "deposit" ? "+" : "−"}{formatGHS(txn.amount)}
                        {txn.type === "fee" && <span className="ml-1 text-[12px] font-normal text-[#0A2240]/40">(SMS fee)</span>}
                      </span>
                      {txn.fee > 0 && <span className="text-[12px] font-normal text-[#0A2240]/45">+ {formatGHS(txn.fee)} commission</span>}
                      <TransactionFlags txn={txn} />
                    </p>
                    <p className="truncate text-[12px] text-[#0A2240]/45">
                      {formatDateTime(txn.created_at)} · Balance after {formatGHS(txn.bal_after)}
                      {txn.recorder?.full_name ? ` · by ${txn.recorder.full_name}` : ""}
                      {txn.notes ? ` · ${txn.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-[#0033AA]/12 px-2.5 py-1 text-[11px] font-medium capitalize text-[#0A2240]/55">
                      {txn.type}
                    </span>
                    {isAdmin && txn.reversed_at === null && (txn.type === "deposit" || txn.type === "withdrawal") && (
                      <EditTransactionButton transaction={txn} />
                    )}
                    {isAdmin && <DeleteTransactionButton transaction={txn} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function TransactionFlags({ txn }: { txn: Transaction }) {
  if (txn.reversed_at) {
    return (
      <span className="rounded-full border border-[#B3432B]/20 bg-[#B3432B]/[0.06] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#963522]">
        Reversed
      </span>
    );
  }
  if (txn.edited_at) {
    return (
      <span className="rounded-full border border-[#0062E1]/20 bg-[#0062E1]/[0.06] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#0A4DA6]">
        Edited{txn.original_amount != null ? ` from ${formatGHS(txn.original_amount)}` : ""}
      </span>
    );
  }
  return null;
}

const SUSU_CLAIM_STATUS_STYLE: Record<SusuClaim["status"], string> = {
  pending_admin: "border-[#B58A2A]/25 bg-[#B58A2A]/[0.08] text-[#8A6A1F]",
  approved: "border-[#0062E1]/20 bg-[#0062E1]/[0.06] text-[#0A4DA6]",
  paid: "border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.06] text-[#1F6E4A]",
  rejected: "border-[#B3432B]/20 bg-[#B3432B]/[0.06] text-[#963522]",
};

const SUSU_CLAIM_STATUS_LABEL: Record<SusuClaim["status"], string> = {
  pending_admin: "Pending admin",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
};

function SusuClaimStatusBadge({ status }: { status: SusuClaim["status"] }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${SUSU_CLAIM_STATUS_STYLE[status]}`}>
      {SUSU_CLAIM_STATUS_LABEL[status]}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
      <p className="text-[#0A2240]">{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}


async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
