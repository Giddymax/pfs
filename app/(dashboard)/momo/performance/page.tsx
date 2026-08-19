import { redirect } from "next/navigation";
import { ShieldCheck, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeMomoStaffPerformance } from "@/lib/finance/momo-summary";
import { MOMO_TYPES } from "@/lib/momo/types";
import { MomoStatCard } from "@/components/momo-stat-card";
import { SummaryControls } from "@/components/summary-controls";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintMomoPerformanceButton } from "@/components/print-momo-performance-button";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { getSettings } from "@/lib/settings/cache";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Admin-only within MoMo — seeing every staff member's collected charges is
// a management view, not everyday work (see components/sidebar.tsx's
// MOMO_NAV comment). Deliberately its own page, not PFS's staff_performance
// RPC/page — see momo-mini-app-brief.md §7.
export default async function MomoPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/momo");
  if (profile.restricted_pages?.includes("momo_performance")) redirect("/momo");

  const params = await searchParams;
  const from = params.from ?? monthStartISO();
  const to = params.to ?? todayISO();

  const [rows, settings] = await Promise.all([
    computeMomoStaffPerformance(supabase, { from, to }),
    getSettings(),
  ]);

  const staffWithActivity = rows.filter((r) => r.transactionCount > 0).length;
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalCharge = rows.reduce((s, r) => s + r.totalCharge, 0);

  return (
    <div>
      <PageHeader
        eyebrow="MoMo"
        title="Performance"
        description="How much each staff member and admin moved through MoMo, by transaction type, and how much they collected in charges."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PrintMomoPerformanceButton
              rows={rows}
              from={from}
              to={to}
              staffWithActivity={staffWithActivity}
              totalAmount={totalAmount}
              totalCharge={totalCharge}
              printedBy={profile.full_name}
              companyPhone={settings.sms.company_tel ?? null}
            />
            <ExportCsvButton
              endpoint="/api/momo/performance/export"
              filename={`momo-performance-${from}-to-${to}.xlsx`}
              label="Export Excel"
              params={{ from, to }}
            />
          </div>
        }
      />

      {/* Date controls */}
      <div className="mb-6">
        <SummaryControls from={from} to={to} preset={params.preset ?? "this_month"} />
      </div>

      {/* Period band */}
      <div className="mb-6 rounded-lg border border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.03] px-5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A1A1A]/50">Period</p>
        <p className="mt-0.5 text-[15px] font-semibold text-[#0A2240]">{fmtDate(from)} — {fmtDate(to)}</p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MomoStatCard label="Staff with activity" value={String(staffWithActivity)} icon={<Users size={16} />} tone="blue" />
        <MomoStatCard label="Total amount moved" value={formatGHS(totalAmount)} tone="green" />
        <MomoStatCard label="Total charges collected" value={formatGHS(totalCharge)} tone="yellow" />
      </div>

      <Card>
        <div className="border-b border-[#1A1A1A]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Individual performance</h2>
          <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
            Every staff/admin account, sorted by the most GHS moved through MoMo in this period — real amounts,
            not a transaction count.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState title="No staff accounts found" />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[#1A1A1A]/6 lg:hidden">
              {rows.map((r) => (
                <li key={r.staffId ?? "unattributed"} className={`px-5 py-4 ${!r.isActive ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1A1A1A]/10 bg-[#1A1A1A]/5 text-[#1A1A1A]/35">
                      <UserRound size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium text-[#0A2240]">
                        {r.fullName}
                        {r.role === "admin" && <ShieldCheck size={13} className="text-[#1E3A8A]" />}
                        {r.staffId && !r.isActive && (
                          <span className="rounded-full border border-[#0A2240]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#0A2240]/40">
                            Inactive
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold tabular-nums text-[#1A1A1A]">{formatGHS(r.totalAmount)}</p>
                      <p className="text-[11px] tabular-nums text-[#0A2240]/45">charge {formatGHS(r.totalCharge)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {MOMO_TYPES.map((t) => (
                      <div key={t.value} className="rounded-lg bg-[#1A1A1A]/[0.025] px-2 py-2">
                        <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#0A2240]/40">{t.label}</p>
                        <p className="mt-0.5 text-[13px] font-bold tabular-nums text-[#0A2240]">{formatGHS(r.byType[t.value])}</p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="admin-table-wrap hidden lg:block">
              <table className="w-full min-w-[1000px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#1A1A1A]/8 bg-[#1A1A1A]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                    <th className="px-5 py-3 font-semibold">Staff member</th>
                    {MOMO_TYPES.map((t) => (
                      <th key={t.value} className="px-3 py-3 text-right font-semibold">{t.label}</th>
                    ))}
                    <th className="px-5 py-3 text-right font-semibold">Total amount</th>
                    <th className="px-5 py-3 text-right font-semibold">Charges collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/6">
                  {rows.map((r) => (
                    <tr
                      key={r.staffId ?? "unattributed"}
                      className={`transition-colors hover:bg-[#1A1A1A]/[0.02] ${!r.isActive ? "opacity-60" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1A1A1A]/10 bg-[#1A1A1A]/5 text-[#1A1A1A]/30">
                            <UserRound size={15} />
                          </span>
                          <span>
                            <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#0A2240]">
                              {r.fullName}
                              {r.role === "admin" && <ShieldCheck size={13} className="text-[#1E3A8A]" />}
                            </span>
                            {r.staffId && !r.isActive && (
                              <span className="text-[11px] text-[#0A2240]/40">Deactivated</span>
                            )}
                          </span>
                        </span>
                      </td>
                      {MOMO_TYPES.map((t) => (
                        <td key={t.value} className="px-3 py-3.5 text-right tabular-nums text-[#0A2240]/70">
                          {formatGHS(r.byType[t.value])}
                        </td>
                      ))}
                      <td className="px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#1A1A1A]">
                        {formatGHS(r.totalAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[14px] font-semibold tabular-nums text-[#1A1A1A]">
                        {formatGHS(r.totalCharge)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
