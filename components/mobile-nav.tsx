"use client";

import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import type { Profile } from "@/lib/types";

export function MobileNav({
  profile,
  onMenuToggle,
  sidebarOpen,
}: {
  profile: Profile;
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}) {
  return (
    <div className="mobile-nav-bar lg:hidden">
      <div className="flex items-center justify-between border-b border-[#1D3461]/10 bg-[#FFFFFF] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <p className="text-[12px] font-bold tracking-[0.16em] text-[#1D3461]">PRIME FINANCIAL</p>
        </div>
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex h-10 w-10 items-center justify-center rounded-md text-[#1D3461]"
          aria-label="Toggle navigation"
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </div>
  );
}
