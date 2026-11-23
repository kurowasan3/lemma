// アカウントと学習記録の同期（Supabase）。
// ログインはメールに届く数字のコード（iPhone のホーム画面アプリでも同じ画面のまま入れるように、リンクではなくコード）。
// 記録は 1人1行（表 lemma_state）。同期は「サーバーの記録を取る → 手元と合わせる → 版番号つきで書き戻す」。
//   ログインしなければ何も送らない（今まで通り端末の中だけ）。
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const FILE_VERSION = '0.23.0';
const AUTH_KEY = 'lemma.auth';
export const enabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

// 記録の合わせ方（mergeState など）は v0.23 から js/store.js にある（同期しない版でも、タブどうし・バックアップの読み込みで使うため）
export { LWW_KEYS, mergeState, mergePstat, stable } from './store.js';
import { mergeState, stable, structural, SCHEMA } from './store.js';

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

const RETRY_MAX = 4;
const retryable = (e) => e && (e.code === 'offline' || e.code === 'conflict' || /^(5\d\d|429|408)$/.test(String(e.code)));
export function createSync({ getState, applyState, onStatus = () => {}, retryDelay = 15000 }) {
  let session = loadSession();
  let timer = null, running = null, retries = 0;
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
      if (structural(local).length) throw new SyncError('この端末の記録の形が正しくないため、同期を止めました。', 'bad_local');
      if (!rows.length) {
        try {
          await call('/rest/v1/lemma_state', { method: 'POST', auth: true, prefer: 'return=minimal', body: { user_id: uid, state: local, rev: 1 } });
          return local;
        } catch (e) { if (e.code === '23505' || e.code === '409') continue; throw e; }   // 別の端末が先に作った
      }
      const { state: remote, rev } = rows[0];
      // v0.23：サーバーの記録を確かめてから合わせる。壊れた記録・新しい版の記録とは合わせず、書き戻しもしない（手元もサーバーも変えない）
      if (structural(remote).length) throw new SyncError('アカウントの記録の形が正しくないため、同期を止めました。この端末の記録はそのまま残っています。', 'bad_remote');
      if (Number.isInteger(remote.schema) && remote.schema > SCHEMA) throw new SyncError('新しい版のアプリで保存された記録です。アプリを更新してから同期してください（この端末の記録はそのまま残っています）。', 'newer_remote');
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
      retries = 0;
      st.status = 'ok'; st.lastSync = Date.now();
      if (session) { session.lastSync = st.lastSync; saveSession(session); }
      emit(); return r;
    }).catch((e) => {
      if (session) { st.status = e.code === 'offline' ? 'offline' : 'error'; st.error = e.message; }
      // 一時的な失敗（オフライン・同時の書き込み・サーバーの不調）は、間をあけて数回だけやり直す。
      //   形の正しくない記録・新しい版の記録・ログイン切れはやり直さない（人が対処する）
      if (session && retryable(e) && retries < RETRY_MAX) { retries++; clearTimeout(timer); timer = setTimeout(() => syncNow(), retryDelay * 2 ** (retries - 1)); }
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
    // autoSync:false のときは同期せずに戻る（アプリが、端末とサーバーの記録を合わせるかを先に聞くため）
    async verify(email, code, { autoSync = true } = {}) {
      const d = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim(), token: String(code).replace(/\s/g, '') } });
      if (!d || !d.access_token) throw new SyncError('ログインできませんでした', 'no_session');
      setSession(d); st.status = 'idle'; st.error = null; emit();
      return autoSync ? syncNow() : null;
    },
    // サーバーの記録の概要（無ければ null）：{ n: 解答の数, last: 最後に解いた時刻 }
    async peek() {
      await fresh();
      const rows = await call(`/rest/v1/lemma_state?select=state,rev&user_id=eq.${session.user.id}`, { auth: true });
      if (!rows.length) return null;
      const log = (rows[0].state && rows[0].state.log) || [];
      return { n: log.length, last: log.length ? log[log.length - 1].t : 0 };
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
