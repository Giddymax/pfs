# Micro-Finance Business Logic — Savings, Daily Susu, Fixed Deposit
(Ghana context — Bank of Ghana Tier 2 microfinance / susu institution)

## 1. Shared Customer & Account Model

**Customer (one record, many accounts)**
- KYC: Ghana Card number, phone, photo, next of kin, residential/business address, occupation
- A customer can hold any combination of: Savings, Susu, Fixed Deposit accounts
- Each account: account number, product type, status (Active / Dormant / Closed / Matured), branch, assigned agent/collector, opening date, current balance

**Account statuses**
- *Active* → normal transactions allowed
- *Dormant* → no transaction for N months (e.g., 6); requires reactivation (visit branch / re-KYC)
- *Closed* → balance withdrawn, account archived
- *Matured* → applies to Fixed Deposit only, awaiting payout/rollover instruction

---

## 2. Savings Account

**Opening**
- Minimum opening deposit (e.g., GHS 10–50, configurable per product variant)
- Minimum operating balance; falling below it may attract a maintenance charge

**Interest**
- Computed on the **minimum monthly balance** (common in Ghana) or average daily balance — pick one and apply consistently
- Accrued monthly, credited quarterly (or per institution policy)
- Tiered rates possible (e.g., higher balance → higher rate)
- Formula (minimum balance method):
  `Interest = Minimum Balance in Month × (Annual Rate / 12)`

**Withdrawals**
- A set number of free withdrawals per month (e.g., 2); extra withdrawals attract a fee
- Withdrawal cannot take balance below the minimum operating balance (unless closing the account)

**Dormancy**
- No debit/credit for N consecutive months → flagged dormant
- Dormant accounts may attract a monthly dormancy fee until reactivated or closed

**Charges**
- Account maintenance fee (monthly/quarterly), excess-withdrawal fee, statement/passbook reissue fee, account closure fee

---

## 3. Daily Susu

This is the classic Ghanaian collector-based product: a field agent visits the customer (market, shop, home) to collect a fixed daily amount.

**Setup**
- Customer agrees to a fixed daily contribution amount (e.g., GHS 5, 10, 20)
- Cycle length: traditionally **31 days**, where the collector keeps **one day's contribution as commission/fee** at cycle-end (customer effectively saves 30 days' worth and "loses" 1 day to the service charge — this is the standard susu commission model; some institutions instead charge a flat % fee)
- Alternative fee model: no day forfeited, but a flat percentage commission is deducted from the cycle total

**Daily collection workflow**
1. Collector visits customer, receives cash, logs it (paper card historically; mobile agent-app today — ideally with GPS/photo/PIN confirmation)
2. Entry posted to customer's susu ledger same day; customer gets a receipt/SMS confirmation
3. Collector remits total daily collections to the branch/cashier at end of day (EOD cash reconciliation — collector is accountable for the full amount collected)

**Missed contributions**
- No interest accrues on susu (it is a pure savings/commission product, not interest-bearing, in most traditional models)
- Missed days simply extend the cycle (customer still owes those contributions to complete a "full" cycle) — define whether missed days are: (a) skippable with no penalty, or (b) must be made up to reach the agreed cycle total
- Optional: a small penalty/admin fee for chronic non-payment, at institution's discretion

**Cycle completion / payout**
- At the end of the agreed cycle (e.g., 31 contributions), the accumulated balance minus the collector's commission day/fee is:
  - Paid out in cash to the customer, **or**
  - Rolled into a new susu cycle, **or**
  - Transferred into a Savings account or used as seed capital for a Fixed Deposit
- Customer may request early cash-out before cycle completion — typically allowed but may forfeit the commission-waiver benefit (i.e., pay the fee regardless of contributions made)

**Collector accountability & commission**
- Collector's earnings = sum of the "commission days"/fees from all active customers in their portfolio for the period (this is how susu collectors are traditionally remunerated, separate from or in addition to a base wage)
- Daily reconciliation: total cash remitted by collector must equal the sum of all logged customer entries for that day; shortfalls are the collector's liability

