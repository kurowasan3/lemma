// ブラウザでの通し操作（Playwright・Chromium、iPhone 幅 390×844）
//   node tests/e2e.mjs
// 主な画面と、v0.6 の学習記録の引き継ぎ、一部のデータだけ古いときの警告を確かめる。
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createMockSupabase } from './mock-supabase.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
let fakeDataVersion = null;
const mock = createMockSupabase({ key: 'sb_publishable_e2e' });   // 同期のテスト用（このサーバーの /mock/ で応える）   // Service Worker のテスト用：index.json の dataVersion を差し替える
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (p.startsWith('/mock/')) {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', async () => {
      const r = await mock.handle({ method: req.method, url: req.url, headers: req.headers, body: body || null });
      res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.body);
    });
    return;
  }
  if (p === '/js/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    const v = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').match(/FILE_VERSION = '([^']+)'/)[1];
    return res.end(`export const FILE_VERSION = '${v}';
export const SUPABASE_URL = 'http://localhost:${server.address().port}/mock';
export const SUPABASE_KEY = 'sb_publishable_e2e';`);
  }
  if (fakeDataVersion && p === '/data/index.json') {
    const d = JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); d.dataVersion = fakeDataVersion;
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(d));
  }
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const U = `http://localhost:${server.address().port}/`;

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const browser = await chromium.launch();

async function newPage({ state = null, route = null, sw = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: sw ? 'allow' : 'block' });
  if (state) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('lemma.v2', s); } }, JSON.stringify(state));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  if (route) await route(page);
  return page;
}
const next = (page) => page.locator('button:has-text("次")').first().click();

