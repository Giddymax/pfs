import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Client, FdStatus, FixedDeposit } from "@/lib/types";

const FD_STATUS_STYLE: Record<FdStatus, string> = {
  active: "border-[#0062E1]/20 bg-[#0062E1]/[0.06] text-[#0A4DA6]",
  matured: "border-[#B58A2A]/25 bg-[#B58A2A]/[0.08] text-[#8A6A1F]",
  pending_early: "border-[#B58A2A]/25 bg-[#B58A2A]/[0.08] text-[#8A6A1F]",
  approved_early: "border-[#0062E1]/20 bg-[#0062E1]/[0.06] text-[#0A4DA6]",
  withdrawn: "border-[#0A2240]/15 bg-[#0A2240]/[0.04] text-[#0A2240]/55",
  rolled_over: "border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.06] text-[#1F6E4A]",
};

const FD_STATUS_LABEL: Record<FdStatus, string> = {
  active: "Active",
  matured: "Matured",
  pending_early: "Early withdrawal pending",
  approved_early: "Early withdrawal approved",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over",
};

export default async function FixedDepositsPage() {
  const supabase = await createClient();

  await supabase.rpc("sync_matured_fds");

  const { data: deposits } = await supabase
    .from("fixed_deposits")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false })
    .returns<(FixedDeposit & { client: Client })[]>();

  const rows = deposits ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Fixed Deposit accounts"
        description="Lump-sum term placements with maturity, early-withdrawal and rollover lifecycles."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No fixed deposits yet"
          description="Fixed deposits are opened from a client's registration form — choose this account type there."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#0033AA]/8 bg-white shadow-sm">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">FD number</th>
                <th className="px-5 py-3 font-semibold">Principal · term</th>
                <th className="px-5 py-3 font-semibold">Maturity</th>
                <th className="px-5 py-3 font-semibold">Expected payout</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0033AA]/6">
              {rows.map((fd) => (
                <tr key={fd.id} className="transition-colors hover:bg-[#0033AA]/[0.025]">
                  <td className="px-5 py-3.5">
                    {fd.client ? (
                      <Link href={`/clients/${fd.client.id}`} className="font-medium text-[#0A2240] hover:text-[#0033AA]">
                        {fd.client.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">
                    <Link href={`/fixed-deposits/${fd.id}`} className="font-medium text-[#0033AA] hover:underline">
                      {fd.fd_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">
                    {formatGHS(fd.principal)} · {fd.term_months}mo @ {fd.annual_rate_percent}%
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{formatDate(fd.maturity_date)}</td>
                  <td className="px-5 py-3.5 text-[#0A2240]/75">{formatGHS(fd.expected_payout)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${FD_STATUS_STYLE[fd.status]}`}>
                      {FD_STATUS_LABEL[fd.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
