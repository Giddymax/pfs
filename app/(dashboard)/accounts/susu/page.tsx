import { AccountTypeList } from "@/components/account-type-list";

export default async function SusuAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <AccountTypeList slug="susu" status={status} />;
}
