import { AccountTypeList } from "@/components/account-type-list";

export default async function SavingsAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <AccountTypeList slug="savings" status={status} />;
}
