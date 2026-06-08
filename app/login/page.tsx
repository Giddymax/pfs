"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IBM_Plex_Sans } from "next/font/google";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen w-full bg-[#FFFFFF] text-[#0A2240]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
        <BrandPanel />

        {/* RIGHT — sign-in form */}
        <div className="relative flex items-center justify-center px-6 py-14 sm:px-12 lg:px-20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_15%,rgba(15,61,46,0.05),transparent_55%)]" />

          <div className="w-full max-w-sm">
            <div
              className="mb-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0033AA]/60 animate-fade-up"
              style={{ animationDelay: "60ms" }}
            >
              <span className="h-px w-8 bg-[#0062E1]" />
              Staff &amp; Admin Portal
            </div>

            <h1
              className="mb-2 text-[2.4rem] leading-[1.05] tracking-tight text-[#0033AA] animate-fade-up"
              style={{ fontFamily: "var(--font-display)", animationDelay: "120ms" }}
            >
              Welcome back.
            </h1>
            <p
              className="mb-10 text-[15px] leading-relaxed text-[#0A2240]/60 animate-fade-up"
              style={{ animationDelay: "180ms" }}
            >
              Sign in to manage clients, susu collections, and loans.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div
                className="animate-fade-up"
                style={{ animationDelay: "240ms" }}
              >
                <label
                  htmlFor="email"
                  className="mb-2 block text-[13px] font-semibold text-[#0033AA]/80"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@primefinancial.com.gh"
                  className="w-full rounded-none border-0 border-b-2 border-[#0033AA]/15 bg-transparent px-1 py-3 text-[15px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#0062E1]"
                />
              </div>

              <div
                className="animate-fade-up"
                style={{ animationDelay: "300ms" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[13px] font-semibold text-[#0033AA]/80"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-[12px] font-medium text-[#0033AA]/45 transition-colors hover:text-[#0062E1]"
                  >
                    Forgot access?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-none border-0 border-b-2 border-[#0033AA]/15 bg-transparent px-1 py-3 pr-9 text-[15px] text-[#0A2240] outline-none transition-colors placeholder:text-[#0A2240]/30 focus:border-[#0062E1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[#0033AA]/40 transition-colors hover:text-[#0033AA]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div
                className="flex items-center justify-between pt-1 animate-fade-up"
                style={{ animationDelay: "350ms" }}
              >
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#0A2240]/60">
                  <span className="relative flex h-[18px] w-[18px] items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-[4px] border-2 border-[#0033AA]/25 bg-transparent transition-colors peer-checked:border-[#0033AA] peer-checked:bg-[#0033AA]" />
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

              {error && (
                <div
                  role="alert"
                  className="animate-fade-up rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-4 py-3 text-[13px] leading-relaxed text-[#963522]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-[#0033AA] px-6 py-3.5 text-[14px] font-semibold tracking-wide text-[#FFFFFF] transition-all hover:bg-[#002884] disabled:cursor-not-allowed disabled:opacity-70 animate-fade-up"
                style={{ animationDelay: "400ms" }}
              >
                {loading ? (
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
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#0062E1] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </form>

            <div
              className="mt-10 flex items-start gap-2.5 border-t border-[#0033AA]/10 pt-6 text-[12.5px] leading-relaxed text-[#0A2240]/45 animate-fade-up"
              style={{ animationDelay: "460ms" }}
            >
              <ShieldCheck size={15} className="mt-[2px] shrink-0 text-[#0033AA]/35" />
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

function BrandPanel() {
  const features = ["Daily Susu", "Fixed Deposits", "Client Loans", "Savings"];

  return (
    <div className="relative hidden overflow-hidden bg-[#0033AA] px-16 py-16 text-[#FFFFFF] lg:flex lg:flex-col lg:justify-between">
      {/* decorative motifs */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[0.14]"
        viewBox="0 0 300 300"
        fill="none"
      >
        <circle cx="150" cy="150" r="40" stroke="#0089FF" strokeWidth="1.4" />
        <circle cx="150" cy="150" r="82" stroke="#0089FF" strokeWidth="1" />
        <circle cx="150" cy="150" r="124" stroke="#0089FF" strokeWidth="0.8" />
        <circle cx="150" cy="150" r="148" stroke="#0089FF" strokeWidth="0.5" />
      </svg>

      <svg
        className="pointer-events-none absolute -bottom-32 -left-28 h-[480px] w-[480px] opacity-[0.12] animate-spin-slow"
        viewBox="0 0 400 400"
        fill="none"
      >
        {Array.from({ length: 28 }).map((_, i) => {
          const angle = (i * 360) / 28;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={i}
              x1="200"
              y1="200"
              x2={(200 + 188 * Math.cos(rad)).toFixed(3)}
              y2={(200 + 188 * Math.sin(rad)).toFixed(3)}
              stroke="#0089FF"
              strokeWidth="1"
            />
          );
        })}
        <circle cx="200" cy="200" r="58" stroke="#0089FF" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="108" stroke="#0089FF" strokeWidth="0.8" />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* top: brand mark */}
      <div className="relative z-10 flex items-center gap-3 animate-fade-up">
        <Logo size={44} />
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-[0.18em]">PRIME FINANCIAL</p>
          <p className="text-[10px] tracking-[0.32em] text-[#00A1E0]/80">SERVICE · GHANA</p>
        </div>
      </div>

      {/* middle: headline */}
      <div className="relative z-10 max-w-md">
        <h2
          className="text-[2.85rem] leading-[1.12] tracking-tight animate-fade-up"
          style={{ fontFamily: "var(--font-display)", fontWeight: 400, animationDelay: "180ms" }}
        >
          Where everyday savings become{" "}
          <em className="not-italic text-[#00A1E0]" style={{ fontStyle: "italic" }}>
            lasting security.
          </em>
        </h2>
        <p
          className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#FFFFFF]/65 animate-fade-up"
          style={{ animationDelay: "260ms" }}
        >
          One platform for the people who show up at the market stall, the shop
          counter, and the front door — every single day.
        </p>

        <div
          className="mt-9 flex flex-wrap gap-x-7 gap-y-3 animate-fade-up"
          style={{ animationDelay: "330ms" }}
        >
          {features.map((f) => (
            <span key={f} className="border-b border-[#0089FF]/40 pb-1.5 text-[13px] tracking-wide text-[#FFFFFF]/80">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* bottom: quote */}
      <div
        className="relative z-10 max-w-sm border-l border-[#0089FF]/30 pl-5 animate-fade-up"
        style={{ animationDelay: "400ms" }}
      >
        <p className="text-[14px] italic leading-relaxed text-[#FFFFFF]/70" style={{ fontFamily: "var(--font-display)" }}>
          “Built for the field officers and branch staff who turn small, daily
          contributions into real financial futures.”
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#00A1E0]/60">
          — Prime Financial Service Field Team
        </p>
      </div>
    </div>
  );
}
