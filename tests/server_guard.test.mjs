// supabase/guard.sql（サーバー側の書き込み制限）を、実際の PostgreSQL（PGlite：WASM 版）で確かめる（v0.24）
//   node tests/server_guard.test.mjs        （@electric-sql/pglite が必要：npm install --no-save @electric-sql/pglite）
// Supabase そのもの（PostgREST・RLS・認証）は含まない。表と、guard.sql のトリガーだけを確かめる。
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
let PGlite;
try { ({ PGlite } = await import(require.resolve('@electric-sql/pglite'))); }
catch { console.log('@electric-sql/pglite が入っていません（npm install --no-save --no-package-lock @electric-sql/pglite）'); process.exit(1); }

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const db = new PGlite();
// schema.sql の表（auth.users への参照と RLS は PGlite に無いので除く）
await db.exec(`create table public.lemma_state (user_id uuid primary key, state jsonb not null, rev integer not null default 1,
  updated_at timestamptz not null default now(), constraint state_size check (pg_column_size(state) < 5000000));`);
const guard = fs.readFileSync(path.join(root, 'supabase/guard.sql'), 'utf8');
await db.exec(guard);
await db.exec(guard);   // 何度実行してもよい
const U = '00000000-0000-0000-0000-000000000001';
const log = (n, t0 = 1700000000000) => Array.from({ length: n }, (_, i) => ({ p: 'q01', t: t0 + i, g: 3 }));
const st = (n, extra = {}) => JSON.stringify({ schema: 4, log: log(n), problems: {}, ...extra });
const attempt = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.code || String(e); } };
const upd = (state, rev) => attempt('update public.lemma_state set state = $1::jsonb, rev = $2 where user_id = $3', [state, rev, U]);

ok(await attempt('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', [U, JSON.stringify({ log: 'x' })]) === 'LM001', '作成：log が配列でない記録は断る');
ok(await attempt('insert into public.lemma_state (user_id, state, rev) values ($1, $2::jsonb, 1)', [U, st(10)]) === null, '作成：正しい記録は入る');
ok(await upd(st(12), 2) === null, '更新：rev+1・記録が増える → 入る');
ok(await upd(st(13), 2) === 'LM002', '更新：rev が進んでいない（古い版番号のまま）→ 断る');
ok(await upd(st(13), 9) === 'LM002', '更新：rev を飛ばす → 断る');
ok(await upd(st(12, { schema: 3 }), 3) === 'LM003', '更新：schema を下げる → 断る');
ok(await upd(st(5), 3) === 'LM004', '更新：解答の記録が減る（古いアプリの切り捨て）→ 断る');
ok(await upd(st(0, { resetAt: 1800000000000 }), 3) === null, '更新：「消した印」resetAt が進んだ消去は入る');
ok(await upd(st(0, { resetAt: 1800000000000 }), 4) === null, '更新：同じ内容の書き直しは入る');
ok(await upd(JSON.stringify({ schema: 4, log: {} }), 5) === 'LM001', '更新：log が配列でない → 断る');
const row = (await db.query('select rev, jsonb_array_length(state->\'log\') as n from public.lemma_state where user_id = $1', [U])).rows[0];
ok(row.rev === 4 && row.n === 0, `断った書き込みは表を変えない（rev ${row.rev}）`);

console.log(`server_guard.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
