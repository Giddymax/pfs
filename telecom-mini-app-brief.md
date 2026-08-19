# PFS Telecom Mini-App — Build Brief

**Prepared for:** Prime Financial Service (PFS)
**Prepared as:** an implementation prompt — hand this to whoever (or whichever AI session) builds the feature next. It is written so no further context is required to start.

---

## 1. One-paragraph brief

Inside the existing PFS app (Next.js 16 App Router + Supabase, live at the current dashboard), add a second mini-app called **Telecom** — a mobile-money transaction log with its own yellow-and-white visual identity, sitting alongside the existing "Financial Service" workspace (savings, susu, loans — current teal/navy identity, unchanged). After logging in with the same credentials, the sidebar exposes an **app switcher**: two destinations, "Financial Service" and "Telecom". Selecting one swaps the sidebar's nav items, accent theme, and the routed content area into that app's world. The two apps share one login, one `profiles` table, one Supabase project — but Telecom gets its own table, its own log, and (per §7) its own fully separate financial statements. This is a firm decision, not an open question: **Telecom's money and PFS's money are never combined, anywhere in the app.**

Telecom transactions are **walk-in, one-off, from random people** — not PFS's registered savings/susu clients. There's no account to open first and no running balance to maintain; each transaction is logged on its own, at the moment it happens.

**Do not conflate Telecom with PFS, anywhere, not just the money.** Telecom does not appear in any PFS report, export, staff-performance figure, stat card, or "recent activity" widget — and PFS's own branding, terminology, and navigation groupings stay out of the Telecom pane wherever the two would otherwise blur together. See §7 for the full list.

**Exactly one thing is shared: the profile.** One login, one `profiles` table, one session, the same `is_admin()`/`is_staff_or_admin()` role-check primitives — that's identity and permission plumbing, and it stays shared because there's genuinely one person signing in either way. Everything built *on top of* that identity — what counts as admin-only, what counts as revenue, what the nav shows, what the brand shows, what a stat card means — is decided independently for Telecom, on Telecom's own terms, never inherited just because "that's how PFS already does it." Reusing PFS's UI components (`Card`, `StatCard`, `xlsxResponse`, and so on, §4) is fine — that's rendering tooling with no business meaning baked in. Reusing PFS's business *decisions* is what this brief is ruling out.

---

## 2. Scope

**In scope (phase 1 minimum viable product):**
- Sidebar app switcher (Financial Service ⇄ Telecom) — **admin-only for now**, see §3
- Telecom route group with its own yellow/white theme
- A flat transaction log — every row stands alone, for a phone number that isn't necessarily an existing PFS client (see §5); there is no wallet, no per-person account, and no running balance
- **Transaction type**, chosen from a dropdown, not typed free text: **Cash In, Cash Out, Deposit, Airtime, Data Bundle, Mashup**
- **Transaction form**, exactly four fields: **phone number, type, charge, note**
- Telecom-scoped Overview page (its own stat cards, entirely self-contained — see §7)
- Excel export of Telecom transactions, matching the existing export conventions

**Out of scope for phase 1** (call out explicitly rather than silently build):
- Any wallet, float, or running balance tracked inside PFS's own database — only the **charge** (what PFS collects for handling the transaction) is logged here, not the underlying Telecom principal that moves through the telco's own network. Flagged as an assumption to confirm in §9, not a silent guess.
- Wallet-to-wallet transfers — there's no wallet to transfer between
- Interest, loans, or susu-style cycles on Telecom transactions
- SMS notifications for Telecom transactions (existing `lib/sms/*` can be extended later, not now)
- A public/customer-facing app — this is staff/admin-operated, same as the rest of PFS
- Any attempt to match a phone number back to an existing PFS `clients` row — treat every transaction as belonging to a stranger, because it usually does

---

## 3. Navigation & the app switcher

