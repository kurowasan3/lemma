-- Lemma v0.25：学習記録をサーバー側でも守る（schema.sql のあとに、Supabase の SQL Editor で実行する）
--   ・何度実行してもよい（関数は create or replace、トリガーは作り直すだけ）。表と既存の記録は変えない。
--   ・適用前後の確認・戻し方は docs/data-integrity.md §6.3。
--
-- アプリ（クライアント）の合わせ方（js/store.js mergeState）は「和集合・新しい方・多い方」なので、通常の同期で
-- 学習記録が減ったり古くなったりすることは無い。減ってよいのは「消した印」resetAt を進めた明示的な消去・置き換えだけ。
-- そこで、表 lemma_state への書き込みごとに、次の規則を確かめる（破れば SQLSTATE 'LM00x' のエラーで断り、表は変えない）。
--
--   LM001 形：state はオブジェクト、log は配列で各要素は {p: 文字列, t: 数値}、pstat などはオブジェクト
--   LM002 版番号：作成は rev = 1、更新は rev = 前の rev + 1
--   LM003 記録の版：state.schema は 1〜100 の整数で、更新で下げない
--   LM004 解答の記録：前の記録（問題ID p と時刻 t の組）がすべて残っている（resetAt を進めた消去なら、その時刻より前は消えてよい）
--   LM005 解答の記録の改変：残っている記録から項目を消していない（値の更新＝再採点・想起・メモは許す）
--   LM006 消した印 resetAt：数値で、戻さない。進めるときはサーバーの時計で1日より先の未来にしない
--   LM007 学習状態：pstat・problems・cards・bookmarks・explains の項目が消えていない・時刻（と problems の回数）が戻っていない
--         （resetAt を進めた消去なら、その時刻より前のものは消えてよい）
--   LM008 重複：同じ (p, t) の解答の記録を増やしていない
--   localResetAt（端末だけの印）は、送られてきても保存しない（取り除く）。
--
-- 守らないもの（通常の操作で正しく変わるため）：settings・practice・グラフの式（最後に変えた方）、streak（日をあけると戻る）、
--   drill の自己ベスト（良い方に入れ替わる）、explains の古いメモ（問題ごとに新しい5件だけ残す）。

-- 関数は API に出ない schema（lemma_private）に置く（public の関数は Supabase の API から呼べてしまうため）。
-- トリガーは書き込んだ利用者の権限で動くので、authenticated にこの schema の利用を許す。
create schema if not exists lemma_private;
revoke all on schema lemma_private from public, anon;
grant usage on schema lemma_private to authenticated;

