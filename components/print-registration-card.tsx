"use client";

import { useState } from "react";
import { Printer, X, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { Account, Client, ProductType } from "@/lib/types";

const PRODUCT_LABEL: Record<ProductType, string> = {
  savings: "Savings",
  susu: "Daily Susu",
  fixed_deposit: "Fixed Deposits",
};

function fullDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function PrintRegistrationCardButton({
  client,
  account,
  agentName,
  processedBy,
  registeredBy,
  fdNumber,
  companyPhone,
  isMigrated,
}: {
  client: Client;
  account?: Account | null;
  agentName?: string | null;
  processedBy?: string | null;
  registeredBy?: string | null;
  fdNumber?: string | null;
  companyPhone?: string | null;
  isMigrated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <Printer size={12} />
        Print card
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in print:static print:overflow-visible print:bg-transparent print:p-0">
          <div className="mx-auto flex max-w-[760px] justify-end gap-2 pb-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884]"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
            >
              <X size={14} />
              Close
            </button>
          </div>

          <div
            id="pfs-print-card"
            className="mx-auto max-w-[760px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl print:max-w-none print:rounded-none print:px-12 print:py-10 print:shadow-none"
          >
            {/* Watermark (hidden on screen, visible on print via globals.css) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <PrintWatermark />

            {/* Letterhead */}
            <div className="flex items-start justify-between gap-6 pb-5">
              <div className="flex items-center gap-3">
                <Logo size={48} />
                <div className="leading-tight">
                  <p className="text-[19px] font-bold tracking-[0.08em] text-[#0033AA]">PRIME</p>
                  <p className="text-[12px] font-semibold tracking-[0.18em] text-[#0A2240]/70">FINANCIAL SERVICE</p>
                  {companyPhone && <p className="mt-0.5 text-[11px] text-[#0A2240]/45">Tel: {companyPhone}</p>}
                </div>
              </div>
            </div>
            <div className="h-[3px] w-full bg-[#0033AA]" />
            <p className="py-4 text-center text-[14px] font-bold tracking-[0.12em] text-[#0A2240]">
              CLIENT REGISTRATION CARD
            </p>

            {/* Bio data */}
            <Section title="Bio data">
              <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-[1fr_1fr_auto]">
                <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:col-span-2 sm:grid-cols-2">
                  <Field label="Full name" value={client.full_name} />
                  <Field label="Client code" value={client.client_code} />
                  <Field
                    label="Client type"
                    value={isMigrated ? "Old (Migrated)" : "New"}
                    highlight={isMigrated ? "migrated" : "new"}
                  />
                  <Field label="Date of birth" value={client.date_of_birth ? fullDate(client.date_of_birth) : "—"} />
                  <Field label="Gender" value={client.gender ? (client.gender === "male" ? "Male" : "Female") : "—"} />
                  <Field label="Telephone" value={client.phone} />
                  <Field label="Alternate phone" value={client.alt_phone ?? "—"} />
                  <Field label="Ghana Card no." value={client.ghana_card_number ?? "—"} />
                  <Field label="Occupation" value={client.occupation ?? "—"} />
                  <Field label="Town / location" value={client.town ?? "—"} />
                  <Field label="Address" value={client.residential_address ?? "—"} />
                  <Field
                    label="Next of kin"
                    value={[client.next_of_kin_name, client.next_of_kin_phone].filter(Boolean).join(" · ") || "—"}
                  />
                  <Field label="SMS notifications" value={client.sms_opt_in ? "Opted in" : "Opted out"} />
                </div>
                <div className="flex h-28 w-24 shrink-0 items-center justify-center justify-self-start rounded-md border border-dashed border-[#0033AA]/25 bg-[#0033AA]/[0.03] sm:justify-self-end">
                  {client.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.photo_url} alt={client.full_name} className="h-full w-full rounded-md object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[10px] text-[#0A2240]/35">
                      <UserRound size={20} />
                      Passport photo
                    </span>
                  )}
                </div>
              </div>
            </Section>

            {/* Account / transaction details */}
            <Section title="Account details">
              {account ? (
                <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                  <Field label="Account type" value={PRODUCT_LABEL[account.product_type]} />
                  <Field label="Account number" value={account.account_number} />
                  <Field label="Opening date" value={fullDate(account.opening_date)} />
                  <Field label="Status" value={account.status[0].toUpperCase() + account.status.slice(1)} />
                  {account.product_type === "savings" && (
                    <Field label="Opening deposit" value={account.minimum_opening_deposit != null ? formatGHS(account.minimum_opening_deposit) : "—"} />
                  )}
                  {account.product_type === "susu" && (
                    <Field label="Daily contribution" value={account.daily_contribution_amount != null ? formatGHS(account.daily_contribution_amount) : "—"} />
                  )}
                  {account.product_type === "fixed_deposit" && (
                    <>
                      <Field label="Principal amount" value={account.principal_amount != null ? formatGHS(account.principal_amount) : "—"} />
                      <Field label="Tenor" value={account.tenor_days != null ? `${account.tenor_days} days` : "—"} />
                      <Field label="Maturity date" value={account.maturity_date ? fullDate(account.maturity_date) : "—"} />
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-[#0A2240]/45">No account opened at registration.</p>
              )}
            </Section>

            {/* Office use */}
            <div className="mt-2 rounded-md border border-[#0A2240]/12 px-5 py-4">
              <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#0A2240]/45">Office use</p>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                <Field label="Account name" value={client.full_name} />
                <Field label="Account number" value={account?.account_number ?? fdNumber ?? "—"} />
                <Field label="Branch" value={account?.branch ?? "Asuom"} />
                <Field label="Registered by" value={registeredBy ?? "—"} />
              </div>
              <div className="mt-6 flex items-end justify-between gap-6 text-[12px] text-[#0A2240]/55">
                <p className="border-t border-[#0A2240]/25 pt-1.5">Manager&apos;s signature</p>
              </div>
            </div>

            {/* Signature footer */}
            <div className="mt-7 flex flex-col gap-6 text-[12px] text-[#0A2240]/55 sm:flex-row sm:items-end sm:justify-between">
              <p className="border-t border-[#0A2240]/25 pt-1.5 sm:w-1/2">Client signature / thumb print</p>
              <p className="border-t border-[#0A2240]/25 pt-1.5 sm:w-1/3">Date: ____________________</p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
              <p>
                Printed:{" "}
                {printedAt
                  ? `${printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${printedAt.toLocaleTimeString("en-GB")}`
                  : "—"}
              </p>
              <p>Processed by: {processedBy ?? "—"}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#0A2240]/10 py-4">
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#0A2240]/45">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: "new" | "migrated" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
      {highlight ? (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
            highlight === "migrated"
              ? "bg-[#B58A2A]/12 text-[#8A6A1F]"
              : "bg-[#0033AA]/10 text-[#0033AA]"
          }`}
        >
          {value}
        </span>
      ) : (
        <p className="text-[13.5px] font-medium text-[#0A2240]">{value}</p>
      )}
    </div>
  );
}
