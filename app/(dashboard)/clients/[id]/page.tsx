import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, UserRound, Phone, MapPin, IdCard, Briefcase, HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PrintRegistrationCardButton } from "@/components/print-registration-card";
import { PrintTransactionHistoryButton } from "@/components/print-transaction-history-button";
import { Card, ClientStatusBadge, LoanStatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/settings/cache";
import { formatGHS } from "@/lib/loan";
import type { Account, Client, Loan, Profile, Transaction } from "@/lib/types";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: loans }, { data: profile }, { data: accounts }, { data: transactions }, { data: fds }, settings] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single<Client>(),
    supabase.from("loans").select("*").eq("client_id", id).order("created_at", { ascending: false }).returns<Loan[]>(),
    getCurrentProfile(supabase),
    supabase.from("accounts").select("*").eq("client_id", id).order("created_at", { ascending: false }).returns<Account[]>(),
    supabase
      .from("transactions")
      .select("*, account:accounts(account_number, product_type), recorder:recorded_by(full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .returns<(Transaction & { account: { account_number: string; product_type: string } | null; recorder: { full_name: string } | null })[]>(),
    supabase
      .from("fixed_deposits")
      .select("fd_number")
      .eq("client_id", id)
      .not("status", "in", '("withdrawn","rolled_over")')
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ fd_number: string }[]>(),
    getSettings(),
  ]);

  if (!client) notFound();

  const isAdmin = profile?.role === "admin";
  const account = accounts?.[0] ?? null;
  const companyPhone = settings.sms.company_tel ?? null;

  // Fetch agent and registrar names in parallel
  const lookupIds = [
    account?.agent_id,
    client.created_by,
  ].filter((id): id is string => !!id);

  let agentName: string | null = null;
  let registeredBy: string | null = null;

  if (lookupIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles").select("id, full_name").in("id", lookupIds).returns<Pick<Profile, "id" | "full_name">[]>();
    const byId = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));
    agentName = account?.agent_id ? (byId.get(account.agent_id) ?? null) : null;
    registeredBy = client.created_by ? (byId.get(client.created_by) ?? null) : null;
  }

  return (
    <div>
      <PageHeader
        back="/clients"
        eyebrow="Client profile"
        title={client.full_name}
        description={`${client.client_code} · Registered ${new Date(client.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/loans/new?client=${client.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-3 py-1.5 text-[11.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884]"
            >
              <Plus size={13} />
              Issue loan
            </Link>
            <PrintTransactionHistoryButton
              client={client}
              transactions={transactions ?? []}
              printedBy={profile?.full_name}
              companyPhone={companyPhone}
            />
            <PrintRegistrationCardButton
              client={client}
              account={account}
              agentName={agentName}
              processedBy={profile?.full_name}
              registeredBy={registeredBy}
              fdNumber={fds?.[0]?.fd_number ?? null}
              companyPhone={companyPhone}
            />
            {isAdmin && (
              <>
                <Link
                  href={`/clients/${client.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
                >
                  <Pencil size={12} />
                  Edit
                </Link>
                <ConfirmDeleteButton
                  table="clients"
                  id={client.id}
                  label="Delete"
                  confirmTitle="Delete this client?"
                  confirmDescription={`This permanently removes ${client.full_name} and cannot be undone. Clients with existing loans cannot be deleted.`}
                  redirectTo="/clients"
                  triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-[#B3432B]/25 px-3 py-1.5 text-[11.5px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
                />
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 border-b border-[#0033AA]/8 px-6 py-7 text-center">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[#0033AA]/10 bg-[#0033AA]/5">
              {client.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
              ) : (
                <UserRound size={34} className="text-[#0033AA]/25" />
              )}
            </span>
            <div>
              <p className="text-[16px] font-semibold text-[#0033AA]">{client.full_name}</p>
              <p className="text-[12.5px] text-[#0A2240]/45">{client.client_code}</p>
            </div>
            <ClientStatusBadge status={client.status} />
          </div>

          <dl className="space-y-4 px-6 py-6 text-[13.5px]">
            <DetailRow icon={<Phone size={15} />} label="Phone" value={client.phone} />
            {client.alt_phone && <DetailRow icon={<Phone size={15} />} label="Alternate phone" value={client.alt_phone} />}
            {client.ghana_card_number && <DetailRow icon={<IdCard size={15} />} label="Ghana Card" value={client.ghana_card_number} />}
            {client.occupation && <DetailRow icon={<Briefcase size={15} />} label="Occupation" value={client.occupation} />}
            {client.residential_address && <DetailRow icon={<MapPin size={15} />} label="Address" value={client.residential_address} />}
            {(client.next_of_kin_name || client.next_of_kin_phone) && (
              <DetailRow
                icon={<HeartHandshake size={15} />}
                label="Next of kin"
                value={[client.next_of_kin_name, client.next_of_kin_phone].filter(Boolean).join(" · ")}
              />
            )}
            {client.gender && <DetailRow icon={<UserRound size={15} />} label="Gender" value={client.gender === "male" ? "Male" : "Female"} />}
            {client.date_of_birth && (
              <DetailRow
                icon={<UserRound size={15} />}
                label="Date of birth"
                value={new Date(client.date_of_birth).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              />
            )}
          </dl>
        </Card>

        {/* Loans */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#0033AA]/8 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#0033AA]">Loan history</h2>
            <Link
              href={`/loans/new?client=${client.id}`}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#0033AA]/55 hover:text-[#0062E1]"
            >
              <Plus size={13} /> Issue new loan
            </Link>
          </div>

          {!loans || loans.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                title="No loans yet"
                description="Issue this client's first loan to start tracking repayments."
                action={
                  <Link
                    href={`/loans/new?client=${client.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#002884]"
                  >
                    <Plus size={15} /> Issue loan
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#0033AA]/6">
              {loans.map((loan) => (
                <li key={loan.id}>
                  <Link
                    href={`/loans/${loan.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#0033AA]/[0.025]"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#0A2240]">
                        {loan.loan_code} · {formatGHS(loan.principal)}
                      </p>
                      <p className="text-[12px] text-[#0A2240]/45">
                        {loan.flat_rate_percent}% flat · {loan.tenor_months} months · repayable {formatGHS(loan.total_repayable)}
                      </p>
                    </div>
                    <LoanStatusBadge status={loan.status} />
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

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[#0033AA]/35">{icon}</span>
      <div>
        <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
        <p className="text-[#0A2240]">{value}</p>
      </div>
    </div>
  );
}

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
