import Link from "next/link";
import { Users, HandCoins, Wallet, AlertCircle, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Card, LoanStatusBadge, EmptyState } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Loan, Client } from "@/lib/types";

export default async function OverviewPage() {
  const supabase = await createClient();

  const [{ count: clientCount }, { data: loans }, { data: recentClients }] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("loans")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false })
      .returns<Loan[]>(),
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<Client[]>(),
  ]);

  const allLoans = loans ?? [];
  const activeLoans = allLoans.filter((l) => l.status === "active");
  const pendingLoans = allLoans.filter((l) => l.status === "pending");
  const principalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.total_repayable), 0);
  const portfolioDisbursed = allLoans
    .filter((l) => ["active", "completed"].includes(l.status))
    .reduce((sum, l) => sum + Number(l.principal), 0);

  const recentLoans = allLoans.slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Good to see you back"
        description="A snapshot of clients, active loans and what needs attention today."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered clients" value={String(clientCount ?? 0)} icon={<Users size={16} />} hint="Across all branches" />
        <StatCard label="Active loans" value={String(activeLoans.length)} icon={<HandCoins size={16} />} hint={`${pendingLoans.length} awaiting disbursement`} />
        <StatCard label="Principal disbursed" value={formatGHS(portfolioDisbursed)} icon={<Wallet size={16} />} hint="Active + completed loans" />
        <StatCard label="Outstanding repayable" value={formatGHS(principalOutstanding)} icon={<AlertCircle size={16} />} hint="Across active loans" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Recent loans</h2>
            <Link href="/loans" className="flex items-center gap-1 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState title="No loans yet" description="Loans you issue will show up here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {recentLoans.map((loan) => (
                <li key={loan.id}>
                  <Link
                    href={`/loans/${loan.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[#0033AA]/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#0A2240]">
                        {loan.client?.full_name ?? "—"}
                      </p>
                      <p className="text-[12px] text-[#0A2240]/45">
                        {loan.loan_code} · {formatGHS(loan.principal)} · {loan.tenor_months} months
                      </p>
                    </div>
                    <LoanStatusBadge status={loan.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Recently registered clients</h2>
            <Link href="/clients" className="flex items-center gap-1 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState title="No clients yet" description="Register your first client to get started." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {recentClients.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#0033AA]/[0.03]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[12px] font-semibold text-[#0033AA]">
                      {client.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                      ) : (
                        initials(client.full_name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#0A2240]">{client.full_name}</p>
                      <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · {client.phone}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
