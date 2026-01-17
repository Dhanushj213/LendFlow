-- Add title column to loans table for Merge Feature
alter table loans add column if not exists title text;

-- (The following lines are commented out as you have already run them)
-- create table if not exists personal_borrowings (
--   id uuid default gen_random_uuid() primary key,
--   user_id uuid references auth.users not null,
--   lender_name text not null,
--   principal_amount numeric not null,
--   interest_rate numeric not null,
--   rate_interval text not null check (rate_interval in ('ANNUALLY', 'MONTHLY', 'DAILY')),
--   start_date date not null default current_date,
--   status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED')),
--   created_at timestamptz default now()
-- );
-- alter table personal_borrowings enable row level security;
-- create policy "Users can view own borrowings" on personal_borrowings for select using (auth.uid() = user_id);
-- create policy "Users can insert own borrowings" on personal_borrowings for insert with check (auth.uid() = user_id);
-- create policy "Users can update own borrowings" on personal_borrowings for update using (auth.uid() = user_id);
