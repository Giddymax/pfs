"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LayoutDashboard, Users, HandCoins, PiggyBank, Coins, Landmark, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import type { Profile } from "@/lib/types";
import clsx from "clsx";

// Mirrors the sidebar's per-item accent treatment, tuned for the white mobile bar —
// background tint and icon both shift to the item's accent on hover/active.
const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    active: "bg-[#0EA5B7]/14 text-[#0A2240]",
    activeIcon: "text-[#0EA5B7]",
    idle: "group text-[#0A2240]/65 hover:bg-[#0EA5B7]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#0EA5B7]",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    active: "bg-[#6366F1]/14 text-[#0A2240]",
    activeIcon: "text-[#6366F1]",
    idle: "group text-[#0A2240]/65 hover:bg-[#6366F1]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#6366F1]",
  },
  {
    href: "/loans",
    label: "Loans",
    icon: HandCoins,
    active: "bg-[#10B981]/14 text-[#0A2240]",
    activeIcon: "text-[#10B981]",
    idle: "group text-[#0A2240]/65 hover:bg-[#10B981]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#10B981]",
  },
];

const ACCOUNT_NAV = [
  {
    href: "/accounts/savings",
    label: "Savings",
    icon: PiggyBank,
    active: "bg-[#D97706]/14 text-[#0A2240]",
    activeIcon: "text-[#D97706]",
    idle: "group text-[#0A2240]/65 hover:bg-[#D97706]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#D97706]",
  },
  {
    href: "/accounts/susu",
    label: "Daily Susu",
    icon: Coins,
    active: "bg-[#E11D48]/14 text-[#0A2240]",
    activeIcon: "text-[#E11D48]",
    idle: "group text-[#0A2240]/65 hover:bg-[#E11D48]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#E11D48]",
  },
  {
    href: "/accounts/fixed-deposit",
    label: "Fixed Deposit",
    icon: Landmark,
    active: "bg-[#7C3AED]/14 text-[#0A2240]",
    activeIcon: "text-[#7C3AED]",
    idle: "group text-[#0A2240]/65 hover:bg-[#7C3AED]/14 hover:text-[#0A2240]",
    idleIcon: "text-[#0A2240]/55 transition-colors group-hover:text-[#7C3AED]",
  },
];

export function MobileNav({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-[#0033AA]/10 bg-[#FFFFFF] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <p className="text-[12px] font-bold tracking-[0.16em] text-[#0033AA]">PRIME FINANCIAL</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[#0033AA]"
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[57px] z-40 border-b border-[#0033AA]/10 bg-[#FFFFFF] px-3 pb-4 pt-2 shadow-lg animate-fade-up">
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-medium transition-colors",
                    active ? activeCls : idle
                  )}
                >
                  <Icon size={17} className={active ? activeIcon : idleIcon} />
                  {label}
                </Link>
              );
            })}

            <p className="px-3.5 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#0A2240]/35">
              Accounts
            </p>
            {ACCOUNT_NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-medium transition-colors",
                    active ? activeCls : idle
                  )}
                >
                  <Icon size={17} className={active ? activeIcon : idleIcon} />
                  {label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-medium text-[#0A2240]/55"
            >
              <LogOut size={17} />
              Sign out ({profile.full_name.split(" ")[0]})
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
