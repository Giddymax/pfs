import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";
import type { LoanStatus, ClientStatus, AccountStatus } from "@/lib/types";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link
            href={back}
            className="mb-2 inline-flex items-center gap-0.5 text-[12px] font-medium text-[#0033AA]/45 transition-colors hover:text-[#0033AA]"
          >
            <ChevronLeft size={14} />
            Back
          </Link>
        )}
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0033AA]/45">
            <span className="h-px w-6 bg-[#0062E1]" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight text-[#0033AA] sm:text-[1.85rem]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-xl text-[14px] text-[#0A2240]/55">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={clsx(
      "min-w-0 rounded-xl border px-5 py-4 shadow-sm",
      highlight ? "border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.04]" : "border-[#0033AA]/8 bg-white"
    )}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#0A2240]/45">{label}</p>
        {icon && (
          <span className={clsx("shrink-0", highlight ? "text-[#1F6E4A]" : "text-[#0062E1]")}>{icon}</span>
        )}
      </div>
      <p className={clsx(
        "break-words text-[1.25rem] font-semibold tracking-tight sm:text-[1.6rem]",
        highlight ? "text-[#1F6E4A]" : "text-[#0033AA]"
      )}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-[#0A2240]/45">{hint}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded-xl border border-[#0033AA]/8 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

const LOAN_STATUS_STYLES: Record<LoanStatus, string> = {
  pending: "bg-[#0062E1]/12 text-[#0A4DA6] border-[#0062E1]/25",
  active: "bg-[#0033AA]/8 text-[#0033AA] border-[#0033AA]/20",
  completed: "bg-[#1F6E4A]/10 text-[#1F6E4A] border-[#1F6E4A]/25",
  defaulted: "bg-[#B3432B]/10 text-[#963522] border-[#B3432B]/25",
  rejected: "bg-[#0A2240]/8 text-[#0A2240]/50 border-[#0A2240]/15",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide",
        LOAN_STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  active: "bg-[#1F6E4A]/10 text-[#1F6E4A] border-[#1F6E4A]/25",
  inactive: "bg-[#0A2240]/8 text-[#0A2240]/45 border-[#0A2240]/15",
  dormant: "bg-[#0062E1]/12 text-[#0A4DA6] border-[#0062E1]/25",
  suspended: "bg-[#B3432B]/10 text-[#963522] border-[#B3432B]/25",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide",
        CLIENT_STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

const ACCOUNT_STATUS_STYLES: Record<AccountStatus, string> = {
  active: "bg-[#1F6E4A]/10 text-[#1F6E4A] border-[#1F6E4A]/25",
  dormant: "bg-[#0062E1]/12 text-[#0A4DA6] border-[#0062E1]/25",
  matured: "bg-[#0033AA]/8 text-[#0033AA] border-[#0033AA]/20",
  closed: "bg-[#0A2240]/8 text-[#0A2240]/45 border-[#0A2240]/15",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide",
        ACCOUNT_STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#0033AA]/15 bg-white/60 px-6 py-16 text-center">
      <p className="text-[15px] font-semibold text-[#0033AA]">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-[#0A2240]/50">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
