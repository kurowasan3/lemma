// テスト用の「にせ Supabase」。js/sync.js が使う API だけを、同じ形で返す（行ごとのアクセス制限も再現）。
//   const mock = createMockSupabase({ key: 'sb_publishable_test' });
//   await mock.handle({ method, url, headers, body }) → { status, body }
export function createMockSupabase({ key = 'sb_publishable_test', code = '123456' } = {}) {
  const users = new Map();      // email → { id, email }
  const tokens = new Map();     // access_token → user id
  const refresh = new Map();    // refresh_token → user id
  const rows = new Map();       // user id → { state, rev, updated_at }
  const sent = [];
  let n = 0;
  const hooks = { beforePatch: null };

  const issue = (u) => {
    n++;
    const at = `at-${u.id}-${n}`, rt = `rt-${u.id}-${n}`;
    tokens.set(at, u.id); refresh.set(rt, u.id);
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email } };
  };
  const json = (status, body) => ({ status, body: body === undefined ? '' : JSON.stringify(body) });

  async function handle({ method, url, headers, body }) {
    const u = new URL(url, 'http://mock');
    const path = u.pathname.replace(/^.*?(\/auth\/v1|\/rest\/v1)/, '$1');
    const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (h.apikey !== key) return json(401, { message: 'Invalid API key' });
    const data = body ? JSON.parse(body) : null;
    const uid = h.authorization ? tokens.get(h.authorization.replace(/^Bearer /, '')) : null;

    if (method === 'POST' && path === '/auth/v1/otp') {
      if (/blocked/.test(data.email)) return json(400, { error_code: 'email_address_not_authorized', msg: 'Email address not authorized' });
      sent.push(data.email);
      return json(200, {});
    }
    if (method === 'POST' && path === '/auth/v1/verify') {
      if (data.type !== 'email' || data.token !== code || !sent.includes(data.email)) return json(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      let user = users.get(data.email);
      if (!user) { user = { id: `00000000-0000-4000-8000-${String(users.size + 1).padStart(12, '0')}`, email: data.email }; users.set(data.email, user); }
      return json(200, issue(user));
    }
    if (method === 'POST' && path === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
      const id = refresh.get(data.refresh_token);
      if (!id) return json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      refresh.delete(data.refresh_token);
      return json(200, issue([...users.values()].find(x => x.id === id)));
    }
    if (method === 'POST' && path === '/auth/v1/logout') { tokens.delete(h.authorization?.replace(/^Bearer /, '')); return json(204); }

    if (!uid) return json(401, { code: 'PGRST301', message: 'JWT expired or missing' });
    if (path === '/rest/v1/lemma_state') {
      const want = u.searchParams.get('user_id')?.replace(/^eq\./, '');
      if (method === 'GET') {
        const r = rows.get(uid);
        return json(200, r && (!want || want === uid) ? [{ state: r.state, rev: r.rev }] : []);   // 他人の行は見えない
      }
      if (method === 'POST') {
        if (data.user_id !== uid) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
        if (rows.has(uid)) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        rows.set(uid, { state: data.state, rev: data.rev, updated_at: new Date().toISOString() });
        return json(201);
      }
      if (method === 'PATCH') {
        if (hooks.beforePatch) await hooks.beforePatch(uid);
        const rev = Number(u.searchParams.get('rev')?.replace(/^eq\./, ''));
        const r = rows.get(uid);
        if (want !== uid || !r || r.rev !== rev) return json(200, []);
        rows.set(uid, { state: data.state, rev: data.rev, updated_at: data.updated_at });
        return json(200, [{ user_id: uid, rev: data.rev }]);
      }
    }
    if (method === 'POST' && path === '/rest/v1/rpc/delete_my_account') {
      rows.delete(uid);
      for (const [e, x] of users) if (x.id === uid) users.delete(e);
      for (const [t, id] of tokens) if (id === uid) tokens.delete(t);
      return json(204);
    }
    return json(404, { message: `not found ${method} ${path}` });
  }

  // node の fetch の代わりに使う（単体テスト用）
  const fetch = async (url, init = {}) => {
    const r = await handle({ method: init.method || 'GET', url, headers: init.headers, body: init.body });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
  };
  return { handle, fetch, rows, users, tokens, refresh, sent, hooks };
}
