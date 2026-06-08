"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  HandCoins,
  PiggyBank,
  Coins,
  Landmark,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import type { Profile } from "@/lib/types";
import clsx from "clsx";

// Each nav item carries its own accent so the rail reads as a set of distinct
// destinations rather than one flat block — active state, hover tint, and icon
// color all key off the same hex per item.
const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    active: "bg-[#22D3EE]/20 text-[#FFFFFF]",
    activeIcon: "text-[#22D3EE]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#22D3EE]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#22D3EE]",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    active: "bg-[#818CF8]/20 text-[#FFFFFF]",
    activeIcon: "text-[#818CF8]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#818CF8]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#818CF8]",
  },
  {
    href: "/loans",
    label: "Loans",
    icon: HandCoins,
    active: "bg-[#34D399]/20 text-[#FFFFFF]",
    activeIcon: "text-[#34D399]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#34D399]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#34D399]",
  },
];

const ACCOUNT_NAV = [
  {
    href: "/accounts/savings",
    label: "Savings",
    icon: PiggyBank,
    active: "bg-[#FBBF24]/20 text-[#FFFFFF]",
    activeIcon: "text-[#FBBF24]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#FBBF24]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#FBBF24]",
  },
  {
    href: "/accounts/susu",
    label: "Daily Susu",
    icon: Coins,
    active: "bg-[#FB7185]/20 text-[#FFFFFF]",
    activeIcon: "text-[#FB7185]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#FB7185]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#FB7185]",
  },
  {
    href: "/accounts/fixed-deposit",
    label: "Fixed Deposit",
    icon: Landmark,
    active: "bg-[#A78BFA]/20 text-[#FFFFFF]",
    activeIcon: "text-[#A78BFA]",
    idle: "group text-[#FFFFFF]/55 hover:bg-[#A78BFA]/20 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF]/55 transition-colors group-hover:text-[#A78BFA]",
  },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-gradient-to-b from-[#0046D1] via-[#0033AA] to-[#001F66] text-[#FFFFFF] lg:flex">
      <div className="flex items-center gap-3 px-6 py-7">
        <Logo size={36} />
        <div className="leading-tight">
          <p className="text-[12px] font-bold tracking-[0.16em]">PRIME FINANCIAL</p>
          <p className="text-[9px] tracking-[0.28em] text-[#00A1E0]/70">SERVICE</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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

        <p className="px-3.5 pb-1.5 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#FFFFFF]/35">
          Accounts
        </p>
        {ACCOUNT_NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
      </nav>

      <div className="border-t border-[#FFFFFF]/10 px-4 py-5">
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-[#FFFFFF]/5 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00A1E0]/15 text-[12px] font-semibold text-[#00A1E0]">
            {initials(profile.full_name)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold text-[#FFFFFF]">{profile.full_name}</p>
            <p className="flex items-center gap-1 text-[11px] text-[#FFFFFF]/50">
              {profile.role === "admin" && <ShieldCheck size={11} className="text-[#00A1E0]" />}
              {profile.role === "admin" ? "Administrator" : "Staff"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-[#FFFFFF]/55 transition-colors hover:bg-[#FFFFFF]/5 hover:text-[#FFFFFF]/85"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
