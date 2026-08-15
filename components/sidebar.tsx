"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  HandCoins,
  PiggyBank,
  Coins,
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
  Scale,
  ArrowUpFromLine,
  ArrowDownToLine,
  Landmark,
  Smartphone,
  ArrowLeftRight,
} from "lucide-react";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/types";
import clsx from "clsx";

// Three distinct typefaces give the rail its own visual rhythm — a serif for
// the brand lockup (gravitas), a geometric sans for primary destinations
// (modern, structural), and a monospace for the Accounts ledger group
// (numeric/registry feel). All three are self-hosted and loaded globally by
// app/layout.tsx; --font-sidebar-brand/-nav/-accounts are defined in
// app/globals.css.

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
  {
    href: "/reports/summary",
    label: "Transaction Summary",
    icon: BarChart3,
    active: "bg-[#0891B2]/15 text-[#FFFFFF]",
    activeIcon: "text-[#0891B2]",
    idle: "group text-[#FFFFFF] hover:bg-[#0891B2]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#0891B2]",
  },
  {
    href: "/reports/deposits",
    label: "Deposits",
    icon: ArrowDownToLine,
    active: "bg-[#1F6E4A]/15 text-[#FFFFFF]",
    activeIcon: "text-[#4ADE80]",
    idle: "group text-[#FFFFFF] hover:bg-[#1F6E4A]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#4ADE80]",
  },
  {
    href: "/reports/withdrawals",
    label: "Withdrawals",
    icon: ArrowUpFromLine,
    active: "bg-[#B3432B]/15 text-[#FFFFFF]",
    activeIcon: "text-[#F97066]",
    idle: "group text-[#FFFFFF] hover:bg-[#B3432B]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#F97066]",
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
    href: "/reports/account-summary",
    label: "Account Summary",
    icon: BarChart3,
    active: "bg-[#DC2626]/15 text-[#FFFFFF]",
    activeIcon: "text-[#F87171]",
    idle: "group text-[#FFFFFF] hover:bg-[#DC2626]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#F87171]",
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
    href: "/reconciliation",
    label: "Reconciliation",
    icon: Scale,
    active: "bg-[#D97706]/15 text-[#FFFFFF]",
    activeIcon: "text-[#FBBF24]",
    idle: "group text-[#FFFFFF] hover:bg-[#D97706]/15 hover:text-[#FFFFFF]",
    idleIcon: "text-[#FFFFFF] transition-colors group-hover:text-[#FBBF24]",
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

// MoMo's own nav (see momo-mini-app-brief.md §3) — replaces NAV/ACCOUNT_NAV/
// ADMIN_NAV entirely while active, never sits underneath them. Bold white
// text/icons here (the MoMo sidebar background, .sidebar-momo in
// app/globals.css, is deep blue — dark enough for white to read clearly,
// unlike the lighter tones tried earlier). Hover flips to a solid white
// pill, so hover states flip the text/icon to dark ink to stay legible on
// that white ground.
const MOMO_NAV = [
  {
    href: "/momo",
    label: "Overview",
    icon: LayoutDashboard,
    active: "bg-white/20 text-white",
    activeIcon: "text-white",
    idle: "group text-white hover:bg-white hover:text-[#1A1A1A]",
    idleIcon: "text-white transition-colors group-hover:text-[#1A1A1A]",
    adminOnly: false,
  },
  {
    href: "/momo/transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    active: "bg-white/20 text-white",
    activeIcon: "text-white",
    idle: "group text-white hover:bg-white hover:text-[#1A1A1A]",
    idleIcon: "text-white transition-colors group-hover:text-[#1A1A1A]",
    adminOnly: false,
  },
  // Admin-only within MoMo — seeing every staff member's collected charges
  // is a management view, not everyday work, same split PFS's own
  // Staff Performance page already draws (that page is entirely
  // admin-gated even though staff can access the rest of PFS).
  {
    href: "/momo/performance",
    label: "Performance",
    icon: TrendingUp,
    active: "bg-white/20 text-white",
    activeIcon: "text-white",
    idle: "group text-white hover:bg-white hover:text-[#1A1A1A]",
    idleIcon: "text-white transition-colors group-hover:text-[#1A1A1A]",
    adminOnly: true,
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
  const isAdmin = profile.role === "admin";
  // Every active staff/admin gets MoMo now — the admin-only phase-1 default
  // (momo-mini-app-brief.md §3) has been lifted. "Performance" inside
  // MOMO_NAV stays admin-gated below (see that array's comment).
  const inMomo = pathname.startsWith("/momo");
  // Per-account exceptions (0066_profile_page_restrictions.sql) — hiding
  // the nav link is UX only, the real enforcement is each restricted
  // page's own redirect guard; this just keeps a dead-end link off the rail.
  const restricted = new Set(profile.restricted_pages ?? []);

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
          "sidebar-drawer flex h-screen w-64 shrink-0 flex-col lg:sticky lg:top-0 lg:!transform-none",
          inMomo ? "sidebar-momo text-[#FFFFFF]" : "sidebar-aurora text-[#FFFFFF]",
          mobileOpen && "open"
        )}
      >
      {inMomo ? (
        // MoMo's own brand block — the three-network banner, not the PFS
        // logo mark. Shaped differently from the row below on purpose (a
        // wide banner, not an icon + text row) because the source image
        // itself is a 600×307 banner, not a square mark.
        <div className="px-6 pb-5 pt-7">
          <Image
            src="/images/momo-logo.jpg"
            alt="MTN, AirtelTigo, Telecel"
            width={600}
            height={307}
            className="w-full rounded-lg"
            priority
          />
          <p
            className="mt-2.5 text-[13px] font-bold tracking-[0.2em] text-white"
            style={{ fontFamily: "var(--font-sidebar-brand)" }}
          >
            MOMO
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-6 py-7">
          <Logo size={36} />
          <div className="leading-tight" style={{ fontFamily: "var(--font-sidebar-brand)" }}>
            <p className="text-[15px] font-bold tracking-[0.06em] text-[#FFFFFF]">Prime Financial</p>
            <p className="text-[9px] italic tracking-[0.32em] text-[#FFFFFF]">Service</p>
          </div>
        </div>
      )}

      {/* App switcher — every staff/admin, route-driven (see momo-mini-app-brief.md §3) */}
      <div className="flex gap-1.5 px-4 pb-4">
        <Link
          href="/"
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] font-semibold transition-colors",
            !inMomo
              ? "bg-[#FFFFFF]/18 text-[#FFFFFF]"
              : "text-white/85 hover:bg-white hover:text-[#1A1A1A]"
          )}
        >
          <Landmark size={13} />
          Financial Service
        </Link>
        <Link
          href="/momo"
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] font-semibold transition-colors",
            inMomo
              ? "bg-white/20 text-white"
              : "text-[#FFFFFF]/70 hover:bg-[#FFFFFF]/10 hover:text-[#FFFFFF]"
          )}
        >
          <Smartphone size={13} />
          MoMo
        </Link>
      </div>

      <nav className="sidebar-nav flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {inMomo ? (
          MOMO_NAV.filter(({ adminOnly, href }) => (!adminOnly || isAdmin) && !(href === "/momo/performance" && restricted.has("momo_performance"))).map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
            const active = href === "/momo" ? pathname === "/momo" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{ fontFamily: "var(--font-sidebar-nav)" }}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[14px] font-bold transition-colors",
                  active ? activeCls : idle
                )}
              >
                <Icon size={17} className={active ? activeIcon : idleIcon} />
                {label}
              </Link>
            );
          })
        ) : (
          <>
            {NAV.filter(({ href }) => (href !== "/" || profile.role === "admin") && !(href === "/" && restricted.has("overview"))).map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
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
                {ADMIN_NAV.filter(({ href }) =>
                  !(href === "/settings" && restricted.has("settings")) &&
                  !(href === "/staff/performance" && restricted.has("staff_performance"))
                ).map(({ href, label, icon: Icon, active: activeCls, activeIcon, idle, idleIcon }) => {
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
          </>
        )}
      </nav>

      <div className={clsx("border-t px-4 py-5", inMomo ? "border-white/15" : "border-[#163013]/10")}>
        <Link
          href="/profile"
          className={clsx(
            "group mb-4 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
            inMomo ? "bg-white/10 hover:bg-white" : "bg-[#163013]/5 hover:bg-[#163013]/10"
          )}
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
            <p className={clsx("truncate text-[13px] font-bold", inMomo ? "text-white group-hover:text-[#1A1A1A]" : "text-[#FFFFFF]")}>{profile.full_name}</p>
            <p className={clsx("flex items-center gap-1 text-[11px]", inMomo ? "font-semibold text-white group-hover:text-[#1A1A1A]" : "text-[#FFFFFF]")}>
              {profile.role === "admin" && <ShieldCheck size={11} className="text-[#0033AA]" />}
              {profile.role === "admin" ? "Administrator" : "Staff"}
            </p>
          </div>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] transition-colors",
              inMomo ? "font-bold text-white hover:bg-white hover:text-[#1A1A1A]" : "font-medium text-[#FFFFFF] hover:bg-[#163013]/5"
            )}
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
