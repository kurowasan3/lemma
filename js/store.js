// 学習記録の保存・読み込み・移行・点検・バックアップ（v0.23）
//   画面には触らない（Node でもテストできるように、保存先 storage を引数で受け取る）。
//   方針：学習記録（解答の記録・復習状態・ブックマーク・メモ）を失わないこと。
//     ・読めない記録で上書きしない（読めなければ別のキーに退避してから、新しい記録で始める）
//     ・保存に失敗したら、前に保存できていた記録をそのまま残す（localStorage.setItem は失敗すると前の値のまま）
//     ・別のタブが先に保存していたら、上書きせずに合わせてから保存する
//     ・移行・読み込み（置き換え）・全消去の前に、端末の中に控えを残す
import { review } from './scheduler.js';

export const FILE_VERSION = '0.23.0';
export const KEY = 'lemma.v2';                  // 学習記録の本体
export const SNAP_KEY = 'lemma.snap.v1';        // 自動で残す控え（最大 SNAP_MAX 件。同期しない）
export const BROKEN_PREFIX = 'lemma.v2.broken.'; // 読めなかった記録の退避先（キー名に時刻）
export const SCHEMA = 4;                        // 記録の形の版（変えるときは MIGRATIONS に足す）
export const MIN_SCHEMA = 1;                    // 読み込める最も古い版（v0.1 の記録）
export const SNAP_MAX = 2;
export const BACKUP_FORMAT = 'lemma-backup';
export const BACKUP_VERSION = 1;

