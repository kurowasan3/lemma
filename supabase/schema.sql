-- Lemma：学習記録の同期用（Supabase の SQL Editor で1回だけ実行する）
-- 1人1行。各ユーザーは自分の行だけを読み書きできる（行単位のアクセス制限 RLS）。
create table public.lemma_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  rev        integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint state_size check (pg_column_size(state) < 5000000)
);

alter table public.lemma_state enable row level security;

create policy "自分の記録を読む" on public.lemma_state
  for select using (auth.uid() = user_id);
create policy "自分の記録を作る" on public.lemma_state
  for insert with check (auth.uid() = user_id);
create policy "自分の記録を更新" on public.lemma_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "自分の記録を消す" on public.lemma_state
  for delete using (auth.uid() = user_id);

-- 退会：自分のアカウントごと消す（記録も一緒に消える）
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
