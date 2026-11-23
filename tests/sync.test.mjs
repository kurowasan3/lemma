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
  // v0.23：B の復習（last=1990…）のあとに A の解答（t=2000…, g=4）があり、A の reps は B から増えていない＝別々に復習した。
  //   新しい方（A）だけを採ると B の復習が消えるので、B の状態から A の解答を review し直す
  const { review } = await import('../js/scheduler.js');
  const want = review(B.pstat['I-QF-109'], 4, 2000000000000);
  // q01：A（＝base）は2回復習済み、B はその状態を知らずに1回目として解いた（reps 1）。v0.26 から、B の reps が少なくても
  //   A の状態から B の解答（g=1）を計算し直す（以前は B の状態だけを採り、A の2回分が消えていた）
  const wantQ = review(base.pstat.q01, 1, 2000000000500);
  ok(M.pstat['I-QF-109'].S === want.S && M.pstat['I-QF-109'].reps === 2 && M.pstat.q01.reps === 3 && M.pstat.q01.S === wantQ.S, '復習状態：2台で別々に復習した問題は、両方の復習を反映する（同期していない端末が初めて解いた場合も）');
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
  // pstat（問題ごとの復習の記録）も失われない：片方にしか無い問題はそのまま、両方にあれば新しい方
  const L3 = clone(L), R3 = clone(R);
  L3.pstat = { 'I-EXP-001': { S: 3, D: 5, last: 1000, reps: 1, lapses: 0 } };
  R3.pstat = { 'I-EXP-003': { S: 1, D: 6, last: 3000, reps: 1, lapses: 1 }, 'I-EXP-001': { S: 1, D: 6, last: 500, reps: 1, lapses: 0 } };
  const M3 = S.mergeState(clone(L3), clone(R3));
  ok(M3.pstat['I-EXP-001'].last === 1000 && M3.pstat['I-EXP-003'] && M3.log.find(l => l.p === 'I-EXP-001').r === 3, 'pstat は問題ごとに新しい方が残り、片方にしか無いものも残る（r も一緒に）');
}

