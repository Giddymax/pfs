"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportCsvButton({
  endpoint,
  filename,
  label = "Export CSV",
  params,
}: {
  endpoint: string;
  filename: string;
  label?: string;
  params?: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (params) {
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-2 text-[12.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5 disabled:opacity-60"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {label}
    </button>
  );
}
