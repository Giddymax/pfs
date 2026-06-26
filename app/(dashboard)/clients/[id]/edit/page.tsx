"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui";
import type { Client } from "@/lib/types";

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [smsOptIn, setSmsOptIn] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "",
    phone: "",
    alt_phone: "",
    ghana_card_number: "",
    occupation: "",
    residential_address: "",
    next_of_kin_name: "",
    next_of_kin_phone: "",
    status: "active",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
      if (profile?.role !== "admin") {
        if (!cancelled) {
          setForbidden(true);
          setLoading(false);
        }
        return;
      }

      const { data: client } = await supabase.from("clients").select("*").eq("id", id).single<Client>();
      if (!client) {
        router.replace("/clients");
        return;
      }

      if (!cancelled) {
        setForm({
          full_name: client.full_name,
          date_of_birth: client.date_of_birth ?? "",
          gender: client.gender ?? "",
          phone: client.phone,
          alt_phone: client.alt_phone ?? "",
          ghana_card_number: client.ghana_card_number ?? "",
          occupation: client.occupation ?? "",
          residential_address: client.residential_address ?? "",
          next_of_kin_name: client.next_of_kin_name ?? "",
          next_of_kin_phone: client.next_of_kin_phone ?? "",
          status: client.status,
        });
        setSmsOptIn(client.sms_opt_in);
        setExistingPhotoUrl(client.photo_url);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

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

  function clearNewPhoto() {
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

    setSubmitting(true);
    const supabase = createClient();

    try {
      let photo_url = existingPhotoUrl;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("client-photos").upload(path, photoFile, { upsert: false });
        if (uploadError) throw new Error("Photo upload failed: " + uploadError.message);
        const { data: publicUrlData } = supabase.storage.from("client-photos").getPublicUrl(path);
        photo_url = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          phone: form.phone.trim(),
          alt_phone: form.alt_phone.trim() || null,
          ghana_card_number: form.ghana_card_number.trim() || null,
          occupation: form.occupation.trim() || null,
          residential_address: form.residential_address.trim() || null,
          next_of_kin_name: form.next_of_kin_name.trim() || null,
          next_of_kin_phone: form.next_of_kin_phone.trim() || null,
          status: form.status,
          sms_opt_in: smsOptIn,
          photo_url,
        })
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);

      window.location.href = `/clients/${id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="px-1 py-10 text-[14px] text-[#0A2240]/45">Loading client…</div>;
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[#0033AA]/8 bg-white px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-[#0033AA]">Administrators only</p>
        <p className="mt-1.5 text-[13.5px] text-[#0A2240]/55">Editing client records is restricted to administrators. Contact your branch admin if changes are needed.</p>
        <button onClick={() => router.back()} className="mt-5 rounded-md border border-[#0033AA]/20 px-4 py-2 text-[13px] font-medium text-[#0033AA] hover:bg-[#0033AA]/5">
          Go back
        </button>
      </div>
    );
  }

  const displayedPhoto = photoPreview ?? existingPhotoUrl;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Clients" title="Edit client details" description="Update the client's information. Changes are saved immediately." />

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div role="alert" className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] text-[#963522]">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Client photo</h2>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#0033AA]/20 bg-[#0033AA]/[0.03] sm:h-28 sm:w-28">
              {displayedPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayedPhoto} alt="Client" className="h-full w-full object-cover" />
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
                  Replace photo
                </button>
                {photoPreview && (
                  <button type="button" onClick={clearNewPhoto} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-[#0A2240]/45 hover:text-[#963522]">
                    <X size={14} /> Undo change
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#0A2240]/45">JPG or PNG, clear face photo. Max 5MB.</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png, image/jpeg" onChange={handlePhotoChange} className="hidden" />
          </div>
        </section>

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
            <Field label="Account status">
              <Select value={form.status} onChange={(v) => update("status", v)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-[#0033AA]/8 bg-white p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#0033AA]">Contact &amp; address</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Phone number" required>
              <Input value={form.phone} onChange={(v) => update("phone", v)} />
            </Field>
            <Field label="Alternate phone">
              <Input value={form.alt_phone} onChange={(v) => update("alt_phone", v)} />
            </Field>
            <Field label="Residential address" full>
              <Textarea value={form.residential_address} onChange={(v) => update("residential_address", v)} />
            </Field>
          </div>
        </section>

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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-6 py-3 text-[14px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Saving…" : "Save changes"}
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
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-[#0033AA]/75">
        {label} {required && <span className="text-[#0062E1]">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
    />
  );
}

function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-none rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
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