// ---------------------------------------------------------------- v0.23：同期の安全性
{
  const mock = createMockSupabase({ key: SUPABASE_KEY });
  globalThis.fetch = mock.fetch;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const device = (initial, opts = {}) => {
    let st = clone(initial);
    const sync = S.createSync({ getState: () => st, applyState: opts.apply ? (m) => { st = opts.apply(st, m); } : (m) => { st = m; }, retryDelay: 5 });
    return { sync, get: () => st, set: (x) => { st = x; } };
  };
  mem.clear();
  const A = device({ ...clone(base), log: base.log.slice(0, 30) });
  await A.sync.sendCode('safe@example.com'); await A.sync.verify('safe@example.com', '123456');
  const uid = [...mock.users.values()].find(u => u.email === 'safe@example.com').id;
  const sess = mem.get('lemma.auth');

  // 壊れたサーバーの記録：合わせず、書き戻さず、手元も変えない
  const good = clone(mock.rows.get(uid));
  mock.rows.set(uid, { ...good, state: { ...good.state, log: 'こわれた' } });
  const before = S.stable(A.get());
  await A.sync.syncNow();
  ok(A.sync.status().status === 'error' && /形が正しくない/.test(A.sync.status().error) && S.stable(A.get()) === before && mock.rows.get(uid).state.log === 'こわれた', '壊れたサーバーの記録とは合わせず、手元もサーバーも変えない');
  // 新しい版（schema が大きい）の記録：上書きしない
  mock.rows.set(uid, { ...good, state: { ...good.state, schema: 99 } });
  await A.sync.syncNow();
  ok(/新しい版/.test(A.sync.status().error) && mock.rows.get(uid).state.schema === 99 && mock.rows.get(uid).rev === good.rev, '新しい版のアプリの記録は上書きしない');
  mock.rows.set(uid, good);
  await wait(30);

  // 手元の記録が壊れている：送らない
  const broken = device({ ...clone(base), log: [{ p: 'x' }] });
  await broken.sync.syncNow();
  ok(broken.sync.status().status === 'error' && mock.rows.get(uid).rev === good.rev, '手元の記録の形が正しくなければ送らない');

  // 古い記録しか持っていない端末が同期しても、サーバーの新しい記録・復習状態は消えない
  mock.rows.set(uid, { ...good, state: { ...good.state, log: [...good.state.log, { p: 'I-QF-109', t: 2100000000000, g: 4 }], pstat: { ...good.state.pstat, 'I-QF-109': { S: 9, D: 4, last: 2100000000000, reps: 3, lapses: 0 } } } });
  const old = device({ ...clone(base), log: base.log.slice(0, 5), pstat: { 'I-QF-109': { S: 1, D: 5, last: 1700000000000, reps: 2, lapses: 0 } } });
  await old.sync.syncNow();
  const srv = mock.rows.get(uid).state;
  ok(srv.log.some(l => l.t === 2100000000000) && srv.log.length >= good.state.log.length + 1 && srv.pstat['I-QF-109'].S === 9, '古い記録の端末が同期しても、サーバーの新しい記録・復習状態で上書きされる側にはならない');

  // 書き戻しの途中で通信が切れた（部分的な同期）：サーバーは前のまま、手元も失わない。次の同期で両方が入る
  const C = device(old.get());
  C.set({ ...C.get(), log: [...C.get().log, { p: 'q03', t: 2100000001000, g: 3 }] });
  const revC = mock.rows.get(uid).rev;
  globalThis.fetch = async (url, init) => { if (init && init.method === 'PATCH') throw new TypeError('Failed to fetch'); return mock.fetch(url, init); };
  await C.sync.syncNow();
  ok(C.sync.status().status === 'offline' && mock.rows.get(uid).rev === revC && C.get().log.some(l => l.p === 'q03'), '書き戻しで切れても、サーバーは前の版のまま・手元の記録も残る');
  globalThis.fetch = mock.fetch;
  await wait(40);   // 自動のやり直し（retryDelay=5ms）
  ok(C.sync.status().status === 'ok' && mock.rows.get(uid).state.log.some(l => l.p === 'q03'), 'オフラインの失敗は、間をあけて自動でやり直す');

  // サーバーの一時的な不調（503）も自動でやり直す。壊れた記録（bad_remote）はやり直さない
  let n503 = 1;
  globalThis.fetch = async (url, init) => { if (n503-- > 0) return { ok: false, status: 503, text: async () => '{"message":"busy"}' }; return mock.fetch(url, init); };
  C.set({ ...C.get(), log: [...C.get().log, { p: 'q04', t: 2100000002000, g: 2 }] });
  await C.sync.syncNow();
  ok(C.sync.status().status === 'error', '503 ではいったん失敗');
  await wait(40);
  ok(C.sync.status().status === 'ok' && mock.rows.get(uid).state.log.some(l => l.p === 'q04'), '503 のあと自動でやり直して同期できる');
  globalThis.fetch = mock.fetch;

  // 通信している間に解いた記録：アプリと同じく、反映の前にもう一度合わせれば失われない
  const D = device(C.get(), { apply: (cur, m) => S.mergeState(cur, m) });
  const NAIVE = device(C.get());
  for (const [dev, name] of [[D, 'merge'], [NAIVE, 'naive']]) {
    mock.hooks.beforePatch = async () => { dev.get().log.push({ p: 'q05', t: 2100000003000 + (name === 'merge' ? 0 : 1), g: 3 }); };
    dev.set({ ...dev.get(), log: [...dev.get().log, { p: 'q06', t: 2100000004000 + (name === 'merge' ? 0 : 1), g: 3 }] });
    await dev.sync.syncNow();
    mock.hooks.beforePatch = null;
  }
  ok(D.get().log.some(l => l.p === 'q05'), '同期の途中で解いた記録も、反映のときに合わせ直せば残る（app.js の applyState）');
  ok(!NAIVE.get().log.some(l => l.p === 'q05'), '（確認）合わせ直さずに置き換えると、途中で解いた記録が消える＝合わせ直しが必要');

  // 5000件を超える記録も、同期で切り捨てない
  const many = Array.from({ length: 6000 }, (_, i) => ({ p: 'q01', t: 1700000000000 + i * 1000, g: 3 }));
  const M = S.mergeState({ ...clone(base), log: many.slice(0, 3500) }, { ...clone(base), log: many.slice(2500) });
  ok(M.log.filter(l => l.t >= 1700000000000 && l.p === 'q01').length === 6000, '5000件を超える解答の記録も同期で切り捨てない');
  // 同じ問題を2台で別々に復習（共通の状態 C0 から）：両方の復習が入り、どちらから合わせても同じ・何度合わせても同じ
  const { review } = await import('../js/scheduler.js');
  const C0 = review(null, 3, 1800000000000);
  const LA = { ...clone(base), log: [{ p: 'q09', t: 1800000000000, g: 3 }, { p: 'q09', t: 1801000000000, g: 1 }], pstat: { q09: review(C0, 1, 1801000000000) } };
  const RB = { ...clone(base), log: [{ p: 'q09', t: 1800000000000, g: 3 }, { p: 'q09', t: 1802000000000, g: 4 }], pstat: { q09: review(C0, 4, 1802000000000) } };
  const want = review(review(C0, 1, 1801000000000), 4, 1802000000000);
  const X = S.mergeState(clone(LA), clone(RB)), Y = S.mergeState(clone(RB), clone(LA));
  ok(X.pstat.q09.reps === 3 && X.pstat.q09.lapses === 1 && Math.abs(X.pstat.q09.S - want.S) < 1e-9, '2台で別々に復習した問題は、両方の復習を時刻順に反映する（片方の失敗が消えない）');
  ok(S.stable(X.pstat) === S.stable(Y.pstat), '復習状態の合わせ方は、どちらから合わせても同じ');
  ok(S.stable(S.mergeState(clone(X), clone(RB)).pstat) === S.stable(X.pstat) && S.stable(S.mergeState(clone(RB), clone(X)).pstat) === S.stable(X.pstat), '合わせた結果をもう一度どちらと合わせても変わらない（端末どうしで行ったり来たりしない）');
  // 一方が他方の続き（同じ端末で続けて復習しただけ）なら、新しい方をそのまま使う
  const P1 = { q09: review(C0, 3, 1801000000000) };
  const P2 = { q09: review(P1.q09, 4, 1802000000000) };
  const lg = [{ p: 'q09', t: 1800000000000, g: 3 }, { p: 'q09', t: 1801000000000, g: 3 }, { p: 'q09', t: 1802000000000, g: 4 }];
  ok(S.stable(S.mergeState({ ...clone(base), log: lg, pstat: P1 }, { ...clone(base), log: lg, pstat: P2 }).pstat.q09) === S.stable(P2.q09), '続きの関係なら新しい方（二重に数えない）');
  mem.set('lemma.auth', sess);
}

