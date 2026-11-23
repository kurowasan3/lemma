// supabase/guard.sql（サーバー側の書き込み制限）を、実際の PostgreSQL（PGlite：WASM 版）で確かめる（v0.25・v0.26）
//   node tests/server_guard.test.mjs        （@electric-sql/pglite が必要：npm install --no-save --no-package-lock @electric-sql/pglite）
// 前半：SQL を直接送って、各規則が断る／通すことを確かめる。
// 後半：本物の js/sync.js（createSync）と js/store.js（mergeState・restoreState）を、トリガーつきの表を持つにせ Supabase につなぎ、
//       アプリの正当な操作（追加・再採点・メモ・ブックマーク解除・2台での復習・全消去・置き換え・ログアウトして消す）がすべて通り、
//       古い版のアプリの書き込みだけが断られることを確かめる。
// 含まないもの：Supabase の PostgREST（エラーの返し方）・認証・RLS・本番のデータ。それらは実際の Supabase で確かめる（docs/data-integrity.md §6.3）。
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createMockSupabase } from './mock-supabase.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
let PGlite;
try { ({ PGlite } = await import(require.resolve('@electric-sql/pglite'))); }
catch { console.log('@electric-sql/pglite が入っていません（npm install --no-save --no-package-lock @electric-sql/pglite）'); process.exit(1); }

