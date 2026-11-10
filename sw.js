// オフラインで動かすためのキャッシュ。
//   コード用  … VERSION（アプリを更新したら上げる）。古い版は activate で消す
//   データ用  … lemma-data-<dataVersion>（data/ の中身の版。data/index.json を取り直して版が変わったら、古い問題データを捨てる）
// どちらも「まずネットワーク、つながらなければキャッシュ」なので、更新はすぐ反映される。
const VERSION = 'lemma-v0.9.0';
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/app.js",
  "js/parser.js",
  "js/graph.js",
  "js/content.js",
  "js/scheduler.js",
  "js/graph3d.js",
  "js/catalog.js",
  "js/answer.js",
  "js/ui.js",
  "js/drill.js",
  "js/sync.js",
  "js/config.js",
  "privacy.html",
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
const isData = (url) => url.pathname.includes('/data/');

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
    await c.addAll(FILES);
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
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !k.startsWith(DATA_PREFIX)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function fromNetwork(req, url) {
  const res = await fetch(req, { cache: 'no-cache' });
  if (!res.ok) return res;
  const copy = res.clone();
  if (!isData(url)) {
    (await caches.open(VERSION)).put(req, copy);
  } else if (url.pathname.endsWith('/data/index.json')) {
    const v = (await copy.clone().json()).dataVersion;
    (await useDataVersion(v)).put(req, copy);
  } else {
    const name = await currentDataCache();
    (await caches.open(name || DATA_PREFIX + 'legacy')).put(req, copy);
  }
  return res;
}

// まずネットワーク、つながらなければキャッシュ（更新がすぐ反映されるように）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fromNetwork(e.request, url).catch(() => caches.match(e.request).then((r) => r || (isData(url) ? Response.error() : caches.match('./')))));
});