// ---------------------------------------------------------------- v0.24：同期の境界条件
{
  const mock = createMockSupabase({ key: SUPABASE_KEY });
  globalThis.fetch = mock.fetch;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const device = (initial) => {
    let st = clone(initial);
    const sync = S.createSync({ getState: () => st, applyState: (m) => { st = S.mergeState(st, m); }, retryDelay: 5 });
    return { sync, get: () => st, set: (x) => { st = x; } };
  };
  mem.clear();
  const A = device({ ...clone(base), localResetAt: 1234 });
  await A.sync.sendCode('edge@example.com'); await A.sync.verify('edge@example.com', '123456');
  const uid = [...mock.users.values()].find(u => u.email === 'edge@example.com').id;
  ok(!('localResetAt' in mock.rows.get(uid).state) && A.get().localResetAt === 1234, 'この端末だけの印 localResetAt はサーバーに送らない（手元には残る）');

  // 再試行の重複：同時に何度呼んでも、通信は1回分
  let gets = 0;
  globalThis.fetch = async (url, init) => { if ((!init || !init.method || init.method === 'GET') && String(url).includes('lemma_state')) gets++; return mock.fetch(url, init); };
  A.set({ ...A.get(), log: [...A.get().log, { p: 'q01', t: 2200000000000, g: 3 }] });
  await Promise.all([A.sync.syncNow(), A.sync.syncNow(), A.sync.syncNow()]);
  ok(gets === 1, `同時に3回同期を呼んでも、サーバーへの取得は1回（${gets}回）`);
  globalThis.fetch = mock.fetch;

  // 通信中のログアウト：落ちずに止まり、記録は変えない
  const before = S.stable(A.get().log);
  mock.hooks.beforePatch = async () => { await A.sync.logout(); };
  A.set({ ...A.get(), log: [...A.get().log, { p: 'q02', t: 2200000001000, g: 3 }] });
  const res = await A.sync.syncNow();
  mock.hooks.beforePatch = null;
  ok(!A.sync.loggedIn() && A.get().log.length === JSON.parse(before).length + 1 && A.sync.status().status === 'out', `通信中にログアウトしても、記録を変えずに止まる（${res === null ? '失敗扱い' : '完了'}）`);
  await wait(30);

  // 新しい schema の手元の記録は送らない
  mem.clear();
  const N = device({ ...clone(base), schema: 99 });
  await N.sync.sendCode('edge@example.com'); await N.sync.verify('edge@example.com', '123456');
  ok(/新しい版/.test(N.sync.status().error || '') && mock.rows.get(uid).state.schema === 4, '手元の記録が新しい schema なら送らない');

  // サーバー側の制限（guard.sql）に対する同期は tests/server_guard.test.mjs で、本物の PostgreSQL（PGlite）を相手に確かめる

  // 大きい記録（2万件）の同期：欠けずに往復する
  mem.clear();
  const many = Array.from({ length: 20000 }, (_, i) => ({ p: `q${String(i % 500).padStart(3, '0')}`, t: 1700000000000 + i * 60000, g: 1 + (i % 4), sg: 'full', c: 'mid', min: 5, in: 1 }));
  const Big = device({ ...clone(base), log: many });
  const t0 = Date.now();
  await Big.sync.sendCode('big@example.com'); await Big.sync.verify('big@example.com', '123456');
  const uidB = [...mock.users.values()].find(u => u.email === 'big@example.com').id;
  const Big2 = device({ ...clone(base), log: many.slice(0, 100) });
  await Big2.sync.sendCode('big@example.com'); await Big2.sync.verify('big@example.com', '123456');
  ok(mock.rows.get(uidB).state.log.length >= 20000 && Big2.get().log.length >= 20000, `2万件の記録も欠けずに同期する（${Date.now() - t0}ms）`);
}

