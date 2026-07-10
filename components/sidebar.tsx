"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Playfair_Display, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  LayoutDashboard,
  Users,
  HandCoins,
  PiggyBank,
  Coins,
  Landmark,
  LogOut,
  ShieldCheck,
  Settings,
  UsersRound,
  ReceiptText,
  BarChart3,
  Building2,
  TrendingUp,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/types";
import clsx from "clsx";

// Three distinct typefaces give the rail its own visual rhythm — a serif for
// the brand lockup (gravitas), a geometric sans for primary destinations
// (modern, structural), and a monospace for the Accounts ledger group
// (numeric/registry feel) — each layered in via its own CSS variable.
const brandFont = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sidebar-brand" });
const navFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-sidebar-nav" });
const acctFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-sidebar-accounts" });

// Each nav item carries its own accent so the rail reads as a set of distinct
// destinations rather than one flat block — active state, hover tint, and icon
// color all key off the same hex per item. Against the lemon-green backdrop,
// dark ink plus saturated tinted pills give each item its own pop.
const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    active: "bg-[#2563EB]/15 text-[#FFFFFF]",
    activeIcon: "text-[#2563EB]",
    idle: "group text-[#FFFFFF] hover:bg-[#2563EB]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#2563EB]",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    active: "bg-[#7C3AED]/15 text-[#FFFFFF]",
    activeIcon: "text-[#7C3AED]",
    idle: "group text-[#FFFFFF] hover:bg-[#7C3AED]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#7C3AED]",
  },
  {
    href: "/loans",
    label: "Loans",
    icon: HandCoins,
    active: "bg-[#DB2777]/15 text-[#FFFFFF]",
    activeIcon: "text-[#DB2777]",
    idle: "group text-[#FFFFFF] hover:bg-[#DB2777]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#DB2777]",
  },
  {
    href: "/upcoming",
    label: "Upcoming",
    icon: CalendarClock,
    active: "bg-[#0891B2]/15 text-[#FFFFFF]",
    activeIcon: "text-[#0891B2]",
    idle: "group text-[#FFFFFF] hover:bg-[#0891B2]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#0891B2]",
  },
];

const ACCOUNT_NAV = [
  {
    href: "/accounts/savings",
    label: "Savings",
    icon: PiggyBank,
    active: "bg-[#EA580C]/15 text-[#FFFFFF]",
    activeIcon: "text-[#EA580C]",
    idle: "group text-[#FFFFFF] hover:bg-[#EA580C]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#EA580C]",
  },
  {
    href: "/accounts/susu",
    label: "Daily Susu",
    icon: Coins,
    active: "bg-[#0284C7]/15 text-[#FFFFFF]",
    activeIcon: "text-[#0284C7]",
    idle: "group text-[#FFFFFF] hover:bg-[#0284C7]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#0284C7]",
  },
  {
    href: "/fixed-deposits",
    label: "Fixed Deposit",
    icon: Landmark,
    active: "bg-[#4F46E5]/15 text-[#FFFFFF]",
    activeIcon: "text-[#4F46E5]",
    idle: "group text-[#FFFFFF] hover:bg-[#4F46E5]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#4F46E5]",
  },
];