export function freshState() {
  return {
    cards: {}, problems: {}, pstat: {}, log: [], explains: {}, bookmarks: {},
    settings: { size: 6, newPerDay: 3 },
    practice: { fields: null, levels: [0, 1, 2, 3, 4, 5], size: 8 }, lv0: 1,
    schema: SCHEMA,
    newIntroduced: null, streak: { last: null, count: 0 },
    graphExprs: null, graphCExprs: null, graphVExprs: null,
  };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const CONTAINERS = { log: 'array', problems: 'object', pstat: 'object', cards: 'object', explains: 'object', bookmarks: 'object' };

// ---------------------------------------------------------------- 構造の確認（安い。保存のたびに使う）
// 戻り値：致命的な問題の一覧（空なら、アプリが読み書きしてよい形）
export function structural(st) {
  if (!isObj(st)) return [{ code: 'not_object', msg: '記録がオブジェクトではありません' }];
  const out = [];
  for (const [k, t] of Object.entries(CONTAINERS)) {
    if (!(k in st)) continue;
    const ok = t === 'array' ? Array.isArray(st[k]) : isObj(st[k]);
    if (!ok) out.push({ code: 'bad_container', key: k, msg: `${k} の形が正しくありません（${t} のはず）` });
  }
  if (Array.isArray(st.log) && !st.log.every(l => isObj(l) && typeof l.p === 'string' && fin(l.t))) {
    out.push({ code: 'bad_log', key: 'log', msg: '解答の記録に、問題IDか時刻の無いものがあります' });
  }
  if ('schema' in st && !(Number.isInteger(st.schema) && st.schema >= 1)) out.push({ code: 'bad_schema', key: 'schema', msg: 'schema が整数ではありません' });
  return out;
}

// ---------------------------------------------------------------- 移行（schema の版ごと）
// 各手順は「受け取った記録のコピー」を返す純関数。何度実行しても同じ結果になる（冪等）。
//   up: schema が from の記録を from+1 にする。
//   patches: schema は変えない正規化（旧版で足した項目）。判定 need が真のときだけ動く。
export const MIGRATIONS = [
  // v0.1〜0.3（schema 1〜3）：難易度の段階と分野が変わったので、演習の「選択」だけ初期化（記録は残す）
  { from: 1, up: (s) => ({ ...s, practice: legacyPractice(s), schema: 2 }) },
  { from: 2, up: (s) => ({ ...s, practice: legacyPractice(s), schema: 3 }) },
  { from: 3, up: (s) => ({ ...s, practice: legacyPractice(s), schema: 4 }) },
];
function legacyPractice(s) {
  return { fields: null, levels: [0, 1, 2, 3, 4, 5], size: (isObj(s.practice) && Number.isInteger(s.practice.size) && s.practice.size) || 8 };
}
export const PATCHES = [
  // v0.6 で「基礎」(0) を追加：全段階を選んでいた人は基礎も含める
  { id: 'lv0', need: (s) => !s.lv0, run: (s) => {
    const o = { ...s, lv0: 1 };
    const lv = isObj(s.practice) && Array.isArray(s.practice.levels) ? s.practice.levels : null;
    if (lv && [1, 2, 3, 4, 5].every(k => lv.includes(k)) && !lv.includes(0)) o.practice = { ...s.practice, levels: [0, ...lv] };
    return o;
  } },
];

// 戻り値：{ state, from, applied: [説明], newer: bool }。失敗すると例外（元の記録は触らない）
export function migrate(input) {
  if (!isObj(input)) throw new Error('記録がオブジェクトではありません');
  const from = Number.isInteger(input.schema) ? input.schema : MIN_SCHEMA;
  if (from > SCHEMA) return { state: { ...freshState(), ...input }, from, applied: [], newer: true };   // 新しい版の記録：形を変えない
  if (from < MIN_SCHEMA) throw new Error(`schema ${from} の記録は読み込めません`);
  let s = JSON.parse(JSON.stringify(input));   // 元の記録は変えない
  const applied = [];
  for (let v = from; v < SCHEMA; v++) {
    const m = MIGRATIONS.find(x => x.from === v);
    if (!m) throw new Error(`schema ${v} から ${v + 1} への移行がありません`);
    s = m.up(s);
    if (s.schema !== v + 1) throw new Error(`schema ${v} の移行のあとの版が ${s.schema} です`);
    applied.push(`schema ${v}→${v + 1}`);
  }
  for (const p of PATCHES) if (p.need(s)) { s = p.run(s); applied.push(p.id); }
  s = { ...freshState(), ...s, schema: SCHEMA };
  const bad = structural(s);
  if (bad.length) throw new Error(`移行のあとの記録が正しくありません：${bad.map(b => b.msg).join('／')}`);
  return { state: s, from, applied, newer: false };
}

// ---------------------------------------------------------------- 整合性の点検（詳しい。読み込み・復元・CLI で使う）
// ctx: { problemIds?: Set, cardIds?: Set, now?: number }（ID の一覧を渡すと、存在しない問題への参照も調べる）
// 戻り値：{ errors: [], warnings: [], stats }。各項目 { code, msg, ids: [...], fix: 'auto'|'human' }
//   errors   … アプリが記録を正しく扱えない値（復元では受け付けない）
//   warnings … 使えるが不自然なもの（ID が今のデータに無い・未来の時刻・重複など）
//   fix:auto … repair() が安全に直せる（削除はしない。重複の統合・並べ替え・回数の引き上げだけ）
//   fix:human… 人が判断する（消えた問題の記録を残すか、など。自動では触らない）
const T_MIN = Date.UTC(2020, 0, 1);
export function audit(st, ctx = {}) {
  const now = ctx.now || Date.now();
  const errors = [], warnings = [];
  const add = (list, code, msg, ids, fix = 'human') => { if (ids.length) list.push({ code, msg, ids: ids.slice(0, 50), count: ids.length, fix }); };
  const fatal = structural(st);
  if (fatal.length) return { errors: fatal.map(f => ({ ...f, ids: [f.key || ''], count: 1, fix: 'human' })), warnings, stats: {} };
  const log = st.log || [], pids = ctx.problemIds, cids = ctx.cardIds;
  const badT = [], future = [], badG = [], badR = [], badK = [], unknownP = new Set(), dups = [];
  const seen = new Map(), countBy = {}, lastBy = {};
  let unsorted = 0;
  for (let i = 0; i < log.length; i++) {
    const l = log[i], id = `${l.p}@${l.t}`;
    if (l.t < T_MIN) badT.push(id); else if (l.t > now + 86400000) future.push(id);
    if (l.g !== undefined && ![1, 2, 3, 4].includes(l.g)) badG.push(id);
    if (l.r !== undefined && ![1, 2, 3].includes(l.r)) badR.push(id);
    if (l.k !== undefined && l.k !== 't') badK.push(id);
    if (pids && !pids.has(l.p)) unknownP.add(l.p);
    const key = `${l.p}|${l.t}`;
    if (seen.has(key)) dups.push(id); else seen.set(key, i);
    if (i && log[i - 1].t > l.t) unsorted++;
    countBy[l.p] = (countBy[l.p] || 0) + 1;
    lastBy[l.p] = Math.max(lastBy[l.p] || 0, l.t);
  }
  add(errors, 'log_bad_time', '解答の記録の時刻が 2020年より前です', badT);
  add(errors, 'log_bad_grade', '解答の記録の評価 g が 1〜4 ではありません', badG);
  add(errors, 'log_bad_recall', '解法の想起 r が 1〜3 ではありません', badR);
  add(warnings, 'log_bad_kind', '解答の記録の種類 k が不明です', badK);
  add(warnings, 'log_future', '解答の記録の時刻が未来です（端末の時計のずれの可能性）', future);
  add(warnings, 'log_duplicate', '同じ問題・同じ時刻の解答の記録が重複しています', dups, 'auto');
  if (unsorted) add(warnings, 'log_unsorted', '解答の記録が時刻順に並んでいません', [`${unsorted}か所`], 'auto');
  add(warnings, 'log_unknown_problem', '今の問題データに無い問題IDの記録があります（削除・改名された問題）', [...unknownP]);

  const badS = [], unknownS = [], noLog = [];
  for (const [k, v] of Object.entries(st.pstat || {})) {
    if (!isObj(v) || !(fin(v.S) && v.S > 0) || !(fin(v.D) && v.D >= 1 && v.D <= 10) || !fin(v.last) || !(Number.isInteger(v.reps) && v.reps >= 0) || !(Number.isInteger(v.lapses) && v.lapses >= 0 && v.lapses <= v.reps)) badS.push(k);
    else if (v.last > now + 86400000) future.push(`pstat:${k}`);
    if (pids && !pids.has(k)) unknownS.push(k);
    if (!countBy[k]) noLog.push(k);
  }
  add(errors, 'pstat_invalid', '復習状態（S・D・last・reps・lapses）の値が正しくありません', badS);
  add(warnings, 'pstat_unknown_problem', '今の問題データに無い問題IDの復習状態があります', unknownS);

  const badC = [], unknownC = [];
  for (const [k, v] of Object.entries(st.cards || {})) {
    if (!isObj(v) || !(fin(v.S) && v.S > 0) || !fin(v.last) || !Number.isInteger(v.reps)) badC.push(k);
    if (cids && !cids.has(k)) unknownC.push(k);
  }
  add(errors, 'card_invalid', '解法カードの復習状態の値が正しくありません', badC);
  add(warnings, 'card_unknown', '今のデータに無い解法カードIDの復習状態があります', unknownC);

  const badP = [], lowN = [];
  for (const [k, v] of Object.entries(st.problems || {})) {
    if (!isObj(v) || !fin(v.last) || !(Number.isInteger(v.n) && v.n >= 0)) { badP.push(k); continue; }
    if ((countBy[k] || 0) > v.n || (lastBy[k] || 0) > v.last) lowN.push(k);
  }
  for (const k of Object.keys(countBy)) if (!(st.problems || {})[k]) lowN.push(k);
  add(errors, 'problems_invalid', '解いた問題の回数・時刻の値が正しくありません', badP);
  add(warnings, 'problems_behind_log', '解いた問題の回数・最終時刻が、解答の記録より少ない／古い', lowN, 'auto');

  const badB = [], unknownB = [];
  for (const [k, v] of Object.entries(st.bookmarks || {})) {
    if (!isObj(v) || typeof v.on !== 'boolean' || !fin(v.t)) badB.push(k);
    if (pids && !pids.has(k)) unknownB.push(k);
  }
  add(errors, 'bookmark_invalid', 'ブックマークの値が正しくありません', badB);
  add(warnings, 'bookmark_unknown_problem', '今の問題データに無い問題のブックマークがあります', unknownB);

  const badE = [];
  for (const [k, v] of Object.entries(st.explains || {})) if (!Array.isArray(v) || !v.every(e => isObj(e) && fin(e.t) && typeof e.text === 'string')) badE.push(k);
  add(errors, 'explain_invalid', '気づきのメモの形が正しくありません', badE);

  if ('resetAt' in st && !fin(st.resetAt)) add(errors, 'reset_invalid', '消した印 resetAt が数値ではありません', ['resetAt']);
  else if (fin(st.resetAt) && st.resetAt > now + 86400000) add(warnings, 'reset_future', '消した印 resetAt が未来です（同期で記録が持ち込まれなくなります）', ['resetAt']);
  if ('settingsAt' in st && st.settingsAt !== undefined && !fin(st.settingsAt)) add(errors, 'settingsat_invalid', 'settingsAt が数値ではありません', ['settingsAt']);
  if (st.streak && st.streak.last && !/^\d{4}-\d{2}-\d{2}$/.test(st.streak.last)) add(warnings, 'streak_invalid', '連続日数の日付の形が正しくありません', [String(st.streak.last)]);
  if (Number.isInteger(st.schema) && st.schema > SCHEMA) add(warnings, 'schema_newer', `新しい版（schema ${st.schema}）の記録です。このアプリは schema ${SCHEMA} まで`, [String(st.schema)]);
  return { errors, warnings, stats: { log: log.length, pstat: Object.keys(st.pstat || {}).length, problems: Object.keys(st.problems || {}).length, bookmarks: Object.keys(st.bookmarks || {}).length, cards: Object.keys(st.cards || {}).length, pstatWithoutLog: noLog.length } };
}

// 安全な自動修復だけ（削除しない）：重複した解答の記録の統合・時刻順の並べ替え・解いた回数の引き上げ。
// 戻り値：{ state（新しいオブジェクト）, changes: [{ code, ids }] }
export function repair(st) {
  const s = JSON.parse(JSON.stringify(st));
  const changes = [];
  const m = new Map(), dup = [];
  for (const l of s.log || []) {
    const k = `${l.p}|${l.t}`, o = m.get(k);
    if (!o) { m.set(k, l); continue; }
    dup.push(`${l.p}@${l.t}`);
    for (const [kk, v] of Object.entries(l)) if (!(kk in o)) o[kk] = v;   // 項目は足すだけ（どちらの値も消さない）
  }
  if (dup.length) changes.push({ code: 'log_duplicate_merged', ids: dup });
  const orig = s.log || [];
  const sorted = [...m.values()].sort((a, b) => a.t - b.t);
  if (!dup.length && sorted.some((l, i) => l !== orig[i])) changes.push({ code: 'log_sorted', ids: [] });
  s.log = sorted;
  const count = {}, last = {};
  for (const l of s.log || []) { count[l.p] = (count[l.p] || 0) + 1; last[l.p] = Math.max(last[l.p] || 0, l.t); }
  const raised = [];
  s.problems = s.problems || {};
  for (const k of Object.keys(count)) {
    const p = s.problems[k];
    if (p && !(isObj(p) && fin(p.last) && Number.isInteger(p.n))) continue;   // 形の壊れた値は人が見る
    const n = Math.max(p ? p.n : 0, count[k]), t = Math.max(p ? p.last : 0, last[k]);
    if (!p || p.n !== n || p.last !== t) { s.problems[k] = { ...(p || {}), last: t, n }; raised.push(k); }
  }
  if (raised.length) changes.push({ code: 'problems_raised', ids: raised });
  return { state: s, changes };
}

// ---------------------------------------------------------------- バックアップ（書き出すファイル）
// 含むもの：解答の記録・復習状態・解いた問題・解法カード・ブックマーク・メモ・計算の自己ベスト・連続日数・設定・グラフの式
// 含まないもの：ログイン情報（lemma.auth）・中断した演習（lemma.session.v1）・自動の控え（lemma.snap.v1）
export function hash(text) {   // FNV-1a 32bit（壊れていないかの確認用。改ざん防止ではない）
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export function counts(st) {
  return { log: (st.log || []).length, pstat: Object.keys(st.pstat || {}).length, problems: Object.keys(st.problems || {}).length,
    cards: Object.keys(st.cards || {}).length, bookmarks: Object.values(st.bookmarks || {}).filter(b => b && b.on).length,
    explains: Object.values(st.explains || {}).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0) };
}
export function makeBackup(st, app, now = Date.now()) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app, schema: st.schema || SCHEMA, createdAt: new Date(now).toISOString(),
    counts: counts(st), hash: `fnv1a32:${hash(stable(st))}`, state: st };
}

