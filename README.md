# Prime Financial Service

Client, loan and loan-repayment management for a Ghanaian microfinance company
(savings, daily susu, fixed deposits, and loans). Built with Next.js 16, Tailwind CSS,
and Supabase (Postgres + Auth + Storage).

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and copy the **Project URL**, **anon public key**,
   and **service_role key**.
3. Copy `.env.local.example` to `.env.local` and paste in those three values.
4. Open the **SQL Editor** in your Supabase project and run the migration at
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates:
   - `profiles` (staff/admin accounts and roles)
   - `clients` (with photo support via the `client-photos` storage bucket)
   - `loans` and `loan_repayments`
   - Row Level Security policies: **admins** can edit/delete; **staff** can view and create only

## 2. Create your first staff & admin logins

Supabase Auth manages credentials; the `profiles` table maps each auth user to a role.

1. In the Supabase dashboard, go to **Authentication → Users → Add user** and create
   a user with an email and password (e.g. the branch admin's email).
2. Copy that user's UUID, then run in the SQL Editor:

   ```sql
   insert into profiles (id, full_name, email, role)
   values ('paste-user-uuid-here', 'Ama Owusu', 'ama@primefinancial.com.gh', 'admin');
   ```

3. Repeat for staff accounts, using `role = 'staff'`. Staff can register clients,
   issue loans and record repayments, but cannot edit or delete records — that is
   reserved for `admin`.

## 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.
Sign in with the email/password you created above.

## Features

- **Beautiful staff/admin login** at `/login`
- **Client registration** with photo capture/upload (`/clients/new`), list & search (`/clients`),
  and detail profile pages
- **Loan issuance** with live flat-rate repayment schedule preview (`/loans/new`)
- **Loan repayment recording** and running balance/progress tracking (loan detail page)
- **Role-based access**: admins can edit and delete clients/loans; staff can register,
  issue, and record but not modify or remove records

## Loan calculation model

Simple flat-rate term loan (see [`lib/loan.ts`](lib/loan.ts)):

```
total interest    = principal × (flat rate % / 100)
total repayable   = principal + total interest
monthly instalment = total repayable / tenor in months
```
