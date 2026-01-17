-- 1. Create personal_borrowings table if it doesn't exist
create table if not exists personal_borrowings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  lender_name text not null,
  principal_amount numeric not null,
  interest_rate numeric not null,
  rate_interval text not null check (rate_interval in ('ANNUALLY', 'MONTHLY', 'DAILY')),
  start_date date not null default current_date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED')),
  created_at timestamptz default now()
);

-- 2. Enable RLS (safe to run multiple times)
alter table personal_borrowings enable row level security;

-- 3. Create Policies (Drops existing policies first to strictly avoid "policy already exists" error)

drop policy if exists "Users can view own borrowings" on personal_borrowings;
create policy "Users can view own borrowings"
  on personal_borrowings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own borrowings" on personal_borrowings;
create policy "Users can insert own borrowings"
  on personal_borrowings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own borrowings" on personal_borrowings;
create policy "Users can update own borrowings"
  on personal_borrowings for update
  using (auth.uid() = user_id);

-- 4. Add title column to loans table (for Merge Borrowers feature)
alter table loans add column if not exists title text;
alter table personal_borrowings add column if not exists title text;