// ファイルの中身（JSON.parse 済み）→ { state（移行済み）, meta, report, applied }。受け付けられなければ例外（理由つき）
//   旧形式（v0.22 までの書き出し＝記録そのもの）も読める。
export function readBackup(d, ctx = {}) {
  if (!isObj(d)) throw new Error('Lemma の学習記録のファイルではありません');
  let st, meta;
  if (d.format === BACKUP_FORMAT) {
    if (!Number.isInteger(d.version) || d.version > BACKUP_VERSION) throw new Error(`新しい版のアプリで作ったバックアップです（形式 ${d.version}）。アプリを更新してから読み込んでください`);
    if (!isObj(d.state)) throw new Error('バックアップに記録が入っていません');
    if (typeof d.hash === 'string' && d.hash !== `fnv1a32:${hash(stable(d.state))}`) throw new Error('バックアップの中身が壊れているか、書き換えられています（確認用の値が合いません）');
    st = d.state;
    meta = { format: d.version, app: d.app || '', createdAt: d.createdAt || '', schema: st.schema };
  } else {
    if (d.format) throw new Error('Lemma の学習記録のファイルではありません');
    st = d;
    meta = { format: 0, app: '', createdAt: '', schema: st.schema };
  }
  if (!Array.isArray(st.log) || !isObj(st.problems)) throw new Error('Lemma の学習記録のファイルではありません');
  if (st.log.length > 200000) throw new Error('記録が多すぎるファイルです');
  const bad = structural(st);
  if (bad.length) throw new Error(`記録の形が正しくありません：${bad.map(b => b.msg).join('／')}`);
  if (Number.isInteger(st.schema) && st.schema > SCHEMA) throw new Error(`新しい版のアプリの記録です（schema ${st.schema}）。アプリを更新してから読み込んでください`);
  const { state, applied } = migrate(st);
  delete state.settingsAt; delete state.resetAt;   // 読み込む側の時刻で決める
  const report = audit(state, ctx);
  if (report.errors.length) {
    const e = new Error(`記録に正しくない値があります：${report.errors.map(x => `${x.msg}（${x.ids.slice(0, 3).join(', ')}${x.count > 3 ? ' ほか' : ''}）`).join('／')}`);
    e.report = report; throw e;
  }
  return { state, meta, report, applied };
}

