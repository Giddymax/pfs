import Link from "next/link";
import { ArrowLeftRight, Coins, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeMomoSummary } from "@/lib/finance/momo-summary";
import { MomoStatCard } from "@/components/momo-stat-card";
import { MomoTypeBadge } from "@/components/momo-type-badge";
import { PageHeader, Card } from "@/components/ui";
import { formatGHS } from "@/lib/loan";

// MoMo's own Overview — entirely self-contained. Every figure here comes
// from computeMomoSummary() (lib/finance/momo-summary.ts) and only from
// there; nothing on this page is ever pulled from
// lib/finance/account-summary.ts or any PFS table — see
// momo-mini-app-brief.md §7.
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MomoOverviewPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [todaySummary, allTimeSummary] = await Promise.all([
    computeMomoSummary(supabase, { from: today, to: today }),
    computeMomoSummary(supabase),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="MoMo"
        title="Overview"
        description="Today's walk-in mobile-money transactions — cash in, cash out, deposits, airtime, data bundles, and mashups."
        action={
          <Link
            href="/momo/transactions"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-3.5 py-2 text-[12.5px] font-semibold text-[#FFC72C] transition-colors hover:bg-[#000000]"
          >
            <ArrowLeftRight size={13} />
            View transactions
          </Link>
        }
      />

      {/* Today's headline figures */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MomoStatCard
          label="Transactions today"
          value={String(todaySummary.transactionCount)}
          icon={<ArrowLeftRight size={16} />}
        />
        <MomoStatCard
          label="Charges collected today"
          value={formatGHS(todaySummary.totalCharge)}
          hint="MoMo revenue — never part of PFS's Total Revenue"
          icon={<Coins size={16} />}
          emphasis
        />
        <MomoStatCard
          label="All-time charges collected"
          value={formatGHS(allTimeSummary.totalCharge)}
          hint={`${allTimeSummary.transactionCount} transaction${allTimeSummary.transactionCount === 1 ? "" : "s"} total`}
          icon={<Receipt size={16} />}
        />
      </div>

      {/* Per-type breakdown, today */}
      <Card>
        <div className="border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Today, by type</h2>
          <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
            How many of each transaction type were recorded today, and what was charged for them.
          </p>
        </div>
        <div className="admin-table-wrap">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#1A1A1A]/8 bg-[#1A1A1A]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 text-right font-semibold">Count</th>
                <th className="px-5 py-3 text-right font-semibold">Charges collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/6">
              {todaySummary.byType.map((row) => (
                <tr key={row.type} className="transition-colors hover:bg-[#1A1A1A]/[0.02]">
                  <td className="px-5 py-3.5">
                    <MomoTypeBadge type={row.type} />
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] tabular-nums text-[#0A2240]/75">{row.count}</td>
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
