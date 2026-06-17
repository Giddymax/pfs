"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Check, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export function TableFilter({
  param,
  label,
  options,
  current,
  qs,
}: {
  param: string;
  label: string;
  options: FilterOption[];
  current: string | undefined;
  qs: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function navigate(value: string | null) {
    const params = new URLSearchParams(qs);
    if (value == null || value === current) {
      params.delete(param);
    } else {
      params.set(param, value);
    }
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
    setOpen(false);
  }

  const isActive = !!current;
  const activeLabel = isActive ? options.find((o) => o.value === current)?.label : undefined;

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1 whitespace-nowrap">
      <span className={isActive ? "text-[#2CBFBF]" : ""}>{activeLabel ?? label}</span>
      {isActive ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(null); }}
          title="Clear filter"
          className="ml-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#2CBFBF] text-white"
        >
          <X size={8} strokeWidth={3} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          title={`Filter by ${label}`}
          className="ml-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded text-current opacity-30 hover:opacity-70"
        >
          <ChevronDown size={11} />
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-[#1D3461]/10 bg-white shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => navigate(opt.value)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] transition-colors hover:bg-[#1D3461]/[0.04] ${
                current === opt.value ? "font-semibold text-[#2CBFBF]" : "text-[#0A2240]/65"
              }`}
            >
              <span className="w-3.5 shrink-0">
                {current === opt.value && <Check size={12} strokeWidth={2.5} className="text-[#2CBFBF]" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
