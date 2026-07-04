"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Loader2 } from "lucide-react";

const CATEGORIES = [
  "Salaries",
  "Rent",
  "Utilities",
  "Transport",
  "Office Supplies",
  "Marketing",
  "Maintenance",
  "Miscellaneous",
];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddExpenditureButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Miscellaneous");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");

  function handleClose() {
    setOpen(false);
    setError(null);
    setTitle("");
    setAmount("");
    setCategory("Miscellaneous");
    setDate(todayLocal());
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, amount: Number(amount), category, date, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save");
      } else {
        handleClose();
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884]"
      >
        <Plus size={14} />
        Add expenditure
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Record expenditure</h3>
              <button type="button" onClick={handleClose} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Description *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Staff salary – June"
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Amount (GHS) *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional details…"
                  className="w-full resize-none rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1]"
                />
              </div>

              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteExpenditureButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenditures/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to delete");
        setLoading(false);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-[#0A2240]/30 transition-colors hover:bg-[#B3432B]/8 hover:text-[#963522]"
        title="Delete"
      >
        <Trash2 size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Delete expenditure?</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
              &ldquo;{title}&rdquo; will be permanently removed from the expenditure log.
            </p>
            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#963522] disabled:opacity-60"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