// 読み込み後の記録を作る（純関数）。mode: 'merge'（今の記録と合わせる）| 'replace'（置き換える）
//   設定（settings・practice・settingsAt）は今のものを残す。置き換えでは「消した印」を付けて、同期で古い記録が戻らないようにする。
export function restoreState(current, incoming, mode, now = Date.now()) {
  const keep = { settings: current.settings, practice: current.practice, settingsAt: current.settingsAt };
  if (mode === 'merge') return mergeState(JSON.parse(JSON.stringify(current)), { ...incoming, resetAt: current.resetAt });
  if (mode === 'replace') return { ...freshState(), ...incoming, ...keep, schema: SCHEMA, resetAt: now };
  throw new Error(`mode ${mode}`);
}

// ---------------------------------------------------------------- 保存先（localStorage と同じ形の storage を受け取る）
export function createStore(storage, { now = () => Date.now(), app = '' } = {}) {
  let lastRaw = null;     // 最後に読んだ・書いた本体の文字列（別のタブの書き込みに気づくため）
  let blocked = null;     // 本体に書いてはいけない理由（読めない記録を退避できなかったとき）

  const get = (k) => { try { return storage.getItem(k); } catch { return null; } };

  // 読めなかった記録を別のキーに移す（消さない）。成功したら true
  function quarantine(raw, reason) {
    try { storage.setItem(BROKEN_PREFIX + now(), JSON.stringify({ reason, at: now(), app, raw })); return true; } catch { return false; }
  }

  // 自動の控え：新しい順に SNAP_MAX 件。入らなければ古い控えから捨てる（本体は触らない）
  function snapshots() {
    try { const a = JSON.parse(get(SNAP_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => isObj(x) && typeof x.raw === 'string') : []; } catch { return []; }
  }
  function snapshot(raw, reason) {
    if (typeof raw !== 'string') raw = JSON.stringify(raw);
    let n = 0; try { n = (JSON.parse(raw).log || []).length; } catch { /* 数えられないだけ */ }
    let list = [{ at: now(), reason, app, n, raw }, ...snapshots()].slice(0, SNAP_MAX);
    while (list.length) {
      try { storage.setItem(SNAP_KEY, JSON.stringify(list)); return true; } catch { list = list.slice(0, -1); }
    }
    try { storage.removeItem(SNAP_KEY); } catch { /* なし */ }
    return false;
  }

  // 戻り値：{ state, status, issues, applied }
  //   status: 'new' | 'ok' | 'migrated' | 'newer' | 'salvaged' | 'broken'
  function load() {
    const raw = get(KEY);
    if (raw === null) { lastRaw = null; return { state: freshState(), status: 'new', issues: [], applied: [] }; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    if (!isObj(parsed)) {
      const q = quarantine(raw, 'JSON として読めない');
      if (!q) blocked = 'broken';
      lastRaw = raw;
      return { state: freshState(), status: 'broken', issues: [{ code: 'unreadable', msg: '保存されていた記録を読めませんでした' }], applied: [], quarantined: q };
    }
    let issues = structural(parsed);
    if (issues.length) {
      // 形の壊れた部分だけを初期値に戻し、ほかの記録は残す。元の記録は先に退避する
      const q = quarantine(raw, issues.map(i => i.msg).join('／'));
      if (!q) blocked = 'broken';
      const s = { ...parsed };
      for (const [k, t] of Object.entries(CONTAINERS)) if (k in s && !(t === 'array' ? Array.isArray(s[k]) : isObj(s[k]))) s[k] = freshState()[k];
      if (Array.isArray(s.log)) s.log = s.log.filter(l => isObj(l) && typeof l.p === 'string' && fin(l.t));
      if (!(Number.isInteger(s.schema) && s.schema >= 1)) s.schema = SCHEMA;
      parsed = s;
      lastRaw = raw;
      try { const m = migrate(parsed); return { state: m.state, status: 'salvaged', issues, applied: m.applied, quarantined: q }; }
      catch (e) { return { state: { ...freshState(), ...parsed }, status: 'salvaged', issues: [...issues, { code: 'migrate_failed', msg: e.message }], applied: [], quarantined: q }; }
    }
    lastRaw = raw;
    let m;
    try { m = migrate(parsed); }
    catch (e) {
      // 移行に失敗：元の記録は本体にそのまま残っている。退避してから、移行前の形のまま使う（保存すると本体が変わるため）
      const q = quarantine(raw, `移行に失敗：${e.message}`);
      if (!q) blocked = 'migrate';
      return { state: { ...freshState(), ...parsed }, status: 'broken', issues: [{ code: 'migrate_failed', msg: e.message }], applied: [], quarantined: q };
    }
    if (m.newer) return { state: m.state, status: 'newer', issues: [], applied: [] };
    const changed = m.applied.length > 0;
    if (changed) snapshot(raw, `移行の前（${m.applied.join('・')}）`);
    return { state: m.state, status: changed ? 'migrated' : 'ok', issues: [], applied: m.applied };
  }

  // 保存。戻り値：{ ok, reason?, merged? }
  //   merged：別のタブ（同じ端末の別の画面）が先に保存していたので、合わせた結果（呼び出し側が手元の記録に反映する）
  function save(state) {
    if (blocked) return { ok: false, reason: 'blocked' };
    const bad = structural(state);
    if (bad.length) return { ok: false, reason: 'invalid', issues: bad };
    let merged = null;
    const cur = get(KEY);
    if (cur !== null && cur !== lastRaw) {   // lastRaw が null＝読み込んだときは何も無かった
      let other = null;
      try { other = JSON.parse(cur); } catch { /* 読めない：下で上書きしない */ }
      if (!isObj(other) || structural(other).length) {
        if (!quarantine(cur, '別の画面が保存した記録を読めない')) return { ok: false, reason: 'blocked' };
      } else if (!(Number.isInteger(other.schema) && other.schema > SCHEMA)) {
        merged = mergeState(state, other);
        state = merged;
      } else return { ok: false, reason: 'newer' };   // 新しい版のアプリが別の画面で動いている：上書きしない
    }
    let json;
    try { json = JSON.stringify(state); } catch (e) { return { ok: false, reason: 'serialize' }; }
    try { storage.setItem(KEY, json); }
    catch (e) { return { ok: false, reason: 'quota', merged }; }    // 前の値のまま残る
    const back = get(KEY);
    if (back === null || back.length !== json.length) return { ok: false, reason: 'verify', merged };
    lastRaw = json;
    return { ok: true, merged };
  }

  // 本体を、検証済みの新しい記録に置き換える（読み込み・控えへの復帰・全消去で使う）。
  //   先に今の記録の控えを残す（残せなければ、呼び出し側が書き出しファイルを作れるよう snapshotted:false を返す）。
  //   保存に失敗したら本体は前のまま（ロールバック）。
  function replace(current, next, reason) {
    const bad = structural(next);
    if (bad.length) return { ok: false, reason: 'invalid', issues: bad };
    const cur = get(KEY);
    // reason が null のときは控えを残さない（共用の端末で、ログアウトして消すとき。記録はサーバーにある）
    const snapshotted = reason === null ? false : snapshot(cur !== null ? cur : JSON.stringify(current), reason);
    lastRaw = cur;   // 別のタブの記録と合わせ直さない（置き換えは意図した操作）
    const r = save(next);
    if (!r.ok) {
      try { if (cur !== null && get(KEY) !== cur) storage.setItem(KEY, cur); } catch { /* 本体は前の値のまま */ }
      return { ...r, snapshotted };
    }
    return { ok: true, snapshotted };
  }

  function brokenKeys() {
    const out = [];
    try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(BROKEN_PREFIX)) out.push(k); } } catch { /* なし */ }
    return out.sort();
  }

  return { load, save, replace, snapshot, snapshots, brokenKeys, blocked: () => blocked, get };
}