// ---------------------------------------------------------------- v0.25：失敗の分類と、断られた後の自動同期の停止
{
  const C = S.classify;
  ok(C('offline') === 'offline' && C('conflict') === 'conflict' && C('LM002') === 'conflict' && C('503') === 'server' && C('429') === 'server'
    && C('LM004') === 'rejected' && C('LM007') === 'rejected' && C('bad_remote') === 'data' && C('newer_local') === 'data'
    && C('no_session') === 'auth' && C('PGRST301') === 'auth' && C('xyz') === 'other', '失敗の分類（やり直す・止める・ログインし直す）');
  const mock = createMockSupabase({ key: SUPABASE_KEY });
  globalThis.fetch = mock.fetch;
  mem.clear();
  let st = clone(base);
  const sync = S.createSync({ getState: () => st, applyState: (m) => { st = S.mergeState(st, m); }, retryDelay: 5 });
  await sync.sendCode('halt@example.com'); await sync.verify('halt@example.com', '123456');
  const uid = [...mock.users.values()].find(u => u.email === 'halt@example.com').id;
  const good = clone(mock.rows.get(uid));
  mock.rows.set(uid, { ...good, state: { ...good.state, log: 'こわれた' } });
  let gets = 0;
  globalThis.fetch = async (url, init) => { if (String(url).includes('lemma_state') && (!init || !init.method || init.method === 'GET')) gets++; return mock.fetch(url, init); };
  await sync.syncNow();
  const s1 = sync.status();
  ok(s1.kind === 'data' && s1.halted && s1.code === 'bad_remote', '壊れたサーバーの記録 → data・自動の同期を止める');
  sync.schedule(1); await sync.syncNow({ auto: true });
  await new Promise(r => setTimeout(r, 30));
  ok(gets === 1, `止めた後は、解答後・画面が隠れたとき等の自動の同期でサーバーに問い合わせない（${gets}回）`);
  mock.rows.set(uid, good);
  await sync.syncNow();
  ok(sync.status().status === 'ok' && !sync.status().halted && gets === 2, '利用者が「今すぐ同期」を押すと再開する');
  globalThis.fetch = mock.fetch;
}

console.log(`sync.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
