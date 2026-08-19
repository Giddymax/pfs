# Running Prime Financial Service — A Simple Day-to-Day Guide

**Who this is for:** you, running the business day to day — not a technical reference. Every step below tells you exactly where to click in the app and what number to look at. No accounting background needed.

**The one idea to hold onto:** your app already does the math correctly and consistently. Your job is not to calculate anything by hand — it's to **check the app's numbers against real life** (real cash, real bank balance) on a regular rhythm, and notice quickly when they stop matching.

---

## 1. Every single day

### Morning (before you open)
- [ ] Open **Overview** (the home page). Look at **Account Balance** — this is "how much money the business actually has right now," combining client deposits, revenue, and loans out. Just glance at it — you're building a habit of knowing this number, not analyzing it yet.

### During the day
- [ ] Record every deposit and withdrawal **the moment it happens**, not at the end of the day from memory. The whole system's accuracy depends on this one habit more than anything else.
- [ ] For a withdrawal: only an admin can record one (staff can only take deposits/contributions). This is deliberate — money leaving the business should always pass through someone senior.
- [ ] For **Daily Susu**: log the day's contribution against the right client the same day it's collected — don't batch several days together.

### End of day (after 8:30pm)
- [ ] Sweep the day's earned revenue into the **PFS Consolidated Fund** account (`SAV-00079`) — deposits to this account are only allowed at or after 8:30pm on purpose, so this becomes a natural "close the books for today" ritual. If you forget one day, do it first thing when you notice — don't skip it.
- [ ] Count the physical cash in the till. Compare it, roughly, to **Cash at Hand** on the Overview page. They should be close. If they're wildly different, don't panic — write down what you counted and flag it for the week's reconciliation (§4).

---

## 2. Every week

- [ ] Open **Staff → Staff Performance**. Pick "This week." Glance down the list — does anyone's numbers look unusually low (maybe they're not recording promptly) or unusually high (worth understanding why, not assuming wrongdoing)?
- [ ] Open **Susu Claims**. Any claim sitting in "Approved" for more than a few days without being paid? That's real client money you're holding that they're waiting on — pay it or find out why it's stuck.
- [ ] Compare your **bank app's actual balance** to **Cash at Bank** on the Bank page. If your bank supports it, this takes two minutes and catches problems early, before a whole month of drift piles up.

---

## 3. Every month

- [ ] **Charge SMS fees.** Go to Settings (or wherever the "Charge SMS fees" action lives) once the month is close to ending. This step is manual — if you skip it, that month's SMS revenue is simply never collected. Put a reminder on your phone for the last week of every month.
- [ ] **Check for overdue loans.** There's no automatic "overdue" flag yet, so this is a manual walk-through: open Loans, and for anything close to or past its due date with a balance still owing, follow up directly with that client. Waiting too long on this is the single easiest way for a microfinance business to quietly lose money.
- [ ] **Look at Expenditures by category** (rent, salaries, supplies, etc.). Are any categories creeping up month over month? Catching this early is much easier than catching it a year later.
- [ ] **Do a full reconciliation** (§4 below) — don't rely only on the quick weekly bank check; once a month, do the complete version.
- [ ] **Check for unclaimed, completed susu cycles.** A client who finished their 31-day cycle but hasn't come to collect is money you're still holding. Susu Claims will show these — reach out to clients who haven't claimed.

---

## 4. How to reconcile (step by step)

"Reconciliation" just means: **does what the app says match what's really in your hands?** Do this monthly at minimum, weekly if you can.

1. **Count your physical cash** — every note and coin in the till, right now.
2. **Check your real bank balance** — log into your actual bank app or ask the bank.
3. Open the **Bank** page in the app. Note the **Cash at Bank** and **Cash at Hand** figures it shows.
4. **Compare:**
   - Your physical count (step 1) vs. **Cash at Hand**
   - Your real bank balance (step 2) vs. **Cash at Bank**
5. **Record the result** on the **Reconciliation** page — even if the numbers match perfectly, write it down. A reconciliation record that says "everything matched, [date]" is just as valuable as one that catches a problem, because it proves you checked.
6. **If the numbers don't match:**
   - Small difference (a few cedis) — usually a rounding or a very recent transaction not yet recorded. Note it and move on.
   - Larger difference — stop and trace it. Pull up the day's transaction list for the account(s) involved and walk through each entry until you find where it diverges. Don't guess or "adjust" the app's number to match reality without finding the actual cause — that hides the real problem instead of fixing it.

---

## 5. The five numbers that matter most

You don't need to memorize formulas — just know what each number is *for*, in plain English.

