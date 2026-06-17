import { AccountTypeList } from "@/components/account-type-list";

export default async function SusuAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  return <AccountTypeList slug="susu" status={status} q={q} />;
}
