import Link from "next/link";
import { ArrowLeftRight, Coins, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeTelecomSummary } from "@/lib/finance/telecom-summary";
import { TelecomStatCard } from "@/components/telecom-stat-card";
import { TelecomTypeBadge } from "@/components/telecom-type-badge";
import { PrintTelecomOverviewButton } from "@/components/print-telecom-overview-button";
import { PageHeader, Card } from "@/components/ui";
import { getSettings } from "@/lib/settings/cache";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

// Telecom's own Overview — entirely self-contained. Every figure here comes
// from computeTelecomSummary() (lib/finance/telecom-summary.ts) and only from
// there; nothing on this page is ever pulled from
// lib/finance/account-summary.ts or any PFS table — see
// telecom-mini-app-brief.md §7.
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TelecomOverviewPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [todaySummary, allTimeSummary, { data: { user } }, settings] = await Promise.all([
    computeTelecomSummary(supabase, { from: today, to: today }),
    computeTelecomSummary(supabase),
    supabase.auth.getUser(),
    getSettings(),
  ]);

  let viewerName: string | null = null;
  if (user) {
    const { data: viewerProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single<Pick<Profile, "full_name">>();
    viewerName = viewerProfile?.full_name ?? null;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Telecom"
        title="Overview"
        description="Today's walk-in mobile-money transactions — cash in, cash out, deposits, airtime, data bundles, and mashups."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PrintTelecomOverviewButton
              todayCount={todaySummary.transactionCount}
              todayAmount={todaySummary.totalAmount}
              todayCharge={todaySummary.totalCharge}
              allTimeCharge={allTimeSummary.totalCharge}
              allTimeCount={allTimeSummary.transactionCount}
              byType={todaySummary.byType}
              printedBy={viewerName}
              companyPhone={settings.sms.company_tel ?? null}
            />
            <Link
              href="/telecom/transactions"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#172554]"
            >
              <ArrowLeftRight size={13} />
              View transactions
            </Link>
          </div>
        }
      />

      {/* Today's headline figures */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TelecomStatCard
          label="Transactions today"
          value={String(todaySummary.transactionCount)}
          icon={<ArrowLeftRight size={16} />}
          tone="blue"
        />
        <TelecomStatCard
          label="Amount moved today"
          value={formatGHS(todaySummary.totalAmount)}
          icon={<Receipt size={16} />}
          tone="green"
        />
        <TelecomStatCard
          label="Charges collected today"
          value={formatGHS(todaySummary.totalCharge)}
          icon={<Coins size={16} />}
          tone="yellow"
        />
        <TelecomStatCard
          label="All-time charges collected"
          value={formatGHS(allTimeSummary.totalCharge)}
          icon={<Receipt size={16} />}
          tone="blue"
        />
      </div>

      {/* Per-type breakdown, today */}
      <Card>
        <div className="border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Today, by type</h2>
          <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
            How many of each transaction type were recorded today, how much moved through them, and what was
            charged for them.
          </p>
        </div>
        <div className="admin-table-wrap">
          <table className="w-full min-w-[600px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#1A1A1A]/8 bg-[#1A1A1A]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 text-right font-semibold">Count</th>
                <th className="px-5 py-3 text-right font-semibold">Amount moved</th>
                <th className="px-5 py-3 text-right font-semibold">Charges collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/6">
              {todaySummary.byType.map((row) => (
                <tr key={row.type} className="transition-colors hover:bg-[#1A1A1A]/[0.02]">
                  <td className="px-5 py-3.5">
                    <TelecomTypeBadge type={row.type} />
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] tabular-nums text-[#0A2240]/75">{row.count}</td>
                  <td className="px-5 py-3.5 text-right text-[14px] tabular-nums text-[#0A2240]/75">
                    {formatGHS(row.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#1A1A1A]">
                    {formatGHS(row.charge)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
