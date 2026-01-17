-- Ensure RLS is enabled for borrowers
alter table borrowers enable row level security;

-- 1. VIEW Policy
-- Drop potential existing policies (both correct and typo versions) to be safe
drop policy if exists "Users can view own borrowers" on borrowers;
drop policy if exists "Users can view own borrowings" on borrowers;

create policy "Users can view own borrowers"
  on borrowers for select
  using (auth.uid() = user_id);

-- 2. INSERT Policy
drop policy if exists "Users can insert own borrowers" on borrowers;
create policy "Users can insert own borrowers"
  on borrowers for insert
  with check (auth.uid() = user_id);

-- 3. DELETE Policy
drop policy if exists "Users can delete own borrowers" on borrowers;
create policy "Users can delete own borrowers"
  on borrowers for delete
  using (auth.uid() = user_id);

-- 4. UPDATE Policy
drop policy if exists "Users can update own borrowers" on borrowers;
create policy "Users can update own borrowers"
  on borrowers for update
  using (auth.uid() = user_id);
