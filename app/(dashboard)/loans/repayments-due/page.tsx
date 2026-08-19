import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ProcessDueRepaymentsButton } from "@/components/process-due-repayments-button";
import { formatGHS, round2 } from "@/lib/loan";
import type { Client, Loan, Profile } from "@/lib/types";

type DueLoan = Loan & {
  client: Pick<Client, "id" | "full_name" | "client_code">;
  repayment_account: { account_number: string; product_type: string; balance: number } | null;
};

export default async function RepaymentsDuePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/loans");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: dueLoans }, { data: unenrolledLoans }] = await Promise.all([
    supabase
      .from("loans")
      .select("*, client:clients(id, full_name, client_code), repayment_account:accounts!repayment_account_id(account_number, product_type, balance)")
      .eq("status", "active")
      .not("repayment_account_id", "is", null)
      .lte("next_due_date", today)
      .order("next_due_date", { ascending: true })
      .returns<DueLoan[]>(),
    supabase
      .from("loans")
      .select("id, loan_code, client:clients(id, full_name)")
      .eq("status", "active")
      .is("repayment_account_id", null)
      .returns<{ id: string; loan_code: string; client: { id: string; full_name: string } }[]>(),
  ]);

  const rows = (dueLoans ?? []).map((loan) => {
    const due = round2(Math.min(Number(loan.monthly_installment) + Number(loan.arrears), Number(loan.current_balance)));
    const available = round2(Math.min(loan.repayment_account?.balance ?? 0, due));
    return { loan, due, available, shortfall: round2(due - available) };
  });

  const totalDue = round2(rows.reduce((s, r) => s + r.due, 0));
  const totalCollectible = round2(rows.reduce((s, r) => s + r.available, 0));

  return (
    <div>
      <PageHeader
        back="/loans"
        eyebrow="Loans"
        title="Repayments due"
        description="Every active loan whose monthly installment is due today or overdue, deducted automatically from its pinned repayment account."
      />

      {(unenrolledLoans?.length ?? 0) > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#B58A2A]/25 bg-[#B58A2A]/[0.07] px-5 py-4 text-[13px] text-[#8A6A1F]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{unenrolledLoans!.length} active loan{unenrolledLoans!.length === 1 ? "" : "s"} not enrolled in auto-deduction</p>
            <p className="mt-1 text-[12.5px] leading-relaxed">
              These predate the repayment-account requirement. Open each one to attach a repayment account:{" "}
              {unenrolledLoans!.map((l, i) => (
                <span key={l.id}>
                  <Link href={`/loans/${l.id}`} className="font-medium underline hover:text-[#6D5219]">
                    {l.loan_code} — {l.client.full_name}
                  </Link>
                  {i < unenrolledLoans!.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0033AA]/8 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0033AA]">{rows.length} due today or overdue</h2>
            <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
              {formatGHS(totalDue)} total due · {formatGHS(totalCollectible)} collectible right now
              {totalCollectible < totalDue ? ` · ${formatGHS(round2(totalDue - totalCollectible))} will carry forward as arrears` : ""}
            </p>
          </div>
          <ProcessDueRepaymentsButton disabled={rows.length === 0} />
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState title="Nothing due right now" description="Loans enrolled in auto-deduction will show up here as their monthly installment comes due." />
          </div>
        ) : (
          <div className="pfs-table-scroll">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-2.5">Client</th>
                  <th className="px-5 py-2.5">Loan</th>
                  <th className="px-5 py-2.5">Account</th>
                  <th className="px-5 py-2.5 text-right">Due</th>
                  <th className="px-5 py-2.5 text-right">Available</th>
                  <th className="px-5 py-2.5 text-right">Shortfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A2240]/6">
                {rows.map(({ loan, due, available, shortfall }) => (
                  <tr key={loan.id}>
                    <td className="px-5 py-3">
                      <Link href={`/clients/${loan.client.id}`} className="flex items-center gap-1 font-medium text-[#0A2240] hover:text-[#0033AA]">
                        {loan.client.full_name} <ArrowUpRight size={12} className="text-[#0033AA]/40" />
                      </Link>
                      <span className="text-[11.5px] text-[#0A2240]/40">{loan.client.client_code}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/loans/${loan.id}`} className="font-medium text-[#0033AA] hover:underline">
                        {loan.loan_code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[#0A2240]/70">
                      {loan.repayment_account?.account_number} <span className="text-[11.5px] text-[#0A2240]/40">({loan.repayment_account?.product_type})</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]">{formatGHS(due)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#1F6E4A]">{formatGHS(available)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {shortfall > 0 ? <span className="font-medium text-[#B3432B]">{formatGHS(shortfall)}</span> : <span className="text-[#0A2240]/30">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