**Where it lives:** `components/sidebar.tsx` currently renders one fixed `NAV` array under the Prime Financial brand lockup. Add a switcher directly below the logo block (`components/sidebar.tsx:228-234`), above the nav list — two pill buttons, not a dropdown, so both destinations are always visible at a glance:

```
[ 🏦 Financial Service ]  [ 📱 Telecom ]
```

- The switcher is **route-driven, not client state**: whichever pill matches the current pathname prefix (`/telecom/*` vs everything else) is the active one. No `useState` toggle that can desync from the URL — clicking a pill is a real `<Link>` navigation to that app's landing page (`/` for Financial Service, `/telecom` for Telecom).
- `components/sidebar.tsx` becomes pathname-aware: `const inTelecom = pathname.startsWith("/telecom")`. When `inTelecom`, render `TELECOM_NAV` + the yellow theme classes; otherwise render the existing `NAV`/`ACCOUNT_NAV`/`ADMIN_NAV` + the existing `sidebar-aurora` theme. This is a straightforward extension of the pattern already used for `profile.role === "admin"` conditional sections — same file, same technique, no new component needed.
- `components/dashboard-shell.tsx` and `components/mobile-nav.tsx` need the identical `inTelecom` check so the mobile drawer matches.
- Both apps keep the same **profile card + sign-out** footer (`sidebar.tsx:308-338`) unchanged — one login, one identity, two workspaces.
- The brand lockup at the top of the sidebar (`sidebar.tsx:228-234`, currently "Prime Financial / Service") swaps to a standalone **"Telecom"** wordmark when `inTelecom` — same `Logo` icon mark for continuity (one company, one login), but the "Prime Financial Service" text drops entirely while inside the Telecom pane. The two should read as genuinely separate apps sharing a login screen, not a PFS screen with a yellow tab bolted on.
- The `TELECOM_NAV` list (whatever pages it ends up with) *replaces* the sidebar's nav entirely while active — it does not sit as a new section underneath "Accounts" or "Admin". Nothing PFS-labeled should be visible while the Telecom pane is active except the shared profile/sign-out footer.

**Admin-only, for now.** Staff don't get Telecom at all in phase 1 — not the pill, not the pages, nothing:
- The Telecom pill in the switcher only renders when `profile.role === "admin"`; staff never see it as an option, the same way the current sidebar already hides the Overview link and the whole `ADMIN_NAV` block from staff (`sidebar.tsx:237, 279`).
- Add `app/(dashboard)/telecom/layout.tsx` with a hard redirect for non-admins, mirroring the existing guard on `app/(dashboard)/page.tsx` (`if (profile.role !== "admin") redirect("/clients")`). This is the real enforcement — the hidden pill is just UX, not security; a staff member typing `/telecom/transactions` directly must still be bounced out.
- This is explicitly a **phase-1 default, not a permanent architecture decision** — see §9 for whether/when it opens up to staff.

**Route structure:** new top-level segment, sibling to the existing pages inside `app/(dashboard)/`:

```
app/(dashboard)/telecom/
  page.tsx                 → Telecom Overview (landing page for the Telecom pill)
  transactions/page.tsx     → the full transaction log, filterable
```

Just two pages — no wallet list, no wallet detail, no client picker. **Recording a transaction needs nothing looked up first.** A "Record transaction" action (a button on the Transactions page, opening a small modal or inline form) captures exactly the four fields from §2:

| Field | Input | Notes |
|---|---|---|
| Phone number | text input | free text — not validated against `clients`, not a foreign key |
| Type | **dropdown** | Cash In / Cash Out / Deposit / Airtime / Data Bundle / Mashup — see §5 for the enum |
| Charge | numeric input (GHS) | what PFS collected for this transaction |
| Note | text input, optional | free text |

Submitting it appends one row to `telecom_transactions` and nothing else changes — no balance to update, no wallet to touch. This replaces the wallet-picker design from an earlier draft of this brief entirely; that version assumed persistent client wallets, which don't exist in this design.

Reusing the existing `app/(dashboard)/layout.tsx` (auth + profile fetch) means Telecom pages get auth for free — no separate login, no separate layout file needed.

