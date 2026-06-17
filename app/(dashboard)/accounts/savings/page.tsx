import { AccountTypeList } from "@/components/account-type-list";

export default async function SavingsAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  return <AccountTypeList slug="savings" status={status} q={q} />;
}
