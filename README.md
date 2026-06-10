# Prime Financial Service

Client, loan and loan-repayment management for a Ghanaian microfinance company
(savings, daily susu, fixed deposits, and loans). Built with Next.js 16, Tailwind CSS,
and Supabase (Postgres + Auth + Storage).

---

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and copy the **Project URL**, **anon public key**,
   and **service_role key**.
3. Copy `.env.local.example` to `.env.local` and paste in those three values:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. Open the **SQL Editor** in your Supabase project and run **each migration in order**:

   | File | What it creates |
   |------|-----------------|
   | `supabase/migrations/0001_init.sql` | `profiles`, `clients`, `loans`, `loan_repayments`, RLS |
   | `supabase/migrations/0002_accounts.sql` | `accounts` (savings, susu, fixed deposit) |
   | `supabase/migrations/0003_clients_town.sql` | Adds `town` column to clients |
   | `supabase/migrations/0004_transactions_and_settings.sql` | `transactions`, `settings`, `sms_log`, `card_fees` |
   | `supabase/migrations/0005_transaction_rpcs.sql` | `record_deposit`, `record_withdrawal` RPCs |
   | `supabase/migrations/0006_loans_lifecycle.sql` | Loan lifecycle helpers |
   | `supabase/migrations/0007_loan_rpcs.sql` | `record_loan_repayment` RPC |
   | `supabase/migrations/0008_susu_cycles_claims.sql` | `susu_cycles`, `susu_claims` |
   | `supabase/migrations/0009_susu_rpcs.sql` | Susu RPCs |
   | `supabase/migrations/0010_fixed_deposits.sql` | `fixed_deposits`, `fd_events` |
   | `supabase/migrations/0011_fd_rpcs.sql` | Fixed deposit RPCs |
   | `supabase/migrations/0012_sms_log_insert_policy.sql` | SMS log insert policy |
   | `supabase/migrations/0013_reconciliation_view.sql` | `compute_reconciliation` RPC |
   | `supabase/migrations/0014_loan_overpayment.sql` | Overpayment auto-credit |
   | `supabase/migrations/0015_period_summary_rpc.sql` | `compute_period_summary` RPC |
   | `supabase/migrations/0016_bank.sql` | `bank_transactions` table |

---

## 2. Create your first admin login

Supabase Auth manages credentials; the `profiles` table maps each auth user to a role.

1. In the Supabase dashboard go to **Authentication → Users → Add user** and create
   a user with an email and password.
2. Copy that user's UUID, then run in the SQL Editor:

   ```sql
   insert into profiles (id, full_name, email, role)
   values ('paste-user-uuid-here', 'Ama Owusu', 'ama@primefinancial.com.gh', 'admin');
   ```

3. Additional staff accounts can be created directly from the **Staff** page inside the app
   (admin login required). Staff can register clients, issue loans and record repayments,
   but cannot edit or delete records — that is reserved for `admin`.

---

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.
Sign in with the credentials you created above.

---

## 4. Deploy to Vercel

### 4.1 Push to GitHub

1. Create a new repository on [github.com](https://github.com/new).
2. Push your code:

   ```bash
   git init          # skip if already a git repo
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/prime-financial-service.git
   git push -u origin main
   ```

### 4.2 Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with your GitHub account.
2. Click **Import** next to your repository.
3. Vercel auto-detects Next.js — leave the build settings as-is.
4. Before clicking **Deploy**, open **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

   Add any other keys your app uses (e.g. `ARKESEL_API_KEY` for SMS).

5. Click **Deploy**. Vercel builds and hosts the app — you get a live URL immediately.

### 4.3 Subsequent deployments

Every `git push` to the `main` branch triggers an automatic re-deploy on Vercel.
Pull requests get isolated preview URLs automatically.

### 4.4 Custom domain (optional)

In your Vercel project go to **Settings → Domains** and add your domain
(e.g. `app.primefinancialservice.com`). Vercel provisions the SSL certificate automatically.

---

## Features

- **Role-based auth** — admin and staff roles with distinct permissions
- **Client management** — registration with photo, search, print registration card, Excel import/export
- **Savings accounts** — deposits, withdrawals, transaction history, print statements
- **Daily Susu** — cycle tracking, contributions, claims (normal and emergency)
- **Fixed deposits** — maturity tracking, early withdrawal, rollover
- **Loans** — flat-rate issuance, repayment recording, overpayment auto-credit to savings
- **Bank ledger** — track cash at bank vs cash at hand (cash at bank + cash at hand = total funds)
- **Period summary** — date-filtered financial summary with print support
- **Master reconciliation** — full ledger reconciliation formula
- **SMS notifications** — client and admin alerts via Arkesel (optional)
- **Staff management** — create, edit, and deactivate staff accounts in-app
- **Print** — registration cards, transaction histories, period summary — all with watermark

## Loan calculation model

Simple flat-rate term loan (see [`lib/loan.ts`](lib/loan.ts)):

```
total interest     = principal × (flat rate % / 100)
total repayable    = principal + total interest
monthly instalment = total repayable / tenor in months
```
