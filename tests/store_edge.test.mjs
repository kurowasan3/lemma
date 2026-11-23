// 学習記録の保全：境界条件・競合・復旧（v0.24）
//   node tests/store_edge.test.mjs
// 新しい schema の上書き防止・バックアップ形式の検証・保存先の障害・複数タブの競合・移行の失敗と再試行。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = await import('../js/store.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
const NOW = Date.UTC(2026, 10, 23);
const ctx = { problemIds: new Set([...base.log.map(l => l.p), 'q01', 'q02', 'q03', 'q04', 'q05']), now: NOW };
const entry = (p, t, g = 3) => ({ p, t, g });
const logOf = (raw) => JSON.parse(raw).log.map(l => `${l.p}@${l.t}`).sort();

// localStorage と同じ形の保存先。失敗を細かく起こせる
function memStorage({ quota = Infinity } = {}) {
  const m = new Map();
  const st = {
    map: m, quota, failGet: 0, failSet: 0, failRemove: false, failGetAfterSet: false, onSet: null, sets: 0,
    getItem(k) { if (st.failGet > 0) { st.failGet--; throw new Error('SecurityError: 読めない'); } return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      if (st.failSet > 0) { st.failSet--; throw Object.assign(new Error('UnknownError: 書けない'), { name: 'UnknownError' }); }
      const size = [...m].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length + kk.length), 0) + String(v).length + k.length;
      if (size > st.quota) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });
      m.set(k, String(v)); st.sets++;
      if (st.failGetAfterSet) { st.failGetAfterSet = false; st.failGet = 1; }
      if (st.onSet) { const f = st.onSet; st.onSet = null; f(k, v); }
    },
    removeItem(k) { if (st.failRemove) throw new Error('removeItem できない'); m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return st;
}

// ================================================================ 1. 新しい schema を上書きしない
{
  const newer = { ...clone(base), schema: 99, future: { kept: true } };
  const raw = JSON.stringify(newer);
  const ls = memStorage(); ls.map.set(S.KEY, raw);
  const st = S.createStore(ls, { now: () => NOW });
  const L = st.load();
  ok(L.status === 'newer' && st.blocked() === 'newer', 'schema 99 の記録を読むと「新しい版」として保存を止める');
  ok(L.state.log.length === base.log.length && L.state.future.kept, '画面の中では記録をそのまま使える（初期化しない）');
  L.state.log.push(entry('q01', NOW));
  const r = st.save(L.state);
  ok(!r.ok && r.reason === 'newer' && ls.map.get(S.KEY) === raw, 'schema 99 を読んだ後に保存しても、上書きされない');
  ok(L.state.log.length === base.log.length + 1, '保存を断っても、画面の学習状態は初期化されない');
  ok(st.replace(L.state, S.freshState(), '消去の前').reason === 'newer' && ls.map.get(S.KEY) === raw, '読み込み・消去（置き換え）も断る');
  const again = S.createStore(ls, { now: () => NOW }).load();
  ok(ls.map.get(S.KEY) === raw && again.status === 'newer', '再読み込みしても元の内容のまま');

  // 同じタブ：画面の記録の schema が新しい（新しい形の記録を合わせた等）
  const ls2 = memStorage(); const s2 = S.createStore(ls2, { now: () => NOW });
  const st2 = s2.load().state; st2.log.push(entry('q01', NOW));
  ok(s2.save(st2).ok, 'schema 4 の正常な記録は今まで通り保存できる');
  const before2 = ls2.map.get(S.KEY);
  ok(s2.save({ ...st2, schema: 99 }).reason === 'newer' && ls2.map.get(S.KEY) === before2, '保存しようとする記録の schema が新しければ断る');

  // 別のタブ：新しい版のアプリが別のタブで移行した
  const ls3 = memStorage(); const A = S.createStore(ls3, { now: () => NOW });
  const a = A.load().state; a.log.push(entry('q01', NOW)); A.save(a);
  const newerRaw = JSON.stringify({ ...JSON.parse(ls3.map.get(S.KEY)), schema: 99 });
  ls3.map.set(S.KEY, newerRaw);   // 新しい版のアプリ（別のタブ）が書いた
  a.log.push(entry('q02', NOW + 1));
  const ra = A.save(a);
  ok(!ra.ok && ra.reason === 'newer' && ls3.map.get(S.KEY) === newerRaw, '別のタブに schema 99 の記録があれば、上書きしない');
  ok(A.save(a).reason === 'newer' && a.log.length === 2, 'その後の保存も止め、画面の記録は残す');

  // 旧版アプリによる保存：v0.22 の load() は schema 4 以外を「古い記録」として schema 4 に書き換えてしまう（このアプリでは防げない）
  //   → 決まり：schema を上げるときは、保存先のキーも変える（古い版のアプリが新しい記録を読まないように）
  ok(S.SCHEMA === 4 ? S.KEY === 'lemma.v2' : S.KEY !== 'lemma.v2', '決まり：schema を 4 より上げるときは、保存先のキー（lemma.v2）も変える');
}

