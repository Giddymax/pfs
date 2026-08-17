import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { AddExpenditureButton, DeleteExpenditureButton } from "@/components/expenditure-actions";
import { PrintFinanceSummaryButton } from "@/components/print-finance-summary-button";
import { ExportCsvButton } from "@/components/export-csv-button";
import { formatGHS, round2 } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface Expenditure {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  linked_transaction_id: string | null;
}

interface ConsolidatedFundAccount {
  id: string;
  account_number: string;
  balance: number;
  wdr: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  Salaries:         "bg-[#7C3AED]/10 text-[#6D28D9]",
  Rent:             "bg-[#0284C7]/10 text-[#0369A1]",
  Utilities:        "bg-[#D97706]/10 text-[#B45309]",
  Transport:        "bg-[#0891B2]/10 text-[#0E7490]",
  "Office Supplies":"bg-[#1F6E4A]/10 text-[#166534]",
  Marketing:        "bg-[#DB2777]/10 text-[#BE185D]",
  Maintenance:      "bg-[#EA580C]/10 text-[#C2410C]",
  Miscellaneous:    "bg-[#64748B]/10 text-[#475569]",
};

const DEFAULT_REVENUE_COMPONENTS = {
  interest: true,
  commission: true,
  susu_fees: true,
  card_fees: true,
  sms_fees: true,
  processing_fees: true,
};

function categoryBadge(cat: string) {
  return CATEGORY_COLOR[cat] ?? "bg-[#64748B]/10 text-[#475569]";
}

