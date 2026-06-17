import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { TableFilter, type FilterOption } from "@/components/table-filter";
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
  pending_early: "Early w/d pending",
  approved_early: "Early w/d approved",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over",
};

const STATUS_OPTIONS: FilterOption[] = (Object.keys(FD_STATUS_LABEL) as FdStatus[]).map((k) => ({
  value: k,
  label: FD_STATUS_LABEL[k],
}));

export default async function FixedDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

  await supabase.rpc("sync_matured_fds");

  const qs = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
  }).toString();

  let query = supabase
    .from("fixed_deposits")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  if (q?.trim()) {
    const term = q.trim();
    const { data: matchedClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("full_name", `%${term}%`);
    const cids = (matchedClients ?? []).map((c: { id: string }) => c.id);
    if (cids.length > 0) {
      query = query.or(`fd_number.ilike.%${term}%,client_id.in.(${cids.join(",")})`);
    } else {
      query = query.ilike("fd_number", `%${term}%`);
    }
  }

  const { data: deposits } = await query.returns<(FixedDeposit & { client: Client })[]>();
  const rows = deposits ?? [];

  const hasSearch = !!q?.trim();
  const hasFilter = !!status;

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Fixed Deposit accounts"
        description="Lump-sum term placements with maturity, early-withdrawal and rollover lifecycles."
      />

      {/* Search */}
      <form className="mb-4 max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1D3461]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by FD number or client name…"
            className="w-full rounded-md border border-[#1D3461]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-[#0A2240]/35 focus:border-[#2CBFBF]"
          />
        </div>
      </form>

      {/* Mobile filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3 lg:hidden">
        <span className="text-[11.5px] font-medium text-[#0A2240]/40">Filter:</span>
        <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={hasSearch || hasFilter ? "No fixed deposits match your search" : "No fixed deposits yet"}
          description={
            hasSearch || hasFilter
              ? "Try adjusting your search term or status filter."
              : "Fixed deposits are opened from a client's registration form — choose this account type there."
          }
        />
      ) : (
        <>
          {/* ── Mobile card list (hidden on lg+) ─────────────────────── */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((fd) => (
              <li key={fd.id} className="rounded-xl border border-[#1D3461]/8 bg-white shadow-sm">
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/fixed-deposits/${fd.id}`}
                      className="text-[14px] font-semibold text-[#1D3461] hover:underline"
                    >
                      {fd.fd_number}
                    </Link>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium ${FD_STATUS_STYLE[fd.status]}`}>
                      {FD_STATUS_LABEL[fd.status]}
                    </span>
                  </div>
                  {fd.client && (
                    <Link
                      href={`/clients/${fd.client.id}`}
                      className="mt-0.5 block truncate text-[13px] text-[#0A2240]/65 hover:text-[#1D3461]"
                    >
                      {fd.client.full_name}
                    </Link>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#0A2240]/55">
                    <span>{formatGHS(fd.principal)} · {fd.term_months}mo @ {fd.annual_rate_percent}%</span>
                    <span className="font-medium text-[#0A2240]">Payout {formatGHS(fd.expected_payout)}</span>
                    <span>Matures {formatDate(fd.maturity_date)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ── Desktop table (hidden on mobile) ─────────────────────── */}
          <div className="hidden overflow-hidden rounded-xl border border-[#1D3461]/8 bg-white shadow-sm lg:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">FD number</th>
                  <th className="px-5 py-3 font-semibold">Principal · term</th>
                  <th className="px-5 py-3 font-semibold">Maturity</th>
                  <th className="px-5 py-3 font-semibold">Expected payout</th>
                  <th aria-label="Status" className="px-5 py-3 font-semibold">
                    <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {rows.map((fd) => (
                  <tr key={fd.id} className="transition-colors hover:bg-[#1D3461]/[0.025]">
                    <td className="px-5 py-3.5">
                      {fd.client ? (
                        <Link href={`/clients/${fd.client.id}`} className="font-medium text-[#0A2240] hover:text-[#1D3461]">
                          {fd.client.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#0A2240]/55">
                      <Link href={`/fixed-deposits/${fd.id}`} className="font-medium text-[#1D3461] hover:underline">
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
        </>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
