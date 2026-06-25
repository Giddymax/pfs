"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import type { CommissionTier, OverviewKpiSettings, RevenueComponents, SmsSettings } from "@/lib/types";

const KPI_LABELS: Record<keyof OverviewKpiSettings, string> = {
  total_clients:   "Total Clients",
  total_savings:   "Total Savings",
  total_susu:      "Total Daily Susu",
  total_fd:        "Total Fixed Deposits",
  combined_total:  "Combined Account Total",
  total_revenue:   "Total Revenue",
  account_balance: "Account Balance",
  cash_at_hand:    "Cash at Hand",
  cash_at_bank:    "Cash at Bank",
};

const CALC_OPTIONS: { value: "balance" | "dep"; label: string }[] = [
  { value: "balance", label: "Current balance" },
  { value: "dep",     label: "Total deposits (gross)" },
];

const REVENUE_LABELS: Record<keyof RevenueComponents, string> = {
  interest:        "Loan Interest",
  commission:      "Withdrawal Commission",
  susu_fees:       "Susu Fees",
  card_fees:       "Card Fees",
  sms_charges:     "SMS Charges",
  processing_fees: "Processing Fees",
};

export function SettingsForm({
  commissionTiers,
  sms,
  cardFeeAmount,
  fdTermsMonths,
  overviewKpi,
}: {
  commissionTiers: CommissionTier[];
  sms: SmsSettings;
  cardFeeAmount: number;
  fdTermsMonths: number[];
  overviewKpi: OverviewKpiSettings;
}) {
  const [tiers, setTiers] = useState<CommissionTier[]>(commissionTiers);
  const [smsSettings, setSmsSettings] = useState<SmsSettings>(sms);
  const [cardFee, setCardFee] = useState(String(cardFeeAmount));
  const [fdTerms, setFdTerms] = useState(fdTermsMonths.join(", "));
  const [kpi, setKpi] = useState<OverviewKpiSettings>(overviewKpi);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateTier(index: number, patch: Partial<CommissionTier>) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function addTier() {
    setTiers((prev) => [...prev, { min: 0, max: null, fee: 0 }]);
  }

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
        commission_tiers: tiers,
        sms: smsSettings,
        card_fee_amount: Number(cardFee) || 0,
        fd_terms_months: fdTermsParsed,
        overview_kpi: kpi,
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
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Withdrawal commission tiers</h2>
          <p className="mt-1 text-[12.5px] text-[#0A2240]/50">
            Applies to regular savings withdrawals only — susu and fixed deposits are exempt. The first tier where the
            amount falls between min and max is used; if none match, the nearest lower tier&rsquo;s fee applies.
          </p>
        </div>
        <div className="space-y-3 px-5 py-5">
          {tiers.map((tier, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <TierInput label="Min (GHS)" value={tier.min} onChange={(v) => updateTier(index, { min: v ?? 0 })} />
              <TierInput
                label="Max (GHS)"
                value={tier.max}
                allowEmpty
                onChange={(v) => updateTier(index, { max: v })}
              />
              <TierInput label="Fee (GHS)" value={tier.fee} onChange={(v) => updateTier(index, { fee: v ?? 0 })} />
              <button
                onClick={() => removeTier(index)}
                className="mt-5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#B3432B]/20 text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
                aria-label="Remove tier"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={addTier}
            className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/20 px-4 py-2 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
          >
            <Plus size={14} /> Add tier
          </button>
        </div>
      </Card>

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
          <label className="block max-w-xs border-t border-[#0033AA]/6 pt-4">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">Company phone (admin alerts)</span>
            <input
              type="tel"
              value={smsSettings.company_tel ?? ""}
              onChange={(e) => setSmsSettings((s) => ({ ...s, company_tel: e.target.value || null }))}
              placeholder="e.g. 0244000000"
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#0062E1] focus:bg-white"
            />
          </label>
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
              placeholder="3, 6, 9, 12, 18, 24"
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#0062E1] focus:bg-white"
            />
          </label>
        </div>
      </Card>

      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">Overview KPI cards</h2>
          <p className="mt-1 text-[12.5px] text-[#0A2240]/50">
            Choose which KPI cards appear on the Overview page and how certain totals are calculated.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          {(Object.keys(KPI_LABELS) as (keyof OverviewKpiSettings)[]).map((key) => (
            <div key={key}>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <Toggle
                  label={KPI_LABELS[key]}
                  checked={kpi[key].visible}
                  onChange={(v) =>
                    setKpi((prev) => ({ ...prev, [key]: { ...prev[key], visible: v } }))
                  }
                />

                {(key === "total_savings" || key === "total_susu") && (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#0A2240]/50">Calculated from:</span>
                    <select
                      aria-label={`Calculation method for ${KPI_LABELS[key]}`}
                      value={(kpi[key] as { visible: boolean; calc: "balance" | "dep" }).calc}
                      onChange={(e) =>
                        setKpi((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], calc: e.target.value as "balance" | "dep" },
                        }))
                      }
                      className="rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-2.5 py-1.5 text-[13px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                    >
                      {CALC_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {key === "total_revenue" && kpi.total_revenue.visible && (
                <div className="ml-6 mt-2 space-y-2 rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.02] p-3.5">
                  <p className="text-[12px] font-medium text-[#0A2240]/50">Include in revenue total:</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(Object.keys(REVENUE_LABELS) as (keyof RevenueComponents)[]).map((comp) => (
                      <Toggle
                        key={comp}
                        label={REVENUE_LABELS[comp]}
                        checked={kpi.total_revenue.components[comp]}
                        onChange={(v) =>
                          setKpi((prev) => ({
                            ...prev,
                            total_revenue: {
                              ...prev.total_revenue,
                              components: { ...prev.total_revenue.components, [comp]: v },
                            },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
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

function TierInput({
  label,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block flex-1">
      <span className="mb-1.5 block text-[12px] font-medium text-[#0033AA]/65">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        placeholder={allowEmpty ? "No limit" : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" && allowEmpty) {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3 py-2 text-[13.5px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#0062E1] focus:bg-white"
      />
    </label>
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