export default async function FinancePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user.id).single<Pick<Profile, "role" | "full_name">>();
  if (profile?.role !== "admin") redirect("/clients");

  const settings = await getSettings();
  const rc = { ...DEFAULT_REVENUE_COMPONENTS, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };

  const [{ data: expenditures }, { data: fund }, summary] = await Promise.all([
    supabase
      .from("expenditures")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Expenditure[]>(),
    // The PFS Consolidated Fund account — see 0074_consolidated_fund_
    // finance_link.sql. Total Expenditure below reads straight off its wdr
    // instead of summing the expenditures table, since every expenditure
    // is, for real, a withdrawal from it. Depositing into it now happens
    // on the account's own page (id below), not here — see the Deposit
    // revenue link in the header.
    supabase.from("accounts").select("id, account_number, balance, wdr").eq("is_consolidated_fund", true).maybeSingle<ConsolidatedFundAccount>(),
    // Same shared calculation the Overview dashboard and Bank page use, so
    // "Total Revenue" here always matches those screens exactly.
    computeAccountSummary(supabase, rc),
  ]);

  const { loanInterest, commission, susuFees, cardFees, totalSmsFees, processingFees, totalRevenue, revenueAvailable } = summary;

  const totalExpenditure = round2(Number(fund?.wdr ?? 0));
  const netBalance = round2(Number(fund?.balance ?? 0));

  const revenueItems = [
    { label: "Loan interest",   value: loanInterest,   visible: rc.interest },
    { label: "Commission",      value: commission,     visible: rc.commission },
    { label: "Susu fees",       value: susuFees,       visible: rc.susu_fees },
    { label: "Card fees",       value: cardFees,       visible: rc.card_fees },
    { label: "SMS fees",        value: totalSmsFees,   visible: rc.sms_fees },
    { label: "Processing fees", value: processingFees, visible: rc.processing_fees },
  ].filter((r) => r.visible);

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Admin - Finance"
        title="Company Finance"
        description="Revenue earned, expenditures recorded, and net balance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {fund && (
              <Link
                href={`/accounts/${fund.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-[#7C3AED] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#6D28D9]"
              >
                <Landmark size={15} />
                Deposit revenue
              </Link>
            )}
            <ExportCsvButton endpoint="/api/finance/export" filename="finance.xlsx" label="Export Excel" />
            <PrintFinanceSummaryButton
              totalRevenue={totalRevenue}
              totalExpenditure={totalExpenditure}
              netBalance={netBalance}
              revenueItems={revenueItems}
              expenditures={expenditures ?? []}
              printedBy={profile?.full_name}
              companyPhone={settings.sms.company_tel ?? null}
            />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Revenue"
          value={formatGHS(totalRevenue)}
          color="bg-[#15803D]"
          sub="Interest + commission + fees"
        />
        <SummaryCard
          label="PFS Consolidated Fund"
          value={formatGHS(Number(fund?.balance ?? 0))}
          color="bg-[#7C3AED]"
          sub={fund ? `Account ${fund.account_number} — always matches its live balance` : "Not set up — mark an account is_consolidated_fund"}
        />
        <SummaryCard
          label="Fund — Amount Available"
          value={formatGHS(revenueAvailable)}
          color="bg-[#6D28D9]"
          sub={`Total Revenue ${formatGHS(totalRevenue)} − already deposited ${formatGHS(round2(totalRevenue - revenueAvailable))}`}
        />
        <SummaryCard
          label="Total Expenditure"
          value={formatGHS(totalExpenditure)}
          color="bg-[#B3432B]"
          sub="Lifetime withdrawals from the Consolidated Fund"
        />
      </div>

      {/* Revenue by product */}
      <div className="mb-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0A2240]/40">Revenue by product</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <ProductRevenueCard
            label="Savings"
            sublabel="Withdrawal commission"
            value={commission}
            accent="border-l-[#0033AA]"
            valueColor="text-[#0033AA]"
          />
          <ProductRevenueCard
            label="Loans"
            sublabel="Interest + processing fees"
            value={round2(loanInterest + processingFees)}
            accent="border-l-[#15803D]"
            valueColor="text-[#15803D]"
          />
          <ProductRevenueCard
            label="Daily Susu"
            sublabel="Susu fees"
            value={susuFees}
            accent="border-l-[#0891B2]"
            valueColor="text-[#0891B2]"
          />
          <ProductRevenueCard
            label="Card Fees"
            sublabel="Registration card fees"
            value={cardFees}
            accent="border-l-[#D97706]"
            valueColor="text-[#D97706]"
          />
          <ProductRevenueCard
            label="SMS Fees"
            sublabel="Monthly SMS charges"
            value={totalSmsFees}
            accent="border-l-[#DB2777]"
            valueColor="text-[#DB2777]"
          />
        </div>
      </div>

      <Card className="mb-6">
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Revenue breakdown</h2>
        </div>
        <div className="divide-y divide-[#0033AA]/6">
          {revenueItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13.5px] text-[#0A2240]/70">{item.label}</span>
              <span className="text-[14px] font-semibold tabular-nums text-[#0A2240]">
                {formatGHS(item.value)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-[#0033AA]/[0.03] px-5 py-3.5">
            <span className="text-[13.5px] font-semibold text-[#0033AA]">Total</span>
            <span className="text-[15px] font-bold tabular-nums text-[#0033AA]">
              {formatGHS(totalRevenue)}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Expenditure log</h2>
            <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
              {(expenditures ?? []).length} entr{(expenditures ?? []).length === 1 ? "y" : "ies"} - {formatGHS(totalExpenditure)} total
            </p>
          </div>
          <AddExpenditureButton />
        </div>

        {!expenditures || expenditures.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              title="No expenditures recorded yet"
              description="Add your first entry to start tracking company costs."
            />
          </div>
        ) : (
          <>
            <div className="pfs-table-scroll hidden md:block">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02]">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Date</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Category</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Description</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Amount</th>
                    <th className="w-8 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0033AA]/6">
                  {expenditures.map((exp) => (
                    <tr key={exp.id} className="group hover:bg-[#0033AA]/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[#0A2240]/60">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${categoryBadge(exp.category)}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13.5px] font-medium text-[#0A2240]">{exp.title}</p>
                        {exp.notes && (
                          <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{exp.notes}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#B3432B]">
                        {formatGHS(exp.amount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <DeleteExpenditureButton id={exp.id} title={exp.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#0033AA]/12 bg-[#0033AA]/[0.03]">
                    <td colSpan={3} className="px-5 py-3.5 text-[13px] font-semibold text-[#0A2240]">Total</td>
                    <td className="px-5 py-3.5 text-right text-[15px] font-bold tabular-nums text-[#B3432B]">
                      {formatGHS(totalExpenditure)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="divide-y divide-[#0033AA]/6 md:hidden">
              {expenditures.map((exp) => (
                <li key={exp.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryBadge(exp.category)}`}>
                        {exp.category}
                      </span>
                      <span className="text-[12px] text-[#0A2240]/45">{formatDate(exp.date)}</span>
                    </div>
                    <p className="text-[13.5px] font-medium text-[#0A2240]">{exp.title}</p>
                    {exp.notes && <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{exp.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[14px] font-semibold tabular-nums text-[#B3432B]">{formatGHS(exp.amount)}</span>
                    <DeleteExpenditureButton id={exp.id} title={exp.title} />
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between bg-[#0033AA]/[0.03] px-5 py-4">
                <span className="text-[13.5px] font-semibold text-[#0A2240]">Total expenditure</span>
                <span className="text-[15px] font-bold tabular-nums text-[#B3432B]">{formatGHS(totalExpenditure)}</span>
              </li>
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  label, value, color, sub, prefix,
}: {
  label: string;
  value: string;
  color: string;
  sub: string;
  prefix?: string;
}) {
  return (
    <div className={`rounded-xl ${color} p-5 text-white`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/75">{label}</p>
      <p className="mt-2 break-words text-[1.45rem] font-bold tabular-nums leading-none">
        {prefix}{value}
      </p>
      <p className="mt-2 text-[11.5px] leading-snug text-white/70">{sub}</p>
    </div>
  );
}

function ProductRevenueCard({
  label, sublabel, value, accent, valueColor,
}: {
  label: string;
  sublabel: string;
  value: number;
  accent: string;
  valueColor: string;
}) {
  return (
    <div className={`rounded-xl border border-[#0A2240]/10 border-l-4 ${accent} bg-white px-5 py-4 shadow-sm`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-[#0A2240]/45">{label}</p>
      <p className={`mt-2 text-[1.35rem] font-bold tabular-nums leading-none ${valueColor}`}>
        {formatGHS(value)}
      </p>
      <p className="mt-1.5 text-[11.5px] text-[#0A2240]/50">{sublabel}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
