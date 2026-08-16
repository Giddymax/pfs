"use client";

import { useEffect, useRef, useState } from "react";
import { Search, PiggyBank, Coins, UserRound, X, Loader2 } from "lucide-react";
import { formatGHS } from "@/lib/loan";
import { RecordTransactionForm } from "@/components/record-transaction-form";
import { SusuContributionForm } from "@/components/susu-contribution-form";
import { SusuWithdrawalForm } from "@/components/susu-withdrawal-form";
import type { SusuCycle } from "@/lib/types";

interface AccountResult {
  id: string;
  account_number: string;
  product_type: "savings" | "susu";
  balance: number;
  daily_contribution_amount: number | null;
  status: string;
  client_id: string;
  client_full_name: string;
  client_code: string;
}

interface WithdrawalContext {
  product_type: "savings" | "susu";
  balance: number;
  daily_contribution_amount?: number | null;
  is_qualified?: boolean;
  emergency_cycle?: SusuCycle | null;
}

const PRODUCT_LABEL: Record<AccountResult["product_type"], string> = {
  savings: "Savings",
  susu: "Daily Susu",
};

const PRODUCT_ICON: Record<AccountResult["product_type"], typeof PiggyBank> = {
  savings: PiggyBank,
  susu: Coins,
};

/**
 * Search-and-select widget that lets an admin/staff member jump straight to
 * recording a deposit or withdrawal from the Deposits/Withdrawals report
 * pages, without navigating to the client's account page first. Reuses the
 * exact same recording forms (RecordTransactionForm / SusuContributionForm /
 * SusuWithdrawalForm) those pages use, so the actual transaction logic never
 * diverges — this component only adds account discovery on top.
 */
export function AccountPicker({ mode }: { mode: "withdrawal" | "deposit" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AccountResult | null>(null);
  const [context, setContext] = useState<WithdrawalContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/accounts/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        setResults(res.ok ? (json.accounts ?? []) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setSearched(true);
      }
    }, term.length < 2 ? 0 : 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selectAccount(account: AccountResult) {
    setSelected(account);
    setResults([]);
    setQuery("");
    setContext(null);
    setContextError(null);

    if (mode === "withdrawal" && account.product_type === "susu") {
      setContextLoading(true);
      try {
        const res = await fetch(`/api/accounts/${account.id}/withdrawal-context`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load this account's withdrawal eligibility.");
        setContext(json);
      } catch (err) {
        setContextError(err instanceof Error ? err.message : "Could not load this account's withdrawal eligibility.");
      } finally {
        setContextLoading(false);
      }
    }
  }

  function reset() {
    setSelected(null);
    setContext(null);
    setContextError(null);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="rounded-xl border border-[#0033AA]/8 bg-white p-5">
      <h2 className="mb-1 text-[14px] font-semibold text-[#0033AA]">
        {mode === "withdrawal" ? "Record a withdrawal" : "Record a deposit"}
      </h2>
      <p className="mb-4 text-[12.5px] text-[#0A2240]/50">
        Search for the client or account, then {mode === "withdrawal" ? "withdraw" : "deposit"} directly — no need to open their account page first.
      </p>

      {!selected ? (
        <div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0033AA]/35" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client name, client ID, phone, or account number"
              className="w-full rounded-md border border-[#0033AA]/15 bg-white py-2.5 pl-10 pr-9 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
            />
            {searching && (
              <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#0033AA]/40" />
            )}
          </div>

          {results.length > 0 && (
            <ul className="mt-2 max-h-72 divide-y divide-[#0033AA]/6 overflow-y-auto rounded-md border border-[#0033AA]/10">
              {results.map((a) => {
                const Icon = PRODUCT_ICON[a.product_type];
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => selectAccount(a)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[#0033AA]/[0.04]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0033AA]/10 bg-[#0033AA]/5 text-[#0033AA]">
                        <UserRound size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-medium text-[#0A2240]">{a.client_full_name}</span>
                          <span className="text-[11.5px] text-[#0A2240]/40">{a.client_code}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[12px] text-[#0A2240]/50">
                          <Icon size={12} />
                          {PRODUCT_LABEL[a.product_type]} · {a.account_number}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#0A2240]">
                        {formatGHS(a.balance)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {searched && !searching && results.length === 0 && query.trim().length >= 2 && (
            <p className="mt-2.5 text-[12.5px] text-[#0A2240]/45">No open accounts match &ldquo;{query.trim()}&rdquo;.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.02] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0033AA]/10 bg-white text-[#0033AA]">
                <UserRound size={18} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#0A2240]">{selected.client_full_name}</p>
                <p className="text-[12px] text-[#0A2240]/50">
                  {selected.client_code} · {PRODUCT_LABEL[selected.product_type]} · {selected.account_number}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0A2240]/45 hover:text-[#963522]"
            >
              <X size={13} /> Change
            </button>
          </div>

          <p className="mb-4 text-[13px] text-[#0A2240]/60">
            Balance: <span className="font-semibold text-[#0A2240]">{formatGHS(selected.balance)}</span>
          </p>

          {contextError && (
            <div className="mb-3 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
              {contextError}
            </div>
          )}

          {mode === "deposit" && selected.product_type === "savings" && (
            <RecordTransactionForm accountId={selected.id} kind="deposit" />
          )}
          {mode === "deposit" && selected.product_type === "susu" && (
            <SusuContributionForm accountId={selected.id} dailyAmount={selected.daily_contribution_amount} />
          )}

          {mode === "withdrawal" && selected.product_type === "savings" && (
            <RecordTransactionForm accountId={selected.id} kind="withdrawal" />
          )}
          {mode === "withdrawal" && selected.product_type === "susu" && (
            contextLoading ? (
              <span className="inline-flex items-center gap-2 text-[13px] text-[#0A2240]/45">
                <Loader2 size={14} className="animate-spin" /> Checking withdrawal eligibility…
              </span>
            ) : context && context.product_type === "susu" ? (
              <SusuWithdrawalForm
                accountId={selected.id}
                availableBalance={context.balance}
                dailyAmount={context.daily_contribution_amount ?? 0}
                isQualified={context.is_qualified}
                emergencyCycle={context.emergency_cycle}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
