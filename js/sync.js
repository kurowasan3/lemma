// アカウントと学習記録の同期（Supabase）。
// ログインはメールに届く数字のコード（iPhone のホーム画面アプリでも同じ画面のまま入れるように、リンクではなくコード）。
// 記録は 1人1行（表 lemma_state）。同期は「サーバーの記録を取る → 手元と合わせる → 版番号つきで書き戻す」。
//   ログインしなければ何も送らない（今まで通り端末の中だけ）。
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const FILE_VERSION = '0.9.0';
const AUTH_KEY = 'lemma.auth';
export const enabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

// ---------------------------------------------------------------- 記録の合わせ方（端末どうしで食い違ったとき）
// 設定のように「最後に変えた方」を採るもの
export const LWW_KEYS = ['settings', 'practice', 'graphExprs', 'graph3Exprs'];
const entryKey = (l) => `${l.p}|${l.t}`;
const nkeys = (o) => Object.keys(o || {}).length;

export function mergeState(L, R) {
  if (!R) return L;
  if (!L) return R;
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
  out.log = [...m.values()].sort((a, b) => a.t - b.t).slice(-5000);
  // 復習状態・解法カード：問題ごとに、最後に解いた方
  const newer = (a, b) => { const o = { ...(b || {}) }; for (const [k, v] of Object.entries(a || {})) if (!o[k] || (v && v.last >= o[k].last)) o[k] = v; return o; };
  out.pstat = newer(L.pstat, R.pstat);
  out.cards = newer(L.cards, R.cards);
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
  return out;
}

// 比較用：キーの順番によらない JSON
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

// ---------------------------------------------------------------- 通信
export class SyncError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
}
function saveSession(s) {
  try { s ? localStorage.setItem(AUTH_KEY, JSON.stringify(s)) : localStorage.removeItem(AUTH_KEY); } catch { /* 保存できない環境 */ }
}
const MESSAGES = {
  over_email_send_rate_limit: '送信の回数が多すぎます。しばらく待ってからもう一度送ってください。',
  email_address_not_authorized: 'このメールアドレスにはまだ送れません（メール送信の設定が必要です）。',
  otp_expired: 'コードが違うか、期限が切れています。もう一度コードを送ってください。',
  validation_failed: 'メールアドレスの形が正しくありません。',
  email_address_invalid: 'メールアドレスの形が正しくありません。',
};

export function createSync({ getState, applyState, onStatus = () => {} }) {
  let session = loadSession();
  let timer = null, running = null;
  const st = { status: session ? 'idle' : 'out', lastSync: session?.lastSync || null, error: null };
  const emit = () => onStatus({ ...st, email: session?.user?.email || null });

  async function call(path, { method = 'GET', body, auth = false, prefer } = {}) {
    if (!enabled()) throw new SyncError('同期の設定がありません', 'not_configured');
    const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = `Bearer ${session.access_token}`;
    if (prefer) headers.Prefer = prefer;
    let res;
    try {
      res = await fetch(SUPABASE_URL.replace(/\/$/, '') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new SyncError('サーバーにつながりません（オフラインかもしれません）', 'offline');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const code = (data && (data.error_code || data.code || data.error)) || String(res.status);
      throw new SyncError(MESSAGES[code] || (data && (data.msg || data.message || data.error_description)) || `エラー ${res.status}`, code);
    }
    return data;
  }
  function setSession(d) {
    session = d ? { access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
      user: { id: d.user.id, email: d.user.email }, lastSync: session?.lastSync || null } : null;
    saveSession(session);
  }
  async function fresh() {
    if (!session) throw new SyncError('ログインしていません', 'no_session');
    if (session.expires_at - 60000 > Date.now()) return;
    try {
      const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      setSession(d);
    } catch (e) {
      if (e.code !== 'offline') { setSession(null); st.status = 'out'; st.error = 'ログインの期限が切れました。もう一度ログインしてください。'; emit(); }
      throw e;
    }
  }

  async function syncOnce() {
    await fresh();
    const uid = session.user.id;
    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = await call(`/rest/v1/lemma_state?select=state,rev&user_id=eq.${uid}`, { auth: true });
      const local = getState();
      if (!rows.length) {
        try {
          await call('/rest/v1/lemma_state', { method: 'POST', auth: true, prefer: 'return=minimal', body: { user_id: uid, state: local, rev: 1 } });
          return local;
        } catch (e) { if (e.code === '23505' || e.code === '409') continue; throw e; }   // 別の端末が先に作った
      }
      const { state: remote, rev } = rows[0];
      const merged = mergeState(local, remote);
      if (stable(merged) !== stable(remote)) {
        const up = await call(`/rest/v1/lemma_state?user_id=eq.${uid}&rev=eq.${rev}`, { method: 'PATCH', auth: true, prefer: 'return=representation',
          body: { state: merged, rev: rev + 1, updated_at: new Date().toISOString() } });
        if (!up.length) continue;   // 同時に別の端末が書いた → 取り直して合わせ直す
      }
      applyState(merged);
      return merged;
    }
    throw new SyncError('同時に同期が重なりました。少し待ってからもう一度試してください。', 'conflict');
  }

  async function syncNow() {
    if (!session) return null;
    if (running) return running;
    st.status = 'syncing'; st.error = null; emit();
    running = syncOnce().then((r) => {
      st.status = 'ok'; st.lastSync = Date.now();
      if (session) { session.lastSync = st.lastSync; saveSession(session); }
      emit(); return r;
    }).catch((e) => {
      if (session) { st.status = e.code === 'offline' ? 'offline' : 'error'; st.error = e.message; }
      emit(); return null;
    }).finally(() => { running = null; });
    return running;
  }

  return {
    status: () => ({ ...st, email: session?.user?.email || null }),
    loggedIn: () => !!session,
    async sendCode(email) {
      await call('/auth/v1/otp', { method: 'POST', body: { email: String(email).trim(), create_user: true } });
    },
    async verify(email, code) {
      const d = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim(), token: String(code).replace(/\s/g, '') } });
      if (!d || !d.access_token) throw new SyncError('ログインできませんでした', 'no_session');
      setSession(d); st.status = 'idle'; st.error = null; emit();
      return syncNow();
    },
    syncNow,
    // 問題を解いたあとなど：20秒まとめてから同期
    schedule(ms = 20000) {
      if (!session) return;
      clearTimeout(timer);
      timer = setTimeout(() => syncNow(), ms);
    },
    async logout() {
      clearTimeout(timer);
      try { if (session) await call('/auth/v1/logout', { method: 'POST', auth: true }); } catch { /* 手元の情報は消す */ }
      setSession(null); st.status = 'out'; st.lastSync = null; st.error = null; emit();
    },
    async deleteAccount() {
      await fresh();
      await call('/rest/v1/rpc/delete_my_account', { method: 'POST', auth: true, body: {} });
      setSession(null); st.status = 'out'; st.lastSync = null; st.error = null; emit();
    },
  };
}