---

## 4. Visual identity

PFS's current identity is navy/blue-led (`#0033AA`) with a green sidebar gradient (`sidebar-aurora`, `globals.css`) and per-section accent tints (`TONES` in `app/(dashboard)/page.tsx`). Telecom needs its own identity that reads as a distinct app while still obviously living inside the same product shell (same fonts, same `Card`/`StatCard`/`PageHeader` primitives, same spacing scale).

| Token | Value | Use |
|---|---|---|
| `--telecom-yellow` | `#FFC72C` | Primary accent — sidebar background base, primary buttons, active nav pill |
| `--telecom-yellow-deep` | `#E0A800` | Hover/pressed states, borders on yellow surfaces |
| `--telecom-ink` | `#1A1A1A` | Text on yellow (never white-on-yellow — fails contrast) |
| `--telecom-white` | `#FFFFFF` | Content area ground, cards |
| `--telecom-paper` | `#FFFBEF` | Subtle warm off-white for card fills / zebra rows, instead of stark white-on-white |
| `--telecom-muted` | `#8A7A3D` | Secondary text, captions, timestamps (warm-biased grey, not neutral grey — ties to the yellow) |

**Rule:** don't fork `components/ui.tsx`. `Card`, `StatCard`, `PageHeader`, `EmptyState` etc. already take `className`/tone-style props elsewhere in the app — extend them the same way (or wrap once in a small `telecom-theme` CSS scope applied at `app/(dashboard)/telecom/layout.tsx`, e.g. `<div className="telecom-scope">{children}</div>` with `.telecom-scope { --brand: var(--telecom-yellow); ... }` overriding the existing tokens the shared components already read). One set of components, two skins — this keeps `xlsxResponse`, `SummaryControls`, `TableFilter`, `ExportCsvButton` etc. reusable as-is inside Telecom pages with zero duplication.

**Type badges:** give each of the six transaction types its own small accent color in the Transactions table and the record form's dropdown, following the same pattern as `ClientStatusBadge`/`AccountStatusBadge` in `components/ui.tsx` — a quick visual scan of the log should tell Cash In from Airtime without reading the text.

Sidebar-specific: add a parallel `sidebar-telecom` CSS class next to `sidebar-aurora` in `globals.css` (yellow gradient background, dark-ink text/icons instead of white — the current `sidebar-aurora` assumes white text works on a dark green ground, which is wrong on yellow).

---

## 5. Data model (one new table, additive-only — nothing existing changes)

Telecom is a flat log, not a ledger with a derived balance. There's no parent "wallet" row for a transaction to post against, so none of `accounts`/`transactions`' balance-snapshot machinery applies here. One table:

```sql
create table telecom_transactions (
  id             uuid primary key default gen_random_uuid(),
  phone_number   text not null,        -- whoever walked in; free text, not a foreign key — see §2/§9
  type           text not null check (type in ('cash_in','cash_out','deposit','airtime','data_bundle','mashup')),
  charge         numeric(10,2) not null,   -- what PFS charged for the transaction — this IS the revenue line (see §7), not the underlying Telecom principal
  note           text,
  recorded_by    uuid not null references profiles(id),
  reversed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index on telecom_transactions (created_at desc);
create index on telecom_transactions (phone_number);
create index on telecom_transactions (type);
```

RLS: reuse the existing `is_admin()` / `is_staff_or_admin()` SQL functions unchanged — they're identity plumbing tied to the one shared `profiles` table (see §1), not a PFS-specific business rule, so reusing them isn't a conflation. What each function gets used *for* is a separate, independent call: decide per §9 whether every type is staff-recordable, or whether Cash Out (physical cash leaving the till) should be admin-only — on Telecom's own risk assessment, not by copying PFS's withdrawal rule just because it exists.

