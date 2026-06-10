"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#002884]"
      }
    >
      <Printer size={15} />
      {label}
    </button>
  );
}
