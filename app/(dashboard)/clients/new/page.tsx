"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui";

// Postgres surfaces unique-constraint violations as raw constraint-name
// messages (e.g. `duplicate key value violates unique constraint
// "clients_phone_unique"`). Translate code 23505 into something a
// non-technical front-desk user can act on.
const FD_TERM_OPTIONS = [3, 6, 9, 12, 18, 24];

function friendlyInsertError(error: { code?: string; message: string }) {
  if (error.code === "23505" && error.message.includes("phone")) {
    return "A client with this phone number is already registered. Search for them instead of creating a duplicate.";
  }
  return error.message;
}

export default function NewClientPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [smsOptIn, setSmsOptIn] = useState(true);
  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "",
    phone: "",
    alt_phone: "",
    ghana_card_number: "",
    occupation: "",
    town: "",
    residential_address: "",
    next_of_kin_name: "",
    next_of_kin_phone: "",
    account_type: "",
    opening_deposit: "",
    daily_contribution_amount: "",
    principal: "",
    annual_rate_percent: "",
    term_months: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || !form.phone.trim()) {
      setError("Full name and phone number are required.");
      return;
    }

    if (!form.account_type) {
      setError("Select an account type to open for this client.");
      return;
    }

    if (form.account_type === "susu" && !(Number(form.daily_contribution_amount) > 0)) {
      setError("Enter the agreed daily contribution amount.");
      return;
    }

    if (form.account_type === "fixed_deposit") {
      if (!(Number(form.principal) > 0)) {
        setError("Enter the fixed deposit principal amount.");
        return;
      }
      if (!(Number(form.annual_rate_percent) >= 0)) {
        setError("Enter the fixed deposit's annual interest rate.");
        return;
      }
      if (!FD_TERM_OPTIONS.includes(Number(form.term_months))) {
        setError("Select the fixed deposit's term.");
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      let photo_url: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("client-photos")
          .upload(path, photoFile, { upsert: false });

        if (uploadError) throw new Error("Photo upload failed: " + uploadError.message);

        const { data: publicUrlData } = supabase.storage.from("client-photos").getPublicUrl(path);
        photo_url = publicUrlData.publicUrl;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: inserted, error: insertError } = await supabase
        .from("clients")
        .insert({
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          phone: form.phone.trim(),
          alt_phone: form.alt_phone.trim() || null,
          ghana_card_number: form.ghana_card_number.trim() || null,
          occupation: form.occupation.trim() || null,
          town: form.town.trim() || null,
          residential_address: form.residential_address.trim() || null,
          next_of_kin_name: form.next_of_kin_name.trim() || null,
          next_of_kin_phone: form.next_of_kin_phone.trim() || null,
          sms_opt_in: smsOptIn,
          photo_url,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(friendlyInsertError(insertError));

      if (form.account_type === "fixed_deposit") {
        // Fixed deposits are lump-sum term placements with their own
        // maturity/rollover lifecycle — they live in `fixed_deposits`,
        // not the shared `accounts` ledger table, so they're opened via
        // the dedicated route (which calls the `open_fixed_deposit` RPC).
        const res = await fetch("/api/fixed-deposits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: inserted.id,
            principal: Number(form.principal),
            annual_rate_percent: Number(form.annual_rate_percent),
            term_months: Number(form.term_months),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error("Client saved, but opening the fixed deposit failed: " + json.error);
      } else {
        const accountInsert: Record<string, unknown> = {
          client_id: inserted.id,
          product_type: form.account_type,
          created_by: user?.id ?? null,
        };

        if (form.account_type === "savings") {
          const opening = form.opening_deposit ? Number(form.opening_deposit) : 0;
          accountInsert.balance = opening;
          accountInsert.minimum_opening_deposit = form.opening_deposit ? opening : null;
        } else if (form.account_type === "susu") {
          accountInsert.daily_contribution_amount = Number(form.daily_contribution_amount);
          accountInsert.cycle_length_days = 31;
        }

        const { error: accountError } = await supabase.from("accounts").insert(accountInsert);
        if (accountError) throw new Error("Client saved, but opening the account failed: " + accountError.message);
      }

      // Flat registration/card fee — recorded to the card_fees ledger for
      // dashboard reconciliation. This must be non-blocking (a failure must
      // not roll back a completed registration), but we surface any error
      // as a non-fatal warning so it can be investigated and backfilled.
      try {
        const { data: feeSetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "card_fee_amount")
          .maybeSingle<{ value: number }>();
        const rawFee = feeSetting?.value;
        const cardFeeAmount = typeof rawFee === "number" ? rawFee : typeof rawFee === "string" ? Number(rawFee) : 20;

        const { error: feeError } = await supabase.from("card_fees").insert({
          client_id: inserted.id,
          amount: cardFeeAmount,
          charged_by: user?.id ?? null,
        });
        if (feeError) console.error("card_fees insert failed:", feeError.message);
      } catch (feeErr) {
        console.error("card_fees block threw:", feeErr);
      }

      window.location.href = `/clients/${inserted.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back="/clients"
        eyebrow="Clients"
        title="Register a new client"
        description="Capture the client's details and a clear photo for identification."
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div role="alert" className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] text-[#963522]">
            {error}
          </div>
        )}

        {/* Photo capture */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Client photo</h2>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#0033AA]/20 bg-[#0033AA]/[0.03] sm:h-28 sm:w-28">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Client preview" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={36} className="text-[#0033AA]/25" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/20 px-4 py-2 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
                >
                  <Camera size={15} />
                  {photoPreview ? "Change photo" : "Upload photo"}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-[#0A2240]/45 transition-colors hover:text-[#963522]"
                  >
                    <X size={14} />
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#0A2240]/45">JPG or PNG, clear face photo. Max 5MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </section>

        {/* Personal details */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Personal details</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={form.full_name} onChange={(v) => update("full_name", v)} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.date_of_birth} onChange={(v) => update("date_of_birth", v)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(v) => update("gender", v)}>
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            </Field>
            <Field label="Occupation">
              <Input value={form.occupation} onChange={(v) => update("occupation", v)} />
            </Field>
            <Field label="Ghana Card number">
              <Input value={form.ghana_card_number} onChange={(v) => update("ghana_card_number", v)} />
            </Field>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Contact &amp; address</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Phone number" required>
              <Input value={form.phone} onChange={(v) => update("phone", v)} />
            </Field>
            <Field label="Alternate phone">
              <Input value={form.alt_phone} onChange={(v) => update("alt_phone", v)} />
            </Field>
            <Field label="Town">
              <Input value={form.town} onChange={(v) => update("town", v)} />
            </Field>
            <Field label="Residential address" full>
              <Textarea value={form.residential_address} onChange={(v) => update("residential_address", v)} />
            </Field>
          </div>
        </section>

        {/* Next of kin */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Next of kin</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.next_of_kin_name} onChange={(v) => update("next_of_kin_name", v)} />
            </Field>
            <Field label="Phone number">
              <Input value={form.next_of_kin_phone} onChange={(v) => update("next_of_kin_phone", v)} />
            </Field>
          </div>
        </section>

        {/* SMS notifications */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">SMS notifications</h2>
          <label className="flex items-center justify-between gap-3 text-[13.5px] text-[#0A2240]">
            <div>
              <span className="font-medium">Opt in to SMS notifications</span>
              <p className="mt-0.5 text-[12px] text-[#0A2240]/45">
                Client will receive transaction alerts. A monthly SMS fee will be deducted from their account.
              </p>
            </div>
            <span
              onClick={() => setSmsOptIn((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                smsOptIn ? "bg-[#0033AA]" : "bg-[#0A2240]/15"
              }`}
            >
              <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                  smsOptIn ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </section>

        {/* Account to open */}
        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Account to open</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Account type" required>
              <Select
                value={form.account_type}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    account_type: v,
                    opening_deposit: "",
                    daily_contribution_amount: "",
                    principal: "",
                    annual_rate_percent: "",
                    term_months: "",
                  }))
                }
              >
                <option value="">Select account type</option>
                <option value="savings">Savings</option>
                <option value="susu">Daily Susu</option>
                <option value="fixed_deposit">Fixed Deposit</option>
              </Select>
            </Field>

            {form.account_type === "savings" && (
              <Field label="Opening deposit (GHS)">
                <Input
                  type="number"
                  value={form.opening_deposit}
                  onChange={(v) => update("opening_deposit", v)}
                 
                />
              </Field>
            )}

            {form.account_type === "susu" && (
              <Field label="Daily contribution amount (GHS)" required>
                <Input
                  type="number"
                  value={form.daily_contribution_amount}
                  onChange={(v) => update("daily_contribution_amount", v)}
                 
                />
              </Field>
            )}

            {form.account_type === "fixed_deposit" && (
              <>
                <Field label="Principal amount (GHS)" required>
                  <Input
                    type="number"
                    value={form.principal}
                    onChange={(v) => update("principal", v)}
                   
                  />
                </Field>
                <Field label="Annual interest rate (%)" required>
                  <Input
                    type="number"
                    value={form.annual_rate_percent}
                    onChange={(v) => update("annual_rate_percent", v)}
                   
                  />
                </Field>
                <Field label="Term" required>
                  <Select value={form.term_months} onChange={(v) => update("term_months", v)}>
                    <option value="">Select term</option>
                    {FD_TERM_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} months
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </div>
          {form.account_type === "susu" && (
            <p className="mt-3 text-[12px] text-[#0A2240]/45">
              Standard cycle is 31 days; the collector keeps one day&apos;s contribution as commission at cycle-end.
            </p>
          )}
          {form.account_type === "fixed_deposit" && (
            <p className="mt-3 text-[12px] text-[#0A2240]/45">
              Maturity date and expected interest are computed automatically (simple interest) from the principal,
              rate and term. Early withdrawal forfeits all accrued interest.
            </p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-6 py-3 text-[14px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Registering…" : "Register client"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md px-5 py-3 text-[14px] font-medium text-[#0A2240]/55 transition-colors hover:text-[#0A2240]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">
        {label} {required && <span className="text-[#0062E1]">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  label?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
    />
  );
}

function Textarea({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      rows={3}
      className="w-full resize-none rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
    >
      {children}
    </select>
  );
}
