import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SusuClaimActions } from "@/components/susu-claim-actions";
import { formatGHS } from "@/lib/loan";
import type { Account, Client, Profile, SusuClaim } from "@/lib/types";

type ClaimRow = SusuClaim & { account: (Account & { client: Client }) | null };

export default async function SusuClaimsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: claims } = await supabase
    .from("susu_claims")
    .select("*, account:accounts(*, client:clients(*))")
    .order("requested_at", { ascending: false })
    .returns<ClaimRow[]>();

  const allClaims = claims ?? [];
  const pending = allClaims.filter((c) => c.status === "pending_admin");
  const others = allClaims.filter((c) => c.status !== "pending_admin");

  return (
    <div>
      <PageHeader
        eyebrow="Daily Susu"
        title="Claims worklist"
        description="Emergency claims requested mid-cycle require admin review before payout. Normal claims are auto-approved and only need to be paid out."
      />

      <Card className="mb-6">
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">
            Pending admin review {pending.length > 0 && <span className="text-[#B58A2A]">({pending.length})</span>}
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="Nothing awaiting review" description="Emergency claims requiring an approval decision will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-[#0033AA]/6">
            {pending.map((claim) => (
              <ClaimRowItem key={claim.id} claim={claim} isAdmin />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">All other claims</h2>
        </div>
        {others.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No other claims yet" description="Approved, paid, and rejected claims will be listed here for reference." />
          </div>
        ) : (
          <ul className="divide-y divide-[#0033AA]/6">
            {others.map((claim) => (
              <ClaimRowItem key={claim.id} claim={claim} isAdmin />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const STATUS_STYLE: Record<SusuClaim["status"], string> = {
  pending_admin: "border-[#B58A2A]/25 bg-[#B58A2A]/[0.08] text-[#8A6A1F]",
  approved: "border-[#0062E1]/20 bg-[#0062E1]/[0.06] text-[#0A4DA6]",
  paid: "border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.06] text-[#1F6E4A]",
  rejected: "border-[#B3432B]/20 bg-[#B3432B]/[0.06] text-[#963522]",
};

const STATUS_LABEL: Record<SusuClaim["status"], string> = {
  pending_admin: "Pending admin",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
};

function ClaimRowItem({ claim, isAdmin }: { claim: ClaimRow; isAdmin: boolean }) {
  const account = claim.account;
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[14px] font-medium text-[#0A2240]">
          <span className="capitalize">{claim.claim_type} claim</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${STATUS_STYLE[claim.status]}`}>
            {STATUS_LABEL[claim.status]}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-[#0A2240]/50">
          {account?.client ? (
            <Link href={`/accounts/${account.id}`} className="font-medium text-[#0033AA] hover:underline">
              {account.client.full_name} · {account.account_number}
            </Link>
          ) : (
            "Account not found"
          )}
        </p>
        <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
          {formatGHS(claim.amount)}
          {claim.penalty_amount > 0 ? ` · penalty ${formatGHS(claim.penalty_amount)}` : ""} · requested {formatDateTime(claim.requested_at)}
        </p>
      </div>
      <SusuClaimActions claim={claim} isAdmin={isAdmin} />
    </li>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
