// 学習記録の保存・点検・バックアップ・移行（js/store.js）の単体テスト（v0.23）
//   node tests/store.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = await import('../js/store.js');
const { review } = await import('../js/scheduler.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
const NOW = Date.UTC(2026, 10, 23);
const ids = new Set([...base.log.map(l => l.p), ...Object.keys(base.pstat), ...Object.keys(base.problems)]);
const ctx = { problemIds: ids, cardIds: new Set(Object.keys(base.cards)), now: NOW };

// localStorage と同じ形の保存先。quota（容量の上限・文字数）、failSet（次の setItem を失敗させる）を設定できる
function memStorage({ quota = Infinity } = {}) {
  const m = new Map();
  const st = {
    failSet: 0, failGet: false, lie: false,
    getItem: (k) => { if (st.failGet) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => {
      if (st.failSet > 0) { st.failSet--; throw new Error('QuotaExceededError'); }
      const size = [...m].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0) + String(v).length;
      if (size > quota) throw new Error('QuotaExceededError');
      m.set(k, st.lie ? String(v).slice(0, 10) : String(v));
    },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    map: m,
  };
  return st;
}
const codes = (rep) => [...rep.errors, ...rep.warnings].map(x => x.code);

// ================================================================ 整合性の点検
{
  const rep = S.audit(clone(base), ctx);
  ok(rep.errors.length === 0, `正常な記録：エラー無し（${JSON.stringify(rep.errors)}）`);
  ok(rep.stats.log === base.log.length, '件数の集計');

  // 重複 ID（同じ問題・同じ時刻の解答）
  const d = clone(base); d.log.push(clone(d.log[0]));
  let r = S.audit(d, ctx);
  const dup = r.warnings.find(w => w.code === 'log_duplicate');
  ok(dup && dup.fix === 'auto' && dup.ids[0] === `${d.log[0].p}@${d.log[0].t}`, '重複した解答の記録を、問題IDと時刻つきで「自動で直せる」注意にする');
  // 存在しない問題・解法カードへの参照
  const o = clone(base); o.log.push({ p: 'Z-GONE-001', t: NOW - 1000, g: 3 }); o.pstat['Z-GONE-002'] = { S: 1, D: 5, last: NOW - 1, reps: 1, lapses: 0 };
  o.bookmarks = {}; o.bookmarks['Z-GONE-003'] = { on: true, t: NOW - 5 }; o.cards['zz-gone'] = { S: 1, D: 5, last: NOW, reps: 1, lapses: 0 };
  r = S.audit(o, ctx);
  ok(r.errors.length === 0 && ['log_unknown_problem', 'pstat_unknown_problem', 'bookmark_unknown_problem', 'card_unknown'].every(c => codes(r).includes(c)), '存在しない問題・解法カードへの参照は「注意」（記録は使える）');
  ok(r.warnings.find(w => w.code === 'log_unknown_problem').ids.includes('Z-GONE-001') && r.warnings.find(w => w.code === 'log_unknown_problem').fix === 'human', '消えた問題の記録は人が判断する（自動では消さない）');
  // 必須項目の欠落・型の不一致
  const m1 = clone(base); delete m1.log[3].t;
  r = S.audit(m1, ctx);
  ok(r.errors.some(e => e.code === 'bad_log'), '時刻の無い解答の記録はエラー');
  const m2 = clone(base); m2.pstat = [];
  ok(S.audit(m2, ctx).errors.some(e => e.code === 'bad_container' && e.key === 'pstat'), '復習状態が配列（型の不一致）はエラー');
  const m3 = clone(base); m3.log[0].t = String(m3.log[0].t);
  ok(S.structural(m3).length > 0, '時刻が文字列（型の不一致）は構造エラー');
  // 不正な値
  const v = clone(base); const k0 = Object.keys(v.pstat)[0]; v.pstat[k0].S = -1; v.log[1].g = 7; v.log[2].r = 9; v.bookmarks = {}; v.bookmarks.x = { on: 'yes', t: 1 };
  r = S.audit(v, ctx);
  ok(['pstat_invalid', 'log_bad_grade', 'log_bad_recall', 'bookmark_invalid'].every(c => r.errors.some(e => e.code === c)), '不正な値（S<0・g=7・r=9・on が文字列）はエラー');
  ok(r.errors.find(e => e.code === 'pstat_invalid').ids[0] === k0, 'エラーに対象の問題IDが入る');
  const lp = clone(base); lp.pstat[k0].lapses = lp.pstat[k0].reps + 1;
  ok(S.audit(lp, ctx).errors.some(e => e.code === 'pstat_invalid'), '失敗回数が復習回数より多いのはエラー（あり得ない状態）');
  // 不正なタイムスタンプ
  const t = clone(base); t.log[0].t = 1000; t.log[1].t = NOW + 30 * 86400000; t.resetAt = NOW + 9e9;
  r = S.audit(t, ctx);
  ok(r.errors.some(e => e.code === 'log_bad_time') && r.warnings.some(e => e.code === 'log_future') && r.warnings.some(e => e.code === 'reset_future'), '2020年より前の時刻はエラー、未来の時刻は注意');
  // 履歴の不整合
  const h = clone(base); const p0 = h.log[0].p; h.problems[p0] = { last: 1, n: 0 }; h.log.sort((x, y) => x.t - y.t); [h.log[0], h.log[5]] = [h.log[5], h.log[0]];
  r = S.audit(h, ctx);
  ok(r.warnings.some(w => w.code === 'problems_behind_log' && w.ids.includes(p0)) && r.warnings.some(w => w.code === 'log_unsorted'), '解いた回数が解答の記録より少ない・時刻順でない、を見つける');
  // 大きなデータでも速い
  const big = { ...clone(base), log: Array.from({ length: 100000 }, (_, i) => ({ p: `P${i % 3000}`, t: Date.UTC(2025, 0, 1) + i * 60000, g: 1 + (i % 4) })) };
  const t0 = Date.now(); S.audit(big, { problemIds: ids, now: NOW }); const ms = Date.now() - t0;
  ok(ms < 1500, `10万件の点検が速い（${ms}ms）`);
}

// ================================================================ 自動修復（削除しない）
{
  const d = clone(base);
  const first = clone(d.log[0]);
  d.log.push({ ...first, note: 'あとで書いた' }); d.log.reverse();
  d.problems[first.p] = { last: 1, n: 0 };
  d.log.push({ p: 'Z-GONE-001', t: NOW - 10, g: 3 });
  const { state, changes } = S.repair(d);
  ok(state.log.length === base.log.length + 1, '重複した解答の記録は1つにまとめ、ほかは消さない（存在しない問題の記録も残す）');
  ok(state.log.find(l => l.p === first.p && l.t === first.t).note === 'あとで書いた', 'まとめるとき、片方にしか無い項目は残す');
  ok(state.log.every((l, i) => !i || state.log[i - 1].t <= l.t), '時刻順に並べ直す');
  ok(state.problems[first.p].n >= base.log.filter(l => l.p === first.p).length, '解いた回数を記録の数まで引き上げる（下げない）');
  ok(changes.some(c => c.code === 'log_duplicate_merged') && changes.some(c => c.code === 'problems_raised'), '変更の記録が残る');
  ok(d.log.length === base.log.length + 2, '元のオブジェクトは変えない');
  ok(S.audit(state, ctx).warnings.every(w => w.fix !== 'auto'), '直したあとは「自動で直せる」注意が残らない');
  ok(S.repair(state).changes.length === 0, 'もう一度直しても何も変わらない');
}

// ================================================================ 保存
{
  // 通常の保存と読み込み
  const ls = memStorage();
  const a = S.createStore(ls, { now: () => NOW });
  let L = a.load();
  ok(L.status === 'new' && L.state.log.length === 0, '何も無ければ新しい記録');
  const st = { ...L.state, log: [{ p: 'q01', t: NOW, g: 3 }] };
  ok(a.save(st).ok && JSON.parse(ls.getItem(S.KEY)).log.length === 1, '通常の保存');
  // 保存に失敗：前の記録は残る
  const prev = ls.getItem(S.KEY);
  ls.failSet = 1;
  const r = a.save({ ...st, log: [...st.log, { p: 'q02', t: NOW + 1, g: 3 }] });
  ok(!r.ok && r.reason === 'quota' && ls.getItem(S.KEY) === prev, '保存に失敗しても、前に保存した記録はそのまま');
  ok(a.save({ ...st, log: [...st.log, { p: 'q02', t: NOW + 1, g: 3 }] }).ok, '失敗のあと、次の保存はできる');
  // 不正なデータは保存しない
  const prev2 = ls.getItem(S.KEY);
  const bad = a.save({ ...st, log: 'こわれた' });
  ok(!bad.ok && bad.reason === 'invalid' && ls.getItem(S.KEY) === prev2, '形の正しくない記録は保存せず、前の記録を残す');
  ok(!a.save({ ...st, log: [{ p: 'q01' }] }).ok, '時刻の無い解答の記録を含む記録は保存しない');
  // 書いたものを読み返して確かめる
  ls.lie = true;
  ok(a.save({ ...st }).reason === 'verify', '書いた内容を読み返して、違えば失敗として知らせる');
  ls.lie = false; ls.map.set(S.KEY, prev2);
  // 循環参照（JSON にできない）：保存しない
  const cyc = { ...st }; cyc.self = cyc;
  ok(a.save(cyc).reason === 'serialize' && ls.getItem(S.KEY) === prev2, 'JSON にできない記録は保存しない（途中で止まっても前の記録のまま）');

  // 別のタブ（同時の更新）：上書きせずに合わせる
  const ls2 = memStorage();
  const t1 = S.createStore(ls2, { now: () => NOW }), t2 = S.createStore(ls2, { now: () => NOW });
  const s1 = t1.load().state, s2 = t2.load().state;
  s1.log.push({ p: 'q01', t: NOW, g: 3 }); t1.save(s1);
  s2.log.push({ p: 'q02', t: NOW + 5, g: 4 });
  const r2 = t2.save(s2);
  const saved = JSON.parse(ls2.getItem(S.KEY));
  ok(r2.ok && r2.merged && saved.log.map(l => l.p).join() === 'q01,q02', '別のタブが先に保存していたら、両方の記録を合わせて保存する');
  s1.log.push({ p: 'q03', t: NOW + 9, g: 2 });
  const r3 = t1.save(s1);
  ok(r3.merged && JSON.parse(ls2.getItem(S.KEY)).log.length === 3, '逆のタブからも同じ（どちらの記録も失わない）');

  // 読めない記録：上書きせずに退避
  const ls3 = memStorage(); ls3.map.set(S.KEY, '{"log":[{"p":"q01","t":1700000000000,"g":3}], こわれた');
  const c = S.createStore(ls3, { now: () => NOW });
  L = c.load();
  ok(L.status === 'broken' && L.quarantined && c.brokenKeys().length === 1, '読めない記録は、別のキーに退避する');
  ok(JSON.parse(ls3.getItem(c.brokenKeys()[0])).raw.includes('こわれた'), '退避した中身は元の文字列そのまま');
  ok(c.save(L.state).ok && ls3.getItem(c.brokenKeys()[0]) !== null, '退避したあとは新しい記録を保存できる（退避分は残る）');
  // 退避もできない（容量いっぱい）：本体に書かない
  const ls4 = memStorage(); const raw4 = 'x'.repeat(50); ls4.map.set(S.KEY, raw4); ls4.failSet = 5;
  const c4 = S.createStore(ls4, { now: () => NOW });
  L = c4.load(); ls4.failSet = 0;
  ok(L.status === 'broken' && !L.quarantined && c4.save(L.state).reason === 'broken' && ls4.getItem(S.KEY) === raw4, '退避できなければ本体への保存を止め、元の記録を残す');
  // 一部だけ壊れた記録：壊れた部分だけ初期値、ほかは残す（元は退避）
  const part = clone(base); part.pstat = 'こわれた'; part.log.push({ p: 'q01' });
  const ls5 = memStorage(); ls5.map.set(S.KEY, JSON.stringify(part));
  const c5 = S.createStore(ls5, { now: () => NOW });
  L = c5.load();
  ok(L.status === 'salvaged' && L.state.log.length === base.log.length && Object.keys(L.state.pstat).length === 0 && c5.brokenKeys().length === 1, '一部だけ壊れた記録：解答の記録は残し、壊れた部分だけ初期値にして、元の記録は退避する');
  // 保存先そのものが使えない
  const ls6 = memStorage(); ls6.failGet = true;
  ok(S.createStore(ls6).load().status === 'unavailable', '保存先を読めない環境でも起動でき、「記録が無い」とは扱わない');
  // 置き換え（読み込み・消去）は控えを残し、失敗したら元のまま
  const ls7 = memStorage(); ls7.map.set(S.KEY, JSON.stringify(base));
  const c7 = S.createStore(ls7, { now: () => NOW });
  const cur = c7.load().state;
  ls7.failSet = 1;   // 控えの書き込みは成功させたい → 控え → 本体の順。1回目（控え）を失敗させると控え無しで進む
  let rr = c7.replace(cur, S.freshState(), '消去の前');
  ok(rr.ok && rr.snapshotted === false, '控えを残せないときは snapshotted:false を返す（アプリは書き出しファイルを作る）');
  ls7.map.set(S.KEY, JSON.stringify(base)); c7.load();
  ls7.failSet = 0;
  const realSet = ls7.setItem; let calls = 0;
  ls7.setItem = (k, v) => { if (k === S.KEY && calls++ === 0) throw new Error('IOError'); return realSet(k, v); };
  rr = c7.replace(cur, S.freshState(), '消去の前');
  ok(!rr.ok && JSON.parse(ls7.getItem(S.KEY)).log.length === base.log.length, '置き換えの保存に失敗したら、本体は元の記録のまま（ロールバック）');
  ls7.setItem = realSet;
  ok(c7.snapshots().length >= 1 && JSON.parse(c7.snapshots()[0].raw).log.length === base.log.length, '置き換えの前の記録が控えに残る');
  ok(c7.replace(cur, S.freshState(), null).snapshotted === false && c7.snapshots().length === 1, 'reason=null（共用端末でログアウトして消す）では控えを残さない');
  // 控えは最大 SNAP_MAX 件、容量が足りなければ古い控えから捨てる
  for (let i = 0; i < 4; i++) c7.snapshot(JSON.stringify({ ...base, i }), `r${i}`);
  ok(c7.snapshots().length === S.SNAP_MAX && c7.snapshots()[0].reason === 'r3', `控えは新しい順に ${S.SNAP_MAX} 件まで`);
  const ls8 = memStorage({ quota: JSON.stringify(base).length * 2 + 2000 });
  const c8 = S.createStore(ls8, { now: () => NOW });
  ls8.setItem(S.KEY, JSON.stringify(base));
  c8.snapshot(JSON.stringify(base), 'a'); c8.snapshot(JSON.stringify(base), 'b');
  ok(c8.snapshots().length === 1 && c8.snapshots()[0].reason === 'b' && ls8.getItem(S.KEY) !== null, '容量が足りなければ古い控えを捨て、本体は触らない');
}

// ================================================================ バックアップと復元
{
  const st = clone(base);
  const b = S.makeBackup(st, '0.23.0', NOW);
  ok(b.format === S.BACKUP_FORMAT && b.version === 1 && b.schema === 4 && b.app === '0.23.0' && b.createdAt && b.counts.log === base.log.length && /^fnv1a32:[0-9a-f]{8}$/.test(b.hash), 'バックアップに形式・版・schema・作成時刻・件数・確認用の値が入る');
  // ファイルを経由して読める
  const file = JSON.stringify(b, null, 1);
  const r = S.readBackup(JSON.parse(file), ctx);
  ok(S.stable(r.state.log) === S.stable(base.log) && S.stable(r.state.pstat) === S.stable(base.pstat) && S.stable(r.state.bookmarks || {}) === S.stable(base.bookmarks || {}), '書き出したファイルから、解答の記録・復習状態・ブックマークがそのまま戻る');
  // 旧形式（v0.22 までの書き出し＝記録そのもの）
  ok(S.readBackup(clone(base), ctx).meta.format === 0, '旧形式のバックアップも読める');
  // 不正・壊れたファイル
  const bad = (x, re, msg) => { let e = null; try { S.readBackup(x, ctx); } catch (er) { e = er; } ok(e && re.test(e.message), `${msg}（${e && e.message}）`); };
  bad(null, /ファイルではありません/, 'null は拒否');
  bad({ hello: 1 }, /ファイルではありません/, '別アプリのファイルは拒否');
  bad({ format: 'other', state: {} }, /ファイルではありません/, '別の形式は拒否');
  const tamper = JSON.parse(file); tamper.state.log[0].g = 1 + (tamper.state.log[0].g % 4);
  bad(tamper, /壊れているか/, '中身が書き換わった（確認用の値が合わない）ファイルは拒否');
  const cut = JSON.parse(file); cut.state.log = cut.state.log.slice(0, 3);
  bad(cut, /壊れているか/, '途中で切れたファイル（記録が欠けた）は拒否');
  bad({ ...JSON.parse(file), version: 2 }, /新しい版/, '新しい形式のバックアップは拒否');
  const newer = clone(base); newer.schema = 99;
  bad(newer, /新しい版/, '新しい schema の記録は拒否');
  const inv = clone(base); inv.log[0].g = 9;
  bad(inv, /正しくない値/, '正しくない値を含む記録は拒否（今の記録は変えない）');
  const shape = clone(base); shape.pstat = [];
  bad(shape, /形が正しくありません/, '形の正しくない記録は拒否');
  // 古い schema のバックアップ：移行して読む
  const v3 = clone(base); v3.schema = 3; v3.practice = { fields: ['I-01'], levels: [1, 2], size: 12 };
  const r3 = S.readBackup(v3, ctx);
  ok(r3.state.schema === 4 && r3.state.practice.size === 12 && r3.state.log.length === base.log.length && r3.applied.includes('schema 3→4'), '古い schema のバックアップは移行してから読む（記録は残る）');
  // 復元：置き換え・合わせる
  const cur = { ...S.freshState(), log: [{ p: 'q01', t: NOW, g: 3 }], settings: { theme: 'dark' }, settingsAt: 5 };
  const rep = S.restoreState(cur, r.state, 'replace', NOW);
  ok(rep.log.length === base.log.length && rep.settings.theme === 'dark' && rep.resetAt === NOW && S.audit(rep, ctx).errors.length === 0, '置き換え：ファイルの記録になり、設定は今のまま、消した印が付き、点検でエラーが無い');
  const mg = S.restoreState(cur, r.state, 'merge', NOW);
  ok(mg.log.length === base.log.length + 1 && cur.log.length === 1, '合わせる：両方の記録が残り、今の記録のオブジェクトは変えない');
  // 復元の全体（保存先つき）：控え → 保存 → 失敗ならロールバック
  const ls = memStorage(); ls.setItem(S.KEY, JSON.stringify(cur));
  const store = S.createStore(ls, { now: () => NOW });
  const loaded = store.load().state;
  const ok1 = store.replace(loaded, rep, 'バックアップで置き換える前');
  ok(ok1.ok && ok1.snapshotted && JSON.parse(ls.getItem(S.KEY)).log.length === base.log.length && JSON.parse(store.snapshots()[0].raw).log.length === 1, '復元の前の記録が控えに残り、復元した記録が保存される');
  ok(S.audit(JSON.parse(ls.getItem(S.KEY)), ctx).errors.length === 0, '復元後の保存された記録を点検してエラーが無い');
  // 控えから戻せる
  const back = S.readBackup(JSON.parse(store.snapshots()[0].raw), ctx);
  ok(store.replace(rep, S.restoreState(rep, back.state, 'replace', NOW + 1), '控えに戻す前').ok && JSON.parse(ls.getItem(S.KEY)).log.length === 1, '控えの時点に戻せる');
  // 大きい記録も往復できる（5000件超）
  const many = { ...clone(base), log: Array.from({ length: 12000 }, (_, i) => ({ p: [...ids][i % ids.size], t: Date.UTC(2025, 0, 1) + i * 60000, g: 1 + (i % 4) })) };
  const rm = S.readBackup(JSON.parse(JSON.stringify(S.makeBackup(many, 'x', NOW))), ctx);
  ok(rm.state.log.length === 12000, '1万2千件の記録も欠けずに往復する');
}

// ================================================================ 移行
{
  // 正常な旧版（schema 4・lv0 なし＝v0.5）
  const v5 = clone(base); delete v5.lv0; v5.practice = { fields: null, levels: [1, 2, 3, 4, 5], size: 8 };
  let m = S.migrate(v5);
  ok(m.state.practice.levels.join() === '0,1,2,3,4,5' && m.state.lv0 === 1 && m.applied.join() === 'lv0', 'v0.5 の記録：「基礎」を選択に足す');
  ok(!('lv0' in v5) && v5.practice.levels.length === 5, '元の記録は変えない');
  // 複数の版をまたぐ（schema 1 → 4）
  const v1 = { schema: 1, log: clone(base.log), problems: clone(base.problems), pstat: clone(base.pstat), practice: { fields: ['x'], levels: [9], size: 10 } };
  m = S.migrate(v1);
  ok(m.state.schema === 4 && m.applied.join() === 'schema 1→2,schema 2→3,schema 3→4,lv0' && m.state.practice.size === 10 && m.state.practice.levels.includes(0), 'schema 1 → 4 を順に移行する');
  ok(S.stable(m.state.log) === S.stable(base.log) && S.stable(m.state.pstat) === S.stable(base.pstat), '移行の前後で解答の記録・復習状態は同じ');
  // schema の無い記録（v0.1 相当）：schema 1 とみなす
  m = S.migrate({ log: clone(base.log), problems: {} });
  ok(m.state.schema === 4 && m.state.log.length === base.log.length && m.state.cards && m.state.bookmarks, 'schema の無い古い記録も読み、足りない項目を補う（不完全なデータ）');
  // もう一度移行しても変わらない（二重の移行を防ぐ）
  const again = S.migrate(m.state);
  ok(again.applied.length === 0 && S.stable(again.state) === S.stable(m.state), 'もう一度移行しても何も変わらない');
  // 新しい版の記録：形を変えない
  const nw = { ...clone(base), schema: 7, future: { x: 1 } };
  m = S.migrate(nw);
  ok(m.newer && m.state.schema === 7 && m.state.future.x === 1, '新しい版の記録は移行せず、知らない項目も残す');
  // 移行の失敗：例外を投げ、元の記録は保存先にそのまま
  const saved = S.MIGRATIONS[2].up;
  S.MIGRATIONS[2].up = () => { throw new Error('テスト用の失敗'); };
  let e = null; try { S.migrate(clone(v1)); } catch (er) { e = er; }
  ok(e && /テスト用の失敗/.test(e.message), '移行の途中の失敗は例外になる');
  const ls = memStorage(); const raw = JSON.stringify(v1); ls.setItem(S.KEY, raw);
  const st = S.createStore(ls, { now: () => NOW });
  const L = st.load();
  ok(L.status === 'migrate_failed' && L.quarantined && ls.getItem(S.KEY) === raw && JSON.parse(ls.getItem(st.brokenKeys()[0])).raw === raw, '移行に失敗しても、元の記録は本体にそのまま・退避もする');
  ok(L.state.log.length === base.log.length, '移行に失敗しても、解答の記録はそのまま使える');
  S.MIGRATIONS[2].up = saved;
  // 移行の前に控えを残す
  const ls2 = memStorage(); ls2.setItem(S.KEY, JSON.stringify(v1));
  const st2 = S.createStore(ls2, { now: () => NOW });
  const L2 = st2.load();
  ok(L2.status === 'migrated' && st2.snapshots().length === 1 && /移行の前/.test(st2.snapshots()[0].reason) && JSON.parse(st2.snapshots()[0].raw).schema === 1, '移行の前の記録を控えに残す');
  st2.save(L2.state);
  ok(S.createStore(ls2).load().status === 'ok' && st2.snapshots().length === 1, '一度移行して保存したら、次の起動では移行しない（控えも増えない）');
  // 実際の v0.6 の記録（fixture）は移行なしで読める
  const ls3 = memStorage(); ls3.setItem(S.KEY, JSON.stringify(base));
  const L3 = S.createStore(ls3).load();
  ok(L3.status === 'ok' && S.stable(L3.state.log) === S.stable(base.log), 'v0.6 の実際の記録はそのまま読める');
}

// ================================================================ 復習状態の合わせ方（review の再計算が scheduler と一致）
{
  const c0 = review(null, 3, Date.UTC(2026, 0, 1));
  const a = review(c0, 2, Date.UTC(2026, 0, 5)), b = review(c0, 1, Date.UTC(2026, 0, 6));
  const log = [{ p: 'x', t: Date.UTC(2026, 0, 1), g: 3 }, { p: 'x', t: Date.UTC(2026, 0, 5), g: 2 }, { p: 'x', t: Date.UTC(2026, 0, 6), g: 1 }];
  const m = S.mergePstat({ x: a }, { x: b }, log);
  ok(m.x.reps === 3 && m.x.lapses === 1 && m.x.last === Date.UTC(2026, 0, 6), '別々の復習を両方数える');
  ok(S.stable(S.mergePstat({ x: a }, { x: b }, log.slice(0, 2))) === S.stable({ x: b }), '記録が足りなければ（切り捨てられた等）、今まで通り新しい方');
  // 同期していない端末が初めて解いた（reps 1）：前の端末の5回分を残して計算し直す（v0.26）
  let five = null; const flog = [];
  for (let i = 0; i < 5; i++) { const t = Date.UTC(2026, 1, 1 + i); five = review(five, 3, t); flog.push({ p: 'y', t, g: 3 }); }
  const fresh = review(null, 1, Date.UTC(2026, 2, 1)); flog.push({ p: 'y', t: Date.UTC(2026, 2, 1), g: 1 });
  const fm = S.mergePstat({ y: five }, { y: fresh }, flog), fm2 = S.mergePstat({ y: fresh }, { y: five }, flog);
  ok(fm.y.reps === 6 && fm.y.lapses === 1 && S.stable(fm) === S.stable(fm2), '同期していない端末が初めて解いても、前の端末の復習回数を消さない（どちらから合わせても同じ）');
  ok(S.stable(S.mergePstat(fm, { y: fresh }, flog)) === S.stable(fm) && S.stable(S.mergePstat(fm, { y: five }, flog)) === S.stable(fm), 'その結果をもう一度合わせても変わらない');
}

console.log(`store.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