// ================================================================ 2. バックアップ形式の検証
{
  const good = S.makeBackup(clone(base), '0.24.0', NOW);
  const code = (x) => { try { S.readBackup(x, ctx); return 'ok'; } catch (e) { return e.code || e.message; } };
  ok(code(clone(good)) === 'ok', '正常な v1 バックアップ');
  ok(code(clone(base)) === 'ok', '正常な旧形式（v0.22 まで）のバックアップ');
  const v = (f) => { const d = clone(good); f(d); return code(d); };
  ok(v(d => { delete d.hash; }) === 'no_hash', 'hash が無い → 断る（no_hash）');
  ok(v(d => { d.hash = 12345; }) === 'bad_hash' && v(d => { d.hash = 'md5:abc'; }) === 'bad_hash', 'hash の型・形が違う → 断る（bad_hash）');
  ok(v(d => { d.state.log[0].g = 1 + (d.state.log[0].g % 4); }) === 'hash_mismatch', 'hash が合わない → 断る（hash_mismatch）');
  ok(v(d => { delete d.schema; }) === 'no_schema', 'schema が無い → 断る');
  ok(v(d => { d.schema = '4'; }) === 'bad_schema', 'schema が整数でない → 断る');
  ok(v(d => { d.schema = 99; }) === 'newer_schema', 'schema が将来の版 → 断る');
  ok(v(d => { d.schema = 3; }) === 'schema_mismatch', '付帯の schema と記録の schema が違う → 断る');
  ok(v(d => { d.version = 2; }) === 'newer_version' && v(d => { d.version = '1'; }) === 'bad_version', 'version が将来・不正 → 断る');
  ok(v(d => { d.createdAt = 'きのう'; }) === 'bad_created' && v(d => { d.createdAt = '2099-01-01T00:00:00Z'; }) === 'bad_created' && v(d => { delete d.createdAt; }) === 'bad_created', 'createdAt が不正・未来・無い → 断る');
  ok(v(d => { delete d.app; }) === 'bad_app', 'app が無い → 断る');
  ok(v(d => { d.state = 'x'; }) === 'bad_state' && v(d => { d.state.log = {}; }) === 'bad_state', 'state が不正 → 断る');
  ok(v(d => { delete d.counts; }) === 'bad_counts' && v(d => { d.counts.log = -1; }) === 'bad_counts', 'counts が無い・不正 → 断る');
  const cm = clone(good); cm.counts.log += 5;
  const rc = S.readBackup(cm, ctx);
  ok(rc.report.warnings.some(w => w.code === 'backup_counts_mismatch' && w.ids[0].startsWith('log:')), 'counts が実際の件数と違う → 注意（記録そのものは hash で確かめ済み）');
  ok(v(d => { d.format = 'lemma-backup-x'; }) === 'not_lemma', '別の形式 → 断る');
  const big = { ...clone(base), log: Array.from({ length: S.LIMITS.log + 1 }, (_, i) => entry('q01', NOW - i)) };
  ok(code(big) === 'too_large', '大きすぎる記録 → 断る');
  const longMemo = clone(base); longMemo.explains = { q01: [{ t: NOW, text: 'あ'.repeat(S.LIMITS.text + 1) }] };
  ok(code(longMemo) === 'too_large', '長すぎるメモ → 断る');
  // 旧アプリ（v0.22）の checkBackup（v0.22 の js/app.js から写したもの）は、新しい形式のファイルを断る＝記録を壊さない
  function checkBackupV022(d) {
    const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (!obj(d) || !Array.isArray(d.log) || !obj(d.problems)) throw new Error('Lemma の学習記録のファイルではありません');
    return d;
  }
  let e022 = null; try { checkBackupV022(clone(good)); } catch (e) { e022 = e; }
  ok(e022 && /ではありません/.test(e022.message), 'v0.22 のアプリは v1 形式のバックアップを読み込まない（記録を置き換えない）');
}

