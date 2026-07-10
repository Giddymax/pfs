import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { AddExpenditureButton, DeleteExpenditureButton } from "@/components/expenditure-actions";
import { AddInvestmentButton, DeleteInvestmentButton, ReturnInvestmentButton } from "@/components/investment-actions";
import { PrintFinanceSummaryButton } from "@/components/print-finance-summary-button";
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
}

type InvestmentStatus = "active" | "returned";

interface Investment {
  id: string;
  title: string;
  investment_type: string;
  amount_invested: number;
  revenue_made: number;
  status: InvestmentStatus;
  date: string;
  return_date: string | null;
  returned_by: string | null;
  returned_at: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
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

  const [
    { data: cardFeeRows },
    { data: commissionRows },
    { data: susuFeeRows },
    { data: processingFeeRows },
    { data: collectedInterest },
    { data: smsFeeRows },
    { data: expenditures },
    { data: investments },
  ] = await Promise.all([
    supabase.from("card_fees").select("amount"),
    supabase.from("transactions").select("fee").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31),
    supabase.from("loans").select("processing_fee"),
    supabase.rpc("compute_collected_loan_interest"),
    supabase.from("sms_fee_charges").select("amount"),
    supabase
      .from("expenditures")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Expenditure[]>(),
    supabase
      .from("investments")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Investment[]>(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sum = (rows: any[] | null, key: string) =>
    round2((rows ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r[key] ?? 0), 0));

  const settings = await getSettings();
  const defaultComponents = {
    interest: true,
    commission: true,
    susu_fees: true,
    card_fees: true,
    sms_fees: true,
    processing_fees: true,
    investment_revenue: true,
  };
  const rc = { ...defaultComponents, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };

  const loanInterest   = round2(Number(collectedInterest ?? 0));
  const commission     = sum(commissionRows, "fee");
  const susuFees       = sum(susuFeeRows, "amount");
  const cardFees       = sum(cardFeeRows, "amount");
  const totalSmsFees   = sum(smsFeeRows, "amount");
  const processingFees = sum(processingFeeRows, "processing_fee");

  const investmentList = investments ?? [];
  const totalInvested = round2(investmentList.reduce((s, e) => s + Number(e.amount_invested), 0));
  const activeInvestmentTotal = round2(
    investmentList.filter((e) => e.status === "active").reduce((s, e) => s + Number(e.amount_invested), 0)
  );
  const returnedInvestmentRevenue = round2(
    investmentList.filter((e) => e.status === "returned").reduce((s, e) => s + Number(e.revenue_made), 0)
  );

  const revenueBeforeInvestments = round2(
    (rc.interest           ? loanInterest               : 0) +
    (rc.commission         ? commission                 : 0) +
    (rc.susu_fees          ? susuFees                   : 0) +
    (rc.card_fees          ? cardFees                   : 0) +
    (rc.sms_fees           ? totalSmsFees               : 0) +
    (rc.processing_fees    ? processingFees             : 0) +
    (rc.investment_revenue ? returnedInvestmentRevenue  : 0)
  );
  const investmentDeductedFromRevenue = round2(Math.min(activeInvestmentTotal, revenueBeforeInvestments));
  const investmentDeductedFromAccount = round2(Math.max(activeInvestmentTotal - revenueBeforeInvestments, 0));
  const totalRevenue = round2(revenueBeforeInvestments - investmentDeductedFromRevenue);

  const totalExpenditure = round2((expenditures ?? []).reduce((s, e) => s + Number(e.amount), 0));
  const netBalance = round2(totalRevenue - totalExpenditure);

  const revenueItems = [
    { label: "Loan interest",              value: loanInterest,                   visible: rc.interest },
    { label: "Commission",                 value: commission,                     visible: rc.commission },
    { label: "Susu fees",                  value: susuFees,                       visible: rc.susu_fees },
    { label: "Card fees",                  value: cardFees,                       visible: rc.card_fees },
    { label: "SMS fees",                   value: totalSmsFees,                   visible: rc.sms_fees },
    { label: "Processing fees",            value: processingFees,                 visible: rc.processing_fees },
    { label: "Returned investment revenue", value: returnedInvestmentRevenue,     visible: rc.investment_revenue },
    { label: "Active investments deducted", value: -investmentDeductedFromRevenue, visible: investmentDeductedFromRevenue > 0 },
  ].filter((r) => r.visible);

  return (
    <div>
      <PageHeader
        eyebrow="Admin - Finance"
        title="Company Finance"
        description="Revenue earned, active investments, expenditures recorded, and net balance."
        action={
          <PrintFinanceSummaryButton
            totalRevenue={totalRevenue}
            totalExpenditure={totalExpenditure}
            netBalance={netBalance}
            revenueItems={revenueItems}
            expenditures={expenditures ?? []}
            investments={investmentList}
            totalInvested={totalInvested}
            activeInvestmentTotal={activeInvestmentTotal}
            investmentDeductedFromRevenue={investmentDeductedFromRevenue}
            investmentDeductedFromAccount={investmentDeductedFromAccount}
            investmentRevenue={returnedInvestmentRevenue}
            printedBy={profile?.full_name}
          />
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Total Revenue"
          value={formatGHS(totalRevenue)}
          color="bg-[#15803D]"
          sub="After active investment deductions"
        />
        <SummaryCard
          label="Returned Investment Revenue"
          value={formatGHS(returnedInvestmentRevenue)}
          color="bg-[#1F6E4A]"
          sub="Added only after return"
        />
        <SummaryCard
          label="Active Investments"
          value={formatGHS(activeInvestmentTotal)}
          color="bg-[#0D9488]"
          sub={`${formatGHS(investmentDeductedFromRevenue)} from revenue`}
        />
        <SummaryCard
          label="Account Balance Used"
          value={formatGHS(investmentDeductedFromAccount)}
          color="bg-[#D97706]"
          sub="Overflow after revenue is used"
        />
        <SummaryCard
          label="Total Expenditure"
          value={formatGHS(totalExpenditure)}
          color="bg-[#B3432B]"
          sub="Sum of all recorded costs"
        />
        <SummaryCard
          label="Net Balance"
          value={formatGHS(Math.abs(netBalance))}
          color={netBalance >= 0 ? "bg-[#0033AA]" : "bg-[#7C3AED]"}
          sub={netBalance >= 0 ? "Surplus after expenditures" : "Deficit: expenditures exceed revenue"}
          prefix={netBalance < 0 ? "-" : undefined}
        />
      </div>

      {/* Revenue by product */}
      <div className="mb-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0A2240]/40">Revenue by product</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ProductRevenueCard
            label="Savings"
            sublabel="Withdrawal commission"
            value={commission}
            accent="border-l-[#0033AA]"
            valueColor="text-[#0033AA]"
          />
          <ProductRevenueCard
            label="Loans"
            sublabel="Collected interest"
            value={loanInterest}
            accent="border-l-[#15803D]"
            valueColor="text-[#15803D]"
          />
          <ProductRevenueCard
            label="Daily Susu"
            sublabel="One-day contribution"
            value={susuFees}
            accent="border-l-[#0891B2]"
            valueColor="text-[#0891B2]"
          />
          <ProductRevenueCard
            label="Investments"
            sublabel="Return on investment"
            value={returnedInvestmentRevenue}
            accent="border-l-[#7C3AED]"
            valueColor="text-[#7C3AED]"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Revenue breakdown</h2>
            <p className="mt-0.5 text-[12px] text-[#0A2240]/45">Investment principal is deducted before totals</p>
          </div>
          <div className="divide-y divide-[#0033AA]/6">
            {revenueItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13.5px] text-[#0A2240]/70">{item.label}</span>
                <span className={`text-[14px] font-semibold tabular-nums ${item.value < 0 ? "text-[#B3432B]" : "text-[#0A2240]"}`}>
                  {formatGHS(item.value)}
                </span>
              </div>
            ))}
            {investmentDeductedFromAccount > 0 && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13.5px] text-[#0A2240]/70">Taken from account balance</span>
                <span className="text-[14px] font-semibold tabular-nums text-[#D97706]">
                  {formatGHS(investmentDeductedFromAccount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between bg-[#0033AA]/[0.03] px-5 py-3.5">
              <span className="text-[13.5px] font-semibold text-[#0033AA]">Total</span>
              <span className="text-[15px] font-bold tabular-nums text-[#0033AA]">
                {formatGHS(totalRevenue)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#0033AA]">Investment log</h2>
              <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
                {investmentList.length} entr{investmentList.length === 1 ? "y" : "ies"} - {formatGHS(activeInvestmentTotal)} active - {formatGHS(returnedInvestmentRevenue)} returned revenue
              </p>
            </div>
            <AddInvestmentButton />
          </div>

          {investmentList.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                title="No investments recorded yet"
                description="Add your first entry to track investments, then mark it returned when revenue is received."
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02]">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Date</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Status</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Investment</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Invested</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Revenue</th>
                      <th className="w-24 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0033AA]/6">
                    {investmentList.map((investment) => (
                      <tr key={investment.id} className="group hover:bg-[#0033AA]/[0.02]">
                        <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[#0A2240]/60">
                          {formatDate(investment.date)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${investment.status === "returned" ? "bg-[#1F6E4A]/10 text-[#166534]" : "bg-[#D97706]/10 text-[#B45309]"}`}>
                            {investment.status === "returned" ? "Returned" : "Active"}
                          </span>
                          {investment.return_date && (
                            <p className="mt-1 text-[11px] text-[#0A2240]/45">{formatDate(investment.return_date)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[13.5px] font-medium text-[#0A2240]">{investment.title}</p>
                          <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{investment.investment_type}</p>
                          {investment.notes && (
                            <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{investment.notes}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#0A2240]">
                          {formatGHS(investment.amount_invested)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#15803D]">
                          {formatGHS(investment.revenue_made)}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {investment.status === "active" && <ReturnInvestmentButton id={investment.id} title={investment.title} />}
                            <DeleteInvestmentButton id={investment.id} title={investment.title} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0033AA]/12 bg-[#0033AA]/[0.03]">
                      <td colSpan={3} className="px-5 py-3.5 text-[13px] font-semibold text-[#0A2240]">Total</td>
                      <td className="px-5 py-3.5 text-right text-[15px] font-bold tabular-nums text-[#0A2240]">
                        {formatGHS(totalInvested)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[15px] font-bold tabular-nums text-[#15803D]">
                        {formatGHS(returnedInvestmentRevenue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ul className="divide-y divide-[#0033AA]/6 md:hidden">
                {investmentList.map((investment) => (
                  <li key={investment.id} className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${investment.status === "returned" ? "bg-[#1F6E4A]/10 text-[#166534]" : "bg-[#D97706]/10 text-[#B45309]"}`}>
                          {investment.status === "returned" ? "Returned" : "Active"}
                        </span>
                        <span className="text-[12px] text-[#0A2240]/45">{formatDate(investment.date)}</span>
                      </div>
                      <p className="text-[13.5px] font-medium text-[#0A2240]">{investment.title}</p>
                      <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{investment.investment_type}</p>
                      <p className="mt-0.5 text-[12px] text-[#0A2240]/55">
                        Invested {formatGHS(investment.amount_invested)} - Revenue {formatGHS(investment.revenue_made)}
                      </p>
                      {investment.return_date && <p className="mt-0.5 text-[12px] text-[#0A2240]/45">Returned {formatDate(investment.return_date)}</p>}
                      {investment.notes && <p className="mt-0.5 text-[12px] text-[#0A2240]/45">{investment.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {investment.status === "active" && <ReturnInvestmentButton id={investment.id} title={investment.title} />}
                      <DeleteInvestmentButton id={investment.id} title={investment.title} />
                    </div>
                  </li>
                ))}
                <li className="flex items-center justify-between bg-[#0033AA]/[0.03] px-5 py-4">
                  <span className="text-[13.5px] font-semibold text-[#0A2240]">Returned investment revenue</span>
                  <span className="text-[15px] font-bold tabular-nums text-[#15803D]">{formatGHS(returnedInvestmentRevenue)}</span>
                </li>
              </ul>
            </>
          )}
        </Card>
      </div>

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
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
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
