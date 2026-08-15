import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BankDepositButton, BankWithdrawalButton } from "@/components/record-bank-transaction-button";
import { EditBankTransactionButton, DeleteBankTransactionButton } from "@/components/bank-transaction-actions";
import { Card, PageHeader } from "@/components/ui";
import { ExportCsvButton } from "@/components/export-csv-button";
import { formatGHS } from "@/lib/loan";
import { getSettings } from "@/lib/settings/cache";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import type { Profile } from "@/lib/types";

const DEFAULT_REVENUE_COMPONENTS = {
  interest: true,
  commission: true,
  susu_fees: true,
  card_fees: true,
  sms_fees: true,
  processing_fees: true,
};

interface BankTxn {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
  recorder?: { full_name: string } | null;
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BankPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const [{ data: txns }, settings] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("*, recorder:recorded_by(full_name)")
      .order("created_at", { ascending: false })
      .returns<BankTxn[]>(),
    getSettings(),
  ]);

  const rows = txns ?? [];

  // Same calculation as the Overview dashboard, including the
  // revenue-component visibility toggles, so the two never silently diverge.
  const rc = { ...DEFAULT_REVENUE_COMPONENTS, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };
  const { accountBalance, cashAtBank, cashAtHand } = await computeAccountSummary(supabase, rc);

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Finance"
        title="Bank account"
        description="Track cash deposited into and withdrawn from the company bank account."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton endpoint="/api/bank/export" filename="bank-transactions.xlsx" label="Export Excel" />
            <BankDepositButton cashAtBank={cashAtBank} />
            <BankWithdrawalButton cashAtBank={cashAtBank} />
          </div>
        }
      />

      {accountBalance < 0 && (
        <div className="mb-6 rounded-xl border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-5 py-4 text-[13.5px] text-[#963522]">
          <p className="font-semibold">Account balance is negative ({formatGHS(accountBalance)})</p>
          <p className="mt-1 text-[12.5px] text-[#963522]/80">
            Combined client obligations exceed available funds. Cash at bank and cash at hand cannot be split
            meaningfully until this is investigated and resolved.
          </p>
        </div>
      )}

      {/* Balance cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BalanceCard
          label="Cash at bank"
          value={cashAtBank}
          hint="Running total of all bank deposits minus withdrawals"
          color="text-[#1F6E4A]"
          bg="bg-[#1F6E4A]/[0.05] border-[#1F6E4A]/15"
        />
        <BalanceCard
          label="Cash at hand"
          value={cashAtHand}
          hint="Money not deposited to bank — account balance minus cash at bank"
          color={cashAtHand >= 0 ? "text-[#0033AA]" : "text-[#963522]"}
          bg="bg-[#0033AA]/[0.04] border-[#0033AA]/12"
        />
        <BalanceCard
          label="Account balance"
          value={accountBalance}
          hint="Actual cash position: client deposits + retained fees − loans out + repayments − expenditures"
          color="text-[#0A2240]"
          bg="bg-[#0A2240]/[0.04] border-[#0A2240]/10"
        />
      </div>

      {/* Transaction history */}
      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Bank transaction history</h2>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13.5px] text-[#0A2240]/40">
            No bank transactions recorded yet. Use the buttons above to record your first deposit.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Date / Time</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="admin-col-secondary px-5 py-3 font-semibold">Description</th>
                  <th className="admin-col-secondary px-5 py-3 font-semibold">Recorded by</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0033AA]/6">
                {rows.map((txn) => {
                  const isDeposit = txn.type === "deposit";
                  return (
                    <tr key={txn.id} className="transition-colors hover:bg-[#0033AA]/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[#0A2240]/55">
                        {formatDT(txn.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                            isDeposit
                              ? "bg-[#1F6E4A]/10 text-[#1F6E4A]"
                              : "bg-[#963522]/10 text-[#963522]"
                          }`}
                        >
                          {isDeposit
                            ? <ArrowDownToLine size={12} />
                            : <ArrowUpFromLine size={12} />}
                          {isDeposit ? "Deposit" : "Withdrawal"}
                        </span>
                      </td>
                      <td className="admin-col-secondary px-5 py-3.5 text-[#0A2240]/65">
                        {txn.description ?? <span className="text-[#0A2240]/30">—</span>}
                      </td>
                      <td className="admin-col-secondary px-5 py-3.5 text-[13px] text-[#0A2240]/55">
                        {txn.recorder?.full_name ?? "—"}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums ${
                          isDeposit ? "text-[#1F6E4A]" : "text-[#963522]"
                        }`}
                      >
                        {isDeposit ? "+" : "−"}{formatGHS(txn.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <EditBankTransactionButton
                            id={txn.id}
                            currentAmount={txn.amount}
                            currentDescription={txn.description}
                          />
                          <DeleteBankTransactionButton id={txn.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Running balance footer */}
              <tfoot>
                <tr className="border-t-2 border-[#0033AA]/10 bg-[#0033AA]/[0.03]">
                  <td colSpan={5} className="px-5 py-3.5 text-[13px] font-semibold text-[#0033AA]">
                    Cash at bank
                  </td>
                  <td className="px-5 py-3.5 text-right text-[15px] font-bold tabular-nums text-[#0033AA]">
                    {formatGHS(cashAtBank)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  hint,
  color,
  bg,
}: {
  label: string;
  value: number;
  hint: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${bg}`}>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/45">{label}</p>
      <p className={`mt-1.5 text-[26px] font-bold tabular-nums ${color}`}>{formatGHS(value)}</p>
      <p className="mt-1 text-[11.5px] text-[#0A2240]/35">{hint}</p>
    </div>
  );
}
