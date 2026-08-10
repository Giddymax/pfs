"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";

interface Candidate {
  id: string;
  client_code: string;
  full_name: string;
  phone: string;
  status: string;
  created_at: string;
  total_balance: number;
  accounts_count: number;
  has_active_loan: boolean;
  deletable: boolean;
  block_reason: string | null;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dormant", label: "Dormant" },
  { value: "suspended", label: "Suspended" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function downloadBlob(res: Response, filename: string) {
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export function BulkDeleteClientsTool() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [zeroBalanceOnly, setZeroBalanceOnly] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deletedCount: number; skipped: { id: string; name: string; reason: string }[] } | null>(null);

  const hasAnyFilter = !!from || !!to || statuses.size > 0 || zeroBalanceOnly;

  const deletable = useMemo(() => (candidates ?? []).filter((c) => c.deletable), [candidates]);
  const blocked = useMemo(() => (candidates ?? []).filter((c) => !c.deletable), [candidates]);
  const selectedCount = selectedIds.size;
  const requiredPhrase = `DELETE ${selectedCount} CLIENTS`;
  const confirmMatches = confirmText.trim() === requiredPhrase && selectedCount > 0;

  function toggleStatus(value: string) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  async function handleSearch() {
    setSearchError(null);
    setResult(null);
    setSearching(true);
    try {
      const res = await fetch("/api/clients/bulk-delete/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from || null,
          to: to || null,
          statuses: [...statuses],
          zero_balance_only: zeroBalanceOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not search for matching clients.");
      const rows = json.candidates as Candidate[];
      setCandidates(rows);
      setSelectedIds(new Set(rows.filter((c) => c.deletable).map((c) => c.id)));
      setConfirmText("");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Could not search for matching clients.");
      setCandidates(null);
    } finally {
      setSearching(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(deletable.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleDelete() {
    if (!confirmMatches) return;
    setSubmitError(null);
    setSubmitting(true);
    const ids = [...selectedIds];
    try {
      // Backup export must succeed before anything is deleted.
      const exportRes = await fetch("/api/clients/bulk-delete/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!exportRes.ok) {
        const j = await exportRes.json().catch(() => null);
        throw new Error(j?.error ?? "Backup export failed — deletion was not performed.");
      }
      await downloadBlob(exportRes, `bulk-delete-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);

      const delRes = await fetch("/api/clients/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const delJson = await delRes.json();
      if (!delRes.ok) throw new Error(delJson.error ?? "Delete failed.");

      setResult({ deletedCount: delJson.deletedCount, skipped: delJson.skipped ?? [] });
      const deletedSet = new Set<string>(delJson.deletedIds ?? []);
      setCandidates((prev) => (prev ?? []).filter((c) => !deletedSet.has(c.id)));
      setSelectedIds(new Set());
      setConfirmText("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-[#0033AA]/8 bg-white p-5 shadow-sm">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0033AA]">Filters</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Registered from</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Registered to</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  statuses.has(opt.value)
                    ? "bg-[#0033AA] text-white"
                    : "border border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30 hover:text-[#0A2240]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#0A2240]/40">Leave all unselected to match every status.</p>
        </div>

        <label className="mt-4 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={zeroBalanceOnly}
            onChange={(e) => setZeroBalanceOnly(e.target.checked)}
            className="h-4 w-4 rounded border-[#0033AA]/30 text-[#0033AA] focus:ring-[#0062E1]"
          />
          <span className="text-[13px] text-[#0A2240]/75">Only clients with zero balance / no accounts</span>
        </label>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSearch}
            disabled={!hasAnyFilter || searching}
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-50"
          >
            {searching && <Loader2 size={14} className="animate-spin" />}
            {searching ? "Searching…" : "Search"}
          </button>
          {!hasAnyFilter && (
            <p className="text-[12px] text-[#0A2240]/40">Set at least one filter to search.</p>
          )}
        </div>

        {searchError && (
          <div className="mt-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
            {searchError}
          </div>
        )}
      </div>

      {/* Result banner */}
      {result && (
        <div className="rounded-xl border border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.06] px-5 py-4 text-[13.5px] text-[#166534]">
          <p className="font-semibold">{result.deletedCount} client{result.deletedCount !== 1 ? "s" : ""} deleted. Backup downloaded.</p>
          {result.skipped.length > 0 && (
            <div className="mt-2 text-[#B45309]">
              <p className="font-medium">{result.skipped.length} skipped at the last moment (their state changed since search):</p>
              <ul className="mt-1 list-disc pl-5">
                {result.skipped.map((s) => (
                  <li key={s.id}>{s.name} — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {candidates !== null && (
        <div className="space-y-4">
          <p className="text-[13px] text-[#0A2240]/60">
            <strong className="text-[#0A2240]">{candidates.length}</strong> client{candidates.length !== 1 ? "s" : ""} matched —{" "}
            <strong className="text-[#1F6E4A]">{deletable.length}</strong> safe to delete,{" "}
            <strong className="text-[#B45309]">{blocked.length}</strong> blocked.
          </p>

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#0033AA]/15 bg-white/60 px-6 py-10 text-center text-[13px] text-[#0A2240]/45">
              No clients match these filters.
            </div>
          ) : (
            <>
              {deletable.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[#0A2240]/8 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#0A2240]/8 px-5 py-3">
                    <h3 className="text-[13px] font-semibold text-[#0A2240]">Safe to delete ({deletable.length})</h3>
                    <div className="flex gap-3 text-[12px] font-medium">
                      <button type="button" onClick={selectAll} className="text-[#0033AA] hover:underline">Select all</button>
                      <button type="button" onClick={deselectAll} className="text-[#0A2240]/45 hover:underline">Deselect all</button>
                    </div>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="w-full min-w-[640px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#0A2240]/45">
                          <th className="w-10 px-4 py-2.5" />
                          <th className="px-4 py-2.5 font-semibold">Client</th>
                          <th className="px-4 py-2.5 font-semibold">Phone</th>
                          <th className="px-4 py-2.5 font-semibold">Status</th>
                          <th className="px-4 py-2.5 font-semibold">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0A2240]/6">
                        {deletable.map((c) => (
                          <tr key={c.id} className="hover:bg-[#0033AA]/[0.02]">
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={() => toggleSelect(c.id)}
                                className="h-4 w-4 rounded border-[#0033AA]/30 text-[#0033AA] focus:ring-[#0062E1]"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-[#0A2240]">{c.full_name}</p>
                              <p className="text-[11px] text-[#0A2240]/40">{c.client_code}</p>
                            </td>
                            <td className="px-4 py-2.5 text-[#0A2240]/60">{c.phone}</td>
                            <td className="px-4 py-2.5 text-[#0A2240]/60 capitalize">{c.status}</td>
                            <td className="px-4 py-2.5 text-[#0A2240]/60">{fmtDate(c.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {blocked.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[#B45309]/20 bg-[#B45309]/[0.03] shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#B45309]/15 px-5 py-3">
                    <ShieldAlert size={15} className="text-[#B45309]" />
                    <h3 className="text-[13px] font-semibold text-[#B45309]">Blocked — not deletable ({blocked.length})</h3>
                  </div>
                  <ul className="divide-y divide-[#B45309]/10">
                    {blocked.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[13px]">
                        <div>
                          <span className="font-medium text-[#0A2240]">{c.full_name}</span>
                          <span className="ml-1.5 text-[11px] text-[#0A2240]/40">{c.client_code}</span>
                        </div>
                        <span className="text-[12px] text-[#B45309]">{c.block_reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Confirm & delete */}
      {selectedCount > 0 && (
        <div className="rounded-xl border border-[#B3432B]/25 bg-[#B3432B]/[0.04] p-5">
          <div className="mb-3 flex items-start gap-2.5">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#963522]" />
            <p className="text-[13.5px] leading-relaxed text-[#963522]">
              This permanently deletes <strong>{selectedCount}</strong> client{selectedCount !== 1 ? "s" : ""} and everything tied to
              them — accounts, transactions, loans, fixed deposits, susu history. A backup Excel file downloads automatically the
              moment you confirm, before anything is removed. This cannot be undone.
            </p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-[#963522]">
              Type <code className="rounded bg-[#963522]/10 px-1.5 py-0.5 font-mono">{requiredPhrase}</code> to confirm
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={requiredPhrase}
              className="w-full max-w-sm rounded-md border border-[#B3432B]/25 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#963522]"
            />
          </label>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmMatches || submitting}
              className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {submitting ? "Deleting…" : `Download backup & delete ${selectedCount}`}
            </button>
          </div>
          {submitError && (
            <div className="mt-4 rounded-md border border-[#B3432B]/25 bg-white px-3.5 py-2.5 text-[12.5px] text-[#963522]">
              {submitError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
