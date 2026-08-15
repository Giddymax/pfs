# Core Financial Formulas — Account Balance, Deposits, Withdrawals

**Prepared using standard depository-institution / microfinance accounting practice** (the same double-entry logic banks, credit unions, and CGAP-aligned MFIs use for their General Ledger and Trial Balance). This is the authoritative reference — not a simplified version. Two levels are given for each metric because a microfinance operation needs both: the **per-account ledger formula** (what one client's passbook shows) and the **company-wide aggregate formula** (what the Overview dashboard shows).

---

## 1. Deposits

### Definition
A **Deposit** is cash received into a client's account. It is recognized **immediately, in full, on a cash basis** — there is no accrual question (unlike interest), because the cash is physically in hand the moment it's recorded. Deposits are always **gross** — never netted against anything.

### Formula — per account (ledger level)
```
Account Deposits (lifetime or period) = Σ (deposit transaction amounts) for that account,
                                          excluding reversed transactions
```

### Formula — company-wide (aggregate level)
```
TOTAL DEPOSITS = Σ (deposit transaction amounts), across every client account, excluding reversed transactions

Best practice splits this by product, since Savings and Susu are different liability products:
  Total Savings Deposits =  Σ(deposits) — savings accounts only
  Total Susu Deposits    =  Σ(deposits) — susu accounts only
  Combined Deposits      =  Total Savings Deposits + Total Susu Deposits
```

### Why this is the correct formula
- **Gross, not net.** A deposit is never reduced by a later withdrawal — that would blend two separate events into one and destroy the audit trail. Deposits and Withdrawals must always be reportable as two independent totals that can each be traced back to their own transaction log.
- **Cash basis.** No revenue-recognition timing issue applies — cash deposited is cash on hand, full stop.
- **Reversals excluded.** A reversed deposit was, by definition, never real money — a correct General Ledger never counts it.
- **Never includes the company's own fund account** (e.g., a Consolidated Fund account holding company equity). Mixing company money into "client deposits" would misstate the deposit liability.

---

## 2. Withdrawals

This is the one metric where casual usage and correct accounting **diverge**, and getting it right matters:

> **A Withdrawal is money physically paid out to the client.**
> **A fee/commission/charge is a separate revenue event that happens to also reduce the client's balance.**

They both *debit the client's account*, but they are not the same *kind* of thing — one is a balance-sheet movement (money leaving the liability), the other is an income-statement event (revenue being earned). A world-class chart of accounts keeps them as two distinct, separately labeled figures rather than folding one into the other under a single "Withdrawals" heading. Conflating them either:
- **understates operational transparency** (you can no longer see, at a glance, how much cash actually left the till vs. how much was retained as fees), or
- **overstates "withdrawals"** if a reader assumes the whole figure was paid out in cash.

### The two figures, correctly defined

```
① CLIENT WITHDRAWALS (Principal)
   = Σ (withdrawal transaction amounts) — the raw principal a client took out in cash,
     excluding reversed transactions
   → This is the true "Withdrawals" line for a Trial Balance / depositor statement.

② TOTAL DEBITS TO CLIENT BALANCES  (operational / management figure — NOT the same as ①)
   = ① Client Withdrawals (Principal)
   + Withdrawal Commission           (fee revenue, savings withdrawals)
   + Susu Fees                       (day-31 fee + early-withdrawal/emergency penalties)
   + SMS Fees                        (monthly charge, deducted from balance)
   + Loan Processing Fees            (deducted from balance at loan activation)
   ─────────────────────────────────────────────────────────────────────
   = every amount that left a client's balance for ANY reason — cash in hand
     to the client, or company revenue collected — all deducted from the
     same liability pool, so they belong together for "how much did client
     balances shrink by," but NOT for "how much cash did we hand out."

   Card Fees are the one deliberate exclusion from ②: a card fee is a fresh
   cash inflow charged at registration — it is never deducted from any
   client's balance, so it cannot belong in a "deductions from balance" figure.
```

### Formula — per account (ledger level)
```
Account Withdrawals (①, principal only) = Σ (withdrawal amounts) for that account, reversed excluded
```

### Formula — company-wide (aggregate level)
```
① TOTAL CLIENT WITHDRAWALS       = Σ(withdrawal amounts), all accounts, reversed excluded
② TOTAL DEBITS TO CLIENT BALANCES = ① + Commission + Susu Fees + SMS Fees + Processing Fees
```

### Best-practice recommendation
Report **both**, always labeled distinctly:
- **"Client Withdrawals"** or **"Cash Paid to Clients"** → figure ①, the number an auditor or a client would recognize as "withdrawals."
- **"Total Debits to Client Balances"** or **"Total Deductions"** → figure ②, a useful internal/management figure for "how much left client accounts in total," but never presented to a client or regulator under the plain word "Withdrawals" alone, since that invites the reader to assume 100% of it was handed out in cash.

---

## 3. Account Balance

There are two equivalent, textbook-correct ways to arrive at this number. Both must always agree — if they don't, something in the underlying transaction data is wrong, not the formula.

### Method A — Running ledger balance (per account, T-account style)
This is how a single client's passbook balance is actually built, transaction by transaction:
```
Account Balance = Opening Balance
                 + Σ(Deposits)
                 − Σ(Withdrawals)
                 − Σ(Commission/Fees charged directly to this account)
```
Every deposit **increases** the balance; every withdrawal and every fee charged to that specific account **decreases** it. This is a pure debit/credit ledger — no company-wide concepts (loans, expenditures, equity) enter into it, because it's scoped to one client's own liability account.

### Method B — Balance-sheet identity (company-wide cash position)
The figure the Overview dashboard calls **Account Balance** is not one client's balance — it's the company's total **cash position**, derived from the fundamental accounting equation:
```
ASSETS = LIABILITIES + EQUITY
Cash + Loans Receivable, net = Client Deposit Liability + Equity

⇒  CASH (= "Account Balance")  =  Client Deposit Liability
                                  + Equity
                                  − Loans Receivable, net
```
Expanded into every figure defined above:
```
ACCOUNT BALANCE  =  Client Deposit Liability          (Σ current balances, all client accounts — Method A's result, summed)
                   + Card Fees                          (fresh cash inflow — see §2)
                   + Withdrawal Commission               ┐
                   + Loan Processing Fees                 │  fee revenue that was
                   + SMS Fees                              │  deducted straight out of
                   + Susu Fees actually collected (swept)  ┘  Client Deposit Liability —
                                                              added back so cash isn't
                                                              understated by the fee total
                   − Loans Disbursed                      (cash that went out the door on loans)
                   + Loan Repayments                      (cash that came back — principal + interest)
                   − Total Expenditures                   (real operating cash outflows)
```

### Why both methods must reconcile
Method A, summed across every single client account, produces exactly **Client Deposit Liability** — the first term of Method B. Method B then layers the company's own money (revenue collected, loans out, loans repaid, expenses paid) on top of that liability figure to arrive at the company's true cash position. They are the same underlying ledger, viewed at two different levels of aggregation — a correct system will always show them agreeing to the cedi.

### The one accepted simplification
Loan interest is **not** added to this formula as a separate line — it arrives bundled inside "Loan Repayments" (a single repayment is principal + interest received in one cash transaction). This is standard, accepted practice in **cash-basis** microfinance accounting: cash increases by the full repayment the moment it's received, and separately tracking the interest sliver for balance-sheet purposes (rather than just recognizing it on the Income Statement) adds ledger complexity most small MFIs don't carry. It does **not** distort the cash figure itself — only a fully accrual-basis loan-receivable sub-ledger would ever need to split it further.

### What Account Balance is **not**
For completeness — two formulas that look plausible but are **not** correct, and why:

```
✗  Account Balance = Combined Deposits − Total Withdrawals
   Wrong because: this only reconstructs Client Deposit Liability (Method A, summed).
   It has no way to reflect money out on loan, revenue earned, or expenditures paid —
   it is not a cash-position formula at all, just the liability side restated.

✗  Account Balance = Combined Deposits − Loans Disbursed
   Wrong because: Combined Deposits (a liability — money owed to depositors) and
   Loans Disbursed (an asset — money the company is owed back) are two different
   sides of the balance sheet. Subtracting one from the other has no accounting
   meaning; the correct treatment nets Loans Disbursed only against Loan
   Repayments (Method B above), not against client deposits.
```

---

## 4. Quick reference card

| Metric | Formula | Type |
|---|---|---|
| **Deposits** (per account) | Σ(deposit amounts), reversed excluded | Liability increase |
| **Deposits** (company-wide) | Σ(deposit amounts), all accounts, reversed excluded | Liability increase |
| **Client Withdrawals** (①) | Σ(withdrawal amounts), reversed excluded | Liability decrease — cash paid out |
| **Total Debits to Balances** (②) | ① + Commission + Susu Fees + SMS Fees + Processing Fees | Liability decrease — cash out + amounts collected (income and non-income alike) |
| **Account Balance** (per account) | Opening + Deposits − Withdrawals − Fees | Running ledger balance |
| **Account Balance** (company-wide) | Client Deposit Liability + Equity − Loans Receivable, net | Cash position (Assets = Liabilities + Equity, solved for Cash) |

---

## 5. How this maps to what your app already calculates

Good news — this is not a departure from your current system, it's the formal statement of it:

- **Deposits** — already correctly gross, per-product, reversal-excluded (Total Savings / Total Daily Susu on Overview; Total Deposits / Savings Deposits / Susu Deposits on the Deposits report).
- **Withdrawals** — your app already keeps **both** figures distinctly labeled, exactly as recommended in §2: `withdrawalPrincipal` / "Cash Paid to Clients" is figure ①, and the broader `totalWithdrawals` / "Total Withdrawals" is figure ②. The one refinement worth making: consider relabeling the Overview's "Total Withdrawals" card to **"Total Debits to Client Balances"** (or similar) so the figure ①-vs-② distinction is unmistakable at a glance, not just in the hint text — say the word and I'll make that change.
- **Account Balance** — `computeAccountSummary()`'s formula in `lib/finance/account-summary.ts` **is** Method B above, term for term, including the correct treatment of the two "wrong formula" traps in §3.

**One classification note, layered on top of everything above:** within figure ② (Total Debits to Balances) and the "fee revenue" language used throughout this file, the app draws a further distinction the owner has made explicit — of the four fee/commission types deducted from client balances, only **Withdrawal Commission, Susu Fees, and Processing Fees** (plus Loan Interest) count as **Company Income**. **SMS Fees are not income** — they're a real receipt (still deducted from client balances, still part of ②, still added back into Account Balance), just not counted toward Total Revenue or Net Income. Card Fees follow the same "receipt, not income" rule, even though they were never part of ② in the first place (§2 already excludes them, since they're never deducted from a client's balance). See `pfs-daily-operating-guide.md` §11.1 for the full Income Statement treatment.

