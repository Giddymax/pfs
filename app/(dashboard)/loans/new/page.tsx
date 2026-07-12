"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui";
import { computeLoanSchedule, formatGHS, addMonths, toISODate } from "@/lib/loan";
import type { Client } from "@/lib/types";

export default function NewLoanPage() {
  return (
    <Suspense fallback={null}>
      <NewLoanForm />
    </Suspense>
  );
}

function NewLoanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client");

  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [principal, setPrincipal] = useState("");
  const [ratePercent, setRatePercent] = useState("10");
  const [tenorMonths, setTenorMonths] = useState("6");
  const [processingFee, setProcessingFee] = useState("0");
  const [purpose, setPurpose] = useState("");
  const [disbursementDate, setDisbursementDate] = useState(toISODate(new Date()));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("clients").select("*").order("full_name").returns<Client[]>();
      setClients(data ?? []);
      if (preselectedClientId) {
        const match = (data ?? []).find((c) => c.id === preselectedClientId);
        if (match) setSelectedClient(match);
      }
      setLoadingClients(false);
    })();
  }, [preselectedClientId]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const term = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.client_code.toLowerCase().includes(term)
    );
  }, [clients, search]);

  const principalNum = Number(principal) || 0;
  const rateNum = Number(ratePercent) || 0;
  const tenorNum = Number(tenorMonths) || 0;
  const processingFeeNum = Number(processingFee) || 0;

  const schedule = useMemo(() => {
    if (principalNum <= 0 || tenorNum <= 0) return null;
    return computeLoanSchedule(principalNum, rateNum, tenorNum);
  }, [principalNum, rateNum, tenorNum]);

  const dueDate = useMemo(() => {
    if (!disbursementDate || tenorNum <= 0) return null;
    return toISODate(addMonths(new Date(disbursementDate), tenorNum));
  }, [disbursementDate, tenorNum]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError("Select the client this loan is for.");
      return;
    }
    if (principalNum <= 0) {
      setError("Enter a loan amount greater than zero.");
      return;
    }
    if (tenorNum <= 0) {
      setError("Enter a tenor of at least 1 month.");
      return;
    }
    if (!schedule) return;

    setSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: inserted, error: insertError } = await supabase
        .from("loans")
        .insert({
          client_id: selectedClient.id,
          principal: principalNum,
          flat_rate_percent: rateNum,
          tenor_months: tenorNum,
          total_interest: schedule.totalInterest,
          total_repayable: schedule.totalRepayable,
          monthly_installment: schedule.monthlyInstallment,
          processing_fee: processingFeeNum,
          purpose: purpose.trim() || null,
          status: "pending",
          current_balance: schedule.totalRepayable,
          issued_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      window.location.href = `/loans/${inserted.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/loans" eyebrow="Loans" title="Issue a new loan" description="Set the principal, flat interest rate and tenor — the repayment schedule is calculated automatically." />

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div role="alert" className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] text-[#963522]">
            {error}
          </div>
        )}

        {/* Client picker */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Client</h2>

          {selectedClient ? (
            <div className="flex items-center justify-between rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.03] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-white text-[12px] font-semibold text-[#0033AA]">
                  {selectedClient.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedClient.photo_url} alt={selectedClient.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={18} className="text-[#0033AA]/30" />
                  )}
                </span>
                <div>
                  <p className="text-[14px] font-medium text-[#0A2240]">{selectedClient.full_name}</p>
                  <p className="text-[12px] text-[#0A2240]/45">{selectedClient.client_code} · {selectedClient.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  setShowPicker(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[#0A2240]/45 hover:text-[#963522]"
              >
                <X size={13} /> Change
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0033AA]/35" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowPicker(true);
                  }}
                  onFocus={() => setShowPicker(true)}
                 
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </div>
              {loadingClients ? (
                <p className="px-1 text-[13px] text-[#0A2240]/45">Loading clients…</p>
              ) : showPicker && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#0033AA]/10">
                  {filteredClients.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[13px] text-[#0A2240]/45">No matching clients.</p>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setSelectedClient(c);
                          setShowPicker(false);
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-3 border-b border-[#0033AA]/6 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-[#0033AA]/[0.03]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[11px] font-semibold text-[#0033AA]">
                          {c.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                          ) : (
                            initials(c.full_name)
                          )}
                        </span>
                        <span>
                          <span className="block text-[13.5px] font-medium text-[#0A2240]">{c.full_name}</span>
                          <span className="block text-[12px] text-[#0A2240]/45">{c.client_code} · {c.phone}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Loan terms */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Loan terms</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Principal amount (GHS)" required>
              <input
                type="number"
                min="0"
                step="0.01"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
               
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </Field>
            <Field label="Flat interest rate (%)" required>
              <input
                type="number"
                min="0"
                step="0.1"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </Field>
            <Field label="Tenor (months)" required>
              <input
                type="number"
                min="1"
                step="1"
                value={tenorMonths}
                onChange={(e) => setTenorMonths(e.target.value)}
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </Field>
            <Field label="Expected disbursement date" required>
              <input
                type="date"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
              <span className="mt-1 block text-[11.5px] text-[#0A2240]/40">
                For the schedule preview only — the loan starts as pending and an admin sets the actual disbursement date on activation.
              </span>
            </Field>
            <Field label="Processing fee (GHS)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={processingFee}
                onChange={(e) => setProcessingFee(e.target.value)}
               
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </Field>
            <Field label="Purpose" full>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
               
                className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
              />
            </Field>
          </div>
        </section>

        {/* Live schedule preview */}
        {schedule && (
          <section className="rounded-xl border border-[#0033AA]/15 bg-[#0033AA]/[0.035] p-6">
            <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Repayment schedule preview</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Preview label="Total interest" value={formatGHS(schedule.totalInterest)} />
              <Preview label="Total repayable" value={formatGHS(schedule.totalRepayable)} />
              <Preview label="Monthly installment" value={formatGHS(schedule.monthlyInstallment)} />
              <Preview label="Estimated due date" value={dueDate ? new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-[#0A2240]/45">
              Flat-rate calculation: interest = principal × rate, repayable = principal + interest, spread evenly over {tenorNum || "—"} month{tenorNum === 1 ? "" : "s"}.
              The due date shown is an estimate based on the expected disbursement date — the real due date is set from the actual disbursement date when an admin activates this loan.
            </p>
          </section>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-6 py-3 text-[14px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Issuing…" : "Issue loan"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-md px-5 py-3 text-[14px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-3" : ""}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">
        {label} {required && <span className="text-[#0062E1]">*</span>}
      </span>
      {children}
    </label>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/40">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-[#0033AA]">{value}</p>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
