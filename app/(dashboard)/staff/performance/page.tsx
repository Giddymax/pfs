import { redirect } from "next/navigation";
import { ShieldCheck, Users, PiggyBank, Coins, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { formatGHS, round2 } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface StaffPerformanceRow {
  staff_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  clients_registered: number;
  savings_collected: number;
  susu_collected: number;
}

export default async function StaffPerformancePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: rows } = await supabase.rpc("staff_performance");

  const staff = (rows ?? []) as StaffPerformanceRow[];

  const totalClients  = staff.reduce((s, r) => s + Number(r.clients_registered), 0);
  const totalSavings  = round2(staff.reduce((s, r) => s + Number(r.savings_collected), 0));
  const totalSusu     = round2(staff.reduce((s, r) => s + Number(r.susu_collected), 0));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Staff performance"
        description="Track how much each staff member has contributed — clients registered, savings deposits collected, and daily susu contributions recorded."
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total clients registered"
          value={String(totalClients)}
          icon={<Users size={18} />}
          color="text-[#7C3AED]"
          bg="bg-[#7C3AED]/[0.05] border-[#7C3AED]/12"
        />
        <SummaryCard
          label="Total savings collected"
          value={formatGHS(totalSavings)}
          icon={<PiggyBank size={18} />}
          color="text-[#EA580C]"
          bg="bg-[#EA580C]/[0.05] border-[#EA580C]/12"
        />
        <SummaryCard
          label="Total susu collected"
          value={formatGHS(totalSusu)}
          icon={<Coins size={18} />}
          color="text-[#0284C7]"
          bg="bg-[#0284C7]/[0.05] border-[#0284C7]/12"
        />
      </div>

      {/* Performance table */}
      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Individual performance</h2>
          <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
            Sorted by most clients registered. Susu collected = sum of daily contributions recorded by each staff.
          </p>
        </div>

        {staff.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13.5px] text-[#0A2240]/40">
            No staff accounts found.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[#0033AA]/6 lg:hidden">
              {staff.map((member) => (
                <li key={member.staff_id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[#0033AA]/35">
                      <UserRound size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium text-[#0A2240]">
                        {member.full_name}
                        {member.role === "admin" && (
                          <ShieldCheck size={13} className="text-[#1D3461]" />
                        )}
                        {!member.is_active && (
                          <span className="rounded-full border border-[#0A2240]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#0A2240]/40">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-[#0A2240]/45">{member.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <StatCell label="Clients" value={String(member.clients_registered)} color="text-[#7C3AED]" />
                    <StatCell label="Savings" value={formatGHS(Number(member.savings_collected))} color="text-[#EA580C]" />
                    <StatCell label="Susu" value={formatGHS(Number(member.susu_collected))} color="text-[#0284C7]" />
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="admin-table-wrap hidden lg:block">
              <table className="w-full min-w-[700px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                    <th className="px-5 py-3 font-semibold">Staff member</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 text-right font-semibold">Clients registered</th>
                    <th className="px-5 py-3 text-right font-semibold">Savings collected</th>
                    <th className="px-5 py-3 text-right font-semibold">Susu collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0033AA]/6">
                  {staff.map((member) => (
                    <tr
                      key={member.staff_id}
                      className={`transition-colors hover:bg-[#0033AA]/[0.02] ${!member.is_active ? "opacity-55" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[#0033AA]/30">
                            <UserRound size={15} />
                          </span>
                          <span>
                            <span className="block text-[13.5px] font-medium text-[#0A2240]">{member.full_name}</span>
                            <span className="block text-[12px] text-[#0A2240]/45">{member.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#0A2240]/65">
                          {member.role === "admin" && <ShieldCheck size={13} className="text-[#1D3461]" />}
                          {member.role === "admin" ? "Administrator" : "Staff"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[15px] font-semibold tabular-nums text-[#7C3AED]">
                          {member.clients_registered}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[14px] font-semibold tabular-nums text-[#EA580C]">
                          {formatGHS(Number(member.savings_collected))}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[14px] font-semibold tabular-nums text-[#0284C7]">
                          {formatGHS(Number(member.susu_collected))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr className="border-t-2 border-[#0033AA]/10 bg-[#0033AA]/[0.03]">
                    <td colSpan={2} className="px-5 py-3 text-[12.5px] font-semibold text-[#0A2240]/55">
                      Total across {staff.length} staff member{staff.length === 1 ? "" : "s"}
                    </td>
                    <td className="px-5 py-3 text-right text-[15px] font-bold tabular-nums text-[#7C3AED]">
                      {totalClients}
                    </td>
                    <td className="px-5 py-3 text-right text-[14px] font-bold tabular-nums text-[#EA580C]">
                      {formatGHS(totalSavings)}
                    </td>
                    <td className="px-5 py-3 text-right text-[14px] font-bold tabular-nums text-[#0284C7]">
                      {formatGHS(totalSusu)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  label, value, icon, color, bg,
}: {
  label: string; value: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${bg}`}>
      <span className={`${color} opacity-70`}>{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/45">{label}</p>
        <p className={`mt-0.5 text-[22px] font-bold tabular-nums ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-[#0A2240]/[0.025] px-2 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/40">{label}</p>
      <p className={`mt-0.5 text-[13px] font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
