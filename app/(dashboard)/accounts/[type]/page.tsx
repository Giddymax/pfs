import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, AccountStatusBadge, EmptyState } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
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
  "fixed-deposit": {
    product_type: "fixed_deposit",
    label: "Fixed Deposit accounts",
    description: "Clients with a lump sum placed for a fixed tenor.",
  },
};

export default async function AccountsByTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const product = PRODUCT_BY_SLUG[type];
  if (!product) notFound();

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, client:clients(*)")
    .eq("product_type", product.product_type)
    .order("created_at", { ascending: false })
    .returns<Account[]>();

  return (
    <div>
      <PageHeader eyebrow="Accounts" title={product.label} description={product.description} />

      {!accounts || accounts.length === 0 ? (
        <EmptyState
          title="No accounts of this type yet"
          description="Accounts are opened from a client's registration form — choose this account type there."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#0033AA]/8 bg-white shadow-sm">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Account no.</th>
                <th className="px-5 py-3 font-semibold">{detailColumnLabel(product.product_type)}</th>
                <th className="px-5 py-3 font-semibold">Balance</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0033AA]/6">
              {accounts.map((account) => (
                <tr key={account.id} className="transition-colors hover:bg-[#0033AA]/[0.025]">
                  <td className="px-5 py-3.5">
                    {account.client ? (
                      <Link href={`/clients/${account.client.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[12px] font-semibold text-[#0033AA]">
                          {account.client.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={account.client.photo_url} alt={account.client.full_name} className="h-full w-full object-cover" />
                          ) : (
                            initials(account.client.full_name)
                          )}
                        </span>
                        <span className="font-medium text-[#0A2240] hover:text-[#0033AA]">{account.client.full_name}</span>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/55">{account.account_number}</td>
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