**Migration numbering:** the app is currently at `0061_staff_performance_date_range.sql`. Telecom is one migration: `0062_momo_transactions.sql` — table + RLS, nothing else. There's no `telecom_wallets` table and no `recalculate_*` RPC in this design, because there's no balance to keep in sync; every row is independent.

**Gotcha to carry forward regardless:** any RLS-gated insert — via RPC or a direct authenticated `.insert()` — must run through the session-authenticated Supabase client (`createClient()` from `lib/supabase/server`), never the service-role `createAdminClient()`. The latter has no `auth.uid()`, so `is_admin()`/`is_staff_or_admin()` silently resolve wrong. This bit PFS once already (the KWADWO DZOSSOU bug, on a much more complex ledger) — don't let Telecom repeat it just because its schema here is simple.

---

## 6. Feature checklist (phase 1)

- [ ] Sidebar app switcher, route-driven, mobile-drawer parity, **pill hidden from staff**
- [ ] `app/(dashboard)/telecom/layout.tsx` redirect guard — admin-only, blocks direct URL access by staff
- [ ] `telecom_transactions` migration + RLS
- [ ] Transaction type dropdown — Cash In / Cash Out / Deposit / Airtime / Data Bundle / Mashup — one shared component used by both the record form and the Transactions page filter
- [ ] Record-transaction form: phone number, type, charge, note — four fields, nothing else
- [ ] Transactions page: full log, filterable by type / phone number / date range (reuse `SummaryControls` for the date part, `TableFilter` for type)
- [ ] Telecom Overview page: today's transaction count, today's charges collected, a per-type breakdown (count + charges collected for each of the six types) — all from `computeTelecomSummary()`, yellow tone
- [ ] Excel export of Telecom transactions (`xlsxResponse`, excluding reversed rows, same convention as every other PFS export)
- [ ] Admin-only edit/delete of Telecom transactions, same as PFS transactions
- [ ] Separation audit passes (§7/§8): Telecom absent from every PFS report, export, and staff-performance figure; brand lockup and nav read as a distinct app while `inTelecom`

---

## 7. No conflation with PFS — not just the money

PFS and Telecom are treated as **two fully independent apps** that happen to share a login screen and a Supabase project. Nothing else is shared by default. This is a firm decision, not an open question, and it goes wider than the balance sheet:

**Financial statements**
- **Own summary helper, structurally separate.** PFS's Overview/Bank/Finance figures all resolve through one helper, `lib/finance/account-summary.ts::computeAccountSummary()`, so no PFS page can ever disagree with another. Telecom gets the same discipline in its own file, `lib/finance/telecom-summary.ts::computeTelecomSummary()` — simple by design here, essentially a `sum(charge)` over `telecom_transactions`, grouped by type and date range. It must not import from, call, or reference anything in `account-summary.ts`, and `account-summary.ts` must never import from or reference `telecom_transactions` either.
- **Own revenue line.** The `charge` collected on every Telecom transaction is Telecom's entire revenue figure. It never joins PFS's "Total Revenue" stat card (interest + commission + susu fees + card fees + sms fees + processing fees, minus the Consolidated Fund carve-out) — Telecom income gets its own "Telecom Revenue" figure, shown only on the Telecom Overview.
- **No cash or balance tracking at all, by design.** This design doesn't track a float or a per-person balance anywhere in PFS's database — only the charge is logged, not the principal that moves through the telco's own Telecom network. There's nothing here that could double-count against PFS's Cash at Hand / Cash at Bank even by accident, because Telecom isn't modeling custody of money — just billing for a service rendered at the counter. (If that reading is wrong — see §9 — this section needs revisiting before build.)
- **No shared client identity either.** An earlier draft of this brief reused PFS's `clients` table for KYC. This draft doesn't: a Telecom transaction's `phone_number` is free text, not a foreign key, because the person on the other side of the counter usually isn't a PFS client at all.