// ================================================================ 3. 保存先の障害
{
  // getItem が失敗：記録が無いとは扱わず、空の記録で上書きしない。復旧したら保存されている記録と合わせる
  const ls = memStorage(); const saved = JSON.stringify({ ...clone(base) }); ls.map.set(S.KEY, saved);
  ls.failGet = 1;
  const st = S.createStore(ls, { now: () => NOW });
  const L = st.load();
  ok(L.status === 'unavailable' && st.blocked() === 'read', 'getItem が失敗 → 「読めない」（「無い」とは区別する）');
  L.state.log.push(entry('q01', NOW));
  ls.failGet = 1;
  ok(st.save(L.state).reason === 'read' && ls.map.get(S.KEY) === saved, '読めない間は保存しない（空の記録で上書きしない）');
  const r = st.save(L.state);   // ストレージが復旧
  ok(r.ok && r.merged && JSON.parse(ls.map.get(S.KEY)).log.length === base.log.length + 1, '復旧したら、保存されていた記録と合わせてから保存する');
  ok(L.state.log.length === 1, '（画面側は r.merged を反映する。store は渡された記録そのものは変えない）');

  // setItem が失敗（容量以外）→ 'write'。前の記録は残る。復旧したら保存できる
  const ls2 = memStorage(); const s2 = S.createStore(ls2, { now: () => NOW });
  const st2 = s2.load().state; st2.log.push(entry('q01', NOW)); s2.save(st2);
  const prev = ls2.map.get(S.KEY);
  st2.log.push(entry('q02', NOW + 1)); ls2.failSet = 1;
  const w = s2.save(st2);
  ok(!w.ok && w.reason === 'write' && ls2.map.get(S.KEY) === prev, 'setItem が失敗 → write（容量不足とは区別）・前の記録は残る');
  ok(s2.save(st2).ok && JSON.parse(ls2.map.get(S.KEY)).log.length === 2, '失敗の後、復旧したら保存できる');

  // 書いた後の読み戻しに失敗
  st2.log.push(entry('q03', NOW + 2)); ls2.failGetAfterSet = true;
  const vr = s2.save(st2);
  ok(!vr.ok && vr.reason === 'verify_read', '書いた後に読み戻せない → verify_read（書き込みの失敗とは区別）');
  st2.log.push(entry('q04', NOW + 3));
  const vr2 = s2.save(st2);
  ok(vr2.ok && JSON.parse(ls2.map.get(S.KEY)).log.length === 4, '読み戻せた後の保存では、保存されている記録と合わせてから書く');

  // 容量不足：控えを捨てて本体を優先。控えも無ければ前の記録のまま
  const one = JSON.stringify(base).length;
  const ls3 = memStorage({ quota: one * 3 + 4000 }); ls3.map.set(S.KEY, JSON.stringify(base));
  const s3 = S.createStore(ls3, { now: () => NOW });
  const st3 = s3.load().state;
  s3.snapshot(JSON.stringify(base), 'a'); s3.snapshot(JSON.stringify(base), 'b');
  const grow = { ...st3, log: [...st3.log, ...Array.from({ length: 60 }, (_, i) => entry('q01', NOW + i))] };
  const q = s3.save(grow);
  ok(q.ok && q.dropped >= 1 && JSON.parse(ls3.map.get(S.KEY)).log.length === grow.log.length, '容量不足：古い控えを捨てて、本体の新しい記録を保存する');
  const ls4 = memStorage({ quota: one + 2000 }); ls4.map.set(S.KEY, JSON.stringify(base));
  const s4 = S.createStore(ls4, { now: () => NOW }); s4.load();
  const q4 = s4.save({ ...clone(base), log: [...base.log, ...Array.from({ length: 200 }, (_, i) => entry('q01', NOW + i))] });
  ok(!q4.ok && q4.reason === 'quota' && ls4.map.get(S.KEY) === JSON.stringify(base), '容量不足（捨てる控えも無い）→ quota・前の記録のまま');

  // removeItem が失敗：控えを消せないと知らせる。本体は変わらない
  const ls5 = memStorage(); ls5.map.set(S.KEY, JSON.stringify(base));
  const s5 = S.createStore(ls5, { now: () => NOW }); s5.load(); s5.snapshot(JSON.stringify(base), 'x');
  ls5.failRemove = true;
  const cr = s5.clearSnapshots();
  ok(!cr.ok && cr.failed.includes(S.SNAP_KEY) && s5.snapshots().length === 1 && ls5.map.get(S.KEY) === JSON.stringify(base), 'removeItem が失敗 → 消せなかったと返し、控えも本体もそのまま');

  // 置き換え中に読めない：置き換えない
  const ls6 = memStorage(); ls6.map.set(S.KEY, JSON.stringify(base));
  const s6 = S.createStore(ls6, { now: () => NOW }); const c6 = s6.load().state;
  ls6.failGet = 1;
  ok(s6.replace(c6, S.freshState(), '消去の前').reason === 'read' && JSON.parse(ls6.map.get(S.KEY)).log.length === base.log.length, '置き換えの前に今の記録を読めなければ、置き換えない');
}

