-- Lemma v0.24：学習記録をサーバー側でも守る（schema.sql のあとに、Supabase の SQL Editor で実行する。何度実行してもよい）
--
-- アプリ（クライアント）は v0.23 から、サーバーの記録を確かめてから合わせる。しかし古い版のアプリや、
-- 手で送られた要求はその確認を通らない。そこで、表 lemma_state への書き込みをサーバーでも次のように制限する。
--   1. state はオブジェクト、state.log は配列（壊れた記録を入れない）
--   2. 更新では rev が「前の rev + 1」（版番号を飛ばした・巻き戻した上書きを断る。同時の書き込みはアプリが取り直す）
--   3. state.schema を下げない（新しい版のアプリの記録を、古い版のアプリが古い形で上書きしない）
--   4. 解答の記録の件数を減らさない。ただし「消した印」resetAt が進んだとき（すべて消す・置き換え）は減ってよい
--      （v0.22 以前のアプリは 5000件で切り捨てて書き戻すので、それを断る）
-- 断ったときは SQLSTATE 'LM001'〜'LM004' のエラーになり、アプリは「同期できませんでした」と理由を表示する（記録は端末に残る）。
--
-- 注意：このファイルを実行するまで、上の制限はサーバーにはない。実行したかどうかは、SQL Editor で
--   select tgname from pg_trigger where tgname = 'lemma_state_guard';
-- が1行返るかで確かめる。

create or replace function public.lemma_state_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  old_n integer; new_n integer;
  old_reset numeric; new_reset numeric;
  old_schema numeric; new_schema numeric;
begin
  if jsonb_typeof(new.state) is distinct from 'object' or jsonb_typeof(new.state -> 'log') is distinct from 'array' then
    raise exception 'lemma: state.log が配列ではありません' using errcode = 'LM001';
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if new.rev is distinct from old.rev + 1 then
    raise exception 'lemma: rev は % のはずです（送られたのは %）', old.rev + 1, new.rev using errcode = 'LM002';
  end if;
  old_schema := case when jsonb_typeof(old.state -> 'schema') = 'number' then (old.state ->> 'schema')::numeric else 1 end;
  new_schema := case when jsonb_typeof(new.state -> 'schema') = 'number' then (new.state ->> 'schema')::numeric else 1 end;
  if new_schema < old_schema then
    raise exception 'lemma: 記録の版を % から % に下げる書き込みです', old_schema, new_schema using errcode = 'LM003';
  end if;
  old_n := case when jsonb_typeof(old.state -> 'log') = 'array' then jsonb_array_length(old.state -> 'log') else 0 end;
  new_n := jsonb_array_length(new.state -> 'log');
  old_reset := case when jsonb_typeof(old.state -> 'resetAt') = 'number' then (old.state ->> 'resetAt')::numeric else 0 end;
  new_reset := case when jsonb_typeof(new.state -> 'resetAt') = 'number' then (new.state ->> 'resetAt')::numeric else 0 end;
  if new_n < old_n and new_reset <= old_reset then
    raise exception 'lemma: 解答の記録が % 件から % 件に減る書き込みです', old_n, new_n using errcode = 'LM004';
  end if;
  return new;
end $$;

drop trigger if exists lemma_state_guard on public.lemma_state;
create trigger lemma_state_guard before insert or update on public.lemma_state
  for each row execute function public.lemma_state_guard();
