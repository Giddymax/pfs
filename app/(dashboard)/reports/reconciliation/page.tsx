import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface Reconciliation {
  savings: number;
  susu_gross: number;
  fixed_deposits: number;
  withdrawals: number;
  commission: number;
  sms_charges: number;
  susu_company_fees: number;
  loans_disbursed: number;
  loan_repayments: number;
  fd_interest_paid: number;
  card_fees: number;
  loan_processing_fees: number;
  total: number;
}

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: figures, error } = await supabase.rpc("compute_reconciliation").single<Reconciliation>();

  const lines = figures
    ? [
        { label: "Savings", amount: figures.savings, sign: "+" as const },
        { label: "Susu (gross — lifetime contributions)", amount: figures.susu_gross, sign: "+" as const },
        { label: "Fixed deposits (active principal)", amount: figures.fixed_deposits, sign: "+" as const },
        { label: "Withdrawals", amount: figures.withdrawals, sign: "−" as const },
        { label: "Commission", amount: figures.commission, sign: "−" as const },
        { label: "SMS charges", amount: figures.sms_charges, sign: "−" as const },
        { label: "Susu company fees (day 31)", amount: figures.susu_company_fees, sign: "−" as const },
        { label: "Loans disbursed", amount: figures.loans_disbursed, sign: "−" as const },
        { label: "Loan repayments", amount: figures.loan_repayments, sign: "+" as const },
        { label: "FD interest paid", amount: figures.fd_interest_paid, sign: "−" as const },
        { label: "Card fees", amount: figures.card_fees, sign: "+" as const },
        { label: "Loan processing fees", amount: figures.loan_processing_fees, sign: "+" as const },
      ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Master reconciliation"
        description="The single formula that should match the company's actual cash position — each line traces back to a specific ledger so a figure that looks wrong can be debugged term by term."
      />

      {error || !figures ? (
        <Card>
          <div className="px-5 py-10 text-center text-[13.5px] text-[#963522]">
            {error?.message ?? "Could not load the reconciliation figures."}
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-1">
            <StatCard
              label="Reconciled total"
              value={formatGHS(figures.total)}
              hint="Savings + Susu + Fixed deposits − Withdrawals − Commission − SMS − Susu fees − Loans disbursed + Repayments − FD interest + Card fees + Processing fees"
            />
          </div>

          <Card>
            <div className="border-b border-[#0033AA]/8 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[#0033AA]">Line items</h2>
            </div>
            <ul className="divide-y divide-[#0033AA]/6">
              {lines.map((line) => (
                <li key={line.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <p className="text-[14px] text-[#0A2240]">{line.label}</p>
                  <p
                    className={`text-[14px] font-semibold tabular-nums ${
                      line.sign === "−" ? "text-[#963522]" : "text-[#1F6E4A]"
                    }`}
                  >
                    {line.sign} {formatGHS(line.amount)}
                  </p>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 bg-[#0033AA]/[0.03] px-5 py-4">
                <p className="text-[14px] font-semibold text-[#0033AA]">Reconciled total</p>
                <p className="text-[15px] font-bold tabular-nums text-[#0033AA]">{formatGHS(figures.total)}</p>
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