create or replace function lemma_private.lemma_num(v jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end
$$;

-- 対応表（問題ID → {時刻 field, …}）で、守る項目（時刻 >= cutoff）が消えた・時刻が戻ったものの数と例
create or replace function lemma_private.lemma_map_lost(o jsonb, n jsonb, field text, cutoff numeric, out lost bigint, out example text)
language sql immutable set search_path = '' as $$
  select count(*), min(a.key)
  from jsonb_each(case when jsonb_typeof(o) = 'object' then o else '{}'::jsonb end) a
  left join jsonb_each(case when jsonb_typeof(n) = 'object' then n else '{}'::jsonb end) b on b.key = a.key
  where coalesce(lemma_private.lemma_num(a.value -> field), 0) >= cutoff
    and (b.key is null
         or (lemma_private.lemma_num(a.value -> field) is not null
             and coalesce(lemma_private.lemma_num(b.value -> field), -1) < lemma_private.lemma_num(a.value -> field)))
$$;

create or replace function lemma_private.lemma_state_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb; n jsonb;
  old_reset numeric; new_reset numeric; cutoff numeric;
  old_schema numeric; new_schema numeric;
  cnt bigint; ex text; m text;
begin
  -- 端末だけの印は保存しない
  if jsonb_typeof(new.state) = 'object' and new.state ? 'localResetAt' then
    new.state := new.state - 'localResetAt';
  end if;
  n := new.state;
  ---------------------------------------------------------------- 形（作成・更新とも）
  if jsonb_typeof(n) is distinct from 'object' or jsonb_typeof(n -> 'log') is distinct from 'array' then
    raise exception 'lemma: state はオブジェクト、state.log は配列でなければなりません' using errcode = 'LM001';
  end if;
  select count(*) into cnt from jsonb_array_elements(n -> 'log') e
    where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'p') is distinct from 'string' or jsonb_typeof(e -> 't') is distinct from 'number';
  if cnt > 0 then
    raise exception 'lemma: 問題ID p（文字列）と時刻 t（数値）の無い解答の記録が % 件あります', cnt using errcode = 'LM001';
  end if;
  foreach m in array array['pstat', 'problems', 'cards', 'bookmarks', 'explains'] loop
    if n ? m and jsonb_typeof(n -> m) is distinct from 'object' then
      raise exception 'lemma: state.% はオブジェクトでなければなりません', m using errcode = 'LM001';
    end if;
  end loop;
  new_schema := lemma_private.lemma_num(n -> 'schema');
  if new_schema is null or new_schema <> floor(new_schema) or new_schema < 1 or new_schema > 100 then
    raise exception 'lemma: state.schema は 1〜100 の整数でなければなりません（%）', coalesce(n ->> 'schema', '無し') using errcode = 'LM003';
  end if;
  if n ? 'resetAt' and lemma_private.lemma_num(n -> 'resetAt') is null then
    raise exception 'lemma: resetAt は数値でなければなりません' using errcode = 'LM006';
  end if;
  new_reset := coalesce(lemma_private.lemma_num(n -> 'resetAt'), 0);

  if tg_op = 'INSERT' then
    if new.rev is distinct from 1 then
      raise exception 'lemma: 作成時の rev は 1 でなければなりません（%）', new.rev using errcode = 'LM002';
    end if;
    if new_reset > extract(epoch from now()) * 1000 + 86400000 then
      raise exception 'lemma: resetAt が未来です' using errcode = 'LM006';
    end if;
    select count(*) - count(distinct (e ->> 'p', lemma_private.lemma_num(e -> 't'))) into cnt from jsonb_array_elements(n -> 'log') e;
    if cnt > 0 then
      raise exception 'lemma: 同じ問題・同じ時刻の解答の記録が % 件重複しています', cnt using errcode = 'LM008';
    end if;
    return new;
  end if;

  ---------------------------------------------------------------- 更新
  o := old.state;
  if new.rev is distinct from old.rev + 1 then
    raise exception 'lemma: rev は % のはずです（送られたのは %）', old.rev + 1, new.rev using errcode = 'LM002';
  end if;
  old_schema := coalesce(lemma_private.lemma_num(o -> 'schema'), 1);
  if new_schema < old_schema then
    raise exception 'lemma: 記録の版を % から % に下げる書き込みです', old_schema, new_schema using errcode = 'LM003';
  end if;
  old_reset := coalesce(lemma_private.lemma_num(o -> 'resetAt'), 0);
  if new_reset < old_reset then
    raise exception 'lemma: 消した印 resetAt を戻す書き込みです' using errcode = 'LM006';
  end if;
  if new_reset > old_reset then
    if new_reset > extract(epoch from now()) * 1000 + 86400000 then
      raise exception 'lemma: resetAt が未来です（端末の時計を確かめてください）' using errcode = 'LM006';
    end if;
    cutoff := new_reset;        -- 明示的な消去・置き換え：この時刻より前の記録は消えてよい
  else
    cutoff := '-infinity';      -- 通常の同期：何も消えてはいけない
  end if;

  -- 解答の記録：前の記録（形の正しいもの）が残っているか・項目が消えていないか・重複を増やしていないか
  with a as (
    select e ->> 'p' as p, lemma_private.lemma_num(e -> 't') as t, e from jsonb_array_elements(
      case when jsonb_typeof(o -> 'log') = 'array' then o -> 'log' else '[]'::jsonb end) e
    where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'p') = 'string' and jsonb_typeof(e -> 't') = 'number'
  ), b as (
    select distinct on (e ->> 'p', lemma_private.lemma_num(e -> 't')) e ->> 'p' as p, lemma_private.lemma_num(e -> 't') as t, e
    from jsonb_array_elements(n -> 'log') e
  )
  select count(*), min(a.p || '@' || a.t) into cnt, ex from a left join b on b.p = a.p and b.t = a.t
    where a.t >= cutoff and b.p is null;
  if cnt > 0 then
    raise exception 'lemma: 前にあった解答の記録 % 件が無くなる書き込みです（例 %）', cnt, ex using errcode = 'LM004';
  end if;
  with a as (
    select e ->> 'p' as p, lemma_private.lemma_num(e -> 't') as t, e from jsonb_array_elements(
      case when jsonb_typeof(o -> 'log') = 'array' then o -> 'log' else '[]'::jsonb end) e
    where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'p') = 'string' and jsonb_typeof(e -> 't') = 'number'
  ), b as (
    select e ->> 'p' as p, lemma_private.lemma_num(e -> 't') as t, e from jsonb_array_elements(n -> 'log') e
  )
  select count(*), min(a.p || '@' || a.t) into cnt, ex from a join b on b.p = a.p and b.t = a.t
    where exists (select 1 from jsonb_object_keys(a.e) k where not (b.e ? k));
  if cnt > 0 then
    raise exception 'lemma: 解答の記録から項目を消す書き込みです（例 %）', ex using errcode = 'LM005';
  end if;
  select (select count(*) - count(distinct (e ->> 'p', lemma_private.lemma_num(e -> 't'))) from jsonb_array_elements(n -> 'log') e)
       - (select count(*) - count(distinct (e ->> 'p', lemma_private.lemma_num(e -> 't'))) from jsonb_array_elements(
            case when jsonb_typeof(o -> 'log') = 'array' then o -> 'log' else '[]'::jsonb end) e
          where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'p') = 'string' and jsonb_typeof(e -> 't') = 'number')
    into cnt;
  if cnt > 0 then
    raise exception 'lemma: 同じ問題・同じ時刻の解答の記録を % 件増やす書き込みです', cnt using errcode = 'LM008';
  end if;

  -- 学習状態：消えていない・時刻が戻っていない（problems は回数も）
  foreach m in array array['pstat', 'problems', 'cards'] loop
    select l.lost, l.example into cnt, ex from lemma_private.lemma_map_lost(o -> m, n -> m, 'last', cutoff) l;
    if cnt > 0 then
      raise exception 'lemma: % の % 件が消える・古くなる書き込みです（例 %）', m, cnt, ex using errcode = 'LM007';
    end if;
  end loop;
  select l.lost, l.example into cnt, ex from lemma_private.lemma_map_lost(o -> 'bookmarks', n -> 'bookmarks', 't', cutoff) l;
  if cnt > 0 then
    raise exception 'lemma: bookmarks の % 件が消える・古くなる書き込みです（例 %。外すときは on:false と新しい時刻で残します）', cnt, ex using errcode = 'LM007';
  end if;
  select count(*), min(a.key) into cnt, ex
    from jsonb_each(case when jsonb_typeof(o -> 'problems') = 'object' then o -> 'problems' else '{}'::jsonb end) a
    join jsonb_each(n -> 'problems') b on b.key = a.key
    where coalesce(lemma_private.lemma_num(a.value -> 'last'), 0) >= cutoff
      and lemma_private.lemma_num(a.value -> 'n') is not null
      and coalesce(lemma_private.lemma_num(b.value -> 'n'), -1) < lemma_private.lemma_num(a.value -> 'n');
  if cnt > 0 then
    raise exception 'lemma: problems の解いた回数が減る書き込みです（例 %）', ex using errcode = 'LM007';
  end if;
  -- メモ：問題ごとに、いちばん新しいメモの時刻が戻っていない（古いメモは新しい5件に入らなければ外れてよい）
  with a as (
    select key, (select max(lemma_private.lemma_num(x -> 't')) from jsonb_array_elements(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) x) as t
    from jsonb_each(case when jsonb_typeof(o -> 'explains') = 'object' then o -> 'explains' else '{}'::jsonb end)
  ), b as (
    select key, (select max(lemma_private.lemma_num(x -> 't')) from jsonb_array_elements(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) x) as t
    from jsonb_each(case when jsonb_typeof(n -> 'explains') = 'object' then n -> 'explains' else '{}'::jsonb end)
  )
  select count(*), min(a.key) into cnt, ex from a left join b on b.key = a.key
    where a.t is not null and a.t >= cutoff and (b.key is null or coalesce(b.t, -1) < a.t);
  if cnt > 0 then
    raise exception 'lemma: explains（メモ）の % 件が消える書き込みです（例 %）', cnt, ex using errcode = 'LM007';
  end if;
  return new;
end $$;

drop trigger if exists lemma_state_guard on public.lemma_state;
create trigger lemma_state_guard before insert or update on public.lemma_state
  for each row execute function lemma_private.lemma_state_guard();

-- v0.24 の guard.sql が public に作った関数は使わなくなったので消す（トリガーは上で作り直し済み。表と記録は変えない）
drop function if exists public.lemma_state_guard();