try {
  // 1. 起動・今日・入力採点・判定がおかしい？・内蔵問題
  {
    const page = await newPage();
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    ok(await page.locator('#lv button').count() === 6, '難易度ボタンが6つ（基礎〜数学探究）');
    ok((await page.locator('#lv').innerText()).includes('数学探究') && (await page.locator('#lv').innerText()).includes('入試発展'), '新しい難易度名');
    ok(await page.locator('.banner').count() === 0, '起動時に警告が出ない');
    await page.evaluate("__lemma.open(['I-EXP-001', 'A-INT-005', 'q01'])"); await page.waitForTimeout(800);
    ok((await page.locator('.chip').allInnerTexts()).some(t => t.includes('入力して採点')), '入力して採点のチップ');
    ok((await page.locator('.chip.val').allInnerTexts()).some(t => /頻出度 [高中低]/.test(t)), '頻出度のチップ');
    await page.locator('#conf button').nth(2).click();
    const inputs = page.locator('#inputs input');
    const vals = ['1', '0', '-10', '0', '9', '-16', '-16<k<9'];
    for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
    await page.click('#judge'); await page.waitForTimeout(500);
    ok((await page.locator('.verdict').innerText()).includes('完答'), 'I-EXP-001 を正しく答えて完答');
    await next(page); await page.waitForTimeout(600);
    await page.locator('#conf button').nth(1).click();
    await page.locator('#inputs input').nth(0).fill('(4,26)');
    await page.locator('#inputs input').nth(1).fill('(28,42),(10,59)');
    await page.click('#judge'); await page.waitForTimeout(400);
    ok((await page.locator('#feedback').innerText()).includes('1つ正解'), '一部だけ正しいと「2つのうち1つ正解」');
    await page.click('#giveup'); await page.waitForTimeout(400);
    await page.locator('.dispute').first().click(); await page.waitForTimeout(300);
    ok((await page.locator('.verdict').innerText()).includes('完答'), '判定がおかしい？で完答に変わる');
    await next(page); await page.waitForTimeout(600);
    ok((await page.locator('.chip').allInnerTexts()).some(t => t.includes('数I・2次関数')), '内蔵問題 q01 の分野チップ');
    ok(await page.locator('#conf button').count() === 3, '内蔵問題に自信度ボタン');
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')));
    ok(st.pstat['I-EXP-001'] && st.pstat['A-INT-005'], '結果が問題ID で記録される');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 2. 基礎だけのセット・計算・設定（テーマ・CSV）・グラフ・定着度
  {
    const page = await newPage();
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    for (const k of ['1', '2', '3', '4', '5']) await page.click(`#lv button[data-l="${k}"]`);
    await page.locator('.hero').first().click(); await page.waitForTimeout(1200);
    ok((await page.locator('.chip').allInnerTexts()).includes('基礎'), '基礎だけ選ぶと基礎の問題が出る');
    await page.goto(U + '#drill'); await page.waitForTimeout(600);
    await page.locator('.drill-card').first().click(); await page.waitForTimeout(500);
    ok(await page.locator('.drill input').count() > 0, '計算トレーニングが始まる');
    await page.goto(U + '#settings'); await page.waitForTimeout(600);
    await page.locator('.segment.theme button:has-text("ダーク")').click();
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'ダークモード');
    await page.goto(U + '#graph'); await page.waitForTimeout(800);
    ok(await page.locator('canvas').count() > 0, 'グラフ画面');
    await page.goto(U + '#map'); await page.waitForTimeout(600);
    ok((await page.locator('#view').innerText()).includes('定着度'), '定着度画面');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 3. v0.6 の学習記録を入れた端末
  {
    const old = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
    const page = await newPage({ state: old });
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.goto(U + '#map'); await page.waitForTimeout(600);
    await page.goto(U + '#settings'); await page.waitForTimeout(600);
    const dl = page.waitForEvent('download');
    await page.click('#csvall');
    const csv = fs.readFileSync(await (await dl).path(), 'utf8');
    ok(csv.split('\n').filter(l => l.trim()).length === old.log.length + 1, `CSV に v0.6 の記録 ${old.log.length}件がすべて出る`);
    await page.evaluate("__lemma.open(['I-EXP-001'])"); await page.waitForTimeout(800);
    await page.locator('#conf button').nth(1).click();
    const all = page.locator('#inputs input');
    const wrong = ['2', '0', '-10', '0', '9', '-16', '-16<k<9'];   // 1つ目だけ違う
    for (let i = 0; i < wrong.length; i++) await all.nth(i).fill(wrong[i]);
    await page.click('#judge'); await page.waitForTimeout(300);
    await page.click('#giveup'); await page.waitForTimeout(300);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')));
    ok(Object.keys(old.pstat).every(k => st.pstat[k]), 'v0.6 の復習状態がすべて残る');
    ok(st.practice.fields.join() === old.practice.fields.join(), '選んでいた分野が残る');
    ok(st.log.length === old.log.length + 1, '学習記録が続きに足される');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 4. 一部の data/ だけ古い（f-I-01.json の版が違う）
  {
    const page = await newPage({ route: (p) => p.route('**/data/f-I-01.json', async (r) => {
      const res = await r.fetch(); const d = await res.json(); d._meta = { dataVersion: 'old000000000' };
      await r.fulfill({ response: res, body: JSON.stringify(d) });
    }) });
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__lemma.open(['I-EXP-001'])"); await page.waitForTimeout(800);
    const b = page.locator('.banner');
    ok(await b.count() === 1 && (await b.innerText()).includes('data/f-I-01.json'), '古い本文ファイルを読むと警告が出る');
    ok(await page.locator('#inputs input').count() > 0, '警告が出ても問題は解ける');
  }
  // 5. 自己採点の前に解答・解説が出る／設定に「問題データ」が無い
  {
    const page = await newPage();
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__lemma.open(['A-COM-020'])"); await page.waitForTimeout(800);
    await page.locator('#conf button').nth(1).click();
    await page.click('#reveal'); await page.waitForTimeout(400);
    const order = await page.evaluate(() => { const a = document.querySelector('#solbox'), b = document.querySelector('#self'); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    ok(order, '自己採点の問題で、解答・解説が「どうだった？」より前に出る');
    await page.locator('#self button').first().click(); await page.waitForTimeout(300);
    ok(await page.locator('#solbox').count() === 1, '採点後も解答・解説は1つだけ');
    await page.goto(U + '#settings'); await page.waitForTimeout(500);
    ok(!(await page.locator('#view').innerText()).includes('問題データ'), '設定に「問題データ」の項目が無い');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 6. 検索・問題セット・共有リンク・得意苦手の図
  {
    const old = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
    const page = await newPage({ state: old });
    await page.goto(U + '#today'); await page.waitForTimeout(1500);
    ok(await page.locator('#sets .set-card').count() >= 3, '今日の画面に問題セット');
    await page.fill('#sq', '回転体'); await page.press('#sq', 'Enter'); await page.waitForTimeout(1500);
    const n = await page.locator('.res-row').count();
    ok(n > 0 && (await page.locator('#sres').innerText()).includes('見つかりました'), `検索「回転体」で結果が出る（${n}件表示）`);
    await page.selectOption('#ssort', 'freq'); await page.waitForTimeout(1200);
    const fr = await page.$$eval('.res-row .chip.val', els => els.map(x => ({ '高': 3, '中': 2, '低': 1 })[x.textContent.slice(-1)]));
    ok(fr.length > 1 && fr.every((v, i) => !i || fr[i - 1] >= v), `頻出度順に並べ替えられる（${fr.join('')}）`);
    await page.selectOption('#ssort', 'hard'); await page.waitForTimeout(1200);
    const lv = await page.$$eval('.res-row .chip[class*="lv"]', els => els.map(x => +x.className.match(/lv(\d)/)[1]));
    ok(lv.length > 1 && lv.every((v, i) => !i || lv[i - 1] >= v), `難しい順に並べ替えられる（${lv.join('')}）`);
    await page.click('#sgo'); await page.waitForTimeout(1000);
    ok(await page.locator('#conf button').count() === 3, '検索結果から演習が始まる');
    await page.goto(U + '#set=col-induction'); await page.waitForTimeout(1500);
    ok(page.url().endsWith('#today') && await page.locator('#conf button').count() === 3, '#set= のリンクで問題セットが始まる');
    await page.goto(U + '#ids=I-QF-109,q01'); await page.waitForTimeout(1500);
    ok((await page.locator('.chip').allInnerTexts()).some(t => t.includes('2次関数')), '#ids= のリンクで指定の問題が出る');
    await page.goto(U + '#map'); await page.waitForTimeout(800);
    const fields = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8')).fields.length;
    ok(await page.locator('.strength svg.radar').count() === 1 && await page.locator('.strength .tile').count() === fields, `得意・苦手の図（レーダー＋${fields}分野のタイル）`);
    await page.locator('.strength .tile').first().click(); await page.waitForTimeout(1000);
    ok(await page.locator('#conf button').count() === 3, 'タイルをタップするとその分野の演習');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 7. Service Worker：データ用キャッシュが版で分かれ、版が変わると古い本文が捨てられる。オフラインでも開いた分野は解ける
  {
    const page = await newPage({ sw: true });
    await page.goto(U + '#today');
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await page.reload(); await page.waitForTimeout(1200);
    await page.evaluate("__lemma.open(['I-EXP-001'])"); await page.waitForTimeout(1200);
    const v = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8')).dataVersion;
    const keys = await page.evaluate(async () => caches.keys());
    ok(keys.includes('lemma-data-' + v) && keys.some(k => k.startsWith('lemma-v')), `コード用とデータ用のキャッシュが分かれる ${keys}`);
    ok(await page.evaluate(async () => !!(await caches.match('data/f-I-01.json'))), '開いた分野の本文がキャッシュされる');
    await page.context().setOffline(true);
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__lemma.open(['I-EXP-001'])"); await page.waitForTimeout(1200);
    ok(await page.locator('#inputs input').count() === 7, 'オフラインでも開いた分野の問題が解ける');
    await page.context().setOffline(false);
    fakeDataVersion = 'e2enewversion';
    await page.goto(U + '#today'); await page.waitForTimeout(1500);
    await page.evaluate(async () => fetch('data/index.json', { cache: 'no-cache' }));
    await page.waitForTimeout(500);
    const keys2 = await page.evaluate(async () => caches.keys());
    ok(keys2.includes('lemma-data-e2enewversion') && !keys2.includes('lemma-data-' + v), `データの版が変わると古いデータ用キャッシュを消す ${keys2}`);
    ok(!(await page.evaluate(async () => !!(await caches.match('data/f-I-01.json')))), '古い版の本文は残らない');
    fakeDataVersion = null;
  }
  // 8. アカウントと同期：2台の端末でログインすると記録が合わさる（にせ Supabase）
  {
    const old = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
    const login = async (page) => {
      await page.goto(U + '#settings'); await page.waitForTimeout(1500);
      await page.fill('#acct-email', 'me@example.com'); await page.click('#acct-send'); await page.waitForTimeout(500);
      await page.fill('#acct-code', '000000'); await page.click('#acct-verify'); await page.waitForTimeout(500);
      const wrong = await page.locator('#acct-err').innerText();
      await page.fill('#acct-code', '123456'); await page.click('#acct-verify'); await page.waitForTimeout(1500);
      // 端末とアカウントの両方に記録があるときは、合わせるかを聞かれる
      page.asked = await page.locator('.chooser').count() > 0;
      if (page.asked) { await page.click('.chooser [data-k="merge"]'); await page.waitForTimeout(1500); }
      return wrong;
    };
    const A = await newPage({ state: { ...old, log: old.log.slice(0, 25) } });
    const wrong = await login(A);
    ok(/コード/.test(wrong), '違うコードでは日本語のエラーが出る');
    ok((await A.locator('#acct').innerText()).includes('me@example.com') && (await A.locator('#acct-state').innerText()).includes('最後の同期'), '端末A：ログインして同期できる');
    const B = await newPage({ state: { ...old, log: old.log.slice(20) } });
    await login(B);
    ok(!A.asked && B.asked, 'ログイン時：アカウントにも端末にも記録があるときだけ、合わせるかを聞く');
    const nB = await B.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.length);
    ok(nB === old.log.length, `端末B：両方の端末の記録が合わさる（${nB}件）`);
    await A.click('#acct-now'); await A.waitForTimeout(1500);
    const nA = await A.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.length);
    ok(nA === old.log.length, '端末A：「今すぐ同期」で端末Bの記録も入る');
    // 解いたあとは自動で同期の予約が入る（ここでは画面を閉じたときの同期で確かめる）
    await A.evaluate("__lemma.open(['I-QF-109'])"); await A.waitForTimeout(800);
    await A.locator('#conf button').nth(1).click();
    const inp = A.locator('#inputs input');
    await inp.nth(0).fill('x^2-8x+10'); await inp.nth(1).fill('4'); await inp.nth(2).fill('-3');
    await A.click('#judge'); await A.waitForTimeout(500);
    await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await A.waitForTimeout(1500);
    const srv = [...mock.rows.values()][0].state.log.map(l => l.p);
    ok(srv.includes('I-QF-109'), 'アプリを閉じるときに、解いた結果がサーバーに送られる');
    await A.goto(U + '#settings'); await A.waitForTimeout(1200);
    await A.click('#acct-out'); await A.waitForTimeout(300);
    await A.click('.chooser [data-k="keep"]'); await A.waitForTimeout(1200);
    ok(await A.locator('#acct-email').count() === 1 && (await A.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.length)) > 0, 'ログアウトしても端末の記録は残る');
    await B.goto(U + '#settings'); await B.waitForTimeout(1200);
    await B.click('#acct-del'); await B.waitForTimeout(1200);
    ok(mock.rows.size === 0 && mock.users.size === 0, '退会でサーバーの記録とアカウントが消える');
    const real = (es) => es.filter(e => !/status of 403/.test(e));   // わざと違うコードを入れたときの 403 は除く
    ok(real(A.errors).length === 0 && real(B.errors).length === 0, `ページのエラーなし ${A.errors} ${B.errors}`);
  }
  // 10. グラフ：平面（ベクトルを含む）・空間・複素数平面のモード、問題を解きながら開くシート
  {
    const G = await newPage();
    // 旧版の「ベクトル」モードの式は、平面の式へ移る
    await G.goto(U + '#today'); await G.waitForTimeout(600);
    await G.evaluate(() => { const s = JSON.parse(localStorage.getItem('lemma.v2') || '{}'); s.graphMode = 'vector'; s.graphVExprs = [{ src: 'Q=(3,3)' }]; localStorage.setItem('lemma.v2', JSON.stringify(s)); });
    await G.reload(); await G.goto(U + '#graph'); await G.waitForTimeout(1200);
    ok(await G.locator('.gmode button').count() === 3, 'グラフ：平面・空間・複素数平面の3モード');
    ok((await G.locator('.gmode button').allInnerTexts()).join() === '平面,空間,複素数平面', 'グラフ：モードの名前');
    ok(await G.locator('.gmode button.on').innerText() === '平面', '旧版のベクトルモードは平面で開く');
    const mig = await G.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')));
    ok(mig.graphExprs.some(e => e.src === 'Q=(3,3)') && !(mig.graphVExprs && mig.graphVExprs.length), '旧版のベクトルの式は平面の式へ移る');
    const ink = async () => G.evaluate(() => {   // グラフに色の付いた線・点があるか（背景と格子以外の画素）
      const c = document.querySelector('.gp canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) { const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (Math.max(r, g, b) - Math.min(r, g, b) > 80) n++; } return n;
    });
    for (const [m, from, n] of [['complex', 0, 7], ['2d', 0, 12]]) {
      await G.click(`.gmode button[data-m="${m}"]`); await G.waitForTimeout(400);
      for (let i = from; i < n; i++) {
        await G.click(`.gpre button[data-i="${i}"]`); await G.waitForTimeout(250);
        const errs = await G.$$eval('.expr-err', xs => xs.filter(x => !x.classList.contains('note')).map(x => x.textContent).filter(Boolean));
        ok(errs.length === 0, `グラフ（${m}）の例 ${i + 1}：式のエラーなし ${errs}`);
        ok(await ink() > 200, `グラフ（${m}）の例 ${i + 1}：描かれている`);
      }
    }
    await G.click('.gmode button[data-m="2d"]'); await G.waitForTimeout(300);
    await G.click('.gpre button[data-i="10"]'); await G.waitForTimeout(300);
    ok((await G.locator('.expr-err.note').allInnerTexts()).includes('= 4'), '平面のベクトル：内積 n·A の値を表示');
    const saved = await G.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).graphExprs.map(e => e.src));
    ok(saved.includes('n·(p-A)=0'), 'ベクトルの式も平面の式として保存される（同期の対象）');
    await G.click('.gmode button[data-m="2d"]'); await G.waitForTimeout(300);
    // 問題を解きながら：シートを開いて閉じても、入力中の答え・経過時間はそのまま
    await G.goto(U + '#today'); await G.waitForTimeout(800);
    await G.evaluate("__lemma.open(['I-QF-109'])"); await G.waitForTimeout(1000);
    await G.locator('#conf button').nth(1).click();
    await G.locator('#inputs input').nth(0).fill('x^2-8x+10');
    await G.click('[data-graph-sheet]'); await G.waitForTimeout(700);
    ok(await G.locator('.gsheet canvas').count() === 1, 'シート：問題の画面からグラフを開ける');
    await G.click('.gsheet .gmode button[data-m="complex"]'); await G.waitForTimeout(400);
    ok(await G.locator('.gsheet .gmode button.on').innerText() === '複素数平面', 'シート：モードを切り替えられる');
    await G.keyboard.press('Escape'); await G.waitForTimeout(300);
    ok(await G.locator('.gsheet').count() === 0, 'シート：Esc で閉じる');
    ok(await G.locator('#inputs input').nth(0).inputValue() === 'x^2-8x+10', 'シートを閉じても、入力中の答えが残る');
    await G.click('[data-graph-sheet]'); await G.waitForTimeout(500);
    await G.click('.gsheet-close'); await G.waitForTimeout(300);
    const inp = G.locator('#inputs input');
    await inp.nth(1).fill('4'); await inp.nth(2).fill('-3');
    await G.click('#judge'); await G.waitForTimeout(500);
    ok(await G.locator('#inputs .is-ok').count() >= 1, 'シートを使ったあとも、そのまま採点できる');
    // 空間ベクトル（空間のモードの例 8〜11）
    await G.goto(U + '#graph'); await G.waitForTimeout(1000);
    await G.click('.gmode button[data-m="3d"]'); await G.waitForTimeout(400);
    for (const i of [7, 8, 9, 10]) {
      await G.click(`.gpre button[data-i="${i}"]`); await G.waitForTimeout(500);
      const errs = await G.$$eval('.expr-err', xs => xs.filter(x => !x.classList.contains('note')).map(x => x.textContent).filter(Boolean));
      ok(errs.length === 0, `空間ベクトルの例 ${i + 1}：式のエラーなし ${errs}`);
      ok(await ink() > 200, `空間ベクトルの例 ${i + 1}：描かれている`);
    }
    ok((await G.locator('.expr-err.note').allInnerTexts()).some(t => /^= 4\.89/.test(t)), '空間ベクトル：|a×b| の値を表示');
    await G.click('.gmode button[data-m="2d"]'); await G.waitForTimeout(300);
    // 問題の図
    await G.goto(U + '#today'); await G.reload(); await G.waitForTimeout(1000);
    await G.evaluate("__lemma.open(['II-GEO-049'])"); await G.waitForTimeout(1000);
    await G.click('[data-fig-sheet]'); await G.waitForTimeout(700);
    const figExprs = await G.$$eval('.gsheet .expr input', xs => xs.map(x => x.value));
    ok(JSON.stringify(figExprs) === JSON.stringify(['x^2+y^2=4', 'x^2+y^2-8x+6y+21=0']), '問題の図：問題文の2つの円');
    ok(await G.locator('.gsheet .gmode').count() === 0 && await G.locator('.gsheet .fig-note').count() === 1, '問題の図：自動で取り出した旨を表示（モード切替なし）');
    const before = await G.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('lemma.v2')).graphExprs));
    await G.locator('.gsheet .expr input').first().fill('x^2+y^2=9'); await G.waitForTimeout(200);
    ok(await G.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('lemma.v2')).graphExprs)) === before, '問題の図：直しても自分のグラフは変わらない');
    await G.click('.gsheet .gcopy'); await G.waitForTimeout(200);
    ok((await G.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).graphExprs.map(e => e.src))).includes('x^2+y^2=9'), '問題の図：「グラフに写す」で自分のグラフへ');
    await G.click('.gsheet-close'); await G.waitForTimeout(300);
    // 図そのものが答えになる問題は、答え合わせのあと
    await G.goto(U + '#today'); await G.reload(); await G.waitForTimeout(1000);
    await G.evaluate("__lemma.open(['C-CUR-148'])"); await G.waitForTimeout(1000);
    ok(await G.locator('[data-fig-sheet].locked').count() === 1, '答えになる図：最初は鍵がかかっている');
    await G.click('[data-fig-sheet]'); await G.waitForTimeout(300);
    ok(await G.locator('.gsheet').count() === 0, '答えになる図：答え合わせの前は開かない');
    await G.locator('#conf button').nth(1).click();
    await G.click('#reveal'); await G.waitForTimeout(500);
    await G.click('[data-fig-sheet]'); await G.waitForTimeout(600);
    ok(await G.locator('.gsheet canvas').count() === 1, '答えになる図：答え合わせのあとは開ける');
    await G.click('.gsheet-close'); await G.waitForTimeout(200);
    ok(G.errors.length === 0, `ページのエラーなし ${G.errors}`);
    await G.evaluate(() => { const s = JSON.parse(localStorage.getItem('lemma.v2')); s.graphMode = '2d'; localStorage.setItem('lemma.v2', JSON.stringify(s)); });
  }
  // 9. ブックマーク・記録の消去（ログイン中も効く）・バックアップの読み込み・ログイン時に端末の記録を使わない
  {
    mock.users.clear(); mock.rows.clear();
    const old = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
    const P = await newPage();
    await P.goto(U + '#today'); await P.waitForTimeout(1500);
    await P.evaluate("__lemma.open(['I-EXP-001'])"); await P.waitForTimeout(1000);
    await P.click('[data-bm="I-EXP-001"]'); await P.waitForTimeout(200);
    ok(await P.locator('[data-bm="I-EXP-001"].on').count() === 1, 'ブックマーク：問題画面で付けられる');
    await P.goto(U + '#today'); await P.reload(); await P.waitForTimeout(1500);   // 解いている途中のセットを閉じる
    ok((await P.locator('#bmset').innerText()).includes('1問'), 'ブックマーク：ホームに「ブックマークした問題 1問」');
    await P.click('#bmset'); await P.waitForTimeout(1000);
    ok(await P.locator('[data-bm="I-EXP-001"]').count() === 1, 'ブックマーク：そこから出題できる');
    await P.click('[data-bm="I-EXP-001"]'); await P.waitForTimeout(200);
    const bm = await P.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).bookmarks['I-EXP-001']);
    ok(bm && bm.on === false && bm.t > 0, 'ブックマーク：外すと on:false の印が残る（同期でよみがえらない）');
    // バックアップの読み込み：形の違うファイルは断る・置き換えでファイルの記録になる
    await P.goto(U + '#settings'); await P.waitForTimeout(1000);
    await P.setInputFiles('#imp', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await P.waitForTimeout(400);
    ok((await P.locator('.toast').innerText()).includes('Lemma の学習記録のファイルではありません'), '読み込み：別のファイルは断る');
    await P.setInputFiles('#imp', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
    await P.waitForTimeout(400);
    const askedImp = await P.locator('.chooser').count();
    if (askedImp) await P.click('.chooser [data-k="replace"]');
    await P.waitForTimeout(800);
    const st = await P.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')));
    ok(st.log.length === old.log.length && st.resetAt > 0, `読み込み：置き換えるとファイルの記録になり、消した印が付く（${st.log.length}件）`);
    // ログインして同期 → 「記録をすべて消す」でアカウントの記録も消える
    const login = async (page, email) => {
      await page.goto(U + '#settings'); await page.waitForTimeout(1200);
      await page.fill('#acct-email', email); await page.click('#acct-send'); await page.waitForTimeout(400);
      await page.fill('#acct-code', '123456'); await page.click('#acct-verify'); await page.waitForTimeout(1500);
    };
    await login(P, 'reset@example.com');
    const srvN = () => { const r = [...mock.rows.values()][0]; return r ? r.state.log.length : -1; };
    ok(srvN() === old.log.length, `同期：アカウントに記録が上がる（${srvN()}件）`);
    const Q = await newPage({ state: { ...old, log: old.log.slice(0, 10) } });
    await login(Q, 'reset@example.com');
    if (await Q.locator('.chooser').count()) { await Q.click('.chooser [data-k="merge"]'); await Q.waitForTimeout(1500); }
    await P.goto(U + '#settings'); await P.waitForTimeout(1000);
    await P.click('#reset'); await P.waitForTimeout(300);
    ok(await P.locator('.chooser [data-k="all"]').count() === 1 && await P.locator('.chooser [data-k="device"]').count() === 1, '消去：ログイン中は「アカウントも」「この端末だけ」を選べる');
    await P.click('.chooser [data-k="all"]'); await P.waitForTimeout(1500);
    ok(srvN() === 0, `消去：アカウントの記録も消える（${srvN()}件）`);
    await Q.goto(U + '#settings'); await Q.waitForTimeout(800);
    await Q.click('#acct-now'); await Q.waitForTimeout(1500);
    const nQ = await Q.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.length);
    ok(nQ === 0 && srvN() === 0, `消去：ほかの端末の古い記録も、同期で消える（端末 ${nQ}件・サーバー ${srvN()}件）`);
    // ログイン時に「アカウントの記録だけを使う」：端末の記録は書き出してから消える
    await P.evaluate("__lemma.open(['I-EXP-001'])"); await P.waitForTimeout(800);
    await P.goto(U + '#settings'); await P.waitForTimeout(800);
    await P.click('#acct-now'); await P.waitForTimeout(1500);
    const R = await newPage({ state: { ...old, log: old.log.slice(0, 5) } });
    await R.goto(U + '#settings'); await R.waitForTimeout(1200);
    await R.fill('#acct-email', 'reset@example.com'); await R.click('#acct-send'); await R.waitForTimeout(400);
    // 先にサーバーへ1件入れておく（P の端末の解答）
    const r0 = [...mock.rows.values()][0];
    r0.state.log = [{ p: 'I-EXP-001', t: Date.now(), g: 3 }]; r0.rev += 1;
    await R.fill('#acct-code', '123456'); await R.click('#acct-verify'); await R.waitForTimeout(1200);
    const [dl] = await Promise.all([R.waitForEvent('download', { timeout: 5000 }).catch(() => null), R.click('.chooser [data-k="remote"]')]);
    await R.waitForTimeout(1500);
    const nR = await R.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.map(l => l.p));
    ok(dl && JSON.stringify(nR) === '["I-EXP-001"]', `ログイン時「アカウントの記録だけ」：端末の記録を書き出してから、アカウントの記録になる（${nR}）`);
    // ログアウトで端末の記録も消す
    await R.goto(U + '#settings'); await R.waitForTimeout(800);
    await R.click('#acct-out'); await R.waitForTimeout(300);
    await R.click('.chooser [data-k="wipe"]'); await R.waitForTimeout(1500);
    const nR2 = await R.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2')).log.length);
    ok(nR2 === 0 && await R.locator('#acct-email').count() === 1, 'ログアウト時に端末の記録も消せる');
    const errs = [...P.errors, ...Q.errors, ...R.errors].filter(e => !/status of 40[13]/.test(e));
    ok(errs.length === 0, `ページのエラーなし ${errs}`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`e2e: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
