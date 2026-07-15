import Link from "next/link";
import { CalendarClock, HandCoins, Landmark, Coins, AlertTriangle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { DisburseInterestButton } from "@/components/disburse-interest-button";
import { formatGHS } from "@/lib/loan";
import { INTEREST_MIN_BALANCE, INTEREST_PERIOD_END, INTEREST_PERIOD_START, isInterestWindowElapsed } from "@/lib/interest";
import type { Client, FixedDeposit, Loan, SusuCycle } from "@/lib/types";

type LoanRow = Loan & { client: Client };
type FdRow = FixedDeposit & { client: Client };
type SusuRow = SusuCycle & {
  account: { account_number: string; client: Client };
  maxDay: number;
};

type EventItem =
  | { kind: "loan"; date: Date; daysOut: number; data: LoanRow }
  | { kind: "fd"; date: Date; daysOut: number; data: FdRow }
  | { kind: "susu"; daysOut: number; data: SusuRow };

interface InterestEligibleRow {
  account_id: string;
  client_id: string;
  client_full_name: string;
  client_code: string;
  account_number: string;
  product_type: "savings" | "susu";
  reference_balance: number;
}

function daysFromNow(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DaysBadge({ days, red }: { days: number; red?: boolean }) {
  if (days < 0) return <span className="rounded-full border border-[#B91C1C]/20 bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#B91C1C]">Overdue {Math.abs(days)}d</span>;
  if (days === 0) return <span className="rounded-full border border-[#D97706]/25 bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#D97706]">Today</span>;
  if (days <= 7) return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${red ? "border-[#DC2626]/20 bg-[#FEF2F2] text-[#DC2626]" : "border-[#D97706]/25 bg-[#FFFBEB] text-[#D97706]"}`}>{days}d left</span>;
  return <span className="rounded-full border border-[#0033AA]/15 bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-medium text-[#0033AA]">{days}d left</span>;
}

export default async function UpcomingPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Interest-eligible clients: savings/susu accounts whose balance as of the
  // end of the qualifying window exceeded the threshold, only surfaced once
  // that window has fully elapsed. Excludes accounts already paid for this round.
  let interestEligible: InterestEligibleRow[] = [];
  if (isInterestWindowElapsed(today)) {
    const { data } = await supabase.rpc("list_interest_eligible_accounts", {
      p_min_balance: INTEREST_MIN_BALANCE,
      p_period_start: INTEREST_PERIOD_START,
      p_period_end: INTEREST_PERIOD_END,
    });
    interestEligible = (data ?? []) as InterestEligibleRow[];
  }

  const [{ data: loanRows }, { data: fdRows }, { data: cycleRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from("loans")
      .select("*, client:clients(*)")
      .eq("status", "active")
      .lte("due_date", in30)
      .order("due_date", { ascending: true })
      .returns<LoanRow[]>(),
    supabase
      .from("fixed_deposits")
      .select("*, client:clients(*)")
      .in("status", ["active", "matured"])
      .lte("maturity_date", in30)
      .gte("maturity_date", today)
      .order("maturity_date", { ascending: true })
      .returns<FdRow[]>(),
    supabase
      .from("susu_cycles")
      .select("*, account:accounts(account_number, client:clients(*))")
      .eq("status", "in_progress")
      .returns<(SusuCycle & { account: { account_number: string; client: Client } })[]>(),
    supabase
      .from("susu_payments")
      .select("cycle_id, day_in_cycle")
      .order("day_in_cycle", { ascending: false }),
  ]);

  // Build max day per cycle
  const maxDayByCycle = new Map<string, number>();
  for (const p of paymentRows ?? []) {
    const cur = maxDayByCycle.get(p.cycle_id) ?? 0;
    if (p.day_in_cycle > cur) maxDayByCycle.set(p.cycle_id, p.day_in_cycle);
  }

  const susuEvents: SusuRow[] = (cycleRows ?? [])
    .map((c) => ({ ...c, maxDay: maxDayByCycle.get(c.id) ?? 0 }))
    .filter((c) => c.maxDay >= 25); // within 6 days of completion

  // Merge into sorted event list
  const events: EventItem[] = [
    ...(loanRows ?? []).map((l): EventItem => {
      const days = daysFromNow(l.due_date!);
      return { kind: "loan", date: new Date(l.due_date!), daysOut: days, data: l };
    }),
    ...(fdRows ?? []).map((f): EventItem => {
      const days = daysFromNow(f.maturity_date);
      return { kind: "fd", date: new Date(f.maturity_date), daysOut: days, data: f };
    }),
    ...susuEvents.map((s): EventItem => ({
      kind: "susu",
      daysOut: 31 - s.maxDay, // days until day-31
      data: s,
    })),
  ];

  events.sort((a, b) => {
    const da = "date" in a ? a.date.getTime() : Date.now() + a.daysOut * 86400000;
    const db = "date" in b ? b.date.getTime() : Date.now() + b.daysOut * 86400000;
    return da - db;
  });

  const overdue = events.filter((e) => e.kind === "loan" && e.daysOut < 0).length;
  const dueThisWeek = events.filter((e) => e.daysOut >= 0 && e.daysOut <= 7).length;

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Events"
        title="Upcoming Events"
        description="Loans due, fixed deposit maturities, and susu cycles completing in the next 30 days."
      />

      {/* Interest-eligible clients */}
      {interestEligible.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.03] shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#1F6E4A]/12 px-5 py-3.5">
            <Sparkles size={16} className="text-[#1F6E4A]" />
            <h2 className="text-[13.5px] font-semibold text-[#1F6E4A]">
              Eligible for interest ({interestEligible.length})
            </h2>
          </div>
          <p className="border-b border-[#1F6E4A]/10 px-5 py-2.5 text-[12px] text-[#0A2240]/50">
            Balance exceeded {formatGHS(INTEREST_MIN_BALANCE)} as of {new Date(INTEREST_PERIOD_END).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {" "}(end of the {new Date(INTEREST_PERIOD_START).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} qualifying window). The rate is flat and set manually per
            client below, applied to that balance — not today&rsquo;s balance.
          </p>
          <ul className="divide-y divide-[#1F6E4A]/8">
            {interestEligible.map((a) => (
              <li key={a.account_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <Link href={`/accounts/${a.account_id}`} className="text-[13.5px] font-semibold text-[#0A2240] hover:underline">
                    {a.client_full_name}
                  </Link>
                  <p className="text-[12px] text-[#0A2240]/45">
                    {a.account_number} · {a.product_type === "savings" ? "Savings" : "Daily Susu"} · Balance as of {fmtDate(INTEREST_PERIOD_END)}: {formatGHS(a.reference_balance)}
                  </p>
                </div>
                <DisburseInterestButton
                  accountId={a.account_id}
                  clientName={a.client_full_name}
                  accountNumber={a.account_number}
                  balance={a.reference_balance}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Chip label="Total events" value={events.length} color="blue" />
        {overdue > 0 && <Chip label="Overdue loans" value={overdue} color="red" />}
        {dueThisWeek > 0 && <Chip label="Due this week" value={dueThisWeek} color="amber" />}
        <Chip label="Loans due" value={events.filter((e) => e.kind === "loan").length} color="pink" />
        <Chip label="FD maturities" value={events.filter((e) => e.kind === "fd").length} color="purple" />
        <Chip label="Susu nearing day 31" value={susuEvents.length} color="teal" />
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#0A2240]/8 bg-white py-20 text-center shadow-sm">
          <CalendarClock size={36} className="mb-4 text-[#0033AA]/25" />
          <p className="text-[15px] font-medium text-[#0A2240]/60">No upcoming events in the next 30 days</p>
          <p className="mt-1 text-[13px] text-[#0A2240]/35">Check back as loans, deposits, and susu cycles near their dates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, i) => {
            if (event.kind === "loan") {
              const l = event.data;
              const isOverdue = event.daysOut < 0;
              return (
                <Link
                  key={`loan-${l.id}`}
                  href={`/loans/${l.id}`}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-5 py-4 shadow-sm transition-colors hover:bg-[#0033AA]/[0.02] ${isOverdue ? "border-[#B91C1C]/20 bg-[#FEF9F9]" : "border-[#0A2240]/8 bg-white"}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOverdue ? "bg-[#B91C1C]/10" : "bg-[#DB2777]/10"}`}>
                    {isOverdue ? <AlertTriangle size={17} className="text-[#B91C1C]" /> : <HandCoins size={17} className="text-[#DB2777]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-[#0A2240]">
                      {l.client.full_name}
                      <span className="ml-2 text-[11.5px] font-normal text-[#0A2240]/45">{l.loan_code}</span>
                    </p>
                    <p className="text-[12px] text-[#0A2240]/45">
                      Loan due {fmtDate(l.due_date!)} · {formatGHS(l.current_balance ?? 0)} remaining
                    </p>
                  </div>
                  <DaysBadge days={event.daysOut} red={isOverdue} />
                </Link>
              );
            }

            if (event.kind === "fd") {
              const f = event.data;
              return (
                <Link
                  key={`fd-${f.id}`}
                  href={`/fixed-deposits`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0A2240]/8 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-[#0033AA]/[0.02]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED]/10">
                    <Landmark size={17} className="text-[#7C3AED]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-[#0A2240]">
                      {f.client.full_name}
                      <span className="ml-2 text-[11.5px] font-normal text-[#0A2240]/45">{f.fd_number}</span>
                    </p>
                    <p className="text-[12px] text-[#0A2240]/45">
                      FD matures {fmtDate(f.maturity_date)} · {formatGHS(f.principal)} @ {f.annual_rate_percent}% p.a.
                    </p>
                  </div>
                  <DaysBadge days={event.daysOut} />
                </Link>
              );
            }

            // susu
            const s = event.data;
            const pct = Math.round((s.maxDay / 31) * 100);
            return (
              <Link
                key={`susu-${s.id}`}
                href={`/accounts/${s.account_id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#0A2240]/8 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-[#0033AA]/[0.02]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0891B2]/10">
                  <Coins size={17} className="text-[#0891B2]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#0A2240]">
                    {s.account.client.full_name}
                    <span className="ml-2 text-[11.5px] font-normal text-[#0A2240]/45">{s.account.account_number}</span>
                  </p>
                  <p className="text-[12px] text-[#0A2240]/45">
                    Susu cycle {s.cycle_number} · day {s.maxDay} of 31 · {formatGHS(s.total_collected)} collected
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#0891B2]/15">
                      <div className="h-full rounded-full bg-[#0891B2]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10.5px] text-[#0A2240]/45">{pct}%</span>
                  </div>
                  <DaysBadge days={event.daysOut} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: "blue" | "red" | "amber" | "pink" | "purple" | "teal" }) {
  const styles = {
    blue: "border-[#0033AA]/20 bg-[#EFF6FF] text-[#0033AA]",
    red: "border-[#B91C1C]/20 bg-[#FEF2F2] text-[#B91C1C]",
    amber: "border-[#D97706]/25 bg-[#FFFBEB] text-[#92400E]",
    pink: "border-[#DB2777]/20 bg-[#FDF2F8] text-[#9D174D]",
    purple: "border-[#7C3AED]/20 bg-[#F5F3FF] text-[#5B21B6]",
    teal: "border-[#0891B2]/20 bg-[#ECFEFF] text-[#0E7490]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium ${styles[color]}`}>
      <span className="text-[14px] font-bold tabular-nums">{value}</span>
      {label}
    </span>
  );
}