| Number | Where to see it | What it actually means |
|---|---|---|
| **Account Balance** | Overview | "How much the business really has right now" — client deposits, plus what you've earned, minus what's out on loan. Your single most important number. |
| **Cash at Hand / Cash at Bank** | Overview, Bank | Account Balance split into "physical cash" vs "in the bank." Should always add up to Account Balance. |
| **Total Revenue** | Overview, Finance | What the business has genuinely earned — loan interest, withdrawal commission, susu fees, processing fees. Card fees and SMS fees are real receipts too, but the business classifies those as **Other Receipts**, not income — see the Finance page and §11.1. |
| **Total Withdrawals** | Overview, Withdrawals report | Every amount that's left a client's balance — what they withdrew in cash, *plus* every fee/commission/charge deducted from their account. If this number jumps unexpectedly, look at the Withdrawals report's breakdown to see which piece moved. |
| **Combined Account Total** | Overview | Total client savings + susu balances — what you owe your clients, all together. Never mix this up with revenue; it's the opposite kind of number (a liability, not income). |

---

## 6. Daily Susu — quick routine

- Contributions get logged daily, per client, the day they're collected.
- On day 31, the system automatically takes the company's fee and starts the client's next cycle — you don't need to do anything for that part.
- When a client wants their money (normal claim at cycle-end, or an emergency early claim): the request goes through **Approve → Pay**. Only an admin can approve and pay. Don't leave approved claims sitting unpaid (see §2).
- If a client withdraws early (before day 31), a penalty is charged automatically — this is normal, not a mistake.

---

## 7. Loans — quick routine

- When you activate a loan, the processing fee is taken automatically from the client's savings/susu balance — make sure they have enough in that account first, or activation will fail (which is the system protecting you from disbursing a fee-free loan by accident).
- Interest only counts as *earned revenue* once it's actually been repaid — not the moment the loan is issued. So a big new loan won't inflate your revenue number; only the repayments will, gradually.
- **There's no automatic "at-risk loan" warning yet** — this is the one area where you personally need to stay on top of it (§3, monthly overdue check). Consider keeping a simple paper or spreadsheet list of loans more than 30/60/90 days overdue until this is automated.

---

## 8. Telecom — quick routine

