"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function EditCodeButton({
  table,
  id,
  field,
  label,
  currentValue,
}: {
  table: "clients" | "accounts" | "loans";
  id: string;
  field: "client_code" | "account_number" | "loan_code";
  label: string;
  currentValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setOpen(false);
    setError(null);
    setValue(currentValue);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      setError(`${label} cannot be empty.`);
      return;
    }
    if (trimmed === currentValue) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from(table)
      .update({ [field]: trimmed })
      .eq("id", id);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? `"${trimmed}" is already used by another record. Choose a different value.`
          : updateError.message
      );
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Edit ${label}`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#0033AA]/45 transition-colors hover:bg-[#0033AA]/6 hover:text-[#0033AA]"
      >
        <Pencil size={11} />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0033AA]">Edit {label}</h3>
                <p className="mt-0.5 text-[12px] text-[#0A2240]/50">Must be unique. Will be saved in uppercase.</p>
              </div>
              <button type="button" onClick={handleClose} className="ml-4 text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">{label}</span>
                <input
                  type="text"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 font-mono text-[14px] uppercase tracking-wide outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