---

## 4. Fixed Deposit (Term/Time Deposit)

**Placement**
- Customer places a lump sum for a fixed tenor: common options 30/60/90/180/365 days (or 3/6/12/24 months)
- Minimum deposit amount (e.g., GHS 500–1,000+)
- Interest rate is tiered by **tenor** and sometimes by **amount** (longer tenor / larger amount → higher rate) — maintain a rate table, not hard-coded values

**Interest calculation (simple interest, standard for short-tenor FDs)**
```
Interest = Principal × Annual Rate × (Tenor in days / 365)
Maturity Value = Principal + Interest
```
- If compounding is offered (longer tenors), compound at the agreed frequency (monthly/quarterly)

**Interest payout options** (selected at placement)
- Lump sum at maturity (most common for short tenors), or
- Periodic payout (monthly/quarterly) to a linked savings account, with principal returned at maturity

**Maturity instructions** (must be captured at placement, confirmed near maturity)
- Pay out principal + interest in full, or
- Auto-rollover principal only (interest paid out), or
- Auto-rollover principal + interest (compounding rollover)
- If no instruction given, default policy applies (commonly: auto-rollover at prevailing rate)

**Premature/early liquidation**
- Generally discouraged; typical penalty structures:
  - Forfeiture of all or part of accrued interest, and/or
  - Interest recalculated at a lower "savings rate" for the actual period held, and/or
  - A flat early-withdrawal penalty fee
- Define a minimum holding period before any withdrawal is permitted at all (e.g., no withdrawal in first 30 days)

**Certificate/instrument**
- Issue a Fixed Deposit certificate/receipt showing principal, rate, tenor, start date, maturity date, maturity value — used as proof and sometimes as loan collateral

---

## 5. Cross-Cutting Rules

**Interest tax (Ghana)**
- Withholding tax applies to interest income for individuals per Ghana Revenue Authority rules (rate set by current GRA policy — confirm current rate before hardcoding; historically 8% on investment income); deduct at source before crediting interest, and remit to GRA

**General ledger / accounting**
- Every transaction (susu collection, savings deposit/withdrawal, FD placement/maturity, interest accrual, fee charge) must post as a double-entry to the GL — no balance changes without a corresponding ledger entry
- End-of-day (EOD) batch jobs: accrue savings/FD interest, run dormancy checks, flag matured FDs, reconcile collector cash

**Compliance**
- Operate within Bank of Ghana Tier 2 microfinance institution rules (licensing category for susu/microfinance companies)
- Mandatory KYC using Ghana Card; AML/CFT screening on large or unusual transactions
- Periodic prudential reporting to BoG (deposit liabilities, loan book if applicable, capital adequacy)

**Audit trail**
- Every balance-affecting action records: who (teller/collector/system), when, what, before/after balance — non-negotiable for regulatory audits and dispute resolution

---

## 6. Suggested Product Parameter Table (configurable, not hardcoded)

| Parameter | Savings | Susu | Fixed Deposit |
|---|---|---|---|
| Min opening amount | ✓ | – (daily amount instead) | ✓ |
| Interest bearing | Yes | No (commission-based) | Yes |
| Interest method | Min monthly balance | n/a | Simple/compound by tenor |
| Fee/commission | Maintenance, excess withdrawal | Commission day or flat % per cycle | Early withdrawal penalty |
| Cycle/tenor | n/a (open-ended) | Fixed cycle (e.g., 31 days) | Fixed tenor (30–365+ days) |
| Early exit | Always allowed (above min balance) | Allowed, may forfeit fee benefit | Restricted, penalty applies |
| Rollover | n/a | Optional, into new cycle/other product | Optional, per maturity instruction |

---

*Note: exact rates, fees, minimums, and tax percentages should live in a configuration table (not hardcoded), since BoG-regulated institutions periodically revise these and they often differ by branch/product variant/promotion.*
