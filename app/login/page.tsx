"use client";

import { useActionState, useState } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { signIn } from "./actions";

// Stanbic's site uses a single corporate sans-serif (Benton Sans, licensed) for
// both headings and body copy — IBM Plex Sans is the closest open equivalent,
// so both "display" and "body" roles here draw from the same family.
const display = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [state, formAction, isPending] = useActionState(signIn, null);

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen w-full bg-[#FFFFFF] text-[#0A2240]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
        <BrandPanel />

        {/* RIGHT — sign-in form */}
        <div className="relative flex items-center justify-center px-6 py-14 sm:px-12 lg:px-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_15%,rgba(44,191,191,0.06),transparent_55%)]" />

          <div className="w-full max-w-sm">
            <div
              className="mb-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1D3461]/60"
            >
              <span className="h-px w-8 bg-[#2CBFBF]" />
              Staff &amp; Admin Portal
            </div>

            <h1
              className="mb-2 text-[2.4rem] leading-[1.05] tracking-tight text-[#1D3461]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Welcome back.
            </h1>
            <p
              className="mb-10 text-[15px] leading-relaxed text-[#0A2240]/60"
            >
              Sign in to manage clients, susu collections, and loans.
            </p>

            <form action={formAction} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[13px] font-semibold text-[#1D3461]/80"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="you@primefinancial.com.gh"
                  className="w-full rounded-none border-0 border-b-2 border-[#1D3461]/15 bg-transparent px-1 py-3 text-[15px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#2CBFBF]"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[13px] font-semibold text-[#1D3461]/80"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-[12px] font-medium text-[#1D3461]/45 transition-colors hover:text-[#2CBFBF]"
                  >
                    Forgot access?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="••••••••••"
                    className="w-full rounded-none border-0 border-b-2 border-[#1D3461]/15 bg-transparent px-1 py-3 pr-9 text-[15px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#2CBFBF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[#1D3461]/40 transition-colors hover:text-[#1D3461]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div
                className="flex items-center justify-between pt-1"
              >
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#0A2240]/60">
                  <span className="relative flex h-[18px] w-[18px] items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-[4px] border-2 border-[#1D3461]/25 bg-transparent transition-colors peer-checked:border-[#1D3461] peer-checked:bg-[#1D3461]" />
                    <svg
                      className="relative h-2.5 w-2.5 text-[#FFFFFF] opacity-0 transition-opacity peer-checked:opacity-100"
                      style={{ opacity: remember ? 1 : 0 }}
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path d="M2 6.2L4.8 9 10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  Keep me signed in on this device
                </label>
              </div>

              {state?.error && (
                <div
                  role="alert"
                  className="animate-fade-up rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] leading-relaxed text-[#963522]"
                >
                  We couldn&apos;t sign you in. Check your email and password and try again.
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-[#1D3461] px-6 py-3.5 text-[14px] font-semibold tracking-wide text-[#FFFFFF] transition-all hover:bg-[#152847] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to dashboard
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#2CBFBF] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </form>

            <div
              className="mt-10 flex items-start gap-2.5 border-t border-[#1D3461]/10 pt-6 text-[12.5px] leading-relaxed text-[#0A2240]/45"
            >
              <ShieldCheck size={15} className="mt-[2px] shrink-0 text-[#1D3461]/35" />
              <p>
                Staff and administrators only. If you need an account or have lost
                access, contact your branch manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRODUCTS = [
  {
    label: "Daily Susu",
    href: "/about/daily-susu",
    desc: "Small daily contributions that build up over a 31-day cycle.",
  },
  {
    label: "Fixed Deposits",
    href: "/about/fixed-deposits",
    desc: "Lock your savings and earn guaranteed interest.",
  },
  {
    label: "Client Loans",
    href: "/about/client-loans",
    desc: "Affordable micro-loans with flexible repayment terms.",
  },
  {
    label: "Savings",
    href: "/about/savings",
    desc: "Secure savings accounts with easy deposit and withdrawal.",
  },
];

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#1D3461] px-16 py-16 text-[#FFFFFF] lg:flex lg:flex-col lg:justify-between">
      {/* Currency note images */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/notes/cedi-50.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 top-[12%] h-[180px] w-auto rotate-[15deg] opacity-25 blur-[1px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/notes/cedi-20.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -left-6 top-[38%] h-[160px] w-auto -rotate-[10deg] opacity-20 blur-[0.5px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/notes/cedi-100.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[8%] right-[5%] h-[170px] w-auto rotate-[22deg] opacity-20 blur-[1px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/notes/cedi-10.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[30%] left-[10%] h-[140px] w-auto rotate-[-18deg] opacity-15 blur-[0.5px]"
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* top: brand mark */}
      <div className="relative z-10 flex items-center gap-3">
        <Logo size={44} />
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-[0.18em]">PRIME FINANCIAL</p>
          <p className="text-[10px] tracking-[0.32em] text-[#2CBFBF]/80">SERVICE · GHANA</p>
        </div>
      </div>

      {/* middle: headline */}
      <div className="relative z-10 max-w-md">
        <h2
          className="text-[2.85rem] leading-[1.12] tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
        >
          Where everyday savings become{" "}
          <em className="not-italic text-[#2CBFBF]" style={{ fontStyle: "italic" }}>
            lasting security.
          </em>
        </h2>

        {/* Clickable product links */}
        <div className="mt-9 grid grid-cols-2 gap-3">
          {PRODUCTS.map((p) => (
            <a
              key={p.href}
              href={p.href}
              className="group rounded-lg border border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.04] px-4 py-3.5 transition-colors hover:border-[#2CBFBF]/40 hover:bg-[#2CBFBF]/[0.08]"
            >
              <p className="text-[13.5px] font-semibold tracking-wide text-[#FFFFFF] group-hover:text-[#2CBFBF]">
                {p.label}
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-[#FFFFFF]/50">
                {p.desc}
              </p>
            </a>
          ))}
        </div>
      </div>

      {/* bottom: tagline */}
      <p className="relative z-10 text-[12px] tracking-[0.1em] text-[#FFFFFF]/40">
        Trusted by communities across Ghana
      </p>
    </div>
  );
}
