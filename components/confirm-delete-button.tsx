"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Postgres surfaces FK violations as raw constraint-name messages (e.g.
// `violates foreign key constraint "loans_client_id_fkey" on table "loans"`).
// Translate code 23503 into something a non-technical admin can act on by
// naming the table that's still referencing this record.
function friendlyDeleteError(error: { code?: string; message: string }) {
  if (error.code === "23503") {
    const referencingTable = [...error.message.matchAll(/on table "([^"]+)"/g)].at(-1)?.[1];
    return referencingTable
      ? `This record still has related ${referencingTable} and can't be deleted. Remove or reassign those first.`
      : "This record has related data elsewhere and can't be deleted.";
  }
  return error.message;
}

export function ConfirmDeleteButton({
  table,
  id,
  label,
  confirmTitle,
  confirmDescription,
  redirectTo,
  triggerClassName,
}: {
  table: string;
  id: string;
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  redirectTo: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);

    if (deleteError) {
      setError(friendlyDeleteError(deleteError));
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-2 rounded-md border border-[#B3432B]/25 px-4 py-2 text-[13px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
        }
      >
        <Trash2 size={14} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">{confirmTitle}</h3>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">{confirmDescription}</p>
            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