const ADMIN_NAV = [
  {
    href: "/finance",
    label: "Finance",
    icon: Wallet,
    active: "bg-[#15803D]/15 text-[#FFFFFF]",
    activeIcon: "text-[#4ADE80]",
    idle: "group text-[#FFFFFF] hover:bg-[#15803D]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#4ADE80]",
  },
  {
    href: "/bank",
    label: "Bank",
    icon: Building2,
    active: "bg-[#0284C7]/15 text-[#FFFFFF]",
    activeIcon: "text-[#38BDF8]",
    idle: "group text-[#FFFFFF] hover:bg-[#0284C7]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#38BDF8]",
  },
  {
    href: "/susu/claims",
    label: "Susu Claims",
    icon: ReceiptText,
    active: "bg-[#B58A2A]/15 text-[#FFFFFF]",
    activeIcon: "text-[#B58A2A]",
    idle: "group text-[#FFFFFF] hover:bg-[#B58A2A]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#B58A2A]",
  },
  {
    href: "/reports/summary",
    label: "Summary",
    icon: BarChart3,
    active: "bg-[#0891B2]/15 text-[#FFFFFF]",
    activeIcon: "text-[#0891B2]",
    idle: "group text-[#FFFFFF] hover:bg-[#0891B2]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#0891B2]",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    active: "bg-[#0D9488]/15 text-[#FFFFFF]",
    activeIcon: "text-[#0D9488]",
    idle: "group text-[#FFFFFF] hover:bg-[#0D9488]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#0D9488]",
  },
  {
    href: "/staff",
    label: "Staff",
    icon: UsersRound,
    active: "bg-[#9333EA]/15 text-[#FFFFFF]",
    activeIcon: "text-[#9333EA]",
    idle: "group text-[#FFFFFF] hover:bg-[#9333EA]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#9333EA]",
  },
  {
    href: "/staff/performance",
    label: "Performance",
    icon: TrendingUp,
    active: "bg-[#059669]/15 text-[#FFFFFF]",
    activeIcon: "text-[#059669]",
    idle: "group text-[#FFFFFF] hover:bg-[#059669]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#059669]",
  },
];

export function Sidebar({
  profile,
  mobileOpen = false,
  onMobileClose,
}: {
  profile: Profile;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop for mobile drawer */}
      <div
        className={clsx("sidebar-backdrop lg:hidden", mobileOpen && "open")}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <aside
        className={clsx(
          brandFont.variable,
          navFont.variable,
          acctFont.variable,
          "sidebar-aurora sidebar-drawer flex h-screen w-64 shrink-0 flex-col text-[#FFFFFF] lg:sticky lg:top-0 lg:!transform-none",
          mobileOpen && "open"
        )}
      >
      <div className="flex items-center gap-3 px-6 py-7">
        <Logo size={36} />
        <div className="leading-tight" style={{ fontFamily: "var(--font-sidebar-brand)" }}>
          <p className="text-[15px] font-bold tracking-[0.06em] text-[#FFFFFF]">Prime Financial</p>
          <p className="text-[9px] italic tracking-[0.32em] text-[#FFFFFF]">Service</p>
        </div>
      </div>

      <nav className="sidebar-nav flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.filter(({ href }) => href !== "/" || profile.role === "admin").map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{ fontFamily: "var(--font-sidebar-nav)" }}
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

        <p
          className="px-3.5 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FFFFFF]"
          style={{ fontFamily: "var(--font-sidebar-accounts)" }}
        >
          Accounts
        </p>
        {ACCOUNT_NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{ fontFamily: "var(--font-sidebar-accounts)" }}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                active ? activeCls : idle
              )}
            >
              <Icon size={17} className={active ? activeIcon : idleIcon} />
              {label}
            </Link>
          );
        })}

        {profile.role === "admin" && (
          <>
            <p
              className="px-3.5 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FFFFFF]"
              style={{ fontFamily: "var(--font-sidebar-accounts)" }}
            >
              Admin
            </p>
            {ADMIN_NAV.map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{ fontFamily: "var(--font-sidebar-nav)" }}
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
          </>
        )}
      </nav>

      <div className="border-t border-[#163013]/10 px-4 py-5">
        <Link
          href="/profile"
          className="mb-4 flex items-center gap-3 rounded-lg bg-[#163013]/5 px-3 py-2.5 transition-colors hover:bg-[#163013]/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0033AA]/12 text-[12px] font-semibold text-[#0033AA]">
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo_url} alt={profile.full_name} className="h-full w-full object-cover" />
            ) : (
              initials(profile.full_name)
            )}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold text-[#FFFFFF]">{profile.full_name}</p>
            <p className="flex items-center gap-1 text-[11px] text-[#FFFFFF]">
              {profile.role === "admin" && <ShieldCheck size={11} className="text-[#0033AA]" />}
              {profile.role === "admin" ? "Administrator" : "Staff"}
            </p>
          </div>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-[#FFFFFF] transition-colors hover:bg-[#163013]/5 hover:text-[#FFFFFF]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
    </>
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
