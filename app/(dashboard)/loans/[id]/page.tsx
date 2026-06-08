import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRound, Calendar, Percent, Wallet, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { RecordRepaymentForm } from "@/components/record-repayment-form";
import { LoanStatusControl } from "@/components/loan-status-control";
import { Card, LoanStatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { formatGHS, round2 } from "@/lib/loan";
import type { Client, Loan, LoanRepayment, Profile } from "@/lib/types";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: loan }, { data: repayments }, { data: profile }] = await Promise.all([
    supabase.from("loans").select("*, client:clients(*)").eq("id", id).single<Loan & { client: Client }>(),
    supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_id", id)
      .order("payment_date", { ascending: false })
      .returns<LoanRepayment[]>(),
    getCurrentProfile(supabase),
  ]);

  if (!loan) notFound();

  const isAdmin = profile?.role === "admin";
  const allRepayments = repayments ?? [];
  const totalPaid = round2(allRepayments.reduce((sum, r) => sum + Number(r.amount), 0));
  const balance = Math.max(0, round2(Number(loan.total_repayable) - totalPaid));
  const progressPercent = loan.total_repayable > 0 ? Math.min(100, Math.round((totalPaid / Number(loan.total_repayable)) * 100)) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Loans"
        title={loan.loan_code}
        description={`Issued to ${loan.client.full_name} on ${formatDate(loan.disbursement_date)}`}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <RecordRepaymentForm loanId={loan.id} suggestedAmount={Number(loan.monthly_installment)} />
            {isAdmin && (
              <ConfirmDeleteButton
                table="loans"
                id={loan.id}
                label="Delete loan"
                confirmTitle="Delete this loan?"
                confirmDescription="This permanently removes the loan and all of its recorded repayments. This cannot be undone."
                redirectTo="/loans"
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Loan summary */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Status</p>
              {isAdmin ? <LoanStatusControl loanId={loan.id} status={loan.status} /> : <LoanStatusBadge status={loan.status} />}
            </div>

            <Link href={`/clients/${loan.client_id}`} className="mb-5 flex items-center gap-3 rounded-lg border border-[#0033AA]/8 bg-[#0033AA]/[0.025] px-3.5 py-3 transition-colors hover:bg-[#0033AA]/[0.05]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-white text-[12px] font-semibold text-[#0033AA]">
                {loan.client.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={loan.client.photo_url} alt={loan.client.full_name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={18} className="text-[#0033AA]/30" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-[#0A2240]">{loan.client.full_name}</span>
                <span className="block text-[12px] text-[#0A2240]/45">{loan.client.client_code} · {loan.client.phone}</span>
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-[#0033AA]/30" />
            </Link>

            <dl className="space-y-4 text-[13.5px]">
              <DetailRow icon={<Wallet size={15} />} label="Principal" value={formatGHS(loan.principal)} />
              <DetailRow icon={<Percent size={15} />} label="Flat interest rate" value={`${loan.flat_rate_percent}% (${formatGHS(loan.total_interest)} total)`} />
              <DetailRow icon={<Wallet size={15} />} label="Total repayable" value={formatGHS(loan.total_repayable)} />
              <DetailRow icon={<Wallet size={15} />} label="Monthly installment" value={`${formatGHS(loan.monthly_installment)} × ${loan.tenor_months} months`} />
              <DetailRow icon={<Calendar size={15} />} label="Disbursed" value={formatDate(loan.disbursement_date)} />
              <DetailRow icon={<Calendar size={15} />} label="Due date" value={formatDate(loan.due_date)} />
              {loan.purpose && <DetailRow icon={<Wallet size={15} />} label="Purpose" value={loan.purpose} />}
            </dl>
          </Card>

          <Card className="p-6">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Repayment progress</p>
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-[#0033AA]/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0033AA] to-[#1F6E4A] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mb-5 text-[12px] text-[#0A2240]/45">{progressPercent}% of total repayable collected</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Paid so far</p>
                <p className="mt-0.5 text-[18px] font-semibold text-[#1F6E4A]">{formatGHS(totalPaid)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Balance remaining</p>
                <p className="mt-0.5 text-[18px] font-semibold text-[#0033AA]">{formatGHS(balance)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Repayment history */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Repayment history</h2>
            <span className="text-[12.5px] text-[#0A2240]/45">{allRepayments.length} payment{allRepayments.length === 1 ? "" : "s"} recorded</span>
          </div>

          {allRepayments.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState title="No repayments recorded yet" description="Repayments logged for this loan will appear here in chronological order." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {allRepayments.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-[#0A2240]">{formatGHS(r.amount)}</p>
                    <p className="text-[12px] text-[#0A2240]/45">
                      {formatDate(r.payment_date)} · {methodLabel(r.method)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#0033AA]/12 px-2.5 py-1 text-[11px] font-medium capitalize text-[#0A2240]/55">
                    {methodLabel(r.method)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[#0033AA]/35">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
        <p className="text-[#0A2240]">{value}</p>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function methodLabel(method: string) {
  return { cash: "Cash", mobile_money: "Mobile Money", bank_transfer: "Bank Transfer" }[method] ?? method;
}

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
