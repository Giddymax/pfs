import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BankDepositButton, BankWithdrawalButton } from "@/components/record-bank-transaction-button";
import { Card, PageHeader } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface BankTxn {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
  recorder?: { full_name: string } | null;
}

interface Reconciliation {
  total: number;
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

  // Fetch all bank transactions, join recorder name
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("*, recorder:recorded_by(full_name)")
    .order("created_at", { ascending: false })
    .returns<BankTxn[]>();

  // Fetch reconciliation total (= total company cash position)
  const { data: recon } = await supabase
    .rpc("compute_reconciliation")
    .single<Reconciliation>();

  const rows = txns ?? [];

  // cash_at_bank = sum of deposits − sum of withdrawals
  const cashAtBank = rows.reduce((acc, t) => {
    return t.type === "deposit" ? acc + t.amount : acc - t.amount;
  }, 0);

  const reconTotal = recon?.total ?? 0;
  const cashAtHand = reconTotal - cashAtBank;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Bank account"
        description="Track cash deposited into and withdrawn from the company bank account."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BankDepositButton cashAtBank={cashAtBank} />
            <BankWithdrawalButton cashAtBank={cashAtBank} />
          </div>
        }
      />

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
          hint="Total company funds minus cash at bank"
          color={cashAtHand >= 0 ? "text-[#0033AA]" : "text-[#963522]"}
          bg="bg-[#0033AA]/[0.04] border-[#0033AA]/12"
        />
        <BalanceCard
          label="Total funds"
          value={reconTotal}
          hint="Cash at hand + Cash at bank (reconciliation total)"
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Date / Time</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 font-semibold">Recorded by</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
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
                      <td className="px-5 py-3.5 text-[#0A2240]/65">
                        {txn.description ?? <span className="text-[#0A2240]/30">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#0A2240]/55">
                        {txn.recorder?.full_name ?? "—"}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums ${
                          isDeposit ? "text-[#1F6E4A]" : "text-[#963522]"
                        }`}
                      >
                        {isDeposit ? "+" : "−"}{formatGHS(txn.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Running balance footer */}
              <tfoot>
                <tr className="border-t-2 border-[#0033AA]/10 bg-[#0033AA]/[0.03]">
                  <td colSpan={4} className="px-5 py-3.5 text-[13px] font-semibold text-[#0033AA]">
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
