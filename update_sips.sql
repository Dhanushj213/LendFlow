-- Create mutual_fund_sips table
create table if not exists mutual_fund_sips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  fund_name text not null,
  amount numeric not null,
  sip_date integer not null check (sip_date between 1 and 31),
  folio_number text,
  next_due_date date,
  created_at timestamptz default now()
);

-- Enable RLS
alter table mutual_fund_sips enable row level security;

-- Policies
create policy "Users can view own sips"
  on mutual_fund_sips for select
  using (auth.uid() = user_id);

create policy "Users can insert own sips"
  on mutual_fund_sips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sips"
  on mutual_fund_sips for update
  using (auth.uid() = user_id);

create policy "Users can delete own sips"
  on mutual_fund_sips for delete
  using (auth.uid() = user_id);
