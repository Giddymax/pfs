import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins, Landmark, HandCoins, PiggyBank } from "lucide-react";
import { Logo } from "@/components/logo";

const PRODUCTS: Record<string, {
  title: string;
  icon: typeof Coins;
  color: string;
  intro: string;
  howItWorks: string[];
  benefits: string[];
}> = {
  "daily-susu": {
    title: "Daily Susu",
    icon: Coins,
    color: "#0284C7",
    intro:
      "Susu is a traditional West African savings system built on trust and consistency. With Prime Financial Service, your daily contributions are recorded digitally, secured, and tracked through a transparent 31-day cycle.",
    howItWorks: [
      "You agree on a daily contribution amount with your field officer (e.g. GHS 20 per day).",
      "Every day, your officer collects your contribution and records it instantly in the system.",
      "Contributions run for 30 days. On day 31, one day's contribution is retained as the company service fee.",
      "After the cycle completes, your full balance (30 days' worth) is available for withdrawal.",
      "If you need your money before the cycle ends, you can request an emergency withdrawal — the company fee is deducted automatically and your funds are released immediately.",
      "A new cycle begins with your next contribution.",
    ],
    benefits: [
      "No minimum balance required — save as little as GHS 1 per day",
      "Transparent cycle tracking — always know which day you're on",
      "SMS notifications for every deposit and withdrawal",
      "Emergency access to your funds when life demands it",
      "Your officer comes to you — no need to travel to a branch",
    ],
  },
  "fixed-deposits": {
    title: "Fixed Deposits",
    icon: Landmark,
    color: "#4F46E5",
    intro:
      "Lock your money away for a set period and earn guaranteed interest. Fixed deposits with Prime Financial Service offer higher returns than regular savings, with terms from 3 months to 24 months.",
    howItWorks: [
      "Choose your deposit amount and term length (3, 6, 9, 12, 18, or 24 months).",
      "Your principal is locked for the chosen term and earns interest at the agreed rate.",
      "At maturity, you can withdraw your principal plus interest, or roll over into a new term.",
      "If you need early access, you can request an early withdrawal — your principal is returned but accrued interest is forfeited.",
      "All transactions are documented and you receive SMS confirmations at every step.",
    ],
    benefits: [
      "Higher interest rates than regular savings",
      "Guaranteed returns — your rate is locked for the full term",
      "Flexible term options from 3 to 24 months",
      "Rollover option at maturity to keep earning",
      "Early withdrawal available when you need it",
    ],
  },
  "client-loans": {
    title: "Client Loans",
    icon: HandCoins,
    color: "#DB2777",
    intro:
      "Access affordable micro-loans to grow your business, handle emergencies, or invest in opportunities. Prime Financial Service offers flat-rate loans with clear, predictable repayment schedules.",
    howItWorks: [
      "Apply for a loan through your field officer or branch. You'll need an active account with Prime Financial Service.",
      "Your loan amount, interest rate, and repayment term are agreed upfront — no hidden charges.",
      "Once approved, funds are disbursed to you and your repayment schedule begins.",
      "Make monthly repayments through your officer or at the branch. Every payment is recorded and you get an SMS confirmation.",
      "Your repayment progress is tracked in real time — you always know your outstanding balance.",
      "Once fully repaid, you're eligible to apply for a new loan.",
    ],
    benefits: [
      "Transparent flat-rate interest — you know the total cost from day one",
      "Flexible repayment terms from 1 to 24 months",
      "No collateral required for small loans",
      "Fast approval and disbursement",
      "SMS updates on every repayment",
    ],
  },
  savings: {
    title: "Savings",
    icon: PiggyBank,
    color: "#EA580C",
    intro:
      "A simple, secure savings account that lets you deposit and withdraw at your convenience. Whether you're saving for a goal or building a safety net, your money is safe with Prime Financial Service.",
    howItWorks: [
      "Open a savings account with your field officer or at any branch — it's quick and straightforward.",
      "Deposit money anytime through your officer or at the branch. There's no minimum deposit.",
      "Withdraw when you need to. A small commission may apply on withdrawals depending on the amount.",
      "Your balance is updated in real time and you receive SMS notifications for every transaction.",
      "Your account earns interest on your balance, credited periodically.",
    ],
    benefits: [
      "No minimum balance requirement",
      "Deposit and withdraw anytime",
      "Interest earned on your balance",
      "SMS notifications for every transaction",
      "Access through your field officer — banking comes to you",
    ],
  },
};

export default async function AboutProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PRODUCTS[slug];
  if (!product) notFound();

  const Icon = product.icon;

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Header */}
      <header className="border-b border-[#1D3461]/8 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/login" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-[13px] font-semibold tracking-[0.12em] text-[#1D3461]">
              PRIME FINANCIAL SERVICE
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1D3461]/15 px-3.5 py-2 text-[12.5px] font-medium text-[#1D3461] transition-colors hover:bg-[#1D3461]/5"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Title */}
        <div className="mb-10 flex items-center gap-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${product.color}15` }}
          >
            <Icon size={26} style={{ color: product.color }} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0A2240]/40">
              Our Products
            </p>
            <h1 className="text-[2rem] font-semibold tracking-tight text-[#1D3461]">
              {product.title}
            </h1>
          </div>
        </div>

        {/* Intro */}
        <p className="mb-10 text-[16px] leading-relaxed text-[#0A2240]/70">
          {product.intro}
        </p>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="mb-5 text-[18px] font-semibold text-[#1D3461]">How it works</h2>
          <ol className="space-y-4">
            {product.howItWorks.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ backgroundColor: product.color }}
                >
                  {i + 1}
                </span>
                <p className="pt-0.5 text-[15px] leading-relaxed text-[#0A2240]/65">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <section className="mb-12">
          <h2 className="mb-5 text-[18px] font-semibold text-[#1D3461]">Benefits</h2>
          <ul className="space-y-3">
            {product.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] text-[#0A2240]/65">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: product.color }}
                />
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* Other products */}
        <section className="border-t border-[#1D3461]/8 pt-8">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#0A2240]/40">
            Explore other products
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(PRODUCTS)
              .filter(([key]) => key !== slug)
              .map(([key, p]) => {
                const PIcon = p.icon;
                return (
                  <Link
                    key={key}
                    href={`/about/${key}`}
                    className="inline-flex items-center gap-2 rounded-md border border-[#1D3461]/12 bg-white px-4 py-2.5 text-[13px] font-medium text-[#1D3461] transition-colors hover:border-[#2CBFBF]/40 hover:bg-[#2CBFBF]/5"
                  >
                    <PIcon size={15} style={{ color: p.color }} />
                    {p.title}
                  </Link>
                );
              })}
          </div>
        </section>
      </main>
    </div>
  );
}