// ---------------------------------------------------------------- 記録の合わせ方（端末どうしで食い違ったとき）
// 設定のように「最後に変えた方」を採るもの
export const LWW_KEYS = ['settings', 'practice', 'graphExprs', 'graph3Exprs', 'graphCExprs', 'graphVExprs'];
const entryKey = (l) => `${l.p}|${l.t}`;
const nkeys = (o) => Object.keys(o || {}).length;

// 記録を消した印（resetAt）：「すべて消す」「バックアップで置き換える」をした時刻（ms）。
//   印の新しい側は、その時刻より前の記録も含めて全部が正しい。印の古い側（まだ消したことを知らない端末・サーバー）からは、
//   その時刻より前の記録を持ち込まない（持ち込むと消した記録がよみがえる）。
function dropBefore(S, at) {
  const keep = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v && (v.last || v.t || 0) >= at));
  const day = new Date(at); day.setHours(0, 0, 0, 0);
  const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return {
    ...S,
    log: (S.log || []).filter(l => l.t >= at),
    pstat: keep(S.pstat), cards: keep(S.cards), problems: keep(S.problems), bookmarks: keep(S.bookmarks),
    explains: Object.fromEntries(Object.entries(S.explains || {}).map(([k, v]) => [k, (v || []).filter(e => e.t >= at)]).filter(([, v]) => v.length)),
    streak: S.streak && (S.streak.last || '') > dk ? S.streak : { last: '', count: 0 },
    drill: S.drill ? { ...S.drill, best: {} } : undefined,   // 自己ベストも記録のうち
  };
}

