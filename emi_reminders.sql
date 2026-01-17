-- Create EMIs Table
create table emis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  lender text not null,
  amount numeric not null,
  pan_number text,
  tenure_months integer,
  remaining_months integer,
  interest_rate numeric,
  start_date date,
  next_due_date date,
  status text check (status in ('ACTIVE', 'CLOSED')) default 'ACTIVE',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Insurance Policies Table
create table insurance_policies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  provider text,
  premium_amount numeric not null,
  frequency text check (frequency in ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY')),
  next_due_date date,
  renewal_date date,
  policy_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Reminders Table
create table reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  amount numeric not null,
  frequency text check (frequency in ('ONE_TIME', 'MONTHLY', 'YEARLY')),
  next_due_date date,
  is_paid boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for EMIs
alter table emis enable row level security;
create policy "Users can view their own emis" on emis for select using (auth.uid() = user_id);
create policy "Users can insert their own emis" on emis for insert with check (auth.uid() = user_id);
create policy "Users can update their own emis" on emis for update using (auth.uid() = user_id);
create policy "Users can delete their own emis" on emis for delete using (auth.uid() = user_id);

-- Enable RLS for Insurance Policies
alter table insurance_policies enable row level security;
create policy "Users can view their own policies" on insurance_policies for select using (auth.uid() = user_id);
create policy "Users can insert their own policies" on insurance_policies for insert with check (auth.uid() = user_id);
create policy "Users can update their own policies" on insurance_policies for update using (auth.uid() = user_id);
create policy "Users can delete their own policies" on insurance_policies for delete using (auth.uid() = user_id);

-- Enable RLS for Reminders
alter table reminders enable row level security;
create policy "Users can view their own reminders" on reminders for select using (auth.uid() = user_id);
create policy "Users can insert their own reminders" on reminders for insert with check (auth.uid() = user_id);
create policy "Users can update their own reminders" on reminders for update using (auth.uid() = user_id);
create policy "Users can delete their own reminders" on reminders for delete using (auth.uid() = user_id);
