"use client";

import { useState } from "react";
import { ArrowUpFromLine, X } from "lucide-react";
import { AccountPicker } from "@/components/account-picker";

/**
 * A "Withdraw" trigger that opens the same search-and-withdraw widget the
 * Withdrawals report page embeds inline (AccountPicker), without leaving
 * the current list. Search finds any account regardless of product type —
 * the picker itself renders the right form once one is selected.
 */
export function WithdrawButtonModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#B3432B]/25 px-3.5 py-2.5 text-[13px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
      >
        <ArrowUpFromLine size={15} />
        Withdraw
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl shadow-xl">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0A2240]/40 shadow-sm hover:text-[#0A2240]"
            >
              <X size={16} />
            </button>
            <AccountPicker mode="withdrawal" />
          </div>
        </div>
      )}
    </>
  );
}
