import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Users, Wallet, ArrowDownToLine, ArrowUpFromLine, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, AccountStatusBadge, EmptyState, StatCard } from "@/components/ui";
import { TableFilter, type FilterOption } from "@/components/table-filter";
import { formatGHS, round2 } from "@/lib/loan";
import { getSettings } from "@/lib/settings/cache";
import { PrintAccountListButton } from "@/components/print-account-list-button";
import type { Account, ProductType } from "@/lib/types";

const PRODUCT_BY_SLUG: Record<string, { product_type: ProductType; label: string; description: string }> = {
  savings: {
    product_type: "savings",
    label: "Savings accounts",
    description: "Clients holding an open-ended savings account.",
  },
  susu: {
    product_type: "susu",
    label: "Daily Susu accounts",
    description: "Clients on a daily collector-based susu cycle.",
  },
};

const STATUS_OPTIONS: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dormant", label: "Dormant" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
];

export async function AccountTypeList({
  slug,
  status,
  q,
}: {
  slug: string;
  status?: string;
  q?: string;
}) {
  const product = PRODUCT_BY_SLUG[slug];
  if (!product) notFound();

  const supabase = await createClient();

  const qs = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
  }).toString();

  let query = supabase
    .from("accounts")
    .select("*, client:clients(*)")
    .eq("product_type", product.product_type)
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
      query = query.or(`account_number.ilike.%${term}%,client_id.in.(${cids.join(",")})`);
    } else {
      query = query.ilike("account_number", `%${term}%`);
    }
  }

  const [{ data: accounts }, { count: totalCount }, { data: statsRows }, settings] = await Promise.all([
    query.returns<Account[]>(),
    supabase.from("accounts").select("*", { count: "exact", head: true }).eq("product_type", product.product_type),
    supabase.from("accounts").select("balance, dep, wdr, comm").eq("product_type", product.product_type)
      .returns<{ balance: number; dep: number; wdr: number; comm: number }[]>(),
    getSettings(),
  ]);

  const companyPhone = settings.sms.company_tel ?? null;

  const sum = (key: "balance" | "dep" | "wdr" | "comm") =>
    round2((statsRows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0));

  const totalBalance = sum("balance");
  const totalDep     = sum("dep");
  const totalWdr     = sum("wdr");
  const totalComm    = sum("comm");

  const hasSearch = !!q?.trim();
  const hasFilter = !!status;

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title={product.label}
        description={product.description}
        action={
          <PrintAccountListButton
            productType={product.product_type as "savings" | "susu"}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            accounts={(accounts ?? []) as any[]}
            totalCount={totalCount ?? 0}
            totalBalance={totalBalance}
            totalDep={totalDep}
            totalWdr={totalWdr}
            totalComm={totalComm}
            companyPhone={companyPhone}
          />
        }
      />

      {/* KPI */}
      {product.product_type === "savings" ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total clients"     value={String(totalCount ?? 0)}  icon={<Users size={16} />} />
          <StatCard label="Total balance"     value={formatGHS(totalBalance)}   icon={<Wallet size={16} />} />
          <StatCard label="Total deposits"    value={formatGHS(totalDep)}       icon={<ArrowDownToLine size={16} />} />
          <StatCard label="Total withdrawals" value={formatGHS(totalWdr)}       icon={<ArrowUpFromLine size={16} />} />
          <StatCard label="Total commission"  value={formatGHS(totalComm)}      icon={<ReceiptText size={16} />} />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total clients"       value={String(totalCount ?? 0)}  icon={<Users size={16} />} />
          <StatCard label="Total balance"       value={formatGHS(totalBalance)}   icon={<Wallet size={16} />} />
          <StatCard label="Total contributions" value={formatGHS(totalDep)}       icon={<ArrowDownToLine size={16} />} />
          <StatCard label="Total withdrawn"     value={formatGHS(totalWdr)}       icon={<ArrowUpFromLine size={16} />} />
        </div>
      )}

      {/* Search */}
      <form className="mb-4 sm:max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1D3461]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Search"
            className="w-full rounded-md border border-[#1D3461]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#2CBFBF]"
          />
        </div>
      </form>

      {/* Mobile filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3 lg:hidden">
        <span className="text-[11.5px] font-medium text-[#0A2240]/40">Filter:</span>
        <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
      </div>

      {!accounts || accounts.length === 0 ? (
        <EmptyState
          title={hasSearch || hasFilter ? "No accounts match your search" : "No accounts of this type yet"}
          description={
            hasSearch || hasFilter
              ? "Try adjusting your search term or status filter."
              : "Accounts are opened from a client's registration form — choose this account type there."
          }
        />
      ) : (
        <>
          {/* ── Mobile card list (hidden on lg+) ─────────────────────── */}
          <ul className="space-y-3 lg:hidden">
            {accounts.map((account) => (
              <li key={account.id} className="rounded-xl border border-[#1D3461]/8 bg-white shadow-sm">
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    {account.client ? (
                      <Link
                        href={`/clients/${account.client.id}`}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[12px] font-semibold text-[#1D3461]">
                          {account.client.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={account.client.photo_url} alt={account.client.full_name} className="h-full w-full object-cover" />
                          ) : (
                            initials(account.client.full_name)
                          )}
                        </span>
                        <span className="truncate text-[14px] font-semibold text-[#0A2240]">{account.client.full_name}</span>
                      </Link>
                    ) : (
                      <span className="text-[#0A2240]/45">—</span>
                    )}
                    <AccountStatusBadge status={account.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-[2.875rem] text-[12px] text-[#0A2240]/55">
                    <Link href={`/accounts/${account.id}`} className="font-medium text-[#1D3461] hover:underline">
                      {account.account_number}
                    </Link>
                    <span>{detailColumnValue(account)}</span>
                    <span className="font-medium text-[#0A2240]">{formatGHS(account.balance)}</span>
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
                  <th className="px-5 py-3 font-semibold">Account no.</th>
                  <th className="px-5 py-3 font-semibold">{detailColumnLabel(product.product_type)}</th>
                  <th className="px-5 py-3 font-semibold">Balance</th>
                  <th aria-label="Status" className="px-5 py-3 font-semibold">
                    <TableFilter param="status" label="Status" options={STATUS_OPTIONS} current={status} qs={qs} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {accounts.map((account) => (
                  <tr key={account.id} className="transition-colors hover:bg-[#1D3461]/[0.025]">
                    <td className="px-5 py-3.5">
                      {account.client ? (
                        <Link href={`/clients/${account.client.id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1D3461]/10 bg-[#1D3461]/5 text-[12px] font-semibold text-[#1D3461]">
                            {account.client.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={account.client.photo_url} alt={account.client.full_name} className="h-full w-full object-cover" />
                            ) : (
                              initials(account.client.full_name)
                            )}
                          </span>
                          <span className="font-medium text-[#0A2240] hover:text-[#1D3461]">{account.client.full_name}</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#0A2240]/55">
                      <Link href={`/accounts/${account.id}`} className="font-medium text-[#1D3461] hover:underline">
                        {account.account_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[#0A2240]/55">{detailColumnValue(account)}</td>
                    <td className="px-5 py-3.5 text-[#0A2240]/75">{formatGHS(account.balance)}</td>
                    <td className="px-5 py-3.5">
                      <AccountStatusBadge status={account.status} />
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

function detailColumnLabel(productType: ProductType) {
  switch (productType) {
    case "savings":
      return "Interest rate";
    case "susu":
      return "Daily contribution";
    case "fixed_deposit":
      return "Principal / tenor";
  }
}

function detailColumnValue(account: Account) {
  switch (account.product_type) {
    case "savings":
      return account.interest_rate_annual != null ? `${account.interest_rate_annual}% p.a.` : "—";
    case "susu":
      return account.daily_contribution_amount != null ? `${formatGHS(account.daily_contribution_amount)} / day` : "—";
    case "fixed_deposit":
      return account.principal_amount != null && account.tenor_days != null
        ? `${formatGHS(account.principal_amount)} · ${account.tenor_days} days`
        : "—";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
