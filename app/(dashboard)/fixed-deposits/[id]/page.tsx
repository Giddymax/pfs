import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Banknote, CalendarDays, Landmark, Percent, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { FdEarlyWithdrawalActions } from "@/components/fd-early-withdrawal-actions";
import { FdMaturityPayoutButton } from "@/components/fd-maturity-payout-button";
import { FdRolloverForm } from "@/components/fd-rollover-form";
import { formatGHS } from "@/lib/loan";
import type { Client, FdEvent, FdStatus, FixedDeposit, Profile } from "@/lib/types";

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
  matured: "Matured — ready to pay out or roll over",
  pending_early: "Early withdrawal pending admin review",
  approved_early: "Early withdrawal approved — ready to pay out",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over into a new deposit",
};

const FD_EVENT_LABEL: Record<FdEvent["event_type"], string> = {
  early_withdrawal_requested: "Early withdrawal requested",
  early_withdrawal_approved: "Early withdrawal approved",
  early_withdrawal_rejected: "Early withdrawal rejected",
  matured_paid_out: "Interest paid out",
  rollover_requested: "Rollover requested",
  rollover_completed: "Rollover completed",
};

export default async function FixedDepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  await supabase.rpc("sync_matured_fds");

  const [{ data: fd }, { data: events }, { data: profile }] = await Promise.all([
    supabase.from("fixed_deposits").select("*, client:clients(*)").eq("id", id).single<FixedDeposit & { client: Client }>(),
    supabase.from("fd_events").select("*").eq("fd_id", id).order("created_at", { ascending: false }).returns<FdEvent[]>(),
    getCurrentProfile(supabase),
  ]);

  if (!fd) notFound();

  const isAdmin = profile?.role === "admin";
  const isStaffOrAdmin = profile?.role === "admin" || profile?.role === "staff";
  const allEvents = events ?? [];

  const [{ data: rolledInto }, { data: rolledFrom }] = await Promise.all([
    fd.rolled_into_fd_id
      ? supabase.from("fixed_deposits").select("id, fd_number").eq("id", fd.rolled_into_fd_id).maybeSingle<Pick<FixedDeposit, "id" | "fd_number">>()
      : Promise.resolve({ data: null }),
    fd.rolled_from_fd_id
      ? supabase.from("fixed_deposits").select("id, fd_number").eq("id", fd.rolled_from_fd_id).maybeSingle<Pick<FixedDeposit, "id" | "fd_number">>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Fixed deposit account"
        title={fd.fd_number}
        description={`Opened ${formatDate(fd.start_date)} · ${fd.client.full_name}`}
        action={
          isStaffOrAdmin && (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {(fd.status === "active" || fd.status === "pending_early" || fd.status === "approved_early") && (
                <FdEarlyWithdrawalActions fdId={fd.id} status={fd.status} isAdmin={isAdmin} />
              )}
              {fd.status === "matured" && (
                <>
                  <FdMaturityPayoutButton fdId={fd.id} expectedPayout={fd.expected_payout} />
                  <FdRolloverForm fdId={fd.id} currentTermMonths={fd.term_months} currentRate={fd.annual_rate_percent} />
                </>
              )}
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Principal" value={formatGHS(fd.principal)} icon={<Landmark size={16} />} />
        <StatCard label="Expected interest" value={formatGHS(fd.expected_interest)} icon={<Percent size={16} />} />
        <StatCard label="Expected payout" value={formatGHS(fd.expected_payout)} icon={<Banknote size={16} />} />
        <StatCard label="Maturity date" value={formatDate(fd.maturity_date)} icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">Status</p>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${FD_STATUS_STYLE[fd.status]}`}>
              {FD_STATUS_LABEL[fd.status]}
            </span>
          </div>

          <Link
            href={`/clients/${fd.client.id}`}
            className="mb-5 flex items-center gap-3 rounded-lg border border-[#0033AA]/8 bg-[#0033AA]/[0.025] px-3.5 py-3 transition-colors hover:bg-[#0033AA]/[0.05]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-white text-[12px] font-semibold text-[#0033AA]">
              {fd.client.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fd.client.photo_url} alt={fd.client.full_name} className="h-full w-full object-cover" />
              ) : (
                <UserRound size={18} className="text-[#0033AA]/30" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#0A2240]">{fd.client.full_name}</span>
              <span className="block text-[12px] text-[#0A2240]/45">
                {fd.client.client_code} · {fd.client.phone}
              </span>
            </span>
            <ArrowUpRight size={15} className="shrink-0 text-[#0033AA]/30" />
          </Link>

          <dl className="space-y-4 text-[13.5px]">
            <DetailRow label="Term" value={`${fd.term_months} months @ ${fd.annual_rate_percent}% p.a.`} />
            <DetailRow label="Start date" value={formatDate(fd.start_date)} />
            <DetailRow label="Maturity date" value={formatDate(fd.maturity_date)} />
            {(fd.status === "active" || fd.status === "pending_early" || fd.status === "approved_early") && (
              <DetailRow label="Early withdrawal" value="Forfeits all accrued interest — payout is principal only" />
            )}
            {rolledFrom && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Rolled over from</p>
                <Link href={`/fixed-deposits/${rolledFrom.id}`} className="text-[#0033AA] hover:underline">
                  {rolledFrom.fd_number}
                </Link>
              </div>
            )}
            {rolledInto && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">Rolled into</p>
                <Link href={`/fixed-deposits/${rolledInto.id}`} className="text-[#0033AA] hover:underline">
                  {rolledInto.fd_number}
                </Link>
              </div>
            )}
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Lifecycle history</h2>
            <span className="text-[12.5px] text-[#0A2240]/45">
              {allEvents.length} event{allEvents.length === 1 ? "" : "s"}
            </span>
          </div>

          {allEvents.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState title="No lifecycle events yet" description="Early-withdrawal requests, payouts and rollovers on this deposit will appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {allEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#0A2240]">{FD_EVENT_LABEL[event.event_type]}</p>
                    <p className="truncate text-[12px] text-[#0A2240]/45">
                      {formatDateTime(event.created_at)}
                      {event.amount != null ? ` · ${formatGHS(event.amount)}` : ""}
                      {event.notes ? ` · ${event.notes}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
      <p className="text-[#0A2240]">{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
