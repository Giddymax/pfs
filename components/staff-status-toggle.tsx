"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function StaffStatusToggle({
  profileId,
  isActive,
  isSelf,
}: {
  profileId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return <span className="text-[12.5px] text-[#0A2240]/35">You can&rsquo;t change your own access</span>;
  }

  async function handleToggle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("profiles").update({ is_active: !isActive }).eq("id", profileId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60 ${
          isActive
            ? "border-[#B3432B]/25 text-[#963522] hover:bg-[#B3432B]/[0.06]"
            : "border-[#1F6E4A]/25 text-[#1F6E4A] hover:bg-[#1F6E4A]/[0.06]"
        }`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
        {isActive ? "Deactivate" : "Activate"}
      </button>
      {error && <span className="text-[11.5px] text-[#963522]">{error}</span>}
    </div>
  );
}
