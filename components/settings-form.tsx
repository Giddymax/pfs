"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui";
import type { SmsSettings } from "@/lib/types";

export function SettingsForm({
  sms,
  cardFeeAmount,
  fdTermsMonths,
  smsMonthlyFee,
}: {
  sms: SmsSettings;
  cardFeeAmount: number;
  fdTermsMonths: number[];
  smsMonthlyFee: number;
}) {
  const [smsSettings, setSmsSettings] = useState<SmsSettings>(sms);
  const [cardFee, setCardFee] = useState(String(cardFeeAmount));
  const [fdTerms, setFdTerms] = useState(fdTermsMonths.join(", "));
  const [smsFee, setSmsFee] = useState(String(smsMonthlyFee));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const fdTermsParsed = fdTerms
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sms: smsSettings,
        card_fee_amount: Number(cardFee) || 0,
        fd_terms_months: fdTermsParsed,
        sms_monthly_fee: Number(smsFee) || 0,
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error ?? "Failed to save settings");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">SMS notifications (Arkesel)</h2>
          <p className="mt-1 text-[12.5px] text-[#0A2240]/50">
            The global switch must be on for any messages to send. Client and admin channels are then gated
            independently, and per-event toggles further refine which client messages go out.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <Toggle
            label="Enable SMS (global kill switch)"
            checked={smsSettings.sms_enabled}
            onChange={(v) => setSmsSettings((s) => ({ ...s, sms_enabled: v }))}
          />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-[#0033AA]/6 pt-4 sm:grid-cols-2">
            <Toggle
              label="Client messages enabled"
              checked={smsSettings.sms_client_enabled}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_client_enabled: v }))}
            />
            <Toggle
              label="Admin / company alerts enabled"
              checked={smsSettings.sms_admin_enabled}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_admin_enabled: v }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-[#0033AA]/6 pt-4 sm:grid-cols-3">
            <Toggle
              label="Deposit SMS to client"
              checked={smsSettings.sms_deposit}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_deposit: v }))}
            />
            <Toggle
              label="Withdrawal SMS to client"
              checked={smsSettings.sms_withdrawal}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_withdrawal: v }))}
            />
            <Toggle
              label="Loan payment SMS to client"
              checked={smsSettings.sms_payment}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_payment: v }))}
            />
          </div>
          <p className="text-[12px] text-[#0A2240]/45">
            Susu, fixed-deposit, and reversal notifications follow the client master switch only — they have no
            individual toggle. Every client message additionally requires that client&rsquo;s own opt-in to be on.
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-[#0033AA]/6 pt-4 sm:grid-cols-2">
            <Toggle
              label="Admin SMS — deposits & other events"
              checked={smsSettings.sms_admin_deposit}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_admin_deposit: v }))}
            />
            <Toggle
              label="Admin SMS — withdrawals & deductions"
              checked={smsSettings.sms_admin_withdrawal}
              onChange={(v) => setSmsSettings((s) => ({ ...s, sms_admin_withdrawal: v }))}
            />
          </div>
          <p className="text-[12px] text-[#0A2240]/45">
            Every admin alert falls into exactly one of these two switches. &ldquo;Withdrawals &amp; deductions&rdquo;
            covers regular withdrawals, susu withdrawals/emergency withdrawals/claims, and fixed-deposit early
            withdrawals or maturity payouts. &ldquo;Deposits &amp; other events&rdquo; covers everything else —
            deposits, loan payments, susu contributions, fixed-deposit openings/rollovers, and reversals.
          </p>
          <div className="grid grid-cols-1 gap-5 border-t border-[#0033AA]/6 pt-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">Company phone (admin alerts)</span>
              <input
                type="tel"
                value={smsSettings.company_tel ?? ""}
                onChange={(e) => setSmsSettings((s) => ({ ...s, company_tel: e.target.value || null }))}
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">Monthly SMS fee per client (GHS)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={smsFee}
                onChange={(e) => setSmsFee(e.target.value)}
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
              <p className="mt-1 text-[11.5px] text-[#0A2240]/45">
                Deducted from opted-in clients&apos; accounts at the start of each month.
              </p>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Registration fee &amp; fixed-deposit terms</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">Card / registration fee (GHS)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cardFee}
              onChange={(e) => setCardFee(e.target.value)}
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">Fixed-deposit terms offered (months, comma-separated)</span>
            <input
              type="text"
              value={fdTerms}
              onChange={(e) => setFdTerms(e.target.value)}
             
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </label>
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] text-[#963522]">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.06] px-4 py-3 text-[13px] text-[#1F6E4A]">
          Settings saved.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884] disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13.5px] text-[#0A2240]">
      <span>{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#0033AA]" : "bg-[#0A2240]/15"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </label>
  );
}
