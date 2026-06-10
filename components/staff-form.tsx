"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

// ──────────────────────────────────────────────
// Add staff
// ──────────────────────────────────────────────

export function AddStaffButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884]"
      >
        <Plus size={14} />
        Add staff
      </button>
      {open && <StaffModal mode="create" onClose={() => setOpen(false)} />}
    </>
  );
}

// ──────────────────────────────────────────────
// Edit staff
// ──────────────────────────────────────────────

export function EditStaffButton({
  profileId,
  fullName,
  role,
}: {
  profileId: string;
  fullName: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11.5px] font-medium text-[#0033AA]/65 transition-colors hover:bg-[#0033AA]/8 hover:text-[#0033AA]"
      >
        <Pencil size={12} />
        Edit
      </button>
      {open && (
        <StaffModal
          mode="edit"
          profileId={profileId}
          defaultFullName={fullName}
          defaultRole={role}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Delete staff
// ──────────────────────────────────────────────

export function DeleteStaffButton({
  profileId,
  fullName,
}: {
  profileId: string;
  fullName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/staff/${profileId}`, { method: "DELETE" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }
    router.refresh();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11.5px] font-medium text-[#963522]/70 transition-colors hover:bg-[#B3432B]/8 hover:text-[#963522]"
      >
        <Trash2 size={12} />
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Delete staff account?</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-[#0A2240]/35 hover:text-[#0A2240]"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
              This permanently removes <strong className="text-[#0A2240]">{fullName}</strong>&apos;s login and profile. They
              will immediately lose access. This cannot be undone.
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

// ──────────────────────────────────────────────
// Shared modal (create / edit)
// ──────────────────────────────────────────────

type Mode = "create" | "edit";

function StaffModal({
  mode,
  profileId,
  defaultFullName = "",
  defaultRole = "staff",
  onClose,
}: {
  mode: Mode;
  profileId?: string;
  defaultFullName?: string;
  defaultRole?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = mode === "create" ? "/api/staff" : `/api/staff/${profileId}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body =
      mode === "create"
        ? { email, password, full_name: fullName, role }
        : { full_name: fullName, role };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/55 px-4 animate-fade-in">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#0A2240]">
            {mode === "create" ? "Add staff account" : "Edit staff account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#0A2240]/40 transition-colors hover:text-[#0A2240]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="e.g. Ama Mensah"
              className="w-full rounded-md border border-[#0A2240]/15 px-3 py-2.5 text-[13.5px] text-[#0A2240] placeholder:text-[#0A2240]/30 focus:border-[#0033AA] focus:outline-none focus:ring-1 focus:ring-[#0033AA]/20"
            />
          </Field>

          {mode === "create" && (
            <>
              <Field label="Email address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="staff@example.com"
                  className="w-full rounded-md border border-[#0A2240]/15 px-3 py-2.5 text-[13.5px] text-[#0A2240] placeholder:text-[#0A2240]/30 focus:border-[#0033AA] focus:outline-none focus:ring-1 focus:ring-[#0033AA]/20"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-md border border-[#0A2240]/15 px-3 py-2.5 text-[13.5px] text-[#0A2240] placeholder:text-[#0A2240]/30 focus:border-[#0033AA] focus:outline-none focus:ring-1 focus:ring-[#0033AA]/20"
                />
              </Field>
            </>
          )}

          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-[#0A2240]/15 px-3 py-2.5 text-[13.5px] text-[#0A2240] focus:border-[#0033AA] focus:outline-none focus:ring-1 focus:ring-[#0033AA]/20"
            >
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#0A2240]/15 px-4 py-2 text-[13px] font-medium text-[#0A2240]/65 transition-colors hover:bg-[#0A2240]/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving…" : mode === "create" ? "Create account" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
        {label}
      </label>
      {children}
    </div>
  );
}
