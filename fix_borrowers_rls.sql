-- Ensure RLS is enabled for borrowers
alter table borrowers enable row level security;

-- Policy to allow users to view their own borrowers
drop policy if exists "Users can view own borrowers" on borrowers;
create policy "Users can view own borrowings"
  on borrowers for select
  using (auth.uid() = user_id);

-- Policy to allow users to insert their own borrowers
drop policy if exists "Users can insert own borrowers" on borrowers;
create policy "Users can insert own borrowers"
  on borrowers for insert
  with check (auth.uid() = user_id);

-- Policy to allow users to delete their own borrowers
drop policy if exists "Users can delete own borrowers" on borrowers;
create policy "Users can delete own borrowers"
  on borrowers for delete
  using (auth.uid() = user_id);

-- Policy to allow users to update their own borrowers
drop policy if exists "Users can update own borrowers" on borrowers;
create policy "Users can update own borrowers"
  on borrowers for update
  using (auth.uid() = user_id);
