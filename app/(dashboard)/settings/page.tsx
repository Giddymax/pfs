import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { ChargeSmsFeeButton } from "@/components/charge-sms-fees-button";
import type { Profile, SettingsRow, SmsSettings } from "@/lib/types";

const DEFAULT_SMS_SETTINGS: SmsSettings = {
  sms_enabled: false,
  sms_client_enabled: true,
  sms_admin_enabled: true,
  sms_deposit: true,
  sms_withdrawal: true,
  sms_payment: true,
  sms_admin_deposit: true,
  sms_admin_withdrawal: true,
  company_tel: null,
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const { data: rows } = await supabase.from("settings").select("*").returns<SettingsRow[]>();
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Administration"
        title="Settings"
        description="Configure SMS notifications, the registration card fee, and fixed-deposit terms. These values apply across the system immediately."
      />

      <SettingsForm
        sms={{ ...DEFAULT_SMS_SETTINGS, ...(byKey.get("sms") as Partial<SmsSettings> | undefined) }}
        cardFeeAmount={(byKey.get("card_fee_amount") as number | undefined) ?? 20}
        fdTermsMonths={(byKey.get("fd_terms_months") as number[] | undefined) ?? [3, 6, 9, 12, 18, 24]}
        smsMonthlyFee={(byKey.get("sms_monthly_fee") as number | undefined) ?? 2}
      />

      <div className="mt-6">
        <ChargeSmsFeeButton />
      </div>
    </div>
  );
}
