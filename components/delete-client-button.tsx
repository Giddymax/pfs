"use client";

import { useState } from "react";
import { Trash2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Postgres surfaces FK violations as raw constraint-name messages (e.g.
// `violates foreign key constraint "loans_client_id_fkey" on table "loans"`).
// Translate code 23503 into something a non-technical admin can act on.
function friendlyDeleteError(error: { code?: string; message: string }) {
  if (error.code === "23503") {
    const referencingTable = [...error.message.matchAll(/on table "([^"]+)"/g)].at(-1)?.[1];
    return referencingTable
      ? `This client still has related ${referencingTable} and can't be deleted. Remove or reassign those first.`
      : "This client has related data elsewhere and can't be deleted.";
  }
  return error.message;
}

export function DeleteClientButton({
  id,
  fullName,
  triggerClassName,
}: {
  id: string;
  fullName: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [transferred, setTransferred] = useState<"no" | "yes" | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = transferred === "no" || (transferred === "yes" && note.trim() !== "");

  function handleClose() {
    setOpen(false);
    setTransferred(null);
    setNote("");
    setError(null);
  }

  async function handleDelete() {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("delete_client_with_log", {
      p_client_id: id,
      p_history_transferred: transferred === "yes",
      p_transfer_note: transferred === "yes" ? note.trim() : null,
    });

    if (rpcError) {
      setError(friendlyDeleteError(rpcError));
      setLoading(false);
      return;
    }

    window.location.href = "/clients";
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
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Delete this client?</h3>
              <button onClick={handleClose} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
              This permanently removes <strong>{fullName}</strong> and everything tied to them — accounts,
              transactions, loans, fixed deposits, susu history. This cannot be undone.
            </p>

            <div className="mb-5">
              <p className="mb-2 text-[12.5px] font-medium text-[#0033AA]/75">
                Was this client&apos;s balance or history transferred elsewhere before this deletion?
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 rounded-md border border-[#0033AA]/15 px-3.5 py-2.5 text-[13px] text-[#0A2240] transition-colors has-[:checked]:border-[#0033AA]/40 has-[:checked]:bg-[#0033AA]/[0.04]">
                  <input
                    type="radio"
                    name="transferred"
                    checked={transferred === "no"}
                    onChange={() => setTransferred("no")}
                    className="mt-0.5 h-4 w-4 border-[#0033AA]/30 text-[#0033AA] focus:ring-[#0062E1]"
                  />
                  No — this is a clean removal, nothing to transfer
                </label>
                <label className="flex items-start gap-2.5 rounded-md border border-[#0033AA]/15 px-3.5 py-2.5 text-[13px] text-[#0A2240] transition-colors has-[:checked]:border-[#B45309]/40 has-[:checked]:bg-[#B45309]/[0.04]">
                  <input
                    type="radio"
                    name="transferred"
                    checked={transferred === "yes"}
                    onChange={() => setTransferred("yes")}
                    className="mt-0.5 h-4 w-4 border-[#0033AA]/30 text-[#B45309] focus:ring-[#B45309]"
                  />
                  Yes — their balance or history was moved somewhere first
                </label>
              </div>
              {transferred === "yes" && (
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-[12px] font-medium text-[#B45309]">
                    Where was it transferred? (required)
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Merged into client PFS/26/0050 — duplicate registration; or: balance paid out in cash, receipt #123"
                    rows={3}
                    className="w-full rounded-md border border-[#B45309]/25 bg-white px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-[#B45309]"
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canConfirm || loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-50"
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
