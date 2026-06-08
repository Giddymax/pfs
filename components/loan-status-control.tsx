"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LoanStatus } from "@/lib/types";

const OPTIONS: { value: LoanStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "defaulted", label: "Defaulted" },
  { value: "rejected", label: "Rejected" },
];

export function LoanStatusControl({ loanId, status }: { loanId: string; status: LoanStatus }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [value, setValue] = useState(status);

  async function handleChange(next: LoanStatus) {
    setValue(next);
    setUpdating(true);
    const supabase = createClient();
    await supabase.from("loans").update({ status: next }).eq("id", loanId);
    setUpdating(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as LoanStatus)}
        disabled={updating}
        className="rounded-md border border-[#0033AA]/20 bg-white px-3 py-2 text-[13px] font-medium text-[#0033AA] outline-none transition-colors focus:border-[#0062E1] disabled:opacity-60"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {updating && <Loader2 size={15} className="animate-spin text-[#0033AA]/40" />}
    </div>
  );
}