- Telecom (mobile money — cash in, cash out, deposits, airtime, data bundles) is **completely separate money from everything above** — its own revenue, its own log, on purpose. Don't add its numbers to your susu/savings totals.
- Every Telecom transaction records two numbers: the **amount** (what actually moved through the customer's Telecom wallet) and the **charge** (what you billed them — this is your Telecom revenue).
- **Important:** the app does *not* track your Telecom float (the money/e-cash backing your Telecom operations) at all — that was a deliberate choice. **You must reconcile your Telecom float yourself, outside this app** — e.g., count your physical float / check your telco wallet balance against what you've charged, on the same rhythm as your cash reconciliation (§4). Treat this as seriously as counting the till.
- Editing or deleting a Telecom transaction is admin-only, same as everywhere else.

---

## 9. Red flags — stop and look closer if you see

- A reconciliation that's off by more than a small, explainable amount.
- A staff member whose recorded activity suddenly drops to zero, or spikes unusually, without an obvious reason.
- An approved susu claim sitting unpaid for more than a few days.
- Cash at Hand or Cash at Bank showing a much bigger jump than the day's activity explains.
- A loan more than 90 days overdue with no follow-up logged.
- Your Telecom float running noticeably lower than what your charges collected would suggest.

None of these automatically mean something is wrong — most of the time there's a simple explanation. But they're exactly the kind of thing that's cheap to check today and expensive to untangle six months from now.

---

## 10. Quick glossary

- **Deposit** — money coming into a client's account.
- **Withdrawal** — money (or a fee) coming out of a client's account.
- **Commission** — the fee you charge on a savings withdrawal (susu withdrawals don't have this — they have penalties instead, see below).
- **Susu fee** — what the company keeps from a susu cycle: the day-31 fee, or a penalty for an early/emergency withdrawal.
- **Reversal** — undoing a transaction that was recorded by mistake, without deleting the record (so there's always a trail).
- **Reconciliation** — checking the app's numbers against real, physical/bank-verified money.
- **Cash at Hand vs Cash at Bank** — physical till money vs. money sitting in your actual bank account. Together they equal Account Balance.
- **Consolidated Fund** — the special account where the company's own earned revenue is formally set aside every night after 8:30pm.

---

## 11. Appendix — The accounting logic behind every KPI

This section is for when you (or your accountant) need to trace a number back to its formula — not for daily use. Every figure below is calculated by the app automatically; you never do this math by hand. It's here so you can **verify** a number against standard double-entry accounting logic, not so you have to **produce** one.

**One rule that applies everywhere below:** a reversed transaction never counts. If a deposit, withdrawal, or fee was reversed, every formula here silently excludes it, as if it never happened.

**The framework:** everything in this appendix is one instance of the fundamental accounting equation —

```
ASSETS  =  LIABILITIES  +  EQUITY
```

— read alongside a standard Income Statement (what was earned and spent this period) that *feeds into* Equity. Once you can place a number on one side of that equation, you know exactly what kind of number it is and what should happen when it moves.

### 11.1 Chart of accounts — the 16 base figures, classified

These sixteen figures are calculated in one single place in the app (so Overview, Bank, Finance, Deposits, and Withdrawals never show conflicting numbers for the same thing). Every other formula in this appendix, and every statement in §11.2–§11.4, is built from these. Each is classified by its true accounting nature, not just its screen label.

| # | Label | Formula | Account type | Statement it belongs to |
|---|---|---|---|---|
| 1 | **Total Savings** | Σ (lifetime deposits) across every savings account, excluding the Consolidated Fund | Liability (gross memo) | Balance Sheet |
| 2 | **Total Daily Susu** | Σ (lifetime deposits) across every susu account | Liability (gross memo) | Balance Sheet |
| 3 | **PFS Consolidated Fund** | Lifetime deposits into account SAV-00079 only | **Equity** (appropriated retained earnings) | Balance Sheet |
| 4 | **Loan Interest** | Σ (interest actually collected via repayments) | **Revenue** (Interest Income) | Income Statement |
| 5 | **Withdrawal Commission** | Σ (fee) on withdrawal transactions from savings accounts only | **Revenue** (Commission Income) | Income Statement |
| 6 | **Susu Fees** | Day-31 completion fees + early-withdrawal penalties + paid emergency-claim penalties | **Revenue** (Fee Income, accrual basis) | Income Statement |
| 7 | **Card Fees** | Σ (registration card fee amounts) | **Other Receipt** — real cash, **not income** (owner's explicit classification) | Balance Sheet (Equity) only |
| 8 | **SMS Fees** | Σ (monthly SMS charge amounts) | **Other Receipt** — real cash, **not income** (owner's explicit classification) | Balance Sheet (Equity) only |
| 9 | **Processing Fees** | Σ (processing_fee) on loans reaching active/completed/defaulted status | **Revenue** (Fee Income) | Income Statement |
| 10 | **Total Revenue** | (#4+#5+#6+#9, each only if switched on) − #3 | Income Statement subtotal — **excludes #7, #8** | Income Statement |
| 11 | **Combined Account Total** | #1 + #2 | Liability subtotal (gross memo) | Balance Sheet |
| 12 | **Withdrawal Principal** | Σ (amount) on withdrawal transactions | Liability contra-movement | Balance Sheet |
| 13 | **Total Withdrawals** | #12 + #5 + #6 + #8 + #9 | Liability contra-movement subtotal (a cash-flow figure — includes #8 regardless of #8's income classification) | Balance Sheet |
| 14 | **Loans Disbursed** | Σ (principal) on loans reaching active/completed/defaulted status | **Asset** (Loans Receivable, gross issued) | Balance Sheet |
| 15 | **Loan Repayments** | Σ (amount) on every loan repayment received | Asset contra-movement (Receivable ↓, Cash ↑) | Balance Sheet |
| 16 | **Total Expenditures** | Σ (amount) on every recorded expenditure | **Expense** (Operating Expenses) | Income Statement |

Two more accounts complete the picture, both derived rather than summed directly from one table:

| Account | Formula | Type |
|---|---|---|
| **Client Deposit Liability** | Σ (current balance) of every savings + susu account, excluding the Consolidated Fund | **Liability** (true net balance — not #1+#2, which are gross) |
| **Susu Fees Swept** | The portion of Susu Fees (#6) that has actually left a client's balance so far, via a real payout transaction | Revenue, recognized cash-basis (subset of #6) |
| **Total Other Receipts** | #7 + #8 | **Not income** — real cash received, reported as its own line, never folded into Total Revenue |
| **Cash at Bank / Cash at Hand** | See §11.4 | **Asset** (Cash) |

> **Why #7 and #8 aren't Revenue:** this is a business classification the owner has made explicitly, not a generic accounting default — Card Fees and Monthly SMS Fees are real money the company receives, but they are not counted as Company Income. They still behave exactly like income everywhere that matters for cash purposes (added back into Account Balance, still included in Total Withdrawals/Total Debits since they're still deducted from a client's balance) — they simply never appear inside Total Revenue or Net Income.

### 11.2 Income Statement (Profit & Loss)

Standard accrual-style P&L: **Company Income only** earned this period, less operating expenses, equals Net Income — which then becomes part of Equity on the Balance Sheet. Card Fees and SMS Fees are deliberately excluded — see the note above.

```
COMPANY INCOME
  Interest Income  (Loan Interest) ..................... #4
  Commission Income  (Withdrawal Commission) ........... #5
  Fee Income — Susu .......... ......................... #6
  Fee Income — Loan Processing ........................... #9
                                                        ─────────
  Gross Income ......................................... Σ(#4, #5, #6, #9, each only if enabled in Settings)
  Less: Appropriated to PFS Consolidated Fund ........... (#3)
                                                        ─────────
  TOTAL REVENUE (#10) ...................................  = Gross Income − #3

LESS: OPERATING EXPENSES
  Total Expenditures (#16) — rent, salaries, supplies, etc.

                                                        ═════════
  NET INCOME FOR THE PERIOD .............................  = #10 − #16
                                                        ═════════

MEMO — OTHER RECEIPTS (not part of Net Income, shown for completeness)
  Card Fees (#7) + SMS Fees (#8) ........................ = Total Other Receipts
```

Net Income is the amount added to Equity (Retained Earnings) once the Consolidated Fund appropriation (#3) has already been carved out above — the two together, #3 plus this period's undeposited Net Income, are what make up total company Equity (§11.3). Total Other Receipts is real cash too, and lands in Equity the same way (§11.3) — it's just tracked as a separate memo line rather than counted as earned income.

### 11.3 Statement of Financial Position (Balance Sheet)

```
ASSETS
  Cash at Bank .......................................... see §11.4
  Cash at Hand ........................................... see §11.4
                                                        ─────────
  Cash (= "Account Balance") ............................ Cash at Bank + Cash at Hand
  Loans Receivable, net .................................. #14 − #15   (Loans Disbursed − Loan Repayments)
                                                        ═════════
  TOTAL ASSETS ...........................................  = Cash + Loans Receivable, net

LIABILITIES
  Client Deposit Liability ............................... Savings + Susu balances owed to depositors, net
                                                        ═════════
  TOTAL LIABILITIES ......................................  = Client Deposit Liability

EQUITY
  PFS Consolidated Fund (restricted/appropriated) ....... #3
  Retained Earnings & Other Receipts, undeposited ........ Commission(#5) + Processing Fees(#9) + Susu Fees Swept
                                                             + Card Fees(#7) + SMS Fees(#8)  ← Other Receipts, not income
                                                             − Expenditures(#16)
                                                        ═════════
  TOTAL EQUITY ............................................ = Consolidated Fund + Retained Earnings & Other Receipts, undeposited

CHECK:  TOTAL ASSETS  =  TOTAL LIABILITIES  +  TOTAL EQUITY
```

**A precise note on that Equity line:** in a textbook chart of accounts, "Retained Earnings" holds *only* accumulated Net Income. Here it's deliberately blended with Total Other Receipts (Card Fees + SMS Fees), because both are real, undeposited cash sitting in the same equity pool — the blend is a practical simplification, not a claim that Card/SMS Fees are income. If you ever need the two split apart on a formal statement, subtract Total Other Receipts (§11.1) from this line to get the pure Retained Earnings figure.

**Accounting caveat, stated plainly:** Loan Interest (#4) is recognized as Revenue in §11.2, but is *not* separately capitalized on this Balance Sheet — it arrives bundled inside Loan Repayments (#15), which reduces "Loans Receivable, net" by the full repayment (principal *and* interest together), not principal alone. Cash still increases correctly by the full repayment amount, so the Cash figure itself is never wrong — but "Loans Receivable, net" understates what's still technically owed on principal alone, and "Retained Earnings" doesn't separately show interest income building up in Equity. This is a deliberate practical simplification (tracking two components of one cash receipt separately isn't worth the complexity it would add), not a bug — just something to know if you're reconciling against a textbook loan ledger.

### 11.4 Deriving Cash (Account Balance) from the accounting equation

Rearranging §11.3's equation for Cash — the figure the app calls **Account Balance** — gives exactly the formula the app computes:

```
Total Assets = Total Liabilities + Total Equity
Cash + Loans Receivable,net = Client Deposit Liability + Total Equity

⇒  CASH  =  Client Deposit Liability
           + Total Equity
           − Loans Receivable, net

Expanding Total Equity (§11.3) and Loans Receivable, net (#14 − #15):

⇒  ACCOUNT BALANCE  =  Client Deposit Liability
                      + Card Fees (#7)
                      + Withdrawal Commission (#5)
                      + Processing Fees (#9)
                      + SMS Fees (#8)
                      + Susu Fees Swept
                      − Loans Disbursed (#14)
                      + Loan Repayments (#15)
                      − Total Expenditures (#16)
```

Note the PFS Consolidated Fund (#3) does **not** appear in this final line — it cancels out. The fund's money never physically left the business; formally setting it aside just moves it from one Equity line ("undeposited retained earnings") to another ("Consolidated Fund"), which is why Account Balance is deliberately *not* adjusted for it a second time.

```
CASH AT BANK   =  Σ(bank deposits) − Σ(bank withdrawals), capped so it never exceeds Account Balance and never goes below 0
CASH AT HAND   =  Account Balance − Cash at Bank
```

### 11.5 Page-by-page — which cards use which formula

**Overview (home page)**
| Card | = |
|---|---|
| Total Clients | count of all registered clients |
| Total Savings | #1 |
| Total Daily Susu | #2 |
| Total Revenue | #10 (Company Income only — excludes Card Fees/SMS Fees) |
| PFS Consolidated Fund | #3 |
| Other Receipts | #7 + #8 (Card Fees + SMS Fees — not income) |
| Card Fees | #7 |
| Loan Interest | #4 |
| Withdrawal Commission | #5 |
| Susu Fees | #6 |
| SMS Fees | #8 |
| Processing Fees | #9 |
| Combined Account Total | #11 |
| Total Withdrawals | #13 |
| Loans Disbursed | #14 |
| Loan Repayments | #15 |
| Account Balance | §11.4 |
| Cash at Hand / Cash at Bank | §11.4 |

**Bank page** — Cash at Bank, Cash at Hand, Account Balance: identical formulas to Overview (§11.4), always in sync.

**Finance page**
| Card | = |
|---|---|
| Total Revenue | #10 (Company Income only) |
| Other Receipts | #7 + #8 (not income) |
| Total Expenditure | #16 |
| Net Balance | #10 − #16 |
| Revenue by product — Company Income (Savings/Loans/Susu) | matching individual base figures (#5, #4+#9, #6) |
| Other receipts (Card Fees/SMS Fees) | #7, #8 — shown in their own section, separate from revenue |

**Withdrawals report** (figures re-run for whatever date range you pick, same formulas scoped to that period)
| Card | = |
|---|---|
| Account Balance | §11.4 (always all-time, matches Overview regardless of the date filter) |
| Total Withdrawals | #13, scoped to the period |
| Cash Paid to Clients | #12, scoped to the period |
| Total Fees & Charges Retained | Total Withdrawals − Cash Paid to Clients, for the period |
| Withdrawal Commission / Susu Fees / SMS Charge / Processing Fee | #5 / #6 / #8 / #9, each scoped to the period |

**Deposits report**
| Card | = |
|---|---|
| Account Balance | §11.4 (all-time) |
| Total Deposits | Σ(amount) of every deposit transaction in the period |
| Savings Deposits | same, savings accounts only |
| Daily Susu Deposits | same, susu accounts only |

**Staff Performance** (period-scoped, per staff member)
| Card | = |
|---|---|
| Total Clients Registered | count of clients each staff member added, summed |
| Total Savings Collected | Σ(deposit amount) each staff member recorded to savings, summed |
| Total Susu Collected | Σ(deposit amount) each staff member recorded to susu, summed |

**Telecom — Overview & Performance** (completely separate money — see §8; never mixed with any figure above)
| Card | = |
|---|---|
| Transactions today / this period | count of Telecom transaction rows |
| Amount moved | Σ(amount) — the cash that passed through the customer's Telecom wallet |
| Charges collected | Σ(charge) — what PFS billed for the service; this is Telecom's *only* revenue figure |
| Per-type breakdown (cash in / cash out / deposit / airtime / data / mashup) | the same two sums, filtered to that one type |
| Staff Performance (Telecom) | same amount/charge sums, grouped by who recorded the transaction |

**Loans page**
| Card | = |
|---|---|
| Total Principal | Σ(principal) across all loans shown |
| Outstanding Balance | Σ(current_balance) across all loans shown |
| Active / Completed / Defaulted | counts by status |

**Individual account statement**
| Card | = |
|---|---|
| Balance | that account's own current balance |
| Lifetime Deposits / Withdrawals / Commission Paid | that account's own running totals (dep / wdr / comm columns) |

---

*Keep this nearby and follow the checklists in order — daily habits are what make the weekly and monthly checks quick instead of stressful.*