**Reporting, exports, and performance tracking**
- Telecom transactions must never appear in any PFS report, page, or export — not `reports/summary`, not `reports/deposits`, not `reports/withdrawals`, not `reports/account-summary`, not any PFS Excel export route, and not the Overview page's "recent transactions" widget. Telecom gets its own Excel export (§6), entirely separate.
- **`staff_performance()` stays untouched.** A staff member's Telecom activity is not "work" as far as PFS's own performance tracking is concerned — the RPC keeps counting `clients_registered`/`savings_collected`/`susu_collected` only. If Telecom ever needs its own staff-performance view, that's a Telecom-scoped page built later, not an extra column bolted onto the existing one.

**Naming and navigation**
- **Terminology collision, flagged rather than silently patched over.** Telecom has a transaction type literally called "Deposit" (§5), which reads identically to PFS's own "Deposit" product. This brief doesn't rename it — but it must never be pulled into PFS's Deposits report, and the two need to stay structurally impossible to confuse (different page, different table, different color story — see §4's type badges).
- **Navigation and branding stay visibly separate too** (see §3): the Telecom nav list replaces PFS's nav while active rather than sitting under it, and the sidebar's brand lockup swaps to a standalone "Telecom" wordmark instead of showing "Prime Financial Service" the whole time. The two apps should never visually announce themselves as one thing with a tab on it.

Nothing about §5's schema changes for any of this — it's about discipline everywhere *outside* the schema: every place a PFS page loops over data, sums a total, lists "recent" anything, or counts a staff member's activity, Telecom must be structurally incapable of showing up in it, because it was never queried from in the first place. There is no future phase where PFS and Telecom get wired together (see §8) — if that's ever revisited, it's a new, explicit decision made later, not something this build drifts toward by default.

---

## 8. Build order

1. **Schema** — `0062_momo_transactions.sql`, RLS. Nothing user-facing yet.
2. **Shell** — sidebar switcher, `/telecom` route group, yellow theme scope, empty Overview page with zeroed stat cards. Ship this alone first to confirm the switcher UX feels right before any logging exists.
3. **Logging** — the type dropdown, the four-field record form, the Transactions page with type/phone/date filters.
4. **Reporting** — real Telecom Overview stat cards (self-contained, from `computeTelecomSummary()` only), Excel export.
5. **Separation audit** — before calling this done, grep the diff for `telecom_transactions` outside the Telecom route group and `lib/finance/telecom-summary.ts`. It should appear nowhere in `lib/finance/account-summary.ts`, the `staff_performance()` migration, any file under `app/api/reports/*` or `app/(dashboard)/reports/*`, or the Overview page's queries. And the reverse: nothing in `lib/finance/telecom-summary.ts` should reference `accounts`/`transactions`/`susu_payments`/`clients`. This is the acceptance check for §7.

---

## 9. Open questions to resolve before or during build

- **Charge vs. principal.** Current scope logs only the `charge` (what PFS collects). Does PFS also want the underlying Telecom amount recorded for reference — e.g. "customer cashed out GHS 500, PFS charged GHS 5" — or is the charge genuinely the only figure that matters here? This is the single biggest assumption in this brief; confirm before building §5.
- Does "Mashup" or any other type need a network dimension too (e.g. MTN vs Telecel vs AirtelTigo), or is network irrelevant to how PFS bills for the transaction?
- Does Cash Out — or any other type — need to be admin-only, given real cash changes hands at the counter even though no running balance is tracked? Decide this on Telecom's own risk profile, not by copying PFS's withdrawal rule (see §1's "exactly one thing is shared" note).
- Phase 1 ships admin-only (§3). When/if staff access is added later, does every staff account get it automatically, or does that need a per-profile `telecom_enabled` flag for a more gradual rollout?
- Should `phone_number` get any format validation (Ghana numbers), given it's free text with nothing backing it?
- Is a per-type fixed or default charge worth pre-filling in the form (e.g. Airtime commonly charges a smaller flat fee than Cash Out), or should every transaction always require the charge to be typed in manually?

---

*This brief was generated for review, not auto-applied — nothing described here has been built yet. No files in the PFS repository have been touched.*
