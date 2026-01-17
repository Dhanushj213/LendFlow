-- Create liability_transactions table
create table if not exists liability_transactions (
  id uuid default gen_random_uuid() primary key,
  borrowing_id uuid references personal_borrowings(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('REPAYMENT', 'INTEREST_ACCRUAL', 'ADJUSTMENT')),
  notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table liability_transactions enable row level security;

-- Policies
drop policy if exists "Users can view own liability transactions" on liability_transactions;
create policy "Users can view own liability transactions"
  on liability_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own liability transactions" on liability_transactions;
create policy "Users can insert own liability transactions"
  on liability_transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own liability transactions" on liability_transactions;
create policy "Users can delete own liability transactions"
  on liability_transactions for delete
  using (auth.uid() = user_id);
