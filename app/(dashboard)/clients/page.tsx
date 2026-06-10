import Link from "next/link";
import { Plus, Search, Lock, PiggyBank, Coins, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PrintRegistrationCardButton } from "@/components/print-registration-card";
import { ClientExcelButtons } from "@/components/client-excel-buttons";
import { PageHeader, ClientStatusBadge, EmptyState } from "@/components/ui";
import type { Client, Account, ProductType, Profile } from "@/lib/types";

const PRODUCT_LABEL: Record<ProductType, string> = {
  savings: "Savings",
  susu: "Daily Susu",
  fixed_deposit: "Fixed Deposit",
};

const PRODUCT_ICON: Record<ProductType, typeof PiggyBank> = {
  savings: PiggyBank,
  susu: Coins,
  fixed_deposit: Lock,
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,client_code.ilike.%${term}%`);
  }

  const { data: clients } = await query.returns<Client[]>();

  const { data: profile } = await getCurrentProfile(supabase);
  const isAdmin = profile?.role === "admin";

  const accountByClient = new Map<string, Account>();
  const agentNameById = new Map<string, string>();
  if (clients && clients.length > 0) {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .in("client_id", clients.map((c) => c.id))
      .order("created_at", { ascending: false })
      .returns<Account[]>();
    for (const account of accounts ?? []) {
      if (!accountByClient.has(account.client_id)) accountByClient.set(account.client_id, account);
    }

    const agentIds = [...new Set((accounts ?? []).map((a) => a.agent_id).filter((id): id is string => !!id))];
    if (agentIds.length > 0) {
      const { data: agents } = await supabase.from("profiles").select("*").in("id", agentIds).returns<Profile[]>();
      for (const agent of agents ?? []) agentNameById.set(agent.id, agent.full_name);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="All clients"
        description="Search, review, and open a client's profile to manage their loans."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && <ClientExcelButtons />}
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#152847]"
            >
              <Plus size={16} />
              Register client
            </Link>
          </div>
        }
      />

      <form className="mb-6 max-w-sm">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1D3461]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, phone, or client code…"
            className="w-full rounded-md border border-[#1D3461]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-[#0A2240]/35 focus:border-[#2CBFBF]"
          />
        </div>
      </form>

      {!clients || clients.length === 0 ? (
        <EmptyState
          title={q ? "No clients match your search" : "No clients registered yet"}
          description={q ? "Try a different name, phone number or client code." : "Register your first client to start building their profile."}
          action={
            !q && (
              <Link href="/clients/new" className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#152847]">
                <Plus size={15} /> Register client
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* ── Mobile card list (hidden on lg+) ───────────────────────── */}
          <ul className="space-y-3 lg:hidden">
            {clients.map((client) => {
              const account = accountByClient.get(client.id);
              const ProductIcon = account ? PRODUCT_ICON[account.product_type] : null;
              return (
                <li key={client.id} className="rounded-xl border border-[#1D3461]/8 bg-white shadow-sm">
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[12px] font-semibold text-[#1D3461]">
                      {client.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                      ) : (
                        initials(client.full_name)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-[#0A2240]">{client.full_name}</p>
                        <ClientStatusBadge status={client.status} />
                      </div>
                      <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · {client.phone}</p>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-[#0A2240]/55">
                        {account && ProductIcon && (
                          <span className="inline-flex items-center gap-1">
                            <ProductIcon size={12} />
                            {PRODUCT_LABEL[account.product_type]}
                          </span>
                        )}
                        {account && (
                          <span className="font-medium text-[#0A2240]">{formatGHC(account.balance)}</span>
                        )}
                        {client.town && <span>{client.town}</span>}
                      </div>
                    </div>
                  </Link>
                  {isAdmin && (
                    <div className="flex items-center gap-2 border-t border-[#1D3461]/6 px-4 py-2.5">
                      <PrintRegistrationCardButton
                        client={client}
                        account={account}
                        agentName={account?.agent_id ? agentNameById.get(account.agent_id) ?? null : null}
                        processedBy={profile?.full_name}
                      />
                      <Link
                        href={`/clients/${client.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#1D3461]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#1D3461] transition-colors hover:bg-[#1D3461]/5"
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ── Desktop table (hidden on mobile) ───────────────────────── */}
          <div className="hidden overflow-x-auto rounded-xl border border-[#1D3461]/8 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[900px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Account</th>
                  <th className="px-5 py-3 font-semibold">Town</th>
                  <th className="px-5 py-3 font-semibold">Savings</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Reg. Date</th>
                  {isAdmin && <th className="px-5 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {clients.map((client) => {
                  const account = accountByClient.get(client.id);
                  const ProductIcon = account ? PRODUCT_ICON[account.product_type] : null;
                  return (
                    <tr key={client.id} className="transition-colors hover:bg-[#1D3461]/[0.025]">
                      <td className="px-5 py-3.5">
                        <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[12px] font-semibold text-[#1D3461]">
                            {client.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={client.photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                            ) : (
                              initials(client.full_name)
                            )}
                          </span>
                          <span className="leading-tight">
                            <span className="block font-medium text-[#0A2240] hover:text-[#1D3461]">{client.full_name}</span>
                            <span className="block text-[12px] text-[#0A2240]/45">{client.client_code}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{client.phone}</td>
                      <td className="px-5 py-3.5">
                        {account && ProductIcon ? (
                          <span className="inline-flex items-center gap-1.5 text-[#0A2240]/70">
                            <ProductIcon size={14} className="text-[#1D3461]/55" />
                            {PRODUCT_LABEL[account.product_type]}
                          </span>
                        ) : (
                          <span className="text-[#0A2240]/35">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{client.town ?? "—"}</td>
                      <td className="px-5 py-3.5 font-medium text-[#0A2240]">
                        {account ? formatGHC(account.balance) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <ClientStatusBadge status={client.status} />
                      </td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{formatRegDate(client.created_at)}</td>
                      {isAdmin && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <PrintRegistrationCardButton
                              client={client}
                              account={account}
                              agentName={account?.agent_id ? agentNameById.get(account.agent_id) ?? null : null}
                              processedBy={profile?.full_name}
                            />
                            <Link
                              href={`/clients/${client.id}/edit`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[#1D3461]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#1D3461] transition-colors hover:bg-[#1D3461]/5"
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
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
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

function formatGHC(amount: number) {
  return `GHC${amount.toFixed(2)}`;
}

function formatRegDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
