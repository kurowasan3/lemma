// オフラインで動かすためのキャッシュ。
//   コード用  … VERSION（アプリを更新したら上げる）。古い版は activate で消す
//   データ用  … lemma-data-<dataVersion>（data/ の中身の版。data/index.json を取り直して版が変わったら、古い問題データを捨てる）
//   本文の塊用 … lemma-chunks（data/b/<塊>.json?h=<中身のハッシュ>。URL が中身で決まるので「まずキャッシュ」。
//                 一覧（data/index.json）を取り直したときに，一覧に無くなった塊・古いハッシュの塊を消す）
// 本文の塊以外は「まずネットワーク、つながらなければキャッシュ」なので、更新はすぐ反映される。
const VERSION = 'lemma-v0.32.0';
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/app.js",
  "js/parser.js",
  "js/graph.js",
  "js/plane.js",
  "js/content.js",
  "js/scheduler.js",
  "js/graph3d.js",
  "js/catalog.js",
  "js/mastery.js",
  "js/answer.js",
  "js/ui.js",
  "js/drill.js",
  "js/store.js",
  "js/sync.js",
  "js/config.js",
  "privacy.html",
  "terms.html",
  "vendor/katex.min.js",
  "vendor/katex.min.css",
  "vendor/auto-render.min.js",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "vendor/fonts/KaTeX_AMS-Regular.woff2",
  "vendor/fonts/KaTeX_Caligraphic-Bold.woff2",
  "vendor/fonts/KaTeX_Caligraphic-Regular.woff2",
  "vendor/fonts/KaTeX_Fraktur-Bold.woff2",
  "vendor/fonts/KaTeX_Fraktur-Regular.woff2",
  "vendor/fonts/KaTeX_Main-Bold.woff2",
  "vendor/fonts/KaTeX_Main-BoldItalic.woff2",
  "vendor/fonts/KaTeX_Main-Italic.woff2",
  "vendor/fonts/KaTeX_Main-Regular.woff2",
  "vendor/fonts/KaTeX_Math-BoldItalic.woff2",
  "vendor/fonts/KaTeX_Math-Italic.woff2",
  "vendor/fonts/KaTeX_SansSerif-Bold.woff2",
  "vendor/fonts/KaTeX_SansSerif-Italic.woff2",
  "vendor/fonts/KaTeX_SansSerif-Regular.woff2",
  "vendor/fonts/KaTeX_Script-Regular.woff2",
  "vendor/fonts/KaTeX_Size1-Regular.woff2",
  "vendor/fonts/KaTeX_Size2-Regular.woff2",
  "vendor/fonts/KaTeX_Size3-Regular.woff2",
  "vendor/fonts/KaTeX_Size4-Regular.woff2",
  "vendor/fonts/KaTeX_Typewriter-Regular.woff2",
];

const DATA_PREFIX = 'lemma-data-';
const CHUNK_CACHE = 'lemma-chunks';
const isData = (url) => url.pathname.includes('/data/');
const isChunk = (url) => url.pathname.includes('/data/b/') && url.searchParams.has('h');

