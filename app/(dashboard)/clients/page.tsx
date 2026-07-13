import Link from "next/link";
import { Plus, Search, Lock, PiggyBank, Coins, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PrintRegistrationCardButton } from "@/components/print-registration-card";
import { ClientPrintHistoryButton } from "@/components/client-print-history-button";
import { ClientExcelButtons } from "@/components/client-excel-buttons";
import { TableFilter, type FilterOption } from "@/components/table-filter";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader, ClientStatusBadge, EmptyState } from "@/components/ui";
import { getSettings } from "@/lib/settings/cache";
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

const STATUS_OPTIONS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dormant", label: "Dormant" },
  { value: "suspended", label: "Suspended" },
];

const ACCOUNT_OPTIONS: FilterOption[] = [
  { value: "savings", label: "Savings" },
  { value: "susu", label: "Daily Susu" },
  { value: "fixed_deposit", label: "Fixed Deposit" },
];

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; account?: string; town?: string }>;
}) {
  const { q, status, account, town } = await searchParams;
  const supabase = await createClient();

  // Build the query string for filter components to preserve other active filters
  const qs = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(account ? { account } : {}),
    ...(town ? { town } : {}),
  }).toString();

  // Get client IDs matching the account-type filter (separate table)
  let accountFilterIds: string[] | null = null;
  if (account) {
    const { data: accs } = await supabase
      .from("accounts")
      .select("client_id")
      .eq("product_type", account);
    accountFilterIds = (accs ?? []).map((a) => (a as { client_id: string }).client_id);
  }

  // Main client query
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (q?.trim()) {
    const term = q.trim();
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,client_code.ilike.%${term}%`);
  }
  if (status) query = query.eq("status", status);
  if (town) query = query.ilike("town", town);
  if (accountFilterIds !== null && accountFilterIds.length > 0) {
    query = query.in("id", accountFilterIds);
  }

  const clients: Client[] =
    accountFilterIds !== null && accountFilterIds.length === 0
      ? []
      : (await query.returns<Client[]>()).data ?? [];

  // Unique towns for the Town filter dropdown
  const { data: townRows } = await supabase
    .from("clients")
    .select("town")
    .not("town", "is", null)
    .neq("town", "")
    .order("town");
  const townOptions: FilterOption[] = [
    ...new Set((townRows ?? []).map((r) => (r as { town: string }).town).filter(Boolean)),
  ].map((t) => ({ value: t, label: t }));

  const [{ data: profile }, settings] = await Promise.all([
    getCurrentProfile(supabase),
    getSettings(),
  ]);
  const isAdmin = profile?.role === "admin";
  const companyPhone = settings.sms.company_tel ?? null;

  const accountByClient = new Map<string, Account>();
  const agentNameById = new Map<string, string>();
  const registrarNameById = new Map<string, string>();
  const fdNumberByClient = new Map<string, string>();
  const fdByClient = new Map<string, { client_id: string; fd_number: string; principal: number }>();
  const clientsWithFees = new Set<string>();
  if (clients.length > 0) {
    const clientIds = clients.map((c) => c.id);

    const [{ data: accounts }, { data: fdRows }, { data: cardFeeRows }] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .returns<Account[]>(),
      supabase
        .from("fixed_deposits")
        .select("client_id, fd_number, principal")
        .in("client_id", clientIds)
        .not("status", "in", '("withdrawn","rolled_over")')
        .order("created_at", { ascending: false })
        .returns<{ client_id: string; fd_number: string; principal: number }[]>(),
      supabase
        .from("card_fees")
        .select("client_id")
        .in("client_id", clientIds)
        .returns<{ client_id: string }[]>(),
    ]);

    for (const r of cardFeeRows ?? []) clientsWithFees.add(r.client_id);

    for (const acc of accounts ?? []) {
      if (!accountByClient.has(acc.client_id)) accountByClient.set(acc.client_id, acc);
    }
    for (const fd of fdRows ?? []) {
      if (!fdNumberByClient.has(fd.client_id)) fdNumberByClient.set(fd.client_id, fd.fd_number);
      fdByClient.set(fd.client_id, fd);
    }

    // Collect all profile IDs we need: agents + registrars
    const agentIds = [...new Set((accounts ?? []).map((a) => a.agent_id).filter((id): id is string => !!id))];
    const registrarIds = [...new Set(clients.map((c) => c.created_by).filter((id): id is string => !!id))];
    const allProfileIds = [...new Set([...agentIds, ...registrarIds])];

    if (allProfileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", allProfileIds)
        .returns<Pick<Profile, "id" | "full_name">[]>();
      for (const p of profileRows ?? []) {
        agentNameById.set(p.id, p.full_name);
        registrarNameById.set(p.id, p.full_name);
      }
    }
  }

  const hasFilters = !!(status || account || town);
  const hasSearch = !!q?.trim();

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Clients"
        title="All clients"
        description="Search, review, and open a client's profile to manage their loans."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton endpoint="/api/export/clients" filename="clients.csv" label="Export CSV" />
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

      {/* Search */}
      <form className="mb-4 sm:max-w-sm">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1D3461]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
           
            className="w-full rounded-md border border-[#1D3461]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#2CBFBF]"
          />
        </div>
      </form>

      {/* Active filter chips — visible on all screens when filters are set */}
      {hasFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-[#0A2240]/40">Filtered by:</span>
          {status && (
            <Link
              href={buildUrl("/clients", { q, account, town })}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2CBFBF]/30 bg-[#2CBFBF]/10 px-2.5 py-1 text-[12px] font-medium text-[#1D3461] transition-colors hover:bg-[#2CBFBF]/20"
            >
              Status: {status}
              <X size={11} strokeWidth={2.5} />
            </Link>
          )}
          {account && (
            <Link
              href={buildUrl("/clients", { q, status, town })}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2CBFBF]/30 bg-[#2CBFBF]/10 px-2.5 py-1 text-[12px] font-medium text-[#1D3461] transition-colors hover:bg-[#2CBFBF]/20"
            >
              Account: {ACCOUNT_OPTIONS.find((o) => o.value === account)?.label ?? account}
              <X size={11} strokeWidth={2.5} />
            </Link>
          )}
          {town && (
            <Link
              href={buildUrl("/clients", { q, status, account })}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2CBFBF]/30 bg-[#2CBFBF]/10 px-2.5 py-1 text-[12px] font-medium text-[#1D3461] transition-colors hover:bg-[#2CBFBF]/20"
            >
              Town: {town}
              <X size={11} strokeWidth={2.5} />
            </Link>
          )}
          <Link
            href={buildUrl("/clients", { q })}
            className="text-[12px] text-[#0A2240]/40 underline-offset-2 hover:text-[#963522] hover:underline"
          >
            Clear all
          </Link>
        </div>
      )}

      {/* Mobile filter controls (hidden on lg where table headers take over) */}
      {!hasFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 lg:hidden">
          <span className="text-[11.5px] font-medium text-[#0A2240]/40">Filter:</span>
          <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
          <TableFilter param="account" label="Account" options={ACCOUNT_OPTIONS} current={account} qs={qs} />
          {townOptions.length > 0 && (
            <TableFilter param="town" label="Town" options={townOptions} current={town} qs={qs} />
          )}
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState
          title={
            hasFilters || hasSearch
              ? "No clients match your filters"
              : "No clients registered yet"
          }
          description={
            hasFilters || hasSearch
              ? "Try adjusting your search or removing some filters."
              : "Register your first client to start building their profile."
          }
          action={
            !hasFilters && !hasSearch && (
              <Link
                href="/clients/new"
                className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#152847]"
              >
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
              const acc = accountByClient.get(client.id);
              const fd = fdByClient.get(client.id);
              const ProductIcon = acc ? PRODUCT_ICON[acc.product_type] : fd ? Lock : null;
              const productLabel = acc ? PRODUCT_LABEL[acc.product_type] : fd ? "Fixed Deposit" : null;
              const displayBalance = acc ? formatGHC(acc.balance) : fd ? formatGHC(fd.principal) : null;
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
                      <p className="text-[12px] text-[#0A2240]/45">{client.client_code} · <a href={`tel:${client.phone}`} className="hover:text-[#0033AA] hover:underline">{client.phone}</a></p>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-[#0A2240]/55">
                        {ProductIcon && productLabel && (
                          <span className="inline-flex items-center gap-1">
                            <ProductIcon size={12} />
                            {productLabel}
                          </span>
                        )}
                        {displayBalance && <span className="font-medium text-[#0A2240]">{displayBalance}</span>}
                        {client.town && <span>{client.town}</span>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#1D3461]/6 px-4 py-2.5">
                    <ClientPrintHistoryButton
                      client={client}
                      accountNumber={acc?.account_number}
                      accountBalance={acc?.balance}
                      printedBy={profile?.full_name}
                      companyPhone={companyPhone}
                    />
                    <PrintRegistrationCardButton
                      client={client}
                      account={acc}
                      agentName={acc?.agent_id ? agentNameById.get(acc.agent_id) ?? null : null}
                      processedBy={profile?.full_name}
                      registeredBy={client.created_by ? registrarNameById.get(client.created_by) ?? null : null}
                      fdNumber={fdNumberByClient.get(client.id) ?? null}
                      companyPhone={companyPhone}
                      isMigrated={!clientsWithFees.has(client.id)}
                    />
                    {isAdmin && (
                      <>
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
                          confirmDescription={`This permanently removes ${client.full_name} and cannot be undone.`}
                          redirectTo="/clients"
                          triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-[#B3432B]/25 px-3 py-1.5 text-[11.5px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
                        />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ── Desktop table (hidden on mobile) ───────────────────────── */}
          <div className="pfs-table-scroll hidden rounded-xl border border-[#1D3461]/8 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[900px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th aria-label="Account" className="px-5 py-3 font-semibold">
                    <TableFilter param="account" label="Account" options={ACCOUNT_OPTIONS} current={account} qs={qs} />
                  </th>
                  <th aria-label="Town" className="px-5 py-3 font-semibold">
                    {townOptions.length > 0 ? (
                      <TableFilter param="town" label="Town" options={townOptions} current={town} qs={qs} />
                    ) : (
                      "Town"
                    )}
                  </th>
                  <th className="px-5 py-3 font-semibold">Balance</th>
                  <th aria-label="Status" className="px-5 py-3 font-semibold">
                    <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
                  </th>
                  <th className="px-5 py-3 font-semibold">Reg. Date</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {clients.map((client) => {
                  const acc = accountByClient.get(client.id);
                  const fd = fdByClient.get(client.id);
                  const ProductIcon = acc ? PRODUCT_ICON[acc.product_type] : fd ? Lock : null;
                  const productLabel = acc ? PRODUCT_LABEL[acc.product_type] : fd ? "Fixed Deposit" : null;
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
                      <td className="px-5 py-3.5 text-[#0A2240]/55"><a href={`tel:${client.phone}`} className="hover:text-[#0033AA] hover:underline">{client.phone}</a></td>
                      <td className="px-5 py-3.5">
                        {ProductIcon && productLabel ? (
                          <span className="inline-flex items-center gap-1.5 text-[#0A2240]/70">
                            <ProductIcon size={14} className="text-[#1D3461]/55" />
                            {productLabel}
                          </span>
                        ) : (
                          <span className="text-[#0A2240]/35">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{client.town ?? "—"}</td>
                      <td className="px-5 py-3.5 font-medium text-[#0A2240]">
                        {acc ? formatGHC(acc.balance) : fd ? formatGHC(fd.principal) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <ClientStatusBadge status={client.status} />
                      </td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{formatRegDate(client.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ClientPrintHistoryButton
                            client={client}
                            accountNumber={acc?.account_number}
                            accountBalance={acc?.balance}
                            printedBy={profile?.full_name}
                            companyPhone={companyPhone}
                          />
                          <PrintRegistrationCardButton
                            client={client}
                            account={acc}
                            agentName={acc?.agent_id ? agentNameById.get(acc.agent_id) ?? null : null}
                            processedBy={profile?.full_name}
                            registeredBy={client.created_by ? registrarNameById.get(client.created_by) ?? null : null}
                            fdNumber={fdNumberByClient.get(client.id) ?? null}
                            companyPhone={companyPhone}
                            isMigrated={!clientsWithFees.has(client.id)}
                          />
                          {isAdmin && (
                            <>
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
                                confirmDescription={`This permanently removes ${client.full_name} and cannot be undone.`}
                                redirectTo="/clients"
                                triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-[#B3432B]/25 px-3 py-1.5 text-[11.5px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
                              />
                            </>
                          )}
                        </div>
                      </td>
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
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatGHC(amount: number) {
  return `GHC${amount.toFixed(2)}`;
}

function formatRegDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null };
  return supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
}