// ================================================================ 4. 複数タブの競合
{
  const two = () => {
    const ls = memStorage(); ls.map.set(S.KEY, JSON.stringify({ ...S.freshState(), log: [entry('q01', NOW - 5000)] }));
    const A = S.createStore(ls, { now: () => NOW }), B = S.createStore(ls, { now: () => NOW + 10 });
    return { ls, A, B, a: A.load().state, b: B.load().state };
  };
  const apply = (st, r) => { if (r.merged) { for (const k of Object.keys(st)) if (!(k in r.merged)) delete st[k]; Object.assign(st, r.merged); } };

  // 同時保存：A が書いた直後に（A の記録を知らない）B が書いた → A は読み返しで気づき、合わせ直す
  {
    const { ls, A, B, a, b } = two();
    a.log.push(entry('q02', NOW)); b.log.push(entry('q03', NOW + 1));
    ls.onSet = () => { ls.map.set(S.KEY, JSON.stringify(b)); };   // A の書き込みの直後に B（古い記録＋q03）が上書き
    const r = A.save(a); apply(a, r);
    ok(r.ok && logOf(ls.map.get(S.KEY)).join() === ['q01@' + (NOW - 5000), 'q02@' + NOW, 'q03@' + (NOW + 1)].sort().join(), '2タブ同時保存：直後に上書きされても、読み返して合わせ直し、和集合を保存する');
    const rb = B.save(b); apply(b, rb);
    ok(rb.ok && b.log.length === 3 && JSON.parse(ls.map.get(S.KEY)).log.length === 3, 'もう片方のタブも和集合になる');
    // 同じ操作を繰り返しても増えない・行ったり来たりしない
    const sets = ls.sets;
    for (let i = 0; i < 5; i++) { apply(a, A.save(a)); apply(b, B.save(b)); }
    ok(JSON.parse(ls.map.get(S.KEY)).log.length === 3 && ls.sets === sets, '同じ保存を繰り返しても、記録は増えず、書き込みも起きない');
  }
  // 保存と復元（置き換え）の競合：A でバックアップに置き換え、B が古い記録を保存
  {
    const { ls, A, B, a, b } = two();
    b.log.push(entry('q03', NOW - 100));   // B が置き換えの前に解いた（保存前）
    const file = { ...S.freshState(), log: [entry('q05', NOW - 99999)] };
    const next = S.restoreState(a, file, 'replace', NOW);
    ok(A.replace(a, next, 'バックアップで置き換える前').ok, '置き換え');
    b.log.push(entry('q04', NOW + 100));    // 置き換えの後に B で解いた
    const rb = B.save(b); apply(b, rb);
    const got = logOf(ls.map.get(S.KEY));
    ok(got.includes(`q05@${NOW - 99999}`) && got.includes(`q04@${NOW + 100}`) && !got.includes(`q01@${NOW - 5000}`) && !got.includes(`q03@${NOW - 100}`), '保存と復元の競合：置き換えより前の古いタブの記録は持ち込まず、後に解いた記録は残す');
  }
  // 保存と全消去の競合
  {
    const { ls, A, B, a, b } = two();
    const wiped = { ...S.freshState(), resetAt: NOW };
    ok(A.replace(a, wiped, '消去の前').ok, '全消去');
    b.log.push(entry('q04', NOW + 50));
    apply(b, B.save(b));
    ok(logOf(ls.map.get(S.KEY)).join() === `q04@${NOW + 50}`, '保存と全消去の競合：消した記録は古いタブの保存でよみがえらない（消した後の記録は残る）');
  }
  // ログアウトして端末の記録を消す（resetAt を付けない＝サーバーには伝えない）と、別のタブの保存
  {
    const { ls, A, B, a, b } = two();
    const r = A.replace(a, S.freshState(), null, { fence: true });
    ok(r.ok && r.state.localResetAt === NOW && !('resetAt' in r.state), 'ログアウトして消す：この端末だけの印（localResetAt）を付ける');
    b.log.push(entry('q04', NOW + 50));
    apply(b, B.save(b));
    ok(logOf(ls.map.get(S.KEY)).join() === `q04@${NOW + 50}`, 'ログアウトと別タブ保存の競合：消した記録は古いタブから戻らない');
    // localResetAt はほかの端末・サーバーに持ち込まない
    const m = S.mergeState({ ...S.freshState(), log: [entry('q09', NOW - 9e6)] }, { ...S.freshState(), localResetAt: NOW, log: [] });
    ok(!('localResetAt' in m) && m.log.length === 1, 'localResetAt は同期の相手から持ち込まず、記録も落とさない');
  }
  // 別のタブで移行（新しい schema）した後に、古いタブが保存
  {
    const { ls, A, a } = two();
    const nraw = JSON.stringify({ ...JSON.parse(ls.map.get(S.KEY)), schema: 5 });
    ls.map.set(S.KEY, nraw);
    a.log.push(entry('q02', NOW));
    ok(A.save(a).reason === 'newer' && ls.map.get(S.KEY) === nraw, '別のタブで新しい schema に移行した記録を、古いタブが上書きしない');
  }
  // 読めない記録が別のタブで書かれていた：退避してから保存
  {
    const { ls, A, a } = two();
    ls.map.set(S.KEY, '{こわれ');
    a.log.push(entry('q02', NOW));
    const r = A.save(a);
    ok(r.ok && A.brokenKeys().length === 1 && JSON.parse(ls.map.get(A.brokenKeys()[0])).raw === '{こわれ', '別のタブが壊れた記録を書いていたら、退避してから保存する');
  }
  // 競合が収まらない（書くたびに別のタブが上書きする）→ 安全側に止める
  {
    const { ls, A, a } = two();
    a.log.push(entry('q02', NOW));
    let n = 0;
    const realSet = ls.setItem.bind(ls);
    ls.setItem = (k, v) => { realSet(k, v); if (k === S.KEY) ls.map.set(S.KEY, JSON.stringify({ ...S.freshState(), log: [entry('q0' + (5 + (n++ % 3)), NOW + n * 1000)] })); };
    const r = A.save(a);
    ok(!r.ok && r.reason === 'conflict' && a.log.length === 2, '競合が収まらなければ conflict で止め、画面の記録は残す');
  }
}

