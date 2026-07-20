"use client";

import { useRouter } from "next/navigation";

export function MonthYearControl({ month }: { month: string }) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (!value) return;
    router.push(`?month=${value}`);
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-[12.5px] font-medium text-[#0A2240]/55">Month</span>
      <input
        type="month"
        value={month}
        onChange={handleChange}
        className="rounded-md border border-[#0033AA]/15 px-3 py-1.5 text-[13px] outline-none focus:border-[#0033AA]"
      />
    </label>
  );
}