const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const { SUPABASE_KEY } = await import('../js/config.js');
const SY = await import('../js/sync.js');
const ST = await import('../js/store.js');
const { review } = await import('../js/scheduler.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const clone = (x) => JSON.parse(JSON.stringify(x));

const db = new PGlite();
// schema.sql の表（auth.users への参照と RLS は PGlite に無いので除く。列と大きさの制約は同じ）
await db.exec(`create table public.lemma_state (user_id uuid primary key, state jsonb not null, rev integer not null default 1,
  updated_at timestamptz not null default now(), constraint state_size check (pg_column_size(state) < 5000000));`);
// Supabase にある役割（PGlite には無いので作る）
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  grant select, insert, update, delete on public.lemma_state to authenticated, service_role;`);
const guard = fs.readFileSync(path.join(root, 'supabase/guard.sql'), 'utf8');
await db.exec(guard);
await db.exec(guard);   // 何度実行してもよい

// ================================================================ 前半：SQL を直接
const U = '00000000-0000-0000-0000-0000000000a1';
const NOW = Date.now();
const T0 = NOW - 30 * 86400000;
const e = (p, t, g = 3, extra = {}) => ({ p, t, g, ok: g >= 3, sg: g >= 3 ? 'full' : 'none', c: 'mid', h: 0, min: 5, in: 1, ...extra });
const S0 = () => ({
  schema: 4,
  log: [e('q01', T0), e('q02', T0 + 1000, 1), e('q01', T0 + 2000, 4)],
  pstat: { q01: review(review(null, 3, T0), 4, T0 + 2000), q02: review(null, 1, T0 + 1000) },
  problems: { q01: { last: T0 + 2000, n: 2 }, q02: { last: T0 + 1000, n: 1 } },
  cards: { 'qe-loc': review(null, 3, T0 + 500) },
  bookmarks: { q02: { on: true, t: T0 + 1500 } },
  explains: { q01: [{ t: T0 + 2100, text: '判別式' }], q02: [1, 2, 3, 4, 5].map(i => ({ t: T0 + 3000 + i, text: `メモ${i}` })) },
  settings: { size: 6, theme: 'dark' }, practice: { size: 8 }, streak: { last: '2026-11-01', count: 3 }, drill: { size: 10, best: { diff: { ok: 8, n: 10, ms: 1000 } } },
});
const code = async (fn) => { try { await fn(); return null; } catch (err) { return err.code || String(err.message || err); } };
const put = async (state) => { await db.query('delete from public.lemma_state where user_id = $1', [U]); await db.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', [U, JSON.stringify(state)]); };
const ins = (state, rev = 1, uid = U) => code(() => db.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, $3)', [uid, JSON.stringify(state), rev]));
const upd = (state, rev = 2) => code(() => db.query('update public.lemma_state set state = $1::jsonb, rev = $2 where user_id = $3', [JSON.stringify(state), rev, U]));
const row = async () => (await db.query('select state, rev from public.lemma_state where user_id = $1', [U])).rows[0];
// 1つの更新を、前の状態から確かめる
const check = async (f, rev = 2) => { await put(S0()); const s = S0(); f(s); return upd(s, rev); };

// ---- 作成（INSERT）
await db.query('delete from public.lemma_state');
ok(await ins(S0()) === null, '作成：正しい記録');
ok(await ins(S0(), 1, '00000000-0000-0000-0000-0000000000a2') === null && await ins(S0(), 2, '00000000-0000-0000-0000-0000000000a3') === 'LM002', '作成：rev が 1 でなければ断る');
ok(await ins({ ...S0(), log: {} }, 1, '00000000-0000-0000-0000-0000000000a4') === 'LM001', '作成：log が配列でない → LM001');
ok(await ins('x', 1, '00000000-0000-0000-0000-0000000000a5') === 'LM001', '作成：state がオブジェクトでない → LM001');
ok(await ins({ ...S0(), log: [{ p: 'q01', t: '1700' }] }, 1, '00000000-0000-0000-0000-0000000000a6') === 'LM001', '作成：時刻が文字列の解答の記録 → LM001');
ok(await ins({ ...S0(), schema: '4' }, 1, '00000000-0000-0000-0000-0000000000a7') === 'LM003' && await ins({ ...S0(), schema: 4.5 }, 1, '00000000-0000-0000-0000-0000000000a8') === 'LM003'
  && await ins({ ...S0(), schema: 0 }, 1, '00000000-0000-0000-0000-0000000000a9') === 'LM003' && await ins((({ schema, ...r }) => r)(S0()), 1, '00000000-0000-0000-0000-0000000000aa') === 'LM003', '作成：schema が整数でない・範囲外・無い → LM003');
ok(await ins({ ...S0(), log: [e('q01', T0), e('q01', T0)] }, 1, '00000000-0000-0000-0000-0000000000ab') === 'LM008', '作成：同じ解答の記録の重複 → LM008');
ok(await ins({ ...S0(), resetAt: NOW + 5 * 86400000 }, 1, '00000000-0000-0000-0000-0000000000ac') === 'LM006', '作成：未来の resetAt → LM006');
ok(await ins({ ...S0(), pstat: [] }, 1, '00000000-0000-0000-0000-0000000000ad') === 'LM001', '作成：pstat が配列 → LM001');
await ins({ ...S0(), localResetAt: 123 }, 1, '00000000-0000-0000-0000-0000000000ae');
ok(!('localResetAt' in (await db.query("select state from public.lemma_state where user_id = '00000000-0000-0000-0000-0000000000ae'")).rows[0].state), '端末だけの印 localResetAt は、送られてもサーバーに保存しない');
const big = await code(() => db.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', ['00000000-0000-0000-0000-0000000000af', JSON.stringify({ ...S0(), pad: 'x'.repeat(5_200_000) })]));
ok(big === '23514', `作成：大きすぎる記録は表の制約（state_size）で断る（${big}）`);

// ---- 利用者の権限（authenticated）でもトリガーが動く（lemma_private の利用を許してある）。anon は関数の schema を使えない
await put(S0());
await db.exec('set role authenticated');
const asUser = await upd({ ...S0(), log: [...S0().log, e('q03', NOW)] });
const asUserBad = await upd({ ...S0(), log: [] }, 3);
await db.exec('reset role');
ok(asUser === null && asUserBad === 'LM004', `authenticated の権限で、正しい更新は通り、記録を消す更新は断られる（${asUser} / ${asUserBad}）`);
const anonUse = (await db.query("select has_schema_privilege('anon', 'lemma_private', 'USAGE') as a, has_schema_privilege('authenticated', 'lemma_private', 'USAGE') as b")).rows[0];
ok(!anonUse.a && anonUse.b, 'lemma_private は anon からは使えず、authenticated からは使える');
const fx = (await db.query(`select bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as auth, bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) as anon,
  bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')) as svc, bool_and('search_path=""' = any(p.proconfig)) as sp, bool_or(p.prosecdef) as definer
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'lemma_private'`)).rows[0];
ok(fx.auth && !fx.anon && fx.svc && fx.sp && !fx.definer, `lemma_private の関数：authenticated・service_role は実行でき、anon はできない・search_path は空・SECURITY DEFINER は使わない（${JSON.stringify(fx)}）`);
await put(S0());
await db.exec('set role service_role');
const asSvc = await upd({ ...S0(), log: [] });
await db.exec('reset role');
ok(asSvc === 'LM004', 'service_role（管理用の鍵）で書いてもトリガーは動く');
const oldFn = (await db.query("select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'lemma_%'")).rows[0].n;
ok(oldFn === 0, 'public（API から呼べる場所）に lemma_ の関数を残さない');

// ---- 版番号・記録の版（UPDATE）
await put(S0());
ok(await upd(S0(), 1) === 'LM002', 'rev が同じ（重複した書き込み）→ LM002');
ok(await upd(S0(), 3) === 'LM002', 'rev を飛ばす → LM002');
ok(await upd(S0(), 0) === 'LM002', 'rev を戻す → LM002');
ok(await check(s => { s.schema = 3; }) === 'LM003', 'schema を下げる → LM003');
ok(await check(s => { s.schema = 'x'; }) === 'LM003', 'schema が不正 → LM003');
ok(await check(s => { s.schema = 5; }) === null, 'schema を上げる（新しい版のアプリの移行）→ 通す');

// ---- 解答の記録
ok(await check(s => { s.log.push(e('q03', NOW)); }) === null, '解答の記録の追加 → 通す');
ok(await check(s => { s.log.push(clone(s.log[0])); }) === 'LM008', '同じ解答の記録の重複追加 → LM008');
ok(await check(s => { s.log = s.log.map((l, i) => e('q09', NOW + i)); }) === 'LM004', '同じ件数のまま全部を別の記録に置き換え → LM004');
ok(await check(s => { s.log.splice(1, 1); }) === 'LM004', '一部の記録の削除 → LM004');
ok(await check(s => { s.log[0].t += 1; }) === 'LM004', '記録の時刻を書き換える（＝別の記録になる）→ LM004');
ok(await check(s => { s.log[0].p = 'q99'; }) === 'LM004', '記録の問題IDを書き換える → LM004');
ok(await check(s => { delete s.log[0].sg; }) === 'LM005', '記録から項目を消す → LM005');
ok(await check(s => { Object.assign(s.log[1], { g: 2, sg: 'part', ok: false }); s.pstat.q02 = review(null, 2, s.log[1].t); }) === null, '再採点（g・sg・ok の更新と、前の状態からの復習状態の計算し直し）→ 通す');
ok(await check(s => { s.log[0].r = 3; s.log[0].note = 'あとで'; s.log[0].disp = ['x']; }) === null, '想起 r・メモ・異議の追記 → 通す');
ok(await check(s => { s.log.reverse(); }) === null, '並び順だけ違う → 通す');
// 明示的な全消去・置き換え（resetAt を進める）
ok(await check(s => { Object.assign(s, { log: [], pstat: {}, problems: {}, cards: {}, bookmarks: {}, explains: {}, resetAt: NOW }); }) === null, '明示的な全消去（resetAt を今に進める）→ 通す');
ok(await check(s => { Object.assign(s, { log: [e('q50', T0 - 9e8)], pstat: { q50: { S: 1, D: 5, last: T0 - 9e8, reps: 1, lapses: 0 } }, problems: {}, cards: {}, bookmarks: {}, explains: {}, resetAt: NOW }); }) === null, 'バックアップによる置き換え（古いファイルの記録＋resetAt）→ 通す');
ok(await check(s => { s.resetAt = T0 + 1500; s.log = s.log.filter(l => l.t >= T0 + 1500); s.pstat = { q01: s.pstat.q01 }; s.problems = { q01: s.problems.q01 }; s.cards = {}; }) === null, 'resetAt より前のものだけ消える → 通す（bookmarks・メモは resetAt 以後なので残す）');
ok(await check(s => { s.resetAt = T0 + 1500; s.log = []; }) === 'LM004', 'resetAt を進めても、その時刻以後の記録を消す → LM004（resetAt を口実にした削除）');
ok(await check(s => { s.resetAt = T0 + 1500; s.log = s.log.filter(l => l.t >= T0 + 1500); s.pstat = {}; }) === 'LM007', 'resetAt 以後の復習状態を消す → LM007');

// ---- そのほかの学習データ
ok(await check(s => { delete s.pstat.q01; }) === 'LM007', '復習状態（pstat）の消失 → LM007');
ok(await check(s => { s.pstat.q01.last -= 1; }) === 'LM007', '復習状態が古くなる（last が戻る）→ LM007');
ok(await check(s => { s.pstat.q01 = review(s.pstat.q01, 3, NOW); s.log.push(e('q01', NOW)); }) === null, '復習状態の正当な更新 → 通す');
ok(await check(s => { delete s.problems.q02; }) === 'LM007' && await check(s => { s.problems.q01.n = 1; }) === 'LM007', '解いた問題（problems）の消失・回数の減少 → LM007');
ok(await check(s => { delete s.cards['qe-loc']; }) === 'LM007', '解法カード（cards）の消失 → LM007');
ok(await check(s => { s.bookmarks.q02 = { on: false, t: NOW }; }) === null, 'ブックマークの正当な解除（on:false と新しい時刻）→ 通す');
ok(await check(s => { s.bookmarks.q01 = { on: true, t: NOW }; }) === null, 'ブックマークの追加 → 通す');
ok(await check(s => { delete s.bookmarks.q02; }) === 'LM007', 'ブックマークの項目ごとの削除（解除の印が消える＝ほかの端末でよみがえる）→ LM007');
ok(await check(s => { s.explains.q01 = [...s.explains.q01, ...[1, 2, 3, 4, 5].map(i => ({ t: NOW + i, text: `m${i}` }))].slice(-5); }) === null, 'メモの追加（新しい5件だけ残り、古いメモが外れる）→ 通す');
ok(await check(s => { delete s.explains.q01; }) === 'LM007', 'メモの消失 → LM007');
ok(await check(s => { s.settings = { size: 10, theme: 'light' }; s.practice = { size: 4 }; s.graphExprs = [{ src: 'y=x' }]; s.settingsAt = NOW; }) === null, '設定・グラフの式の変更 → 通す');
ok(await check(s => { s.streak = { last: '2026-11-20', count: 1 }; s.drill = { size: 20, best: {} }; }) === null, '連続日数が戻る・自己ベストの入れ替え → 通す（守る対象ではない）');
ok(await check(s => { s.pstat = []; }) === 'LM001', '不正なデータ型（pstat が配列）→ LM001');

// ---- v0.26：同じ時刻のままの書き換え（LM009）と、正当な計算し直し
const P2 = () => S0().pstat.q01;   // 2回復習（g=3, g=4）、last = T0+2000
ok(await check(s => { s.pstat.q01 = { ...P2(), reps: 1 }; }) === 'LM009', 'pstat：last を保ったまま reps を減らす → LM009');
ok(await check(s => { s.pstat.q02 = { ...s.pstat.q02, lapses: 0, S: 99 }; }) === null, 'pstat：last・reps を保ったまま lapses を1減らし S を変える（再採点で「解けた」に直した）→ 通す');
ok(await check(s => { s.pstat.q01 = { ...P2(), lapses: 2 }; }) === 'LM009', 'pstat：last・reps を保ったまま lapses を2増やす → LM009（再採点で変わるのは1まで）');
ok(await check(s => { s.pstat.q01 = { ...P2(), S: -1 }; }) === 'LM009' && await check(s => { s.pstat.q01 = { ...P2(), D: 50 }; }) === 'LM009', 'pstat：S・D を範囲外に書き換える → LM009');
ok(await check(s => { const { S, ...rest } = P2(); s.pstat.q01 = rest; }) === 'LM009', 'pstat：同じ時刻のまま項目（S）を消す → LM009');
ok(await check(s => { s.pstat.q01 = { ...P2(), lapses: 5 }; }) === 'LM009', 'pstat：lapses が reps より多い → LM009');
ok(await check(s => { s.pstat.q01 = review(review(review(null, 3, T0), 1, T0 + 1000), 4, T0 + 2000); }) === null, 'pstat：同じ last・reps で、途中の評価が違う計算し直し（S・D・lapses が変わる）→ 通す');
ok(await check(s => { s.pstat.q01 = review(null, 2, NOW); s.log.push(e('q01', NOW, 2)); }) === null, 'pstat：last が進めば reps が減っても通す（古い版のアプリの合わせ方。値は正しい範囲）');
ok(await check(s => { s.pstat.q01 = { ...review(P2(), 3, NOW), D: 0 }; }) === 'LM009', 'pstat：last が進んでも、値が範囲外なら LM009');
ok(await check(s => { s.cards['qe-loc'] = { ...s.cards['qe-loc'], S: 50 }; }) === 'LM009', 'cards：同じ last・reps のまま S を書き換える → LM009（cards は再採点しない）');
ok(await check(s => { s.cards['qe-loc'] = { ...s.cards['qe-loc'], reps: 0 }; }) === 'LM009', 'cards：同じ last のまま reps を減らす → LM009');
ok(await check(s => { s.cards['qe-loc'] = review(s.cards['qe-loc'], 2, NOW); }) === null, 'cards：復習（last が進み reps+1）→ 通す');
ok(await check(s => { s.cards.new1 = review(null, 3, NOW); }) === null, 'cards：新しいカード → 通す');
ok(await check(s => { s.bookmarks.q02 = { on: false, t: s.bookmarks.q02.t }; }) === 'LM009', 'bookmarks：t を保ったまま on を変える → LM009');
ok(await check(s => { s.bookmarks.q02 = { ...s.bookmarks.q02, x: 1 }; }) === 'LM009', 'bookmarks：t を保ったまま項目を書き換える → LM009');
ok(await check(s => { s.bookmarks.q02 = { on: false, t: NOW }; }) === null && await check(s => { s.bookmarks.q02 = { on: true, t: s.bookmarks.q02.t - 1 }; }) === 'LM007', 'bookmarks：正当な解除（新しい t）は通り、t を戻すと LM007');
ok(await check(s => { s.explains.q01 = [{ t: T0 + 2100, text: '書き換えた' }]; }) === 'LM009', 'explains：最新のメモを同じ時刻のまま本文を書き換える → LM009');
ok(await check(s => { s.explains.q02 = s.explains.q02.filter(m => m.text !== 'メモ3'); }) === 'LM007', 'explains：途中のメモだけを消す（古いメモは残す）→ LM007');
ok(await check(s => { s.explains.q02 = [...s.explains.q02, { t: NOW, text: '新しい' }].slice(-5); }) === null, 'explains：新しいメモで、いちばん古いメモが5件から押し出される → 通す');
ok(await check(s => { s.explains.q02 = [...s.explains.q02.slice(1), { t: T0 + 3001, text: '別の本文' }].sort((x, y) => x.t - y.t).slice(-5); }) === 'LM009', 'explains：押し出しに見せかけて、同じ時刻の別の本文に入れ替える → LM009');
ok(await check(s => { s.explains.q01 = [...s.explains.q01, { t: NOW, text: '追加' }]; s.explains.q03 = [{ t: NOW, text: '初めて' }]; }) === null, 'explains：メモの追加 → 通す');
ok(await check(s => { Object.assign(s, { resetAt: NOW, log: [e('q50', T0 - 9e8)], pstat: { q01: { ...P2(), reps: 1 } }, cards: {}, bookmarks: { q02: { on: false, t: s.bookmarks.q02.t } }, explains: { q01: [{ t: T0 + 2100, text: 'ファイルの本文' }] }, problems: {} }); }) === null,
  'resetAt を進めた置き換えでは、その時刻より前のもの（同じ時刻の値が違っても）を置き換えてよい');

// ---- resetAt
ok(await check(s => { s.resetAt = 1; }) === null, 'resetAt を（古い時刻へ）初めて付ける → 通す（消せるものは無い）');
await put({ ...S0(), resetAt: T0 });
ok(await upd({ ...S0(), resetAt: T0 - 1 }, 2) === 'LM006', 'resetAt を戻す → LM006（古い端末が印を消せない）');
await put(S0());
ok(await upd((({ resetAt, ...r }) => r)({ ...S0() }), 2) === null, '通常の同期（resetAt を変えない）→ 通す');
ok(await check(s => { Object.assign(s, { log: [], pstat: {}, problems: {}, cards: {}, bookmarks: {}, explains: {}, resetAt: NOW + 3 * 86400000 }); }) === 'LM006', '端末の時計が3日進んでいて resetAt が未来 → LM006（未来の印で今後の記録まで消さない）');
ok(await check(s => { Object.assign(s, { log: [], pstat: {}, problems: {}, cards: {}, bookmarks: {}, explains: {}, resetAt: NOW + 3600000 }); }) === null, '時計が1時間進んでいる程度の全消去 → 通す（1日まで許す）');
ok(await check(s => { s.resetAt = 'きのう'; }) === 'LM006', 'resetAt が数値でない → LM006');

// ---- 大きい記録（2万件）の更新の速さ
{
  const many = Array.from({ length: 20000 }, (_, i) => e(`p${i % 3000}`, T0 + i * 1000, 1 + (i % 4)));
  await put({ ...S0(), log: many });
  const t0 = Date.now();
  const r = await upd({ ...S0(), log: [...many, e('q01', NOW)] });
  const ms = Date.now() - t0;
  ok(r === null && ms < 10000, `2万件の解答の記録の更新を確かめられる（${ms}ms、PGlite）`);
  ok(await upd({ ...S0(), log: many.slice(-5000) }, 3) === 'LM004', '古いアプリ（v0.22）の5000件への切り捨て → LM004');
}
// ---- guard を入れる前からの記録（重複や形の崩れた記録を含む）でも、新しいアプリの同期は通る
await db.query('alter table public.lemma_state disable trigger lemma_state_guard');
await db.query('delete from public.lemma_state where user_id = $1', [U]);
await db.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 7)', [U, JSON.stringify({ ...S0(), log: [...S0().log, S0().log[0], { p: 'q01' }, 'x'] })]);
await db.query('alter table public.lemma_state enable trigger lemma_state_guard');
const legacy = (await row()).state;
const tidy = ST.mergeState(S0(), { ...legacy, log: legacy.log.filter(l => l && typeof l === 'object' && typeof l.p === 'string' && typeof l.t === 'number') });
ok(tidy.log.length === S0().log.length && await upd(tidy, 8) === null, '前からある重複・壊れた記録は、整えて書き戻せる（重複が減る・壊れた記録は対象外）');

// ---- v0.24 の guard.sql を入れた Supabase に v0.25 を上書きで入れる（既存の記録は変えない）
{
  const up = new PGlite();
  await up.exec(`create role anon nologin; create role authenticated nologin;
    create table public.lemma_state (user_id uuid primary key, state jsonb not null, rev integer not null default 1,
    updated_at timestamptz not null default now(), constraint state_size check (pg_column_size(state) < 5000000));`);
  await up.exec(`create role service_role nologin;`);
  await up.exec(fs.readFileSync(path.join(root, 'tests/fixtures/guard-v0.24.sql'), 'utf8'));
  await up.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', [U, JSON.stringify(S0())]);
  const before = (await up.query('select state::text as s, rev from public.lemma_state')).rows[0];
  await up.exec(fs.readFileSync(path.join(root, 'tests/fixtures/guard-v0.25.sql'), 'utf8'));
  const mid = (await up.query('select state::text as s, rev from public.lemma_state')).rows[0];
  await up.exec(guard);
  const after = (await up.query('select state::text as s, rev from public.lemma_state')).rows[0];
  ok(before.s === mid.s && mid.s === after.s && before.rev === after.rev, 'v0.24 → v0.25 → v0.26 の上書き適用で、既存の記録は変わらない');
  ok((await up.query('select lemma_private.guard_version() as v')).rows[0].v === '0.26.0', '適用済みの版を guard_version() で確かめられる');
  ok(await code(() => up.query('update public.lemma_state set state = $1::jsonb, rev = 2 where user_id = $2', [JSON.stringify({ ...S0(), bookmarks: { q02: { on: false, t: S0().bookmarks.q02.t } } }), U])) === 'LM009', '上書き後は、v0.26 の規則（同じ時刻のままの書き換え）も効く');
  const trg = (await up.query("select p.proname, s.nspname from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace s on s.oid = p.pronamespace where t.tgname = 'lemma_state_guard'")).rows;
  const old = (await up.query("select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'lemma_state_guard'")).rows[0].n;
  ok(trg.length === 1 && trg[0].nspname === 'lemma_private' && old === 0, 'トリガーは1つで v0.25 の関数を使い、v0.24 の関数は消える');
  const sameCount = await code(() => up.query('update public.lemma_state set state = $1::jsonb, rev = 2 where user_id = $2', [JSON.stringify({ ...S0(), log: S0().log.map((l, i) => ({ ...l, t: l.t + 1 })) }), U]));
  ok(sameCount === 'LM004', '上書き後は、v0.24 では通っていた「同じ件数での置き換え」も断る');
  // v0.25 だけを入れた状態から v0.26 へ
  const up2 = new PGlite();
  await up2.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create table public.lemma_state (user_id uuid primary key, state jsonb not null, rev integer not null default 1,
    updated_at timestamptz not null default now(), constraint state_size check (pg_column_size(state) < 5000000));`);
  await up2.exec(fs.readFileSync(path.join(root, 'tests/fixtures/guard-v0.25.sql'), 'utf8'));
  await up2.query('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', [U, JSON.stringify(S0())]);
  const b2 = (await up2.query('select state::text as s from public.lemma_state')).rows[0].s;
  await up2.exec(guard);
  ok((await up2.query('select state::text as s from public.lemma_state')).rows[0].s === b2, 'v0.25 → v0.26 の上書き適用で、既存の記録は変わらない');
  const fns = (await up2.query("select count(*)::int as n from pg_trigger where tgname = 'lemma_state_guard'")).rows[0].n;
  ok(fns === 1, 'トリガーは1つだけ');
  await up2.close();
  await up.close();
}

