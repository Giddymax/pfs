import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRound, Calendar, Percent, Wallet, ArrowUpRight, Hash, CheckCircle2, XCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EditCodeButton } from "@/components/edit-code-button";
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

  type LoanWithIssuer = Loan & { client: Client; issuer: { full_name: string } | null };
  type RepaymentWithRecorder = LoanRepayment & { recorder: { full_name: string } | null };

  const [{ data: loan }, { data: repayments }, { data: profile }] = await Promise.all([
    supabase.from("loans").select("*, client:clients(*), issuer:issued_by(full_name)").eq("id", id).single<LoanWithIssuer>(),
    supabase
      .from("loan_repayments")
      .select("*, recorder:recorded_by(full_name)")
      .eq("loan_id", id)
      .order("payment_date", { ascending: false })
      .returns<RepaymentWithRecorder[]>(),
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
            <RecordRepaymentForm loanId={loan.id} suggestedAmount={Number(loan.monthly_installment)} currentBalance={Number(loan.current_balance)} />
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

            <div className="space-y-4 text-[13.5px]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[#0033AA]/35"><Hash size={15} /></span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Loan code</p>
                  <p className="flex items-center gap-1.5 text-[#0A2240]">
                    {loan.loan_code}
                    {isAdmin && (
                      <EditCodeButton
                        table="loans"
                        id={loan.id}
                        field="loan_code"
                        label="Loan code"
                        currentValue={loan.loan_code}
                      />
                    )}
                  </p>
                </div>
              </div>
              <DetailRow icon={<Wallet size={15} />} label="Principal" value={formatGHS(loan.principal)} />
              <DetailRow icon={<Percent size={15} />} label="Flat interest rate" value={`${loan.flat_rate_percent}% (${formatGHS(loan.total_interest)} total)`} />
              <DetailRow icon={<Wallet size={15} />} label="Total repayable" value={formatGHS(loan.total_repayable)} />
              <DetailRow icon={<Wallet size={15} />} label="Monthly installment" value={`${formatGHS(loan.monthly_installment)} × ${loan.tenor_months} months`} />
              <DetailRow icon={<Calendar size={15} />} label="Disbursed" value={formatDate(loan.disbursement_date)} />
              <DetailRow icon={<Calendar size={15} />} label="Due date" value={formatDate(loan.due_date)} />
              {loan.purpose && <DetailRow icon={<Wallet size={15} />} label="Purpose" value={loan.purpose} />}
              {(loan as LoanWithIssuer).issuer?.full_name && (
                <DetailRow icon={<UserRound size={15} />} label="Issued by" value={(loan as LoanWithIssuer).issuer!.full_name} />
              )}
            </div>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* Right column: schedule + history */}
        <div className="space-y-6 lg:col-span-2">
          {/* Repayment schedule */}
          {loan.disbursement_date && loan.tenor_months > 0 && (
            <Card>
              <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-[#0033AA]">Repayment schedule</h2>
                <span className="text-[12.5px] text-[#0A2240]/45">{loan.tenor_months} installments</span>
              </div>
              <div className="pfs-table-scroll">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/45">
                      <th className="px-5 py-2.5">#</th>
                      <th className="px-5 py-2.5">Due date</th>
                      <th className="px-5 py-2.5 text-right">Expected</th>
                      <th className="px-5 py-2.5 text-right">Paid</th>
                      <th className="px-5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A2240]/6">
                    {buildSchedule(loan.disbursement_date, loan.tenor_months, Number(loan.monthly_installment), allRepayments).map((slot) => (
                      <tr key={slot.month} className={slot.status === "missed" ? "bg-[#FEF2F0]/60" : ""}>
                        <td className="px-5 py-3 text-[#0A2240]/40">{slot.month}</td>
                        <td className="px-5 py-3 text-[#0A2240]/70">{slot.dueDate}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]">{formatGHS(slot.expected)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]/55">
                          {slot.paid > 0 ? formatGHS(slot.paid) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {slot.status === "paid" && (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#1F6E4A]">
                              <CheckCircle2 size={13} /> Paid
                            </span>
                          )}
                          {slot.status === "missed" && (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#B91C1C]">
                              <XCircle size={13} /> Missed
                            </span>
                          )}
                          {slot.status === "upcoming" && (
                            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#0A2240]/40">
                              <Clock size={13} /> Upcoming
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Repayment history */}
          <Card>
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
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#0A2240]">{formatGHS(r.amount)}</p>
                      <p className="text-[12px] text-[#0A2240]/45">
                        {formatDate(r.payment_date)}
                        {r.recorder?.full_name ? ` · by ${r.recorder.full_name}` : ""}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#1D3461]/12 px-2.5 py-1 text-[11px] font-medium capitalize text-[#0A2240]/55">
                      {methodLabel(r.method)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
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

type ScheduleSlot = {
  month: number;
  dueDate: string;
  expected: number;
  paid: number;
  status: "paid" | "missed" | "upcoming";
};

function buildSchedule(
  disbursementDate: string,
  tenorMonths: number,
  monthlyInstallment: number,
  repayments: { amount: number; payment_date: string }[]
): ScheduleSlot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort repayments chronologically and use them slot by slot
  const sorted = [...repayments].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  let repaymentIdx = 0;

  return Array.from({ length: tenorMonths }, (_, i) => {
    const month = i + 1;
    const due = new Date(disbursementDate);
    due.setMonth(due.getMonth() + month);

    const isPast = due <= today;
    let paid = 0;
    let status: ScheduleSlot["status"] = "upcoming";

    if (isPast && repaymentIdx < sorted.length) {
      paid = Number(sorted[repaymentIdx].amount);
      repaymentIdx++;
      status = "paid";
    } else if (isPast) {
      status = "missed";
    }

    return {
      month,
      dueDate: due.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      expected: monthlyInstallment,
      paid,
      status,
    };
  });
}