// ================================================================ 5. 移行の失敗と再試行・旧版からの移行
{
  const v1 = { schema: 1, log: clone(base.log), problems: clone(base.problems), pstat: clone(base.pstat), practice: { size: 10 } };
  const raw = JSON.stringify(v1);
  const ls = memStorage(); ls.map.set(S.KEY, raw);
  const saved = S.MIGRATIONS[1].up;
  S.MIGRATIONS[1].up = () => { throw new Error('テスト用の失敗'); };
  const st = S.createStore(ls, { now: () => NOW });
  const L = st.load();
  ok(L.status === 'migrate_failed' && st.blocked() === 'migrate', '移行の途中の例外 → 保存を止める');
  L.state.log.push(entry('q01', NOW));
  ok(st.save(L.state).reason === 'migrate' && ls.map.get(S.KEY) === raw, '移行に失敗した記録は上書きしない（元の記録のまま）');
  S.MIGRATIONS[1].up = saved;
  const st2 = S.createStore(ls, { now: () => NOW });
  const L2 = st2.load();
  ok(L2.status === 'migrated' && L2.state.schema === S.SCHEMA && L2.state.log.length === base.log.length, '直った版で再読み込みすると、もう一度移行できる（再試行）');
  ok(st2.save(L2.state).ok && JSON.parse(ls.map.get(S.KEY)).schema === S.SCHEMA, '移行した記録を保存できる');
  ok(st2.snapshots().some(x => JSON.parse(x.raw).schema === 1), '移行の前の記録（schema 1）が控えに残る');
}

console.log(`store_edge.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