// ================================================================ 後半：本物の同期処理を、トリガーつきの表で
{
  const mock = createMockSupabase({ key: SUPABASE_KEY });
  mock.hooks.db = db;
  globalThis.fetch = mock.fetch;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const device = (initial) => {
    let st = clone(initial);
    const sync = SY.createSync({ getState: () => st, applyState: (m) => { st = ST.mergeState(st, m); }, retryDelay: 5 });
    return { sync, get: () => st, set: (x) => { st = x; }, edit: (f) => { f(st); } };
  };
  const login = async (d, email) => { await d.sync.sendCode(email); await d.sync.verify(email, '123456'); };
  const srv = async (uid) => (await db.query('select state, rev from public.lemma_state where user_id = $1', [uid])).rows[0];
  const now = Date.now();
  const L = (p, t, g = 3) => ({ p, t, g, ok: g >= 3, sg: g >= 3 ? 'full' : 'none' });

  mem.clear();
  const A = device({ ...ST.freshState(), log: [L('q01', now - 9000)], pstat: { q01: review(null, 3, now - 9000) }, problems: { q01: { last: now - 9000, n: 1 } } });
  await login(A, 'g@example.com');
  const uid = [...mock.users.values()].find(u => u.email === 'g@example.com').id;
  ok(A.sync.status().status === 'ok' && (await srv(uid)).rev === 1, '同期：初回（作成）が通る');
  const authA = mem.get('lemma.auth');

  // 2台目：別の記録を持ってログイン → 和集合
  mem.clear();
  const B = device({ ...ST.freshState(), log: [L('q02', now - 8000, 1)], pstat: { q02: review(null, 1, now - 8000) }, problems: { q02: { last: now - 8000, n: 1 } } });
  await login(B, 'g@example.com');
  const authB = mem.get('lemma.auth');
  ok(B.sync.status().status === 'ok' && (await srv(uid)).state.log.length === 2, '同期：複数端末の追加は和集合で通る');
  const use = (d, auth) => { mem.set('lemma.auth', auth); return d; };

  // 再採点・想起・メモ・ブックマーク・解除
  use(B, authB).edit(s => { const l = s.log.find(x => x.p === 'q02'); Object.assign(l, { g: 2, sg: 'part', r: 1, note: '符号' }); s.pstat.q02 = review(null, 2, l.t);
    s.bookmarks.q02 = { on: true, t: now - 7000 }; s.explains.q02 = [{ t: now - 6900, text: '場合分け' }]; });
  await B.sync.syncNow();
  ok(B.sync.status().status === 'ok', `同期：再採点・想起・メモ・ブックマークが通る（${B.sync.status().error || ''}）`);
  use(A, authA); await A.sync.syncNow();
  A.edit(s => { s.bookmarks.q02 = { on: false, t: now - 5000 }; for (let i = 0; i < 6; i++) s.explains.q02 = [...(s.explains.q02 || []), { t: now - 4000 + i, text: `m${i}` }].slice(-5); });
  await A.sync.syncNow();
  ok(A.sync.status().status === 'ok' && (await srv(uid)).state.bookmarks.q02.on === false && (await srv(uid)).state.explains.q02.length === 5, `同期：ブックマークの解除・メモが5件を超える追加が通る（${A.sync.status().error || ''}）`);

  // 2台で同じ問題を別々に復習（復習状態は解答の記録から計算し直す）
  const base1 = review(null, 3, now - 9000);
  use(A, authA).edit(s => { s.log.push(L('q01', now - 3000, 1)); s.pstat.q01 = review(base1, 1, now - 3000); s.problems.q01 = { last: now - 3000, n: 2 }; });
  await A.sync.syncNow();
  use(B, authB).edit(s => { s.log.push(L('q01', now - 2000, 4)); s.pstat.q01 = review(base1, 4, now - 2000); s.problems.q01 = { last: now - 2000, n: 2 }; });
  await B.sync.syncNow();
  const sv = (await srv(uid)).state;
  ok(B.sync.status().status === 'ok' && sv.pstat.q01.reps === 3 && sv.pstat.q01.lapses === 1, `同期：2台での別々の復習が両方入り、サーバーに通る（reps ${sv.pstat.q01.reps}）`);

  // 同時更新：書き戻しの直前に別の端末が書いた → 取り直して合わせ直す（rev はトリガーの規則どおり）
  use(A, authA).edit(s => { s.log.push(L('q03', now - 1000)); });
  let once = true;
  mock.hooks.beforePatch = async (id) => {
    if (!once) return; once = false;
    const r = await srv(id);
    await db.query('update public.lemma_state set state = $1::jsonb, rev = $2 where user_id = $3', [JSON.stringify({ ...r.state, log: [...r.state.log, L('q04', now - 900)] }), r.rev + 1, id]);
  };
  await A.sync.syncNow();
  mock.hooks.beforePatch = null;
  const logs = (await srv(uid)).state.log.map(l => l.p);
  ok(A.sync.status().status === 'ok' && logs.includes('q03') && logs.includes('q04'), '同期：同時更新でも、取り直してどちらの記録も残る');

  // 通常の同期では resetAt は変わらない
  ok(!('resetAt' in (await srv(uid)).state), '同期：通常の同期で resetAt は付かない・変わらない');

  // ネットワーク障害 → 自動でやり直して通る
  use(B, authB).edit(s => { s.log.push(L('q05', now - 800)); });
  globalThis.fetch = async (url, init) => { if (init && init.method === 'PATCH') throw new TypeError('Failed to fetch'); return mock.fetch(url, init); };
  await B.sync.syncNow();
  ok(B.sync.status().kind === 'offline', '同期：ネットワーク障害は offline と分類');
  globalThis.fetch = mock.fetch;
  await wait(40);
  ok(B.sync.status().status === 'ok' && (await srv(uid)).state.log.some(l => l.p === 'q05'), '同期：復旧後に自動でやり直して通る');

  // 古い版のアプリ（v0.22）：5000件を超えると切り捨てて書き戻す → サーバーが断る。新しいアプリは自動の同期を止め、手動で再開できる
  use(A, authA).edit(s => { for (let i = 0; i < 5100; i++) s.log.push(L(`z${i % 900}`, now - 600000 + i)); });
  await A.sync.syncNow();
  ok(A.sync.status().status === 'ok' && (await srv(uid)).state.log.length > 5100, '同期：5000件を超える記録も通る');
  const r0 = await srv(uid);
  const v022 = { ...r0.state, log: r0.state.log.slice(-5000) };
  const rej = await code(() => db.query('update public.lemma_state set state = $1::jsonb, rev = $2 where user_id = $3', [JSON.stringify(v022), r0.rev + 1, uid]));
  ok(rej === 'LM004' && (await srv(uid)).state.log.length === r0.state.log.length, '古い版のアプリの切り捨ては LM004 で断られ、サーバーの記録は減らない');

  // サーバーに断られたとき（壊れた手元の記録を作って再現：項目の消えた記録）：自動ではやり直さず、手動の同期でだけ再開
  let patches = 0;
  globalThis.fetch = async (url, init) => { if (init && init.method === 'PATCH') patches++; return mock.fetch(url, init); };
  const bad = device(clone((await srv(uid)).state));
  mem.set('lemma.auth', authB);
  bad.edit(s => { delete s.log[0].sg; s.log.push(L('q06', now - 500)); });   // 手元で項目が消えた記録（不具合を再現）→ 合わせても補われないよう、相手の値も消す
  const r1 = await srv(uid);
  await db.query('alter table public.lemma_state disable trigger lemma_state_guard');
  const stripped = clone(r1.state); delete stripped.log[0].sg;
  await db.query('update public.lemma_state set state = $1::jsonb where user_id = $2', [JSON.stringify(r1.state), uid]);
  await db.query('alter table public.lemma_state enable trigger lemma_state_guard');
  // サーバーの記録の方に sg があり、手元に無い → 合わせると補われるので通る（mergeState は項目を足すだけ）
  await bad.sync.syncNow();
  ok(bad.sync.status().status === 'ok', '手元で項目が欠けた記録も、合わせるとサーバーの項目で補われるので通る');
  // 本当に断られる書き込み：手元の resetAt が未来（時計が大きく進んだ端末で全消去）
  bad.edit(s => { Object.assign(s, { log: [], pstat: {}, problems: {}, cards: {}, bookmarks: {}, explains: {}, resetAt: now + 5 * 86400000 }); });
  patches = 0;
  await bad.sync.syncNow();
  const s1 = bad.sync.status();
  ok(s1.status === 'error' && s1.code === 'LM006' && s1.kind === 'rejected' && s1.halted && /日時/.test(s1.error), `サーバーに断られたら、code・分類・利用者がすべきことを示す（${s1.code} ${s1.kind}）`);
  bad.sync.schedule(1); await bad.sync.syncNow({ auto: true }); await wait(40);
  ok(patches === 1, `断られた後は、自動の同期（解答後・やり直し）で同じ書き込みを繰り返さない（PATCH ${patches}回）`);
  ok((await srv(uid)).state.log.length > 5100, '断られた書き込みでサーバーの記録は消えない');
  bad.edit(s => { s.resetAt = now; });   // 時計を直して全消去し直す
  await bad.sync.syncNow();
  ok(bad.sync.status().status === 'ok' && !bad.sync.status().halted && (await srv(uid)).state.log.length === 0, '原因を直して手動で同期すると再開し、明示的な全消去が通る');
  globalThis.fetch = mock.fetch;

  // 全消去の後、古い端末（消したことを知らない）が同期しても、消した記録はよみがえらない
  const oldDev = device({ ...ST.freshState(), log: [L('q01', now - 9000), L('q07', now - 100)], pstat: { q01: review(null, 3, now - 9000) } });
  mem.set('lemma.auth', authA);
  await oldDev.sync.syncNow();
  const after = (await srv(uid)).state;
  ok(oldDev.sync.status().status === 'ok' && after.log.length === 0 && !after.pstat.q01 && oldDev.get().log.length === 0, `古い端末からの復活を防ぐ（サーバー ${after.log.length}件・古い端末 ${oldDev.get().log.length}件）`);
  // 消した後に解いた記録は残る
  oldDev.edit(s => { s.log.push(L('q08', Date.now())); });
  await oldDev.sync.syncNow();
  ok((await srv(uid)).state.log.some(l => l.p === 'q08'), '全消去の後に解いた記録は同期で残る');

  // バックアップで置き換え（restoreState replace）→ 同期で通り、サーバーの古い記録は持ち込まない
  const file = { ...ST.freshState(), log: [L('q30', now - 99 * 86400000)], pstat: { q30: review(null, 3, now - 99 * 86400000) } };
  oldDev.set(ST.restoreState(oldDev.get(), file, 'replace', Date.now()));
  await oldDev.sync.syncNow();
  const rs = (await srv(uid)).state;
  ok(oldDev.sync.status().status === 'ok' && rs.log.map(l => l.p).join() === 'q30' && rs.pstat.q30, `バックアップによる置き換えが同期で通る（${oldDev.sync.status().error || ''}）`);
  // 合わせる読み込みも通る
  oldDev.set(ST.restoreState(oldDev.get(), { ...ST.freshState(), log: [L('q31', now - 50 * 86400000)] }, 'merge', Date.now()));
  await oldDev.sync.syncNow();
  ok(oldDev.sync.status().status === 'ok' && (await srv(uid)).state.log.length === 2, 'バックアップと合わせる読み込みも同期で通る');

  // ログアウトして端末の記録を消す（localResetAt）→ 送らない。もう一度ログインして合わせても、サーバーの記録は消えない
  const before = (await srv(uid)).state.log.length;
  oldDev.set({ ...ST.freshState(), localResetAt: Date.now() });
  await oldDev.sync.syncNow();
  ok(!('localResetAt' in (await srv(uid)).state) && (await srv(uid)).state.log.length === before && oldDev.get().log.length === before, 'ログアウトして消した端末が同期しても、サーバーの記録は消えず、localResetAt も送られない');

  // v0.26：複数端末でのブックマークの付与・解除、再採点、同期していない端末の初回の復習（トリガーつき）
  {
    mem.clear();
    const t1 = Date.now();
    const X = device({ ...ST.freshState(), log: [], pstat: {} });
    await login(X, 'v26@example.com');
    const uidX = [...mock.users.values()].find(u => u.email === 'v26@example.com').id;
    const authX = mem.get('lemma.auth');
    mem.clear();
    const Y = device(ST.freshState());
    await login(Y, 'v26@example.com');
    const authY = mem.get('lemma.auth');
    mem.set('lemma.auth', authX); X.edit(s => { s.bookmarks.q01 = { on: true, t: t1 }; }); await X.sync.syncNow();
    mem.set('lemma.auth', authY); await Y.sync.syncNow(); Y.edit(s => { s.bookmarks.q01 = { on: false, t: t1 + 10 }; }); await Y.sync.syncNow();
    mem.set('lemma.auth', authX); await X.sync.syncNow();
    ok(X.sync.status().status === 'ok' && Y.sync.status().status === 'ok' && X.get().bookmarks.q01.on === false && (await srv(uidX)).state.bookmarks.q01.on === false, '複数端末でのブックマークの付与・解除が、トリガーつきの表で通る');
    // 端末Xで5回復習して同期 → 端末Y（同期していない）が初めて解く → 合わせても5回分が残り、サーバーにも通る
    let st5 = null;
    X.edit(s => { for (let i = 0; i < 5; i++) { const t = t1 - 100000 + i; st5 = review(st5, 3, t); s.log.push(L('q02', t)); } s.pstat.q02 = st5; s.problems.q02 = { last: t1 - 100000 + 4, n: 5 }; });
    await X.sync.syncNow();
    Y.edit(s => { s.log.push(L('q02', t1 + 20, 1)); s.pstat.q02 = review(null, 1, t1 + 20); s.problems.q02 = { last: t1 + 20, n: 1 }; });
    mem.set('lemma.auth', authY); await Y.sync.syncNow();
    const sp = (await srv(uidX)).state.pstat.q02;
    ok(Y.sync.status().status === 'ok' && sp.reps === 6 && sp.lapses === 1, `同期していない端末が初めて解いても、サーバーの復習回数は消えない（reps ${sp.reps}）`);
    // 再採点：同じ last・reps のまま lapses と S が変わる → 通る
    Y.edit(s => { const l = s.log.find(x => x.t === t1 + 20); Object.assign(l, { g: 3, sg: 'full', ok: true }); s.pstat.q02 = review(st5, 3, t1 + 20); });
    await Y.sync.syncNow();
    ok(Y.sync.status().status === 'ok' && (await srv(uidX)).state.pstat.q02.lapses === 0, `再採点（同じ時刻で lapses が1減る）が同期で通る（${Y.sync.status().error || ''}）`);
  }

  // docs §6.3 の「PostgREST 経由の確認」と同じ要求（記録はそのまま、rev を2つ飛ばす）：guard があれば LM002 で断られ、記録も rev も変わらない
  {
    const auth = JSON.parse(mem.get('lemma.auth'));
    const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' };
    const U0 = 'https://example.supabase.co';
    const [row0] = await (await mock.fetch(`${U0}/rest/v1/lemma_state?select=state,rev&user_id=eq.${auth.user.id}`, { headers: h })).json();
    const r = await mock.fetch(`${U0}/rest/v1/lemma_state?user_id=eq.${auth.user.id}&rev=eq.${row0.rev}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ state: row0.state, rev: row0.rev + 2 }) });
    const body = JSON.parse(await r.text());
    const row1 = (await db.query('select rev, state from public.lemma_state where user_id = $1', [auth.user.id])).rows[0];
    ok(r.status === 400 && body.code === 'LM002' && row1.rev === row0.rev, `確認用の要求（rev を2つ飛ばす）は LM002 で断られ、行は変わらない（${r.status} ${body.code}）`);
  }

  // ログアウトとの競合：通信中にログアウト
  mock.hooks.beforePatch = async () => { await oldDev.sync.logout(); };
  oldDev.edit(s => { s.log.push(L('q32', Date.now())); });
  await oldDev.sync.syncNow();
  mock.hooks.beforePatch = null;
  ok(!oldDev.sync.loggedIn() && oldDev.sync.status().status === 'out', '同期中のログアウト：落ちずに止まる');
}

console.log(`server_guard.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