// 一覧にある塊（名前 → ハッシュ）だけを残す
async function pruneChunks(index) {
  const chunks = index && index.bodies && index.bodies.chunks;
  if (!chunks) return;
  const c = await caches.open(CHUNK_CACHE);
  for (const req of await c.keys()) {
    const u = new URL(req.url);
    const key = decodeURIComponent(u.pathname.split('/').pop().replace(/\.json$/, ''));
    if (chunks[key] !== u.searchParams.get('h')) await c.delete(req);
  }
  // 前の形（v0.31 まで）の分野ごとの本文 data/f-*.json はもう使わない。データの版が同じまま更新したときにも残らないように消す
  for (const name of (await caches.keys()).filter((k) => k.startsWith(DATA_PREFIX))) {
    const dc = await caches.open(name);
    for (const req of await dc.keys()) if (/\/data\/f-[^/]+\.json$/.test(new URL(req.url).pathname)) await dc.delete(req);
  }
}
// 前の版のアプリ（v0.31 まで）が読む分野ごとの本文 data/f-<分野>.json を，塊から組み立てて返す。
// 更新の直後は，HTTP キャッシュ（GitHub Pages は max-age=600）や開いたままのタブで前の版の JS が動くことがあり，
// サーバーにはもう f-*.json が無いので，そのままでは問題を開けなくなる。新しい Service Worker がこれを肩代わりする
const legacyField = (url) => { const m = url.pathname.match(/\/data\/f-([^/]+)\.json$/); return m ? decodeURIComponent(m[1]) : null; };
async function currentIndex() {
  try { const r = await fetch('data/index.json', { cache: 'no-cache' }); if (r.ok) return r.json(); } catch (err) { /* オフライン */ }
  const c = await caches.match('data/index.json');
  return c ? c.json() : null;
}
async function legacyFromChunks(field) {
  const index = await currentIndex();
  const bl = index && index.bodies;
  if (!bl || bl.layout !== 'chunks') return null;
  const keyOf = (e) => { const m = /^(.+)-(\d+)$/.exec(e.id); return m ? `${m[1]}-${Math.floor(+m[2] / bl.size)}` : `_${e.f}`; };
  const ids = new Set(index.problems.filter((e) => e.f === field).map((e) => e.id));
  if (!ids.size) return null;
  const out = { _meta: { dataVersion: index.dataVersion } };
  for (const key of new Set(index.problems.filter((e) => ids.has(e.id)).map(keyOf))) {
    const res = await chunkFirst(new Request(`data/${bl.dir || 'b'}/${key}.json?h=${bl.chunks[key]}`));
    if (!res.ok) return null;
    for (const [id, b] of Object.entries(await res.json())) if (ids.has(id)) out[id] = b;
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
async function legacyBody(req, url) {
  let res = null;
  try { res = await fetch(req, { cache: 'no-cache' }); if (res.ok) return res; } catch (err) { /* オフライン */ }
  const made = await legacyFromChunks(legacyField(url)).catch(() => null);
  return made || res || Response.error();
}

// 本文の塊：まずキャッシュ，無ければネットワーク（取れたら入れておく）
async function chunkFirst(req) {
  const c = await caches.open(CHUNK_CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await c.put(req, res.clone());
  return res;
}

// いまのデータ用キャッシュの名前（無ければ null）
async function currentDataCache() {
  const keys = await caches.keys();
  return keys.find((k) => k.startsWith(DATA_PREFIX)) || null;
}
// データの版が変わったら、新しい名前のキャッシュに切り替えて古いものを消す
async function useDataVersion(v) {
  const name = DATA_PREFIX + (v || 'legacy');
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(DATA_PREFIX) && k !== name).map((k) => caches.delete(k)));
  return caches.open(name);
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // HTTP キャッシュ（GitHub Pages は max-age=600）にある前の版のファイルを入れないように，必ずサーバーから取り直す
    await c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    // 問題の一覧だけは最初から入れておく（本文は開いた分野から順に入る）
    try {
      const res = await fetch('data/index.json', { cache: 'no-cache' });
      if (res.ok) {
        const v = (await res.clone().json()).dataVersion;
        await (await useDataVersion(v)).put('data/index.json', res);
      }
    } catch (err) { /* オフラインでのインストールは一覧なしで続ける */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== CHUNK_CACHE && !k.startsWith(DATA_PREFIX)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function fromNetwork(req, url) {
  // ページ本体（navigate）の Request には init を付けられない（付けると例外になり，いつもキャッシュの古い HTML を返していた）
  const res = await (req.mode === 'navigate' ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }));
  if (!res.ok) return res;
  try { await keep(req, url, res.clone()); } catch (err) { /* キャッシュに入れられなくても，取れた新しい中身は返す */ }
  return res;
}
async function keep(req, url, copy) {
  if (!isData(url)) {
    await (await caches.open(VERSION)).put(req.mode === 'navigate' ? url.href : req, copy);
  } else if (url.pathname.endsWith('/data/index.json')) {
    const index = await copy.clone().json();
    (await useDataVersion(index.dataVersion)).put(req, copy);
    await pruneChunks(index).catch(() => {});
  } else {
    const name = await currentDataCache();
    await (await caches.open(name || DATA_PREFIX + 'legacy')).put(req, copy);
  }
}

// まずネットワーク、つながらなければキャッシュ（更新がすぐ反映されるように）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (isChunk(url)) { e.respondWith(chunkFirst(e.request).catch(() => Response.error())); return; }
  if (legacyField(url)) { e.respondWith(legacyBody(e.request, url)); return; }
  e.respondWith(fromNetwork(e.request, url).catch(() => caches.match(e.request).then((r) => r || (isData(url) ? Response.error() : caches.match('./')))));
});
