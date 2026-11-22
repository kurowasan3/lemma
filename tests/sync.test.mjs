// 同期（js/sync.js）の単体テスト：記録の合わせ方と、にせ Supabase を相手にした一連の流れ
//   node tests/sync.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMockSupabase } from './mock-supabase.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const { SUPABASE_KEY } = await import('../js/config.js');
const S = await import('../js/sync.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));

// ---------------------------------------------------------------- 合わせ方
{
  const A = clone(base), B = clone(base);
  A.log.push({ p: 'I-QF-109', t: 2000000000000, g: 4, sg: 'full' });
  B.log.push({ p: 'q01', t: 2000000000500, g: 1, sg: 'none' });
  A.pstat['I-QF-109'] = { S: 3, D: 4, last: 2000000000000, reps: 1, lapses: 0 };
  B.pstat['I-QF-109'] = { S: 1, D: 6, last: 1990000000000, reps: 1, lapses: 1 };
  B.pstat['q01'] = { S: 0.4, D: 7, last: 2000000000500, reps: 1, lapses: 1 };
  A.settings = { ...A.settings, theme: 'light' }; A.settingsAt = 100;
  B.settings = { ...B.settings, theme: 'dark' }; B.settingsAt = 200;
  A.drill = { size: 10, best: { diff: { ok: 9, n: 10, ms: 300000 }, int: { ok: 5, n: 5, ms: 90000 } } };
  B.drill = { size: 20, best: { diff: { ok: 10, n: 10, ms: 400000 }, lim: { ok: 3, n: 5, ms: 1000 } } };
  A.explains['I-QF-109'] = [{ t: 1, text: 'a' }];
  B.explains['I-QF-109'] = [{ t: 2, text: 'b' }];
  const M = S.mergeState(clone(A), clone(B));
  const keys = new Set(M.log.map(l => `${l.p}|${l.t}`));
  ok(M.log.length === base.log.length + 2 && keys.has('I-QF-109|2000000000000') && keys.has('q01|2000000000500'), '解答の記録は両方の分を足し、同じ回は重複しない');
  ok(M.log.every((l, i) => i === 0 || M.log[i - 1].t <= l.t), '記録は時刻順');
  ok(M.pstat['I-QF-109'].S === 3 && M.pstat.q01.S === 0.4, '復習状態は問題ごとに新しい方');
  ok(M.settings.theme === 'dark' && M.settingsAt === 200, '設定は最後に変えた方');
  ok(M.drill.best.diff.ok === 10 && M.drill.best.int && M.drill.best.lim, '計算の自己ベストは良い方を残し、両方の種目を残す');
  ok(M.explains['I-QF-109'].map(e => e.text).join() === 'a,b', 'メモは両方を残す');
  ok(M.problems['q01'] && M.problems['q01'].n >= 1, '解いた問題の回数は記録の数以上');
  const M2 = S.mergeState(clone(M), clone(B));
  ok(S.stable(M2) === S.stable(M), '同じ相手ともう一度合わせても変わらない（何度同期しても同じ）');
  const MB = S.mergeState(clone(B), clone(A));
  ok(S.stable(MB.log) === S.stable(M.log) && S.stable(MB.pstat) === S.stable(M.pstat), '順番を逆にしても記録と復習状態は同じ');
  ok(S.mergeState(A, null) === A && S.mergeState(null, B) === B, '片方が無ければもう片方');
  // 手元の記録オブジェクトはそのまま使う（解いている途中の参照が切れない）
  const L = clone(A), R = clone(A); const ref = L.log[L.log.length - 1]; R.log[R.log.length - 1].note = 'あとで書いた';
  const M3 = S.mergeState(L, R);
  ok(M3.log.includes(ref) && ref.note === 'あとで書いた', '手元の記録オブジェクトを使い、相手にしかない項目は補う');
  ok(S.stable({ b: 1, a: [1, { d: 2, c: 3 }] }) === S.stable({ a: [1, { c: 3, d: 2 }], b: 1 }), 'stable() はキーの順番によらない');
}
// 記録を消した印（resetAt）とブックマーク（v0.11）
{
  const T = 2000000000000;
  const old = clone(base);                                   // まだ消したことを知らない端末（またはサーバー）
  old.log.push({ p: 'I-QF-109', t: T - 1000, g: 3 }, { p: 'q01', t: T + 5000, g: 4 });
  old.pstat['I-QF-109'] = { S: 3, D: 4, last: T - 1000, reps: 1, lapses: 0 };
  old.pstat['q01'] = { S: 2, D: 4, last: T + 5000, reps: 1, lapses: 0 };
  old.explains = { 'I-QF-109': [{ t: T - 2000, text: '古いメモ' }] };
  old.bookmarks = { 'I-QF-109': { on: true, t: T - 3000 } };
  old.drill = { size: 10, best: { diff: { ok: 9, n: 10, ms: 1 } } };
  old.settings = { ...old.settings, theme: 'dark' }; old.settingsAt = 50;
  const wiped = { log: [], pstat: {}, problems: {}, cards: {}, explains: {}, bookmarks: {}, streak: { last: null, count: 0 },
    settings: { theme: 'light' }, settingsAt: 10, schema: 4, resetAt: T };
  const M = S.mergeState(wiped, old);
  ok(M.resetAt === T, '消した印は新しい方');
  ok(M.log.length === 1 && M.log[0].p === 'q01', '消した時刻より前の記録は持ち込まず、後の記録は残す');
  ok(!M.pstat['I-QF-109'] && M.pstat.q01, '復習状態も、消した時刻より前のものは持ち込まない');
  ok(!M.explains['I-QF-109'] && !M.bookmarks['I-QF-109'], 'メモ・ブックマークも同じ');
  ok(!M.drill || !Object.keys(M.drill.best || {}).length, '計算の自己ベストも消える');
  ok(M.settings.theme === 'dark', '設定は消さない（最後に変えた方）');
  const M2 = S.mergeState(old, wiped);
  ok(S.stable(M2.log) === S.stable(M.log) && S.stable(M2.pstat) === S.stable(M.pstat), '向きを逆にしても同じ');
  const imported = { ...clone(base), resetAt: T + 10000 };   // 置き換えで読み込んだ記録：古い解答も消さない
  const M3 = S.mergeState(imported, old);
  ok(M3.log.length === base.log.length, '印の新しい側の記録は、印より古くても残す（バックアップで置き換えたとき）');
  // ブックマーク：付け外しの新しい方。外した印でよみがえらない
  const a = { ...clone(base), bookmarks: { x: { on: true, t: 1 }, y: { on: false, t: 9 } } };
  const b = { ...clone(base), bookmarks: { x: { on: false, t: 5 }, y: { on: true, t: 3 }, z: { on: true, t: 2 } } };
  const MB = S.mergeState(a, b);
  ok(MB.bookmarks.x.on === false && MB.bookmarks.y.on === false && MB.bookmarks.z.on === true, 'ブックマークは問題ごとに最後に付け外しした方');
  ok(!('resetAt' in S.mergeState(clone(base), clone(base))), '消した印が無ければ項目を作らない');
}

// ---------------------------------------------------------------- にせ Supabase を相手にした流れ
{
  const mock = createMockSupabase({ key: SUPABASE_KEY });
  globalThis.fetch = mock.fetch;
  const device = (initial) => {
    let st = clone(initial);
    const statuses = [];
    const sync = S.createSync({ getState: () => st, applyState: (m) => { st = m; }, onStatus: (x) => statuses.push(x.status) });
    return { sync, get: () => st, set: (x) => { st = x; }, statuses };
  };
  // 端末A：ログイン → 初回はそのままサーバーへ
  mem.clear();
  const A = device({ ...clone(base), log: base.log.slice(0, 20) });
  let err = null;
  try { await A.sync.sendCode('blocked@example.com'); } catch (e) { err = e; }
  ok(err && /送れません/.test(err.message), '送れないメールアドレスは日本語で知らせる');
  await A.sync.sendCode('me@example.com');
  err = null; try { await A.sync.verify('me@example.com', '000000'); } catch (e) { err = e; }
  ok(err && err.code === 'otp_expired', '違うコードではログインできない');
  await A.sync.verify('me@example.com', '123 456');
  ok(A.sync.loggedIn() && A.sync.status().status === 'ok', 'コードでログインし、そのまま同期する');
  const uid = [...mock.users.values()][0].id;
  ok(mock.rows.get(uid).rev === 1 && mock.rows.get(uid).state.log.length === 20, '初回の同期で、この端末の記録がサーバーに入る');
  const sessA = mem.get('lemma.auth');

  // 端末B：別の記録を持ってログイン → 合わさる
  mem.clear();
  const B = device({ ...clone(base), log: base.log.slice(15) });
  await B.sync.sendCode('me@example.com');
  await B.sync.verify('me@example.com', '123456');
  ok(B.get().log.length === base.log.length, `端末B：両方の記録が合わさる（${B.get().log.length}件）`);
  ok(mock.rows.get(uid).rev === 2, 'サーバーの版が1つ進む');

  // 端末A：もう一度同期すると、Bの分も入る
  mem.clear(); mem.set('lemma.auth', sessA);
  const A2 = device(A.get());
  await A2.sync.syncNow();
  ok(A2.get().log.length === base.log.length, '端末A：次の同期でBの記録も入る');
  const revBefore = mock.rows.get(uid).rev;
  await A2.sync.syncNow();
  ok(mock.rows.get(uid).rev === revBefore, '変わりが無ければサーバーに書かない');

  // 同時に書かれた（版がずれた）とき：取り直して合わせ直す
  A2.set({ ...A2.get(), log: [...A2.get().log, { p: 'I-QF-108', t: 2100000000000, g: 3 }] });
  let once = true;
  mock.hooks.beforePatch = async (id) => {
    if (!once) return; once = false;
    const r = mock.rows.get(id);
    mock.rows.set(id, { ...r, rev: r.rev + 1, state: { ...r.state, log: [...r.state.log, { p: 'q02', t: 2100000000001, g: 2 }] } });
  };
  await A2.sync.syncNow();
  mock.hooks.beforePatch = null;
  const srv = mock.rows.get(uid).state.log.map(l => l.p);
  ok(srv.includes('I-QF-108') && srv.includes('q02'), '同時に書かれても、どちらの記録も失わない');

  // 期限切れのアクセス用トークン → 自動で取り直す
  const s = JSON.parse(mem.get('lemma.auth')); s.expires_at = Date.now() - 1000; mem.set('lemma.auth', JSON.stringify(s));
  const A3 = device(A2.get());
  await A3.sync.syncNow();
  ok(A3.sync.status().status === 'ok' && JSON.parse(mem.get('lemma.auth')).access_token !== s.access_token, 'トークンの期限が切れていたら取り直して同期する');

  // 通信できない → 状態は「オフライン」、記録はそのまま
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const before = S.stable(A3.get());
  await A3.sync.syncNow();
  ok(A3.sync.status().status === 'offline' && S.stable(A3.get()) === before, 'オフラインでは記録を変えずに「同期待ち」');
  globalThis.fetch = mock.fetch;

  // 退会 → サーバーの記録とアカウントが消え、手元の記録は残る
  await A3.sync.deleteAccount();
  ok(!mock.rows.has(uid) && mock.users.size === 0 && !A3.sync.loggedIn() && A3.get().log.length > 0, '退会でサーバーの記録とアカウントが消え、手元の記録は残る');
  ok(!mem.has('lemma.auth'), '退会後はログイン情報も消える');
}

// v0.20：解答後の「解法は浮かんだか」（r）と解法カードからの印（k）が同期で保たれる
{
  const base = { v: 2, log: [], problems: {}, pstat: {}, cards: {}, bookmarks: {}, practice: {}, settings: {} };
  const L = clone(base), R = clone(base);
  L.log = [{ p: 'I-EXP-001', t: 1000, g: 3, ok: true, r: 3 }, { p: 'I-EXP-002', t: 2000, g: 3, ok: true, k: 't' }];
  R.log = [{ p: 'I-EXP-001', t: 1000, g: 3, ok: true }, { p: 'I-EXP-003', t: 3000, g: 1, ok: false, r: 1 }];
  const M = S.mergeState(clone(L), clone(R));
  const by = Object.fromEntries(M.log.map(l => [l.p, l]));
  ok(by['I-EXP-001'].r === 3, '手元で答えた r は、r の無い向こうの同じ回に上書きされない');
  ok(by['I-EXP-002'].k === 't' && by['I-EXP-003'].r === 1, 'k と向こうの r も残る');
  const M2 = S.mergeState(clone(R), clone(L));
  ok(M2.log.find(l => l.p === 'I-EXP-001').r === 3, '向こうの端末に r があれば、こちらにも入る');
  const L2 = clone(L); L2.log[0].r = 1;
  ok(S.mergeState(clone(L2), clone(L)).log.find(l => l.p === 'I-EXP-001').r === 1, '同じ端末で答え直した r は手元の値が残る');
}

console.log(`sync.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