// 復習状態（pstat）の合わせ方（v0.23）
//   以前は「最後に解いた時刻 last が新しい方」だけを採っていたため、2台でそれぞれ同じ問題を復習すると、
//   古い方の端末の復習が復習状態に反映されなかった（解答の記録には両方残る）。
//   今は、解答の記録（合わせた後）を手がかりにする：古い方の last より後の記録が、新しい方の reps の増え方より多ければ、
//   古い方の状態からそれらの記録を時刻順に review() し直す。記録が足りない（切り捨てられた等）・新しい方の reps が古い方より少ない
//   （つじつまが合わない）・評価 g の無い記録があるときは、今まで通り新しい方。
//   どちらから合わせても同じ結果になり、何度合わせても変わらない。
export function mergePstat(a, b, log) {
  const o = { ...(b || {}) };
  const ok = (v) => v && Number.isFinite(v.S) && v.S > 0 && Number.isFinite(v.D) && Number.isFinite(v.last) && Number.isInteger(v.reps);
  let byP = null;
  const entries = (k) => {
    if (!byP) { byP = new Map(); for (const l of log || []) { if (!byP.has(l.p)) byP.set(l.p, []); byP.get(l.p).push(l); } }
    return byP.get(k) || [];
  };
  for (const [k, v] of Object.entries(a || {})) {
    const w = o[k];
    if (!w || !ok(w)) { if (v || !w) o[k] = v; continue; }
    if (!ok(v)) continue;
    if (v.last === w.last) { o[k] = w.reps > v.reps ? w : v; continue; }   // 同じ時刻：多くの復習を含む方（同じなら手元 a）
    const [older, newer] = v.last < w.last ? [v, w] : [w, v];
    const after = entries(k).filter(l => l.t > older.last);
    if (after.length && newer.reps >= older.reps && after.length > newer.reps - older.reps && after.every(l => [1, 2, 3, 4].includes(l.g))) {
      let s = older;
      for (const l of after) s = review(s, l.g, l.t);
      o[k] = s;
    } else o[k] = newer;
  }
  return o;
}

export function mergeState(L, R) {
  if (!R) return L;
  if (!L) return R;
  const resetAt = Math.max(L.resetAt || 0, R.resetAt || 0);
  if ((L.resetAt || 0) < resetAt) L = dropBefore(L, resetAt);
  if ((R.resetAt || 0) < resetAt) R = dropBefore(R, resetAt);
  const out = { ...R, ...L };
  // 解答の記録：両方を足す（同じ回＝同じ問題・同じ時刻は1つに。項目の多い方に、足りない項目を補う）
  const m = new Map();
  for (const r of R.log || []) m.set(entryKey(r), r);
  for (const l of L.log || []) {
    const r = m.get(entryKey(l));
    if (r && nkeys(r) > nkeys(l)) Object.assign(l, r);
    else if (r) for (const [k, v] of Object.entries(r)) if (!(k in l)) l[k] = v;
    m.set(entryKey(l), l);   // 手元の記録はそのままのオブジェクトを使う（解いている途中の参照が切れないように）
  }
  // v0.23：5000件で切り捨てていたのをやめた（古い解答の記録が同期のたびに消えていた）
  out.log = [...m.values()].sort((a, b) => a.t - b.t);
  // 解法カード：問題ごとに、最後に解いた方
  const newer = (a, b) => { const o = { ...(b || {}) }; for (const [k, v] of Object.entries(a || {})) if (!o[k] || (v && v.last >= o[k].last)) o[k] = v; return o; };
  out.pstat = mergePstat(L.pstat, R.pstat, out.log);
  out.cards = newer(L.cards, R.cards);
  // ブックマーク：問題ごとに、最後に付け外しした方（外した印 on:false も残して、よみがえらないようにする）
  const bmNewer = (a, b) => { const o = { ...(b || {}) }; for (const [k, v] of Object.entries(a || {})) if (!o[k] || (v && v.t >= o[k].t)) o[k] = v; return o; };
  out.bookmarks = bmNewer(L.bookmarks, R.bookmarks);
  // 解いた問題：最後に解いた時刻は新しい方、回数は多い方（記録の数より少なくはしない）
  const count = {};
  for (const l of out.log) count[l.p] = (count[l.p] || 0) + 1;
  out.problems = {};
  for (const k of new Set([...Object.keys(L.problems || {}), ...Object.keys(R.problems || {})])) {
    const a = (L.problems || {})[k], b = (R.problems || {})[k];
    out.problems[k] = { last: Math.max(a ? a.last : 0, b ? b.last : 0), n: Math.max(a ? a.n : 0, b ? b.n : 0, count[k] || 0) };
  }
  // 気づきのメモ：両方を足して、問題ごとに新しい5件
  out.explains = {};
  for (const k of new Set([...Object.keys(L.explains || {}), ...Object.keys(R.explains || {})])) {
    const all = new Map();
    for (const e of [...((R.explains || {})[k] || []), ...((L.explains || {})[k] || [])]) all.set(`${e.t}|${e.text}`, e);
    out.explains[k] = [...all.values()].sort((a, b) => a.t - b.t).slice(-5);
  }
  // 計算トレーニングの自己ベスト：正答率が高い方、同じなら速い方
  const dl = L.drill || {}, dr = R.drill || {};
  if (!L.drill && !R.drill) delete out.drill;
  if (L.drill || R.drill) {
    const best = { ...(dr.best || {}) };
    for (const [k, v] of Object.entries(dl.best || {})) {
      const o = best[k];
      if (!o || v.ok / v.n > o.ok / o.n || (v.ok / v.n === o.ok / o.n && v.ms <= o.ms)) best[k] = v;
    }
    out.drill = { ...dr, ...dl, best };
  }
  // 連続日数：最後に解いた日が新しい方（同じ日なら長い方）
  const sl = L.streak || {}, sr = R.streak || {};
  out.streak = (sl.last || '') > (sr.last || '') ? sl : (sr.last || '') > (sl.last || '') ? sr : ((sl.count || 0) >= (sr.count || 0) ? sl : sr);
  out.csvExportedAt = Math.max(L.csvExportedAt || 0, R.csvExportedAt || 0) || undefined;
  if (out.csvExportedAt === undefined) delete out.csvExportedAt;
  // 設定・選んだ分野など：最後に変えた方
  const lw = (L.settingsAt || 0) >= (R.settingsAt || 0) ? L : R;
  for (const k of LWW_KEYS) { if (k in lw) out[k] = lw[k]; else delete out[k]; }
  out.settingsAt = Math.max(L.settingsAt || 0, R.settingsAt || 0);
  out.schema = L.schema;
  if (resetAt) out.resetAt = resetAt; else delete out.resetAt;
  return out;
}

// 比較用：キーの順番によらない JSON
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
