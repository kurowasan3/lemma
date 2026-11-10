import { parse, toTeX, relationToTeX, equivalent, sameNumberSet } from './parser.js';
import { Graph, COLORS } from './graph.js';
import { Graph3D } from './graph3d.js';
// 版の確認用（古いファイルに FILE_VERSION が無くても読み込みが止まらないよう名前空間で取り込む）
import * as M_G3 from './graph3d.js';
import * as M_CONTENT from './content.js';
import * as M_SCHED from './scheduler.js';
import * as M_GRAPH from './graph.js';
import * as M_PARSER from './parser.js';
import * as M_CAT from './catalog.js';
import * as M_ANS from './answer.js';
import * as M_UI from './ui.js';
import * as M_DRILL from './drill.js';
import { parseSpec, checkField, fieldHint, fieldUnit, fieldTeX, condTeX, exprTeX } from './answer.js';
import { ICON, play, setSound, applyTheme, BIRD_SVG, BIRD_NAME, birdMessage } from './ui.js';
import { renderDrillHome } from './drill.js';
import { CARDS, cardById, problemById, unitById, subjectById } from './content.js';
import { review, retrievability, dayKey } from './scheduler.js';
import {
  LEVELS, FIELDS, ENTRIES, META, fieldByKey, entryById, loadCatalog, ensureBodies, getBody,
  subjectsWithFields, pool, pickPractice, pickReview, dueEntries, nextReviewTime,
} from './catalog.js';

const VERSION = '0.9.0';
const KEY = 'lemma.v2';
let sync = null, syncApplying = false, syncStatus = null;   // アカウントと同期（initSync で用意）
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------- 保存 ----------
function freshState() {
  return {
    cards: {}, problems: {}, pstat: {}, log: [], explains: {},
    settings: { size: 6, newPerDay: 3 },
    practice: { fields: null, levels: [0, 1, 2, 3, 4, 5], size: 8 }, lv0: 1,
    schema: 4,
    newIntroduced: null, streak: { last: null, count: 0 },
    graphExprs: null,
  };
}
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = { ...freshState(), ...JSON.parse(raw) };
      if (st.schema !== 4) { // v0.3 以前の記録：難易度の段階と分野が変わったので選択だけ初期化
        st.practice = { fields: null, levels: [0, 1, 2, 3, 4, 5], size: (st.practice && st.practice.size) || 8 };
        st.pstat = st.pstat || {};
        st.schema = 4;
      }
      // v0.6 で「基礎」(0) を追加：全段階を選んでいた人は基礎も含める
      if (!JSON.parse(raw).lv0 && st.practice && Array.isArray(st.practice.levels)) {
        if ([1, 2, 3, 4, 5].every(k => st.practice.levels.includes(k)) && !st.practice.levels.includes(0)) st.practice.levels.unshift(0);
        st.lv0 = 1;
      }
      return st;
    }
  } catch (e) { /* 読めないときは新規 */ }
  return freshState();
}
// 設定・選んだ分野などが変わった時刻（端末どうしで食い違ったら新しい方を採る）
let lwwSig = null;
function save() {
  const sig = JSON.stringify([state.settings, state.practice, state.graphExprs, state.graph3Exprs]);
  if (lwwSig !== null && sig !== lwwSig) state.settingsAt = Date.now();
  lwwSig = sig;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境 */ }
  if (sync && !syncApplying) sync.schedule();
}

// ---------- アカウントと同期（js/sync.js を読めないときは、この機能なしで動く）
function initSync() {
  import('./sync.js').then((M) => {
    if (M.FILE_VERSION !== VERSION) showBanner(`<b>古いファイルが混ざっています（v${VERSION}）</b>js/sync.js が更新されていません。リポジトリにzipの中身をすべて上書きアップロードしてください。`);
    if (!M.enabled()) return;
    sync = M.createSync({
      getState: () => state,
      applyState: (merged) => {
        syncApplying = true;
        for (const k of Object.keys(merged)) state[k] = merged[k];
        save();
        syncApplying = false;
        // 解いている途中でなければ、画面を描き直して新しい記録を見せる
        const tab = (location.hash || '#today').slice(1).split('=')[0];
        if (!session && ['today', 'map', 'settings'].includes(tab) && !document.activeElement?.matches('input, textarea')) route();
      },
      onStatus: (s) => { syncStatus = s; const el = $('#acct'); if (el) drawAccount(); },
    });
    syncStatus = sync.status();
    if ((location.hash || '').startsWith('#settings')) renderSettings();
    if (sync.loggedIn()) sync.syncNow();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync.syncNow(); });
    window.addEventListener('online', () => sync.syncNow());
  }).catch(() => { /* 同期なし */ });
}
function drawAccount() {
  const box = $('#acct');
  if (!box) return;
  if (!sync) { box.innerHTML = '<p class="muted" style="margin:0">この版では同期を使えません。</p>'; return; }
  const s = syncStatus || sync.status();
  if (!sync.loggedIn()) {
    box.innerHTML = `
      <p style="margin:0 0 10px">ログインすると、学習記録を複数の端末で使え、サーバーにも保存されます。ログインしなくても、今まで通りこの端末だけで使えます。</p>
      <div id="acct-step1">
        <input class="field-in" type="email" id="acct-email" placeholder="メールアドレス" autocomplete="email" inputmode="email">
        <button class="btn primary block" id="acct-send" style="margin-top:8px">ログイン用のコードを送る</button>
      </div>
      <div id="acct-step2" hidden>
        <p class="muted" style="margin:0 0 6px"><span id="acct-to"></span> に届いたコード（数字）を入れてください（届くまで1分ほどかかることがあります）。</p>
        <input class="field-in code" type="text" id="acct-code" placeholder="123456" inputmode="numeric" autocomplete="one-time-code" maxlength="10">
        <button class="btn primary block" id="acct-verify" style="margin-top:8px">ログイン</button>
        <button class="linkbtn" id="acct-back" style="margin-top:6px">メールアドレスを入れ直す</button>
      </div>
      <p class="acct-err" id="acct-err">${s.error ? esc(s.error) : ''}</p>
      <p class="muted small" style="margin:6px 0 0">保存するのはメールアドレスと学習記録だけです。<a href="privacy.html">プライバシーポリシー</a></p>`;
    const err = (m) => { $('#acct-err').textContent = m || ''; };
    $('#acct-send').addEventListener('click', async (ev) => {
      const email = $('#acct-email').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err('メールアドレスを確かめてください。'); return; }
      ev.target.disabled = true; err('');
      try {
        await sync.sendCode(email);
        $('#acct-step1').hidden = true; $('#acct-step2').hidden = false; $('#acct-to').textContent = email;
        $('#acct-code').focus();
      } catch (e) { err(e.message); }
      ev.target.disabled = false;
    });
    $('#acct-email').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#acct-send').click(); });
    $('#acct-code').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#acct-verify').click(); });
    $('#acct-back').addEventListener('click', () => { $('#acct-step1').hidden = false; $('#acct-step2').hidden = true; err(''); });
    $('#acct-verify').addEventListener('click', async (ev) => {
      ev.target.disabled = true; err('');
      try { await sync.verify($('#acct-email').value.trim(), $('#acct-code').value); toast('ログインしました'); drawAccount(); }
      catch (e) { err(e.message); ev.target.disabled = false; }
    });
    return;
  }
  const when = s.lastSync ? new Date(s.lastSync).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'まだ';
  const label = { syncing: '同期しています…', ok: `最後の同期：${when}`, idle: `最後の同期：${when}`, offline: `オフラインのため同期待ち（最後の同期：${when}）`, error: '同期できませんでした' }[s.status] || '';
  box.innerHTML = `
    <div class="setting" style="padding-top:0"><span><b>${esc(s.email || '')}</b><br><span class="muted small" id="acct-state">${esc(label)}</span></span>
      <button class="btn" id="acct-now" ${s.status === 'syncing' ? 'disabled' : ''}>今すぐ同期</button></div>
    ${s.error && s.status !== 'offline' ? `<p class="acct-err">${esc(s.error)}</p>` : ''}
    <p class="muted small" style="margin:8px 0">この端末の記録とサーバーの記録は、解答の記録を足し合わせ、復習の予定は新しい方を使って合わせます。</p>
    <div class="btn-row" style="margin-top:4px"><button class="btn ghost" id="acct-out">ログアウト</button><button class="btn ghost danger" id="acct-del">退会する</button></div>
    <p class="muted small" style="margin:6px 0 0"><a href="privacy.html">プライバシーポリシー</a></p>`;
  $('#acct-now').addEventListener('click', () => sync.syncNow());
  $('#acct-out').addEventListener('click', async () => {
    if (!confirm('ログアウトします。この端末の記録はそのまま残ります。')) return;
    await sync.syncNow(); await sync.logout(); toast('ログアウトしました'); drawAccount();
  });
  $('#acct-del').addEventListener('click', async () => {
    if (!confirm('退会すると、アカウントとサーバーに保存した学習記録がすべて消えます（この端末の記録は残ります）。元に戻せません。')) return;
    try { await sync.deleteAccount(); toast('退会しました'); } catch (e) { toast(e.message); }
    drawAccount();
  });
}

// ---------- 表示ユーティリティ ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
function math(el) {
  if (!window.renderMathInElement) { setTimeout(() => math(el), 60); return; }
  window.renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
}
function tex(el, src, display = false) {
  if (!window.katex) { el.textContent = src; return; }
  window.katex.render(src, el, { throwOnError: false, displayMode: display });
}
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), 1800);
}
function relTime(t) {
  const d = (t - Date.now()) / 86400000;
  if (d <= 0) return '今';
  if (d < 1 / 24) return `${Math.max(1, Math.round(d * 1440))}分後`;
  if (d < 1) return `${Math.round(d * 24)}時間後`;
  return `${Math.round(d)}日後`;
}

const view = $('#view');
let activeGraphs = [];
function clearGraphs() { activeGraphs.forEach(g => g.destroy()); activeGraphs = []; }

// グラフ部品（ツールボタンとスライダー付き）
function mountGraph(host, exprs, { view: bounds, sliders, sketch = false, hidden = false, height, three = false } = {}) {
  if (height) host.style.height = height + 'px';
  let g;
  try { g = three ? new Graph3D(host) : new Graph(host, {}); }
  catch (e) { host.innerHTML = `<p class="graph-error">グラフを表示できませんでした：${esc(e.message)}</p>`; throw e; }
  activeGraphs.push(g);
  g.setExpressions(exprs.map((src, i) => ({ src, color: COLORS[i % COLORS.length] })));
  if (bounds) g.setView(bounds);
  if (hidden) g.setRevealed(false);
  if (sketch) g.setSketchMode(true);
  const tools = document.createElement('div');
  tools.className = 'graph-tools';
  tools.innerHTML = `
    <button data-z="in" aria-label="拡大">＋</button>
    <button data-z="out" aria-label="縮小">−</button>
    <button data-z="home" aria-label="表示を戻す"><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7 M6 10v10h12V10"/></svg></button>`;
  host.appendChild(tools);
  tools.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.z === 'in') g.zoomBy(1.4);
    if (b.dataset.z === 'out') g.zoomBy(1 / 1.4);
    if (b.dataset.z === 'home') g.resetView();
  });
  if (sliders) renderSliders(sliders, g);
  return g;
}

function renderSliders(box, g) {
  const names = g.paramNames();
  box.innerHTML = names.map(n => {
    const v = g.params[n];
    return `<div class="slider" data-p="${esc(n)}">
      <span class="name">${esc(n)}</span>
      <input type="range" min="-10" max="10" step="0.05" value="${v}" aria-label="${esc(n)} の値">
      <input type="number" step="0.1" value="${+v.toFixed(2)}" aria-label="${esc(n)} の値">
    </div>`;
  }).join('');
  $$('.slider', box).forEach(row => {
    const n = row.dataset.p;
    const [range, num] = $$('input', row);
    range.addEventListener('input', () => { g.setParam(n, +range.value); num.value = (+range.value).toFixed(2); });
    num.addEventListener('change', () => {
      const v = parseFloat(num.value); if (!Number.isFinite(v)) return;
      if (v > +range.max) range.max = Math.ceil(v); if (v < +range.min) range.min = Math.floor(v);
      range.value = v; g.setParam(n, v);
    });
  });
}

// ---------- ルーティング ----------
let session = null; // { steps, i, results: [], extra }

let ready = false;
let greeted = false;
let timer = null;
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function route() {
  stopTimer();
  if (!ready) { view.innerHTML = '<p class="muted" style="padding:40px 4px">問題データを読み込んでいます…</p>'; return; }
  let tab = (location.hash || '#today').slice(1);
  let arg = '';
  if (tab.includes('=')) { arg = decodeURIComponent(tab.slice(tab.indexOf('=') + 1)); tab = tab.slice(0, tab.indexOf('=')); }
  // 共有リンク：#set=<問題セットID>、#ids=<問題ID,…>（開いたら「今日」に戻してから出題）
  if (tab === 'set' || tab === 'ids') {
    history.replaceState(null, '', '#today');
    if (tab === 'set') openCollection(arg); else openIds(arg.split(',').map(x => x.trim()).filter(Boolean));
    return;
  }
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === (tab === 'practice' || tab === 'search' ? 'today' : tab)));
  document.body.dataset.tab = tab;
  clearGraphs();
  document.body.classList.remove('immersive');
  window.scrollTo(0, 0);
  $('#bird')?.classList.remove('talk'); // 画面を移ったら吹き出しは閉じる
  if (tab === 'graph') return renderGraphPage();
  if (tab === 'map') return renderMap();
  if (tab === 'settings') return renderSettings();
  if (tab === 'practice') return renderPractice();
  if (tab === 'search') return renderSearch(arg);
  if (tab === 'drill') return renderDrillHome(view, drillCtx);
  // 結果画面を見たあとに「今日」へ戻ったら、ホームを出す
  if (session && session.shown && !session.steps[session.i]) session = null;
  if (session) return renderStep();
  return renderToday();
}
window.addEventListener('hashchange', route);

// ---------- 今日 ----------
function levelToolbar(pr, onChange) {
  return {
    html: `<div class="toolbar">
        <div class="toggles" id="lv">${Object.entries(LEVELS).map(([k, v]) => `<button class="tog lv${k} ${pr.levels.includes(+k) ? 'on' : ''}" data-l="${k}">${v}</button>`).join('')}</div>
        <select id="tsize" aria-label="問題数">${[4, 6, 8, 10, 15, 20].map(k => `<option value="${k}" ${k === pr.size ? 'selected' : ''}>${k}問</option>`).join('')}</select>
      </div>`,
    bind() {
      $$('#lv .tog').forEach(b => b.addEventListener('click', () => {
        const k = +b.dataset.l, set = new Set(pr.levels);
        if (set.has(k) && set.size === 1) { toast('難易度は1つ以上選んでください'); return; }
        set.has(k) ? set.delete(k) : set.add(k);
        pr.levels = [...set].sort((x, y) => x - y); save(); onChange();
      }));
      $('#tsize').addEventListener('change', (e) => { pr.size = +e.target.value; save(); onChange(); });
    },
  };
}

function renderToday() {
  const pr = state.practice;
  const solved = (list) => list.filter(e => state.problems[e.id]).length;
  const all = pool({ levels: pr.levels });
  const due = dueEntries(state).length;
  const doneToday = state.streak.last === dayKey();
  const bar = levelToolbar(pr, renderToday);
  view.innerHTML = `
    <div class="fade-in">
      <div class="kicker">LEMMA · 受験数学</div>
      <h1>演習</h1>
      <p class="sub">${state.streak.count ? `連続 ${state.streak.count}日${doneToday ? '（今日の分 ✓）' : ''}・` : ''}解いた問題 ${solved(all)} / ${all.length}</p>
      ${bar.html}
      <button class="hero" id="random">
        <b>全分野からランダム</b>
        <span>数I〜数C・融合の全${FIELDS.length}分野から ${Math.min(pr.size, all.length)}問。分野を混ぜて出すので、どの解法を使うかを見抜く練習になります。</span>
      </button>
      ${due ? `<button class="btn block" id="review" style="margin-top:10px">復習：忘れかけた問題 ${due}問</button>` : ''}
      <form class="search" id="sform" role="search">
        <input type="search" id="sq" placeholder="問題を探す（例：漸化式 確率、回転体）" enterkeyhint="search" autocomplete="off">
        <button class="btn" type="submit">検索</button>
      </form>
      <div id="sets"></div>
      <h2>分野ごとに演習</h2>
      ${subjectsWithFields().map(sub => {
        const subAll = pool({ fields: sub.fields.map(f => f.key), levels: pr.levels });
        return `<div class="subj-block">
          <button class="subj-row" data-s="${esc(sub.name)}" ${subAll.length ? '' : 'disabled'}>
            <b>${esc(sub.name === '融合' ? '融合問題' : sub.name.replace('数', '数学'))}</b><span>${solved(subAll)} / ${subAll.length}</span><i>まとめて ›</i>
          </button>
          ${sub.fields.map(f => {
            const list = pool({ fields: [f.key], levels: pr.levels }), d = solved(list);
            return `<button class="unit-row" data-f="${esc(f.key)}" ${list.length ? '' : 'disabled'}>
              <span class="nm">${esc(f.name)}</span><span class="ct">${d} / ${list.length}</span>
              <span class="bar"><div style="width:${list.length ? Math.round(d / list.length * 100) : 0}%"></div></span>
            </button>`;
          }).join('')}
        </div>`;
      }).join('')}
      <button class="btn ghost block" id="pick" style="margin-top:14px">複数の分野を組み合わせて選ぶ</button>
      <h2>このアプリの学び方</h2>
      <div class="panel">
        <ol style="margin:0;padding-left:1.2em">
          <li><strong>紙に解いてから答え合わせ。</strong>解説を読む前に自力で考える方が、記憶に残ります。</li>
          <li><strong>ヒントは答えを出さない。</strong>詰まったら「考え方」だけを見られます。</li>
          <li><strong>答え合わせの前に自信度を選ぶ。</strong>「わかったつもり」とのズレを定着度ページで見られます。</li>
          <li><strong>忘れかけた頃に復習。</strong>解けなかった問題ほど早く、解けた問題は間をあけて復習に出します。</li>
        </ol>
      </div>
    </div>`;
  bar.bind();
  if (!greeted) { greeted = true; setTimeout(() => birdSay(birdMessage('greet'), { sound: false }), 700); }
  const go = (fields) => {
    const cfg = { fields, levels: pr.levels.slice(), size: pr.size };
    const st = pickPractice(state, cfg);
    if (st.length) startSession(st, cfg); else toast('この条件の問題はありません');
  };
  $('#random').addEventListener('click', () => go(null));
  $$('.unit-row').forEach(b => b.addEventListener('click', () => go([b.dataset.f])));
  $$('.subj-row').forEach(b => b.addEventListener('click', () => go(FIELDS.filter(f => f.subject === b.dataset.s).map(f => f.key))));
  $('#pick').addEventListener('click', () => { location.hash = '#practice'; });
  $('#sform').addEventListener('submit', (ev) => { ev.preventDefault(); const q = $('#sq').value.trim(); if (q) location.hash = '#search=' + encodeURIComponent(q); });
  drawSets();
  $('#review')?.addEventListener('click', () => {
    const st = pickReview(state, { size: pr.size });
    if (st.length) startSession(st, { review: true, size: pr.size });
  });
}

// ---------- 問題セット・共有リンク・検索 ----------
const shareURL = (frag) => location.href.split('#')[0] + '#' + frag;
async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); toast('リンクをコピーしました'); }
  catch { toast(url); }
}
async function drawSets() {
  const box = $('#sets');
  if (!box || !M_CAT.loadCollections) return;
  const cols = await M_CAT.loadCollections();
  if (!cols.length || !document.body.contains(box)) return;
  box.innerHTML = `<h2>問題セット</h2>${cols.map(c => {
    const done = M_CAT.collectionProgress(state, c), n = c.items.length;
    return `<div class="set-card">
      <button class="set-main" data-set="${esc(c.id)}">
        <span class="set-head"><b>${esc(c.title)}</b><span class="ct">${done} / ${n}問</span></span>
        ${c.description ? `<span class="muted set-desc">${esc(c.description)}</span>` : ''}
        <span class="bar"><div style="width:${Math.round(done / n * 100)}%"></div></span>
      </button>
      <div class="set-foot"><span class="set-go">${done >= n ? 'もう一周 ›' : done ? '続きから ›' : '始める ›'}</span><button class="linkbtn" data-share="${esc(c.id)}">リンクをコピー</button></div>
    </div>`;
  }).join('')}`;
  $$('[data-set]', box).forEach(b => b.addEventListener('click', () => openCollection(b.dataset.set)));
  $$('.set-go', box).forEach(x => x.addEventListener('click', () => openCollection(x.closest('.set-card').querySelector('[data-set]').dataset.set)));
  $$('[data-share]', box).forEach(b => b.addEventListener('click', () => copyLink(shareURL('set=' + b.dataset.share))));
}
async function openCollection(id) {
  const col = (await M_CAT.loadCollections()).find(c => c.id === id);
  if (!col) { toast('この問題セットは見つかりません'); route(); return; }
  const steps = M_CAT.pickCollection(state, col, state.practice.size);
  startSession(steps, { collection: id, size: state.practice.size });
}
function openIds(ids) {
  const ok = ids.filter(id => entryById.has(id)).slice(0, 50);
  if (!ok.length) { toast('リンクの問題が見つかりません'); route(); return; }
  startSession(ok.map(pid => ({ kind: 'problem', pid })), { ids: ok, size: ok.length });
}
let searchShown = 30;
async function renderSearch(q) {
  const pr = state.practice;
  const bar = levelToolbar(pr, () => renderSearch(q));
  view.innerHTML = `<div class="fade-in">
    <div class="kicker">問題を探す</div>
    <h1>検索</h1>
    <form class="search" id="sform" role="search">
      <input type="search" id="sq" value="${esc(q)}" placeholder="例：漸化式 確率、回転体、チェビシェフ" enterkeyhint="search" autocomplete="off">
      <button class="btn" type="submit">検索</button>
    </form>
    ${bar.html}
    <div id="sres"><p class="muted">探しています…</p></div>
  </div>`;
  bar.bind();
  $('#sform').addEventListener('submit', (ev) => { ev.preventDefault(); const v = $('#sq').value.trim(); searchShown = 30; location.hash = '#search=' + encodeURIComponent(v); });
  const box = $('#sres');
  if (!q) { box.innerHTML = '<p class="muted">テーマ・タグ・問題文の言葉で探せます。空白で区切ると、すべてを含む問題を探します。</p>'; return; }
  let res;
  try { res = await M_CAT.searchProblems(q, { levels: pr.levels }); }
  catch (e) { box.innerHTML = `<p class="muted">検索の索引を読めませんでした（${esc(e.message)}）。</p>`; return; }
  dataWarn();
  if (!res.length) { box.innerHTML = '<p class="muted">見つかりませんでした。言葉を短くするか、難易度の選択を広げてみてください。</p>'; return; }
  const fresh = res.filter(e => !state.problems[e.id]);
  const pickIds = [...fresh, ...res.filter(e => state.problems[e.id])].slice(0, pr.size).map(e => e.id);
  box.innerHTML = `<p class="sub" style="margin:4px 0 10px">${res.length}問 見つかりました（未着手 ${fresh.length}問）</p>
    <div class="btn-row" style="margin-top:0"><button class="btn primary" id="sgo">${pickIds.length}問 演習する</button><button class="btn ghost" id="sshare">リンクをコピー</button></div>
    <div class="results">${res.slice(0, searchShown).map(e => {
      const f = fieldByKey[e.f] || {};
      return `<button class="res-row" data-pid="${esc(e.id)}">
        <span class="nm">${e.th || esc(e.id)}</span>
        <span class="muted small">${esc(f.subject || '')}・${esc(f.name || '')}　<span class="chip lv${e.lv}">${LEVELS[e.lv]}</span>${state.problems[e.id] ? '　✓ 解いた' : ''}${(e.tg || []).length ? '　' + e.tg.slice(0, 3).map(esc).join('・') : ''}</span>
      </button>`;
    }).join('')}</div>
    ${res.length > searchShown ? `<button class="btn ghost block" id="smore">さらに表示（残り ${res.length - searchShown}問）</button>` : ''}`;
  math(box);
  $('#sgo').addEventListener('click', () => startSession(pickIds.map(pid => ({ kind: 'problem', pid })), { ids: pickIds, size: pickIds.length }));
  $('#sshare').addEventListener('click', () => copyLink(shareURL('search=' + encodeURIComponent(q))));
  $('#smore')?.addEventListener('click', () => { searchShown += 60; renderSearch(q); });
  $$('.res-row', box).forEach(b => b.addEventListener('click', () => openIds([b.dataset.pid])));
}

async function startSession(steps, cfg = null) {
  view.innerHTML = '<p class="muted" style="padding:40px 4px">問題を読み込んでいます…</p>';
  try { await ensureBodies(steps.map(s => s.pid).filter(Boolean)); dataWarn(); }
  catch (e) { showBanner(`<b>問題を読み込めませんでした</b>${esc(e.message)}`); route(); return; }
  session = { steps, i: 0, results: [], cfg };
  if (!studyStart || Date.now() - lastActivity > 15 * 60000) { studyStart = Date.now(); breakNotified = 0; }
  lastActivity = Date.now();
  const hr = new Date().getHours();
  if (hr >= 0 && hr < 4) setTimeout(() => birdSay(birdMessage('late')), 800);
  if (location.hash !== '#today') location.hash = '#today'; else route();
}

// ---------- セッション ----------
function renderStep() {
  document.body.classList.add('immersive');
  const step = session.steps[session.i];
  if (!step) { session.shown = true; return renderSummary(); }
  if (step.kind === 'intro') return renderIntro(step);
  return renderProblem(step);
}

function topBar() {
  const done = session.i, total = session.steps.length;
  return `<div class="player-top">
    <button class="icon-btn" id="quit" aria-label="中断">×</button>
    <div class="progress"><div style="width:${Math.round(done / total * 100)}%"></div></div>
  </div>`;
}
function bindQuit() {
  $('#quit').addEventListener('click', () => {
    if (session.results.length && !confirm('中断しますか？ここまでの結果は保存されています。')) return;
    session = null; route();
  });
}
function nextStep() { lastActivity = Date.now(); stopTimer(); session.i++; clearGraphs(); window.scrollTo(0, 0); renderStep(); }

function renderIntro(step) {
  const c = cardById[step.cid];
  view.innerHTML = `
    <div class="fade-in intro">
      ${topBar()}
      <div class="kicker">新しい解法 · ${esc(subjectById[unitById[c.unit].subject].name)} ${esc(unitById[c.unit].name)}</div>
      <h1>${rich(c.name)}</h1>
      <div class="panel" style="margin-top:14px">
        <div class="point">${rich(c.point)}</div>
        ${c.example ? `<div class="example"><span class="chip plain">例</span> ${rich(c.example)}</div>` : ''}
      </div>
      ${c.graph ? '<div id="ig"></div><div class="sliders" id="isl"></div>' : ''}
      <button class="btn primary block" id="go" style="margin-top:16px">この解法で問題を解く</button>
    </div>`;
  math(view);
  bindQuit();
  if (c.graph) mountGraph($('#ig'), c.graph, { sliders: $('#isl'), height: 240 });
  $('#go').addEventListener('click', nextStep);
}

const CONF = [{ id: 'low', label: '自信なし' }, { id: 'mid', label: 'たぶん' }, { id: 'high', label: '確実' }];
const FEEL = [
  { k: 1, label: '手が出ない' }, { k: 2, label: '苦戦' }, { k: 3, label: 'ふつう' }, { k: 4, label: 'ほぼ解けた' }, { k: 5, label: '余裕' },
];

// 解説を読みやすく：文の終わりで改行し、∫・Σ・lim を大きく表示する
function bigOps(html) {
  return html.replace(/\$([^$]+)\$/g, (m, body) => /\\(int|iint|sum|prod|lim)\b/.test(body) && !/\\displaystyle/.test(body) ? `$\\displaystyle ${body}$` : m);
}
function formatSolution(html) {
  if (!html) return '';
  const keep = [];
  // 数式とタグを退避してから、文末の「．」「。」の後で改行
  let t = html.replace(/\$[^$]*\$|\\\[[\s\S]*?\\\]|<[^>]+>/g, (m) => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
  t = t.replace(/([．。])(?=\s*[^\s<\u0000)）」』．。,，、]|\s*\u0000\d+\u0000\s*[^<\s])/g, '$1<br>');
  t = t.replace(/\u0000(\d+)\u0000/g, (_, k) => keep[+k]);
  // 数式の直後の句読点だけが次の行に送られないようにする
  t = t.replace(/\$([^$]+)\$([．。，、])/g, (m, body, p) => `$${body}\\text{${p}}$`);
  t = t.replace(/(<br>\s*){2,}/g, '<br>').replace(/<br>\s*(<\/?(div|ol|ul|li|table)\b)/g, '$1').replace(/<br>\s*$/, '');
  return bigOps(t);
}

// 大学で習う用語が出てきたら、高校の言葉で説明を添える
const GLOSSARY = [
  ['有界', 'ある定数 $M$ があって，すべてについて $|\\text{値}|\\leqq M$ となること（ある範囲からはみ出さないこと）。「上に有界」は ある定数以下、「下に有界」は ある定数以上 に収まること。'],
  ['上限', '（大学の用語として）値の全体以上になる数のうち最小のもの。最大値がなくても決まる。例：$0<x<1$ の上限は $1$。'],
  ['下限', '（大学の用語として）値の全体以下になる数のうち最大のもの。例：$x>0$ の下限は $0$。'],
  ['単射', '異なるものには異なる値が対応すること（$x\\neq x\'\\Rightarrow f(x)\\neq f(x\')$）。'],
  ['全単射', '「異なるものには異なる値」かつ「どの値も必ず現れる」こと。1対1の対応。'],
  ['全射', '行き先のどの値も、どれかの値として必ず現れること。'],
  ['写像', '集合の各要素に、別の集合の要素を1つずつ対応させる規則（関数を一般にしたもの）。'],
  ['一様', '場所（$x$ など）によらず，同じ定数で評価できること。'],
  ['稠密', 'どんなに短い区間をとっても，その中に必ず含まれること（例：有理数は実数の中で稠密）。'],
  ['凸関数', 'グラフが下に凸な関数。'],
];
function glossaryHTML(text) {
  const found = GLOSSARY.filter(([w]) => text.includes(w)).filter(([w], i, arr) => !(w === '全射' && arr.some(([v]) => v === '全単射')));
  if (!found.length) return '';
  return `<div class="glossary"><b>用語</b>${found.map(([w, d]) => `<p><strong>${w}</strong>：${d}</p>`).join('')}</div>`;
}

// ---------- 鳥「ルート」
let birdTimer = null;
function birdSay(msg, { sound = true, ms = 9000 } = {}) {
  let el = $('#bird');
  if (!el) return;
  const bub = $('#bird .bubble');
  bub.innerHTML = `<b>${BIRD_NAME}</b>${esc(msg).replace(/\n/g, '<br>')}`;
  el.classList.add('talk');
  if (sound && state.settings.sound !== false) play('bird');
  clearTimeout(birdTimer);
  birdTimer = setTimeout(() => el.classList.remove('talk'), ms);
}
function mountBird() {
  if ($('#bird') || state.settings.bird === false) return;
  const el = document.createElement('div');
  el.id = 'bird';
  el.innerHTML = `<div class="bubble" role="status"></div><button class="bird-btn" aria-label="${BIRD_NAME}に話しかける">${BIRD_SVG}</button>`;
  document.body.appendChild(el);
  $('.bird-btn', el).addEventListener('click', () => {
    if (el.classList.contains('talk')) { el.classList.remove('talk'); return; }
    birdSay(birdMessage('random'));
  });
  $('.bubble', el).addEventListener('click', () => el.classList.remove('talk'));
}
let studyStart = null, breakNotified = 0, lastActivity = 0;
function birdCheckBreak() {
  if (!studyStart) return;
  const min = Math.floor((Date.now() - studyStart) / 60000);
  const step = min >= 50 ? 2 : min >= 25 ? 1 : 0;
  if (step > breakNotified) { breakNotified = step; birdSay(birdMessage('break', { min }), { ms: 12000 }); }
}

// 共通の問題ビュー（catalog.js が古いときは一覧の項目から作る：一部だけ更新された場合でも動くように）
function problemView(e) {
  if (M_CAT.getProblem) return M_CAT.getProblem(e.id);
  const f = fieldByKey[e.f] || {};
  return { id: e.id, kind: e.kind === 'bank' ? 'written' : 'interactive', subject: f.subject, fieldName: f.name,
    level: e.lv, levelName: LEVELS[e.lv], minutes: e.t || null, grading: e.in ? {} : null };
}
function metaChips(e) {
  const p = problemView(e);
  return `<span class="chip">${esc(p.subject)}・${esc(p.fieldName)}</span>
        <span class="chip lv${p.level}">${p.levelName}</span>
        ${p.minutes ? `<span class="chip plain">目安 ${p.minutes}分</span>` : ''}
        ${p.kind === 'written' ? `<span class="chip plain">${p.grading ? '入力して採点' : '自己採点'}</span>` : ''}`;
}

function recordResult(pid, grade, extra) {
  const now = Date.now();
  state.pstat[pid] = review(state.pstat[pid], grade, now);
  state.problems[pid] = { last: now, n: ((state.problems[pid] || {}).n || 0) + 1 };
  state.log.push({ p: pid, t: now, g: grade, ...extra });
  if (state.log.length > 5000) state.log = state.log.slice(-5000);
  const today = dayKey(now);
  if (state.streak.last !== today) {
    const y = dayKey(now - 86400000);
    state.streak = { last: today, count: state.streak.last === y ? state.streak.count + 1 : 1 };
  }
  save();
  session.results.push({ pid, grade });
  return state.log[state.log.length - 1];
}

function renderProblem(step) {
  const entry = entryById.get(step.pid);
  if (!entry) { nextStep(); return; }
  if (entry.kind === 'bank') return renderWritten(step, entry);
  const p = problemById[step.pid];
  const t0 = Date.now();
  const a = { hints: 0, conf: null, attempts: 0, choice: null, done: false, correct: false, firstCorrect: null, grade: null };
  const order = p.type === 'choice' ? shuffle(p.choices.map((_, i) => i)) : null;

  view.innerHTML = `
    <div class="fade-in">
      ${topBar()}
      <div class="meta">
        ${metaChips(entry)}<span class="chip plain">自動判定</span>
        <span class="count">${session.i + 1} / ${session.steps.length}</span>
      </div>
      <div class="question">${rich(p.q)}</div>
      <div id="answer"></div>
      <div id="conf"></div>
      <div class="btn-row" id="actions"></div>
      <div class="hint-list" id="hints"></div>
      <div id="feedback"></div>
    </div>`;
  math($('.question'));
  bindQuit();

  const answerBox = $('#answer');
  let input = null, graph = null;

  if (p.type === 'choice') {
    answerBox.innerHTML = `<div class="choices">${order.map(i => `<button class="choice" data-i="${i}">${rich(p.choices[i])}</button>`).join('')}</div>`;
    math(answerBox);
    $$('.choice', answerBox).forEach(b => b.addEventListener('click', () => {
      if (a.done) return;
      a.choice = +b.dataset.i;
      $$('.choice', answerBox).forEach(x => x.classList.toggle('on', x === b));
      updateActions();
    }));
  } else if (p.type === 'sketch') {
    answerBox.innerHTML = `<div id="sg"></div><p class="muted" style="margin:6px 2px 0">1本指で描く・2本指で移動/拡大。描き直すときは「消す」。</p>`;
    graph = mountGraph($('#sg'), p.graph, { view: p.view, sketch: true, hidden: true, height: 300 });
  } else {
    answerBox.innerHTML = `
      <div class="answer-row">
        ${p.prefix ? `<span class="prefix">${esc(p.prefix)}</span>` : ''}
        <input class="answer-input" id="ans" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="${p.type === 'nums' ? '例: 1, -3' : p.type === 'num' ? '例: 14/3, e^2, pi/4' : '例: 3x^2 + 2x'}" aria-label="答え">
      </div>
      <div class="preview" id="pv"></div>
      <div class="keypad">${['^', '(', ')', '/', '√', 'π', 'e', 'sin', 'cos', 'log', ','].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="inline-err" id="ierr"></div>`;
    input = $('#ans');
    const pv = $('#pv');
    const preview = () => {
      $('#ierr').textContent = '';
      const v = input.value.trim();
      if (!v) { pv.textContent = ''; pv.className = 'preview'; updateActions(); return; }
      try {
        const parts = p.type === 'nums' ? v.split(/[,、，]/).filter(s => s.trim()) : [v];
        tex(pv, parts.map(s => s.includes('=') ? relationToTeX(s) : toTeX(parse(s))).join(',\\ '));
        pv.className = 'preview';
      } catch (e) { pv.textContent = e.message; pv.className = 'preview err'; }
      updateActions();
    };
    input.addEventListener('input', preview);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#judge')?.click(); });
    $$('.keypad button', answerBox).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      const ins = ['sin', 'cos', 'log', '√'].includes(k) ? k + '(' : k;
      const s = input.selectionStart ?? input.value.length, e2 = input.selectionEnd ?? s;
      input.value = input.value.slice(0, s) + ins + input.value.slice(e2);
      input.focus();
      input.setSelectionRange(s + ins.length, s + ins.length);
      preview();
    }));
  }

  // 自信度（スケッチ以外）
  if (p.type !== 'sketch') {
    $('#conf').innerHTML = `<div class="label">答える前に：どのくらい自信がある？</div>
      <div class="segment conf">${CONF.map(c => `<button data-c="${c.id}">${ICON[c.id]}<span>${c.label}</span></button>`).join('')}</div>`;
    $$('#conf button').forEach(b => b.addEventListener('click', () => {
      if (a.done) return;
      a.conf = b.dataset.c;
      $$('#conf button').forEach(x => x.classList.toggle('on', x === b));
      updateActions();
    }));
  }

  function hasAnswer() {
    if (p.type === 'choice') return a.choice !== null;
    if (p.type === 'sketch') return true;
    return input && input.value.trim() !== '';
  }

  function updateActions() {
    const box = $('#actions');
    if (a.done) { box.innerHTML = ''; return; }
    const hintBtn = a.hints < p.hints.length ? `<button class="btn ghost" id="hint">ヒント ${a.hints}/${p.hints.length}</button>` : '';
    if (p.type === 'sketch') {
      box.innerHTML = `${hintBtn}<button class="btn" id="clear">消す</button><button class="btn primary" id="reveal">答え合わせ</button>`;
      $('#clear').addEventListener('click', () => graph.clearSketch());
      $('#reveal').addEventListener('click', revealSketch);
    } else {
      const ready = hasAnswer() && a.conf;
      box.innerHTML = `${hintBtn}<button class="btn primary" id="judge" ${ready ? '' : 'disabled'}>${a.attempts ? 'もう一度判定' : '判定'}</button>`;
      $('#judge').addEventListener('click', judge);
    }
    $('#hint')?.addEventListener('click', showHint);
  }

  function showHint() {
    if (a.hints >= p.hints.length) return;
    const h = document.createElement('div');
    h.className = 'hint fade-in';
    h.innerHTML = `<b>ヒント${a.hints + 1}</b>${rich(p.hints[a.hints])}`;
    $('#hints').appendChild(h);
    math(h);
    a.hints++;
    updateActions();
  }

  function judge() {
    let res;
    if (p.type === 'choice') res = { ok: a.choice === 0 };
    else if (p.type === 'nums') res = sameNumberSet(input.value, p.ans);
    else res = equivalent(input.value, p.ans, p.vars || {});
    if (res.error && !res.ok && p.type !== 'choice') {
      $('#ierr').textContent = res.error;
      if (/使えない|形が正しく|括弧|途中|空|必要/.test(res.error)) return; // 書式の誤りは試行に数えない
    }
    a.attempts++;
    if (a.firstCorrect === null) a.firstCorrect = res.ok;
    const fb = $('#feedback');
    if (res.ok) {
      a.correct = true;
      const grade = a.attempts > 1 || a.hints > 0 ? 2 : (a.conf === 'high' ? 4 : 3);
      finish(grade);
      play('correct');
      fb.innerHTML = `<div class="result ok fade-in"><span class="mark">${ICON.ok}</span><div>正解${a.hints ? `<small>ヒント${a.hints}つで到達</small>` : a.attempts > 1 ? '<small>2回目以降で正解</small>' : ''}</div></div>`;
      if (p.type === 'choice') markChoices();
      showSolution();
    } else {
      play('wrong');
      fb.innerHTML = `<div class="result ng fade-in"><span class="mark">${ICON.ng}</span><div>違うようです<small>どこで考え違いをしたか、もう一度確かめてみよう。</small></div></div>
        <div class="btn-row"><button class="btn" id="retry">もう一度考える</button><button class="btn" id="giveup">解答を見る</button></div>`;
      $('#retry').addEventListener('click', () => { fb.innerHTML = ''; if (input) { input.focus(); input.select(); } });
      $('#giveup').addEventListener('click', () => {
        finish(1);
        fb.innerHTML = `<div class="result ng"><span class="mark">${ICON.ng}</span><div>今回は解けず<small>近いうちにもう一度出題します。</small></div></div>`;
        if (p.type === 'choice') markChoices();
        showSolution(true);
      });
      if (p.type === 'choice') { a.choice = null; $$('.choice').forEach(x => x.classList.remove('on')); }
      updateActions();
    }
  }

  function markChoices() {
    $$('.choice').forEach(x => {
      const i = +x.dataset.i;
      if (i === 0) x.classList.add('right'); else if (x.classList.contains('on')) x.classList.add('wrong');
    });
  }

  function revealSketch() {
    graph.setRevealed(true);
    graph.setSketchMode(false);
    a.done = true;
    updateActions();
    const fb = $('#feedback');
    fb.innerHTML = `<div class="label">重ねて見比べよう。予想はどうだった？</div>
      <div class="segment" id="self">
        <button data-g="3">ほぼ合っていた</button><button data-g="2">一部ずれていた</button><button data-g="1">違っていた</button>
      </div>`;
    $$('#self button').forEach(b => b.addEventListener('click', () => {
      const g = Math.min(+b.dataset.g, a.hints ? 2 : 4);
      a.conf = null;
      finish(g, true);
      $$('#self button').forEach(x => { x.disabled = true; x.classList.toggle('on', x === b); });
      showSolution(false, true);
    }));
  }

  function finish(grade, sketch = false) {
    if (a.done && a.grade) return;
    a.done = true;
    a.grade = grade;
    const now = Date.now();
    for (const cid of p.cards) {
      const g = cid === p.cards[0] ? grade : (grade >= 3 ? 3 : null);
      if (g === null || (cid !== p.cards[0] && !state.cards[cid]?.reps)) continue;
      state.cards[cid] = review(state.cards[cid], g, now);
    }
    a.log = recordResult(p.id, grade, { h: a.hints, c: sketch ? null : a.conf, ok: sketch ? grade >= 3 : !!a.firstCorrect, min: Math.max(1, Math.round((now - t0) / 60000)) });
    updateActions();
    $$('#conf button').forEach(x => x.disabled = true);
    if (input) input.readOnly = true;
  }

  function showSolution(gaveUp = false, sketch = false) {
    const fb = $('#feedback');
    const box = document.createElement('div');
    box.className = 'fade-in';
    const names = p.cards.map(id => `<span class="chip plain">${rich(cardById[id].name)}</span>`).join('');
    const key = cardById[p.cards[0]];
    const canGraph = (p.graph || p.graph3) && !sketch;
    box.innerHTML = `
      <div class="solution">
        <div class="title">解答</div>
        <div>${rich(p.sol)}</div>
        <div class="methods">${names}</div>
        <div class="keypoint"><b>要点</b>${rich(key.point)}</div>
      </div>
      ${canGraph ? '<div class="btn-row"><button class="btn" id="showg">グラフで確かめる</button></div><div id="pg" style="margin-top:12px"></div><div class="sliders" id="psl"></div>' : ''}
      <div class="label">${gaveUp ? '次に同じ型を見たら、最初に何をする？' : 'この問題で最初に気づくべきことを1行で'}</div>
      <textarea class="explain" id="explain" placeholder="例：交点の x 座標を出して1/6公式"></textarea>
      <p class="muted" style="margin:6px 2px 0">自分の言葉で書くと、次に初見の問題で方針が立ちやすくなります（任意）。</p>
      <button class="btn primary block" id="next" style="margin-top:14px">${session.i + 1 < session.steps.length ? '次へ' : '結果を見る'}</button>`;
    fb.appendChild(box);
    math(box);
    $('#showg')?.addEventListener('click', (e) => {
      e.target.closest('.btn-row').remove();
      mountGraph($('#pg'), p.graph3 || p.graph, { view: p.view, sliders: $('#psl'), height: 300, three: !!p.graph3 });
    });
    $('#next').addEventListener('click', () => {
      const t = $('#explain').value.trim();
      if (t) {
        state.explains[p.id] = [...(state.explains[p.id] || []), { t: Date.now(), text: t }].slice(-5);
        if (a.log) a.log.note = t;
        save();
      }
      nextStep();
    });
  }

  updateActions();
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 50);
}

// 問題管理表の問題：入力用の答えがあれば入力して自動採点、なければ紙に解いて自己採点
const SELF = [
  { id: 'full', label: '完答', icon: 'full' },
  { id: 'part', label: '一部正解', icon: 'part' },
  { id: 'none', label: '不正解', icon: 'none' },
];
const CONF_ICON = { low: 'low', mid: 'mid', high: 'high' };
const KEYS = ['^', '(', ')', '/', '√', 'π', 'e', 'sin', 'cos', 'log', ',', '<', '>', '≦', '≧', '±', '|'];

function labelHTML(label) {
  if (!label) return '';
  return esc(label);
}

function renderWritten(step, e) {
  const b = getBody(e.id);
  if (!b) { showBanner('<b>問題本文がありません</b>' + esc(e.id)); nextStep(); return; }
  let spec = null;
  try { spec = b.in ? parseSpec(b.in) : null; } catch (err) { spec = null; }
  const t0 = Date.now();
  const a = { conf: null, hint: false, revealed: false, sg: null, feel: null, log: null, min: null, attempts: 0, results: null, firstAllOk: null, disputes: [] };
  // 入力欄の状態：fields[k] = { f, part, mode: 'plain'|'cases', text, rows }
  const fields = [];
  if (spec) spec.parts.forEach((p, pi) => p.fields.forEach(f => fields.push({ f, part: p.n, pi, mode: 'plain', text: '', rows: [{ cond: '', val: '' }, { cond: '', val: '' }] })));
  const autoFields = fields.filter(x => x.f.kind !== 'self');
  const selfParts = spec ? [...new Set(fields.filter(x => x.f.kind === 'self').map(x => x.part))] : [];
  let focused = null;

  view.innerHTML = `
    <div class="fade-in written">
      ${topBar()}
      <div class="meta">
        ${metaChips(e)}
        <span class="chip plain timer" id="clock">0:00</span>
        <span class="count">${session.i + 1} / ${session.steps.length}</span>
      </div>
      <div class="question qhtml">${bigOps(b.q)}</div>
      ${spec ? '<div id="inputs" class="inputs"></div>' : '<p class="muted pen">この問題は紙に解いてから、答え合わせで自己採点します。</p>'}
      <div id="conf"><div class="label">${spec ? '判定の前に' : '答え合わせの前に'}：どのくらい自信がある？</div>
        <div class="segment conf">${CONF.map(c => `<button data-c="${c.id}">${ICON[CONF_ICON[c.id]]}<span>${c.label}</span></button>`).join('')}</div></div>
      <div class="btn-row" id="actions"></div>
      <div class="hint-list" id="hints"></div>
      <div id="feedback"></div>
      <div class="pid muted">${esc(e.id)}</div>
    </div>`;
  math($('.question'));
  bindQuit();
  const clock = $('#clock');
  const tick = () => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    clock.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    if (e.t && sec > e.t * 60) clock.classList.add('over');
    birdCheckBreak();
  };
  timer = setInterval(tick, 1000);

  // ---------- 入力欄
  function drawInputs() {
    if (!spec) return;
    const box = $('#inputs');
    const byPart = {};
    fields.forEach((x, k) => { (byPart[x.part] = byPart[x.part] || []).push(k); });
    box.innerHTML = Object.entries(byPart).map(([n, ks]) => `
      <div class="part">
        ${n ? `<div class="pn">(${esc(n)})</div>` : ''}
        <div class="pf">${ks.map(k => fieldHTML(k)).join('')}</div>
      </div>`).join('') + `<div class="keypad sticky" id="kp">${KEYS.map(k => `<button type="button" data-k="${esc(k)}">${esc(k)}</button>`).join('')}${extraKeys()}</div>`;
    math(box);
    bindInputs();
  }
  function extraKeys() {
    const letters = new Set();
    for (const x of autoFields) for (const ch of (x.f.src || '').match(/[α-ω]/g) || []) letters.add(ch);
    return [...letters].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('') + '<button type="button" data-k="または" class="wide">または</button>';
  }
  function fieldHTML(k) {
    const x = fields[k], f = x.f;
    const res = a.results && a.results[k];
    const mark = res ? (res.ok === true ? `<span class="fmark ok">${ICON.ok}</span>` : res.ok === false ? `<span class="fmark ng">${ICON.ng}</span>` : '') : '';
    const lab = f.label ? `<span class="flabel">${labelHTML(f.label)}</span>` : '';
    if (f.kind === 'self') {
      return `<div class="field self">${lab}<span class="selfnote">${ICON.self} ${esc(f.sub === '証明' ? '証明' : f.sub === '図示' ? '図示' : '記述')}：紙に書いて、答え合わせで自己採点</span></div>`;
    }
    const canCases = f.kind === 'expr' || f.kind === 'cases';
    const unit = fieldUnit(f);
    const locked = a.revealed || (res && res.ok === true);
    if (x.mode === 'cases') {
      return `<div class="field cases ${res ? (res.ok ? 'is-ok' : 'is-ng') : ''}" data-k="${k}">
        <div class="frow">${lab}<span class="muted">場合分け</span>${mark}${canCases && !locked ? `<button class="mini" data-act="plain" data-k="${k}">場合分けをやめる</button>` : ''}</div>
        ${x.rows.map((r, i) => `<div class="caserow">
          <input class="answer-input cond" data-k="${k}" data-row="${i}" data-part="cond" value="${esc(r.cond)}" placeholder="条件　例：a<0" ${locked ? 'readonly' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <span class="arrow">→</span>
          <input class="answer-input val" data-k="${k}" data-row="${i}" data-part="val" value="${esc(r.val)}" placeholder="値" ${locked ? 'readonly' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          ${!locked && x.rows.length > 1 ? `<button class="mini del" data-act="delrow" data-k="${k}" data-row="${i}" aria-label="この場合を消す">×</button>` : ''}
        </div>`).join('')}
        ${!locked ? `<button class="mini add" data-act="addrow" data-k="${k}">＋ 場合を追加</button>` : ''}
        ${res && res.error ? `<div class="inline-err">${esc(res.error)}</div>` : ''}
      </div>`;
    }
    return `<div class="field ${res ? (res.ok ? 'is-ok' : 'is-ng') : ''}" data-k="${k}">
      <div class="answer-row">
        ${lab}
        <input class="answer-input" data-k="${k}" value="${esc(x.text)}" placeholder="${esc(fieldHint(f) || (f.kind === 'expr' ? '答えを入力' : ''))}" ${locked ? 'readonly' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text">
        ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
        ${mark}
      </div>
      <div class="preview" data-pv="${k}"></div>
      ${canCases && !locked ? `<button class="mini" data-act="cases" data-k="${k}">${ICON.cases} 場合分けする</button>` : ''}
      ${res && res.error ? `<div class="inline-err">${esc(res.error)}</div>` : ''}
    </div>`;
  }
  function preview(k) {
    const x = fields[k], pv = $(`[data-pv="${k}"]`);
    if (!pv) return;
    const v = x.text.trim();
    if (!v || /^-?\d+(\.\d+)?$/.test(v)) { pv.textContent = ''; return; }
    try {
      const t = x.f.kind === 'range' ? condTeX(v) : x.f.kind === 'set' ? v.split(/[,，、]/).map(s => exprTeX(s.trim()) ?? s).join(',\\ ') : (exprTeX(v.replace(/^[^=<>]*=(?!=)/, '')) ?? null);
      if (t == null) throw new Error();
      tex(pv, t); pv.className = 'preview';
    } catch { pv.textContent = '…'; pv.className = 'preview err'; }
  }
  function bindInputs() {
    $$('#inputs input').forEach(inp => {
      const k = +inp.dataset.k, x = fields[k];
      inp.addEventListener('focus', () => { focused = inp; });
      inp.addEventListener('input', () => {
        if (inp.dataset.row != null) x.rows[+inp.dataset.row][inp.dataset.part] = inp.value;
        else { x.text = inp.value; preview(k); }
        if (a.results && a.results[k]) { a.results[k] = null; }
        actions();
      });
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('#judge')?.click(); } });
      if (inp.dataset.row == null) preview(k);
    });
    $$('#inputs [data-act]').forEach(btn => btn.addEventListener('click', () => {
      const k = +btn.dataset.k, x = fields[k];
      if (btn.dataset.act === 'cases') { x.mode = 'cases'; if (x.text) x.rows[0].val = x.text; }
      if (btn.dataset.act === 'plain') x.mode = 'plain';
      if (btn.dataset.act === 'addrow') x.rows.push({ cond: '', val: '' });
      if (btn.dataset.act === 'delrow') x.rows.splice(+btn.dataset.row, 1);
      if (a.results) a.results[k] = null;
      drawInputs(); actions();
      const target = $(`#inputs [data-k="${k}"] input:not([readonly])`); target && target.focus();
    }));
    $$('#kp button').forEach(btn => btn.addEventListener('mousedown', (ev) => ev.preventDefault()));
    $$('#kp button').forEach(btn => btn.addEventListener('click', () => {
      const inp = focused && document.body.contains(focused) ? focused : $('#inputs input:not([readonly])');
      if (!inp || inp.readOnly) return;
      const key = btn.dataset.k;
      const ins = { 'sin': 'sin(', 'cos': 'cos(', 'log': 'log(', '√': 'sqrt(', '≦': '<=', '≧': '>=', 'または': ' または ' }[key] ?? key;
      const st = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? st;
      inp.value = inp.value.slice(0, st) + ins + inp.value.slice(en);
      inp.focus(); inp.setSelectionRange(st + ins.length, st + ins.length);
      inp.dispatchEvent(new Event('input'));
    }));
  }

  $$('#conf button').forEach(btn => btn.addEventListener('click', () => {
    if (a.revealed || a.attempts) return;
    a.conf = btn.dataset.c;
    $$('#conf button').forEach(x => x.classList.toggle('on', x === btn));
    play('tap');
    actions();
  }));

  function filled() {
    return autoFields.every(x => x.mode === 'cases' ? x.rows.some(r => r.cond.trim() && r.val.trim()) : x.text.trim());
  }
  function actions() {
    const box = $('#actions');
    if (a.revealed) { box.innerHTML = ''; return; }
    const hintBtn = b.k && !a.hint ? `<button class="btn ghost" id="hint">${ICON.hint} ヒント：考え方</button>` : '';
    if (!spec) {
      box.innerHTML = `${hintBtn}<button class="btn primary" id="reveal" ${a.conf ? '' : 'disabled'}>答え合わせ</button>`;
      $('#reveal').addEventListener('click', () => reveal());
    } else {
      const ready = a.conf && filled();
      box.innerHTML = `${hintBtn}<button class="btn primary" id="judge" ${ready ? '' : 'disabled'}>${a.attempts ? 'もう一度判定' : '判定'}</button>
        ${a.attempts ? '<button class="btn" id="giveup">答えを見る</button>' : ''}`;
      $('#judge').addEventListener('click', judge);
      $('#giveup')?.addEventListener('click', () => reveal());
    }
    $('#hint')?.addEventListener('click', () => {
      a.hint = true;
      const h = document.createElement('div');
      h.className = 'hint fade-in';
      h.innerHTML = `<b>考え方</b>${b.k}`;
      $('#hints').appendChild(h);
      math(h);
      actions();
    });
  }

  function judge() {
    const res = fields.map(x => x.f.kind === 'self' ? { ok: null }
      : checkField(x.f, x.mode === 'cases' ? { mode: 'cases', rows: x.rows } : { mode: 'plain', text: x.text }));
    // 書き方の誤りだけなら、試行に数えずに知らせる
    if (res.some(r => r.syntax)) {
      a.results = res.map(r => r.syntax ? r : null);
      drawInputs(); actions(); play('wrong');
      return;
    }
    a.attempts++;
    a.results = res;
    const auto = res.filter(r => r.ok !== null);
    const allOk = auto.every(r => r.ok);
    if (a.firstAllOk === null) a.firstAllOk = allOk;
    drawInputs();
    if (allOk) { play('correct'); reveal(); return; }
    play('wrong');
    const fb = $('#feedback');
    const nOk = auto.filter(r => r.ok).length;
    fb.innerHTML = `<div class="result ng fade-in"><span class="mark">${ICON.ng}</span><div>${nOk ? `${auto.length}つのうち${nOk}つ正解` : '違うようです'}<small>×の欄を見直して、もう一度判定できます。</small></div></div>`;
    actions();
  }

  function reveal() {
    a.revealed = true;
    a.min = Math.max(1, Math.round((Date.now() - t0) / 60000));
    stopTimer();
    $$('#conf button').forEach(x => x.disabled = true);
    if (spec) {
      // 判定していない欄は、いま判定する（答えを見る前の最終状態）
      a.results = fields.map((x, k) => (a.results && a.results[k]) || (x.f.kind === 'self' ? { ok: null }
        : checkField(x.f, x.mode === 'cases' ? { mode: 'cases', rows: x.rows } : { mode: 'plain', text: x.text })));
      drawInputs();
    }
    actions();
    const fb = $('#feedback');
    const autoRes = spec ? a.results.filter(r => r.ok !== null) : [];
    const autoAll = autoRes.length && autoRes.every(r => r.ok);
    const answerKey = spec ? specAnswerHTML() : `<div class="ans qhtml">${b.a}</div>`;
    const needSelf = !spec || selfParts.length > 0;   // 自己採点がある＝先に解答・解説を見せてから聞く
    fb.innerHTML = `
      ${spec && autoRes.length ? `<div id="autores">${autoBanner()}</div>` : ''}
      <div class="solution fade-in">
        <div class="title">答</div>
        ${answerKey}
        ${spec ? `<details class="orig"><summary>問題管理表の答えの表記</summary><div class="qhtml">${b.a}</div></details>` : ''}
      </div>
      ${spec && autoRes.some(r => !r.ok) ? '<p class="muted dispute-note">自分の答えも正しいはずなのに×のときは、欄の横の「判定がおかしい？」を押してください。記録に残り、テスト記録のCSVにも出ます。</p>' : ''}
      ${needSelf ? solutionHTML() : ''}
      ${needSelf ? `<div class="label">${spec ? `解答と見比べて、自己採点の小問（${selfParts.map(n => n ? `(${n})` : '').join('')}）はどうだった？` : '解答と見比べて、自分の答案はどうだった？'}</div>
        <div class="segment self" id="self">${SELF.map(x => `<button data-g="${x.id}">${ICON[x.icon]}<span>${x.label}</span></button>`).join('')}</div>` : ''}
      <div id="after"></div>`;
    math(fb);
    addDisputeButtons();
    $$('#self button').forEach(btn => btn.addEventListener('click', () => grade(btn.dataset.g)));
    if (spec && !selfParts.length) grade(null);
  }

  function solutionHTML() {
    return `<div class="solution fade-in" id="solbox">
        <div class="title">解答・解説</div>
        <div class="qhtml sol">${formatSolution(b.s) || '（解説なし）'}</div>
        ${b.k ? `<div class="keypoint"><b>核となるアイデア</b>${b.k}</div>` : ''}
        ${e.th || e.tg ? `<div class="methods">${e.th ? `<span class="chip plain">${e.th}</span>` : ''}${(e.tg || []).map(t => `<span class="chip plain">${esc(t)}</span>`).join('')}</div>` : ''}
        ${glossaryHTML(b.q + b.s + b.k)}
      </div>`;
  }

  function specAnswerHTML() {
    return `<div class="anskey">${spec.parts.map(p => `<div class="akrow">${p.n ? `<span class="pn">(${esc(p.n)})</span>` : ''}<span>${p.fields.map(f => {
      if (f.kind === 'self') return `<span class="muted">${esc(f.sub)}${f.text ? '：' + esc(f.text) : '（解説を参照）'}</span>`;
      const lab = f.label ? `${labelHTML(f.label)} ＝ ` : '';
      return `<span class="akf">${lab}$\\displaystyle ${esc(fieldTeX(f))}$</span>`;
    }).join('')}</span></div>`).join('')}</div>`;
  }

  function addDisputeButtons() {
    if (!spec || !a.results) return;
    fields.forEach((x, k) => {
      const r = a.results[k];
      if (!r || r.ok !== false) return;
      const el = $(`#inputs .field[data-k="${k}"]`);
      if (!el || el.querySelector('.dispute')) return;
      const btn = document.createElement('button');
      btn.className = 'mini dispute';
      btn.textContent = '判定がおかしい？';
      btn.addEventListener('click', () => {
        a.results[k] = { ok: true, disputed: true };
        a.disputes.push(`(${x.part || '-'})${x.f.label ? ' ' + x.f.label : ''}：${x.mode === 'cases' ? x.rows.map(r2 => `${r2.cond}→${r2.val}`).join(' | ') : x.text}`);
        btn.replaceWith(Object.assign(document.createElement('span'), { className: 'muted small', textContent: '正解として記録しました' }));
        if (a.log) { a.log.disp = a.disputes.slice(); save(); }
        el.classList.remove('is-ng'); el.classList.add('is-ok');
        const m = el.querySelector('.fmark'); if (m) { m.className = 'fmark ok'; m.innerHTML = ICON.ok; }
        if (a.sg) regrade();
      });
      el.appendChild(btn);
    });
  }

  function autoScore() {
    const auto = (a.results || []).filter(r => r && r.ok !== null);
    return { n: auto.length, ok: auto.filter(r => r.ok).length };
  }
  function combine(selfSg) {
    const { n, ok } = autoScore();
    if (!spec) return selfSg;
    const autoSg = !n ? null : ok === n ? 'full' : ok === 0 ? 'none' : 'part';
    if (!selfSg) return autoSg;
    if (!autoSg) return selfSg;
    if (autoSg === selfSg) return autoSg;
    return (autoSg === 'none' && selfSg === 'none') ? 'none' : 'part';
  }
  let selfChoice = null;
  function autoBanner() {
    const autoRes = (a.results || []).filter(r => r && r.ok !== null);
    const autoAll = autoRes.every(r => r.ok);
    return `<div class="result ${autoAll ? 'ok' : 'ng'} fade-in"><span class="mark">${autoAll ? ICON.ok : ICON.ng}</span><div>${autoAll ? (a.attempts > 1 ? '正解（2回目以降）' : '正解') : `入力した答え：${autoRes.filter(r => r.ok).length} / ${autoRes.length} 正解`}${a.hint ? '<small>ヒントあり</small>' : ''}</div></div>`;
  }
  // 「判定がおかしい？」で採点が変わったとき：記録と表示を直す（復習の予定は、この回の前の状態から計算し直す）
  function regrade() {
    const sg = combine(selfChoice);
    const ar = $('#autores'); if (ar) ar.innerHTML = autoBanner();
    if (sg === a.sg) return;
    a.sg = sg;
    const v = $('.verdict');
    if (v) { v.className = `verdict v-${sg}`; v.innerHTML = `${ICON[sg]}<b>${SELF.find(x => x.id === sg).label}</b>`; }
    if (a.log) {
      a.log.sg = sg; a.log.ok = sg === 'full';
      a.log.g = gradeOf(sg);
      state.pstat[e.id] = review(a.prevStat, a.log.g, a.log.t);
      const r = [...session.results].reverse().find(x => x.pid === e.id);
      if (r) r.grade = a.log.g;
      save();
    }
  }
  function gradeOf(sg) {
    return sg === 'full' ? (a.hint || a.attempts > 1 ? 2 : a.conf === 'high' ? 4 : 3) : sg === 'part' ? 2 : 1;
  }

  function grade(selfSg) {
    if (a.sg) return;
    selfChoice = selfSg;
    const sg = combine(selfSg);
    a.sg = sg;
    a.prevStat = state.pstat[e.id];
    $$('#self button').forEach(x => { x.disabled = true; x.classList.toggle('on', x.dataset.g === selfSg); });
    play(sg === 'full' ? 'full' : sg === 'part' ? 'part' : 'wrong');
    a.log = recordResult(e.id, gradeOf(sg), { h: a.hint ? 1 : 0, c: a.conf, ok: sg === 'full', sg, min: a.min, in: spec ? 1 : 0, disp: a.disputes.length ? a.disputes.slice() : undefined });
    const after = $('#after');
    after.innerHTML = `
      <div class="verdict v-${sg} fade-in">${ICON[sg]}<b>${SELF.find(x => x.id === sg).label}</b></div>
      ${$('#solbox') ? '' : solutionHTML()}
      <div class="label">手応え（任意）</div>
      <div class="feel" id="feel">${FEEL.map(f => `<button data-k="${f.k}"><b>${f.k}</b><span>${f.label}</span></button>`).join('')}</div>
      <div class="label">${sg === 'full' ? 'この問題で最初に気づくべきことを1行で（任意）' : 'どこで詰まった？（任意）'}</div>
      <textarea class="explain" id="explain" placeholder="${sg === 'full' ? '例：交点の x 座標を出して1/6公式' : '例：(2) の場合分けで a=1 を落とした'}"></textarea>
      <button class="btn primary block" id="next" style="margin-top:14px">${session.i + 1 < session.steps.length ? '次へ' : '結果を見る'}</button>`;
    math(after);
    $$('#feel button').forEach(btn => btn.addEventListener('click', () => {
      a.feel = +btn.dataset.k;
      $$('#feel button').forEach(x => x.classList.toggle('on', x === btn));
    }));
    $('#next').addEventListener('click', () => {
      const t = $('#explain').value.trim();
      if (a.log) { if (t) a.log.note = t; if (a.feel) a.log.feel = a.feel; if (a.disputes.length) a.log.disp = a.disputes.slice(); }
      if (t) state.explains[e.id] = [...(state.explains[e.id] || []), { t: Date.now(), text: t }].slice(-5);
      save();
      nextStep();
    });
  }

  drawInputs();
  actions();
}

function renderSummary() {
  const r = session.results;
  const solo = r.filter(x => x.grade >= 3).length;
  const withHint = r.filter(x => x.grade === 2).length;
  const missed = r.filter(x => x.grade === 1).length;
  const next = nextReviewTime(state);
  view.innerHTML = `
    <div class="fade-in">
      <div class="kicker">おつかれさま</div>
      <h1>${r.length}問 解きました</h1>
      <div class="stat-row">
        <div class="stat"><b>${solo}</b><span>自力で完答</span></div>
        <div class="stat"><b>${withHint}</b><span>一部・ヒントあり</span></div>
        <div class="stat"><b>${missed}</b><span>解けず</span></div>
      </div>
      <div class="panel">
        <p style="margin:0">解けなかった問題は近いうちに、解けた問題は間をあけて復習に出します。${next ? `次の復習は <strong>${relTime(next)}</strong>。` : ''}</p>
        <p class="muted" style="margin:8px 0 0">難しく感じた日の方が、あとで解ける力は伸びています。</p>
      </div>
      <div class="btn-row">
        <button class="btn" id="more">同じ条件でもう一度</button>
        <button class="btn primary" id="home">ホームへ</button>
      </div>
    </div>`;
  play('finish');
  setTimeout(() => birdSay(birdMessage('summary', { solo, missed, n: r.length }), { sound: false }), 600);
  $('#home').addEventListener('click', () => { session = null; route(); });
  $('#more').addEventListener('click', () => {
    const cfg = session.cfg || { size: 8 };
    if (cfg.collection) { openCollection(cfg.collection); return; }
    if (cfg.ids) { openIds(cfg.ids); return; }
    const steps = cfg.review ? pickReview(state, cfg) : pickPractice(state, cfg);
    if (!steps.length) { toast('今は出題できる問題がありません'); return; }
    startSession(steps, cfg);
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- グラフ ----------
const DEFAULT_EXPRS = ['y=x^3-3ax', 'a=1', 'x^2+y^2<=4'];
const PRESETS = [
  { name: '3次関数と接線', exprs: ['y=x^3-3x', 'y=(3a^2-3)(x-a)+a^3-3a', 'a=1.5'] },
  { name: '円と領域', exprs: ['x^2+y^2=4', 'y>=x^2-2'] },
  { name: '媒介変数', exprs: ['(cos(3t), sin(2t))'] },
  { name: '極座標', exprs: ['r=1+cos(θ)'] },
  { name: '定数分離', exprs: ['y=e^x/x', 'y=k', 'k=3'] },
  { name: 'はさみうち', exprs: ['y=sin(x)/x', 'y=1/x', 'y=-1/x'] },
];

const PRESETS3 = [
  { name: '鞍点', exprs: ['z=x^2-y^2'] },
  { name: '球と平面', exprs: ['x^2+y^2+z^2=4', 'x+y+z=k', 'k=1'] },
  { name: '楕円面', exprs: ['x^2/4+y^2+z^2/2=1'] },
  { name: 'らせん', exprs: ['(cos(t), sin(t), t/4) t:-10..10'] },
  { name: '円柱と平面', exprs: ['(cos(u), sin(u), v) u:0..2pi v:-3..3', 'z=y+a', 'a=0'] },
  { name: '回転体', exprs: ['(v, sin(v)cos(u), sin(v)sin(u)) u:0..2pi v:0..pi'] },
  { name: '曲面と接平面', exprs: ['z=x^2+y^2', 'z=2a(x-a)+a^2', 'a=1'] },
];

function renderGraphPage() {
  const mode = state.graphMode === '3d' ? '3d' : '2d';
  const is3 = mode === '3d';
  const key = is3 ? 'graph3Exprs' : 'graphExprs';
  const presets = is3 ? PRESETS3 : PRESETS;
  const defaults = is3 ? PRESETS3[1].exprs : DEFAULT_EXPRS;
  const exprs = state[key] && state[key].length ? state[key] : defaults.map(src => ({ src }));
  view.innerHTML = `
    <div class="graph-page fade-in">
      <div class="segment mode-switch" id="gmode">
        <button data-m="2d" class="${is3 ? '' : 'on'}">平面 2D</button><button data-m="3d" class="${is3 ? 'on' : ''}">空間 3D</button>
      </div>
      <div id="gp"></div>
      <div class="expr-list" id="el"></div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" id="add">＋ 式を追加</button>
        ${is3 ? '' : '<button class="btn" id="sk">予想を描く</button>'}
      </div>
      <div class="sliders" id="gsl"></div>
      <h2>例</h2>
      <div class="presets" id="pre">${presets.map((p, i) => `<button data-i="${i}">${esc(p.name)}</button>`).join('')}</div>
      <h2>書き方</h2>
      <div class="panel syntax">${is3 ? `
        <code>z=x^2-y^2</code> 曲面　<code>x+2y+3z=6</code> 平面　<code>x^2+y^2+z^2=4</code> 球（z について2次までの式）<br>
        <code>(cos t, sin t, t/4) t:0..12</code> 空間曲線　<code>(cos u, sin u, v) u:0..2pi v:-2..2</code> 媒介変数曲面<br>
        <code>(1,2,3)</code> 点　<code>a=2</code> などの文字はスライダー。1本指で回転、2本指・＋−で表示範囲を変更。` : `
        <code>y=x^2-2x</code> 関数　<code>x^2+y^2=4</code> 陰関数　<code>y&gt;=x^2</code> 領域<br>
        <code>x^2&lt;=y&lt;=x+2</code> 連立不等式　<code>(cos t, sin t)</code> 媒介変数　<code>r=1+cos θ</code> 極座標<br>
        <code>(1,2)</code> 点　<code>a=2</code> などの文字はスライダーになります。<code>(t, t^2) t:-1..2</code> で t の範囲。<br>
        関数：sin cos tan log（自然対数）exp sqrt abs、定数 pi e。グラフをタップすると座標を表示。`}
      </div>
    </div>`;
  $$('#gmode button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.m === mode) return;
    state.graphMode = b.dataset.m; save(); clearGraphs(); renderGraphPage();
  }));
  const g = mountGraph($('#gp'), [], { three: is3 });
  let list = exprs.map(e => ({ src: e.src, hidden: !!e.hidden }));
  const apply = () => {
    const items = g.setExpressions(list.map((e, i) => ({ src: e.src, hidden: e.hidden, color: COLORS[i % COLORS.length] })));
    state[key] = list; save();
    $$('.expr', $('#el')).forEach((row, i) => {
      const err = row.nextElementSibling;
      if (err && err.classList.contains('expr-err')) err.textContent = items[i]?.error || '';
    });
    renderSliders($('#gsl'), g);
  };
  const renderList = () => {
    $('#el').innerHTML = list.map((e, i) => `
      <div class="expr" data-i="${i}">
        <button class="dot ${e.hidden ? 'off' : ''}" style="border-color:${COLORS[i % COLORS.length]};background:${COLORS[i % COLORS.length]}" aria-label="表示切替"></button>
        <input value="${esc(e.src)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="式 ${i + 1}">
        <button class="del" aria-label="削除">×</button>
      </div><div class="expr-err"></div>`).join('');
    $$('.expr', $('#el')).forEach(row => {
      const i = +row.dataset.i;
      $('input', row).addEventListener('input', (ev) => { list[i].src = ev.target.value; apply(); });
      $('.dot', row).addEventListener('click', (ev) => { list[i].hidden = !list[i].hidden; ev.target.classList.toggle('off', list[i].hidden); apply(); });
      $('.del', row).addEventListener('click', () => { list.splice(i, 1); renderList(); apply(); });
    });
  };
  renderList(); apply();
  $('#add').addEventListener('click', () => {
    list.push({ src: '' }); renderList(); apply();
    $$('.expr input').at(-1).focus();
  });
  $('#sk')?.addEventListener('click', (ev) => {
    const on = !g.sketchMode;
    g.setSketchMode(on);
    ev.target.textContent = on ? '描き終わる' : '予想を描く';
    ev.target.classList.toggle('primary', on);
    if (on) { g.clearSketch(); g.setRevealed(false); toast('指で概形を描いて、終わったらボタンを押す'); }
    else g.setRevealed(true);
  });
  $('#pre').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    list = presets[+b.dataset.i].exprs.map(src => ({ src }));
    g.params = {};
    renderList(); apply(); g.resetView();
  });
}

// ---------- 定着度 ----------
function fieldStats(keys) {
  const set = new Set(keys);
  const list = ENTRIES.filter(e => set.has(e.f));
  const logs = state.log.filter(l => { const e = entryById.get(l.p); return e && set.has(e.f); });
  // 各問題の最新の結果
  const last = new Map();
  for (const l of logs) last.set(l.p, l);
  const latest = [...last.values()];
  return {
    total: list.length,
    solved: list.filter(e => state.problems[e.id]).length,
    full: latest.filter(l => l.g >= 3).length,
    tried: latest.length,
    due: dueEntries(state, { fields: keys }).length,
  };
}

// 得意度：各問題の最新の結果（完答 1・一部やヒント 0.5・解けず 0）を難易度で重みづけした平均。
// 少ない回数で極端にならないよう 0.5 に2問分寄せる。3問未満は「データ不足」。
function strength(keys) {
  const set = new Set(keys);
  const last = new Map();
  for (const l of state.log) { const e = entryById.get(l.p); if (e && set.has(e.f)) last.set(l.p, { l, e }); }
  let sw = 0, ss = 0;
  for (const { l, e } of last.values()) {
    const w = 1 + 0.25 * e.lv;
    const sc = l.g >= 3 ? 1 : l.g === 2 ? 0.5 : 0;
    sw += w; ss += w * sc;
  }
  const n = last.size;
  return { n, score: n >= 3 ? (ss + 1) / (sw + 2) : null };
}
const SUBJ_SHORT = { '数I': 'I', '数A': 'A', '数II': 'II', '数B': 'B', '数III': 'III', '数C': 'C', '融合': '融合' };
// 得意度 → タイルの色（苦手＝赤系、得意＝緑系、データ不足＝無地）
function strengthStyle(sc) {
  if (sc == null) return '';
  const t = Math.round(Math.min(1, Math.abs(sc - 0.5) * 2) * 55 + 8);
  return `background:color-mix(in srgb, var(${sc >= 0.5 ? '--good' : '--bad'}) ${t}%, var(--card));`;
}
// 科目のレーダー図（SVG）：外側ほど得意。データ不足の科目は中心に点線
function radarSVG(items) {
  const N = items.length, R = 104, cx = 150, cy = 136;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = (f) => items.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(',')).join(' ');
  const val = items.map((it, i) => pt(i, R * (it.score ?? 0)).map(v => v.toFixed(1)).join(',')).join(' ');
  const has = items.some(it => it.score != null);
  return `<svg class="radar" viewBox="0 0 300 278" role="img" aria-label="科目ごとの得意度">
    ${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ring(f)}" class="rg${f === 0.5 ? ' mid' : ''}"/>`).join('')}
    ${items.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rg"/>`; }).join('')}
    ${has ? `<polygon points="${val}" class="rv"/>` : ''}
    ${items.map((it, i) => it.score == null ? '' : (() => { const [x, y] = pt(i, R * it.score); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="rp"/>`; })()).join('')}
    ${items.map((it, i) => { const [x, y] = pt(i, R + 20); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="rl${it.score == null ? ' none' : ''}">${esc(it.label)}<tspan class="rs" x="${x.toFixed(1)}" dy="13">${it.score == null ? '—' : Math.round(it.score * 100)}</tspan></text>`; }).join('')}
    <text x="${cx + 4}" y="${cy - R * 0.5 + 3}" class="rt">50</text>
  </svg>`;
}
function strengthHTML() {
  const subs = subjectsWithFields();
  const fs = FIELDS.map(f => ({ f, ...strength([f.key]) }));
  const judged = fs.filter(x => x.score != null).sort((a, b) => b.score - a.score);
  const good = judged.filter(x => x.score >= 0.6).slice(0, 3);
  const weak = judged.filter(x => x.score < 0.5).slice(-3).reverse();
  const radar = radarSVG(subs.map(s => ({ label: s.name, ...strength(s.fields.map(f => f.key)) })));
  const name = (x) => `${esc(SUBJ_SHORT[x.f.subject] || x.f.subject)}・${esc(x.f.name)}`;
  return `
    <h2>得意・苦手</h2>
    <div class="panel strength">
      ${judged.length ? '' : '<p class="muted" style="margin:0 0 8px">1つの分野で3問以上解くと、その分野の得意・苦手が出ます。</p>'}
      ${radar}
      <div class="sw-cols">
        <div><b class="sw-good">得意</b>${good.length ? good.map(x => `<span>${name(x)} <em>${Math.round(x.score * 100)}</em></span>`).join('') : '<span class="muted">まだありません</span>'}</div>
        <div><b class="sw-weak">苦手</b>${weak.length ? weak.map(x => `<span>${name(x)} <em>${Math.round(x.score * 100)}</em></span>`).join('') : '<span class="muted">まだありません</span>'}</div>
      </div>
      <div class="tiles">${subs.map(s => `<div class="tile-row"><span class="tile-sub">${esc(SUBJ_SHORT[s.name] || s.name)}</span><div class="tile-grid">${s.fields.map(f => {
        const x = fs.find(y => y.f.key === f.key);
        return `<button class="tile" data-f="${esc(f.key)}" style="${strengthStyle(x.score)}"><span>${esc(f.name)}</span><b>${x.score == null ? (x.n ? `${x.n}問` : '—') : Math.round(x.score * 100)}</b></button>`;
      }).join('')}</div></div>`).join('')}</div>
      <p class="muted legend"><i class="lg-weak"></i>苦手<i class="lg-mid"></i>ふつう<i class="lg-good"></i>得意　数字は得意度（0〜100）。最後に解いた結果を難しい問題ほど重く数えます。タップでその分野を演習。</p>
    </div>`;
}

function renderMap() {
  const withConf = state.log.filter(l => l.c);
  const high = withConf.filter(l => l.c === 'high');
  const low = withConf.filter(l => l.c === 'low');
  const over = high.filter(l => !l.ok).length;
  const under = low.filter(l => l.ok).length;
  const total = state.log.length;
  const solo = state.log.filter(l => l.g >= 3).length;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  view.innerHTML = `
    <div class="fade-in">
      <div class="kicker">${FIELDS.length}分野・${ENTRIES.length}問</div>
      <h1>定着度</h1>
      <p class="sub">分野ごとの進み具合と、最後に解いたときに完答できた割合です。</p>
      ${strengthHTML()}
      <h2>自信と結果のズレ</h2>
      <div class="calib">
        <div class="stat"><b>${pct(over, high.length)}</b><span>「確実」で完答できず（過信）</span></div>
        <div class="stat"><b>${pct(under, low.length)}</b><span>「自信なし」で完答</span></div>
      </div>
      <p class="muted" style="margin:8px 2px 0">${total ? `これまで ${total}回解答、うち自力で完答 ${solo}回。` : 'まだ記録がありません。'}過信が多いときは、解き終えたら検算する習慣を。</p>
      ${subjectsWithFields().map(sub => `
        <h2>${esc(sub.name === '融合' ? '融合問題' : sub.name.replace('数', '数学'))}</h2>
        ${sub.fields.map(f => {
          const st = fieldStats([f.key]);
          const rate = st.tried ? st.full / st.tried : 0;
          return `<button class="card-row" data-f="${esc(f.key)}">
            <span><span class="nm">${esc(f.name)}</span><br>
              <span class="muted">解いた ${st.solved} / ${st.total}問・完答率 ${pct(st.full, st.tried)}${st.due ? `・復習待ち ${st.due}問` : ''}</span></span>
            <span class="chip ${st.due ? 'st-due' : st.tried ? 'st-learning' : 'st-new'}">${st.due ? '復習' : st.tried ? '学習中' : '未着手'}</span>
            <span class="bar"><div style="width:${Math.round(st.solved / Math.max(1, st.total) * 100)}%;background:${rate >= 0.7 ? 'var(--good)' : 'var(--accent)'}"></div></span>
          </button>`;
        }).join('')}`).join('')}
    </div>`;
  $$('.card-row, .tile').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.f;
    const rev = pickReview(state, { fields: [f], size: state.practice.size });
    if (rev.length) { startSession(rev, { review: true, fields: [f], size: state.practice.size }); return; }
    const cfg = { fields: [f], levels: state.practice.levels.slice(), size: state.practice.size };
    const st = pickPractice(state, cfg);
    if (st.length) startSession(st, cfg); else toast('この条件の問題はありません');
  }));
}

// ---------- 分野を選ぶ ----------
function renderPractice() {
  const pr = state.practice;
  let fields = new Set(pr.fields && pr.fields.length ? pr.fields : FIELDS.map(f => f.key));
  const draw = () => {
    const n = pool({ fields: [...fields], levels: pr.levels }).length;
    const bar = levelToolbar(pr, draw);
    view.innerHTML = `
      <div class="fade-in">
        <div class="kicker">演習モード</div>
        <h1>分野を選ぶ</h1>
        <p class="sub">選んだ範囲から、まだ解いていない問題・久しぶりの問題を優先して、分野を混ぜて出します。</p>
        ${bar.html}
        <div class="btn-row" style="margin-top:4px"><button class="btn ghost" id="all">すべて選択</button><button class="btn ghost" id="none">すべて解除</button></div>
        ${subjectsWithFields().map(sub => {
          const allOn = sub.fields.every(f => fields.has(f.key));
          return `<div class="subject">
            <button class="subj ${allOn ? 'on' : ''}" data-s="${esc(sub.name)}">${esc(sub.name === '融合' ? '融合問題' : sub.name.replace('数', '数学'))}</button>
            <div class="toggles">${sub.fields.map(f => `<button class="tog ${fields.has(f.key) ? 'on' : ''}" data-f="${esc(f.key)}">${esc(f.name)}<small>${pool({ fields: [f.key], levels: pr.levels }).length}</small></button>`).join('')}</div>
          </div>`;
        }).join('')}
        <button class="btn primary block" id="go" style="margin-top:20px" ${n ? '' : 'disabled'}>${n ? `始める（該当 ${n}問から ${Math.min(n, pr.size)}問）` : '該当する問題がありません'}</button>
      </div>`;
    bar.bind();
    const persist = () => { pr.fields = [...fields]; save(); draw(); };
    $$('.tog[data-f]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.f; fields.has(k) ? fields.delete(k) : fields.add(k); persist(); }));
    $$('.subj').forEach(b => b.addEventListener('click', () => {
      const ks = FIELDS.filter(f => f.subject === b.dataset.s).map(f => f.key);
      const allOn = ks.every(k => fields.has(k));
      ks.forEach(k => allOn ? fields.delete(k) : fields.add(k));
      persist();
    }));
    $('#all').addEventListener('click', () => { fields = new Set(FIELDS.map(f => f.key)); persist(); });
    $('#none').addEventListener('click', () => { fields = new Set(); persist(); });
    $('#go').addEventListener('click', () => {
      const cfg = { fields: [...fields], levels: pr.levels.slice(), size: pr.size };
      const st = pickPractice(state, cfg);
      if (st.length) startSession(st, cfg);
    });
  };
  draw();
}

// ---------- 設定 ----------
// 問題管理表の「弟テスト記録」シートと同じ列で書き出す
function testLogCSV(since = 0) {
  const head = ['日付', '問題ID', '科目', '分野', '難易度', '正誤', '所要時間(分)', '手応え(1-5)', 'どこで詰まったか', '感想・改善点'];
  const q = (v) => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const mark = (l) => l.sg ? { full: '○', part: '△', none: '×' }[l.sg] : (l.g >= 3 ? '○' : l.g === 2 ? '△' : '×');
  const rows = state.log.filter(l => l.t > since).map(l => {
    const e = entryById.get(l.p), f = e && fieldByKey[e.f];
    const d = new Date(l.t);
    const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    const disp = l.disp && l.disp.length ? `判定に異議：${l.disp.join(' / ')}` : '';
    const comment = [l.sg === 'full' ? (l.note || '') : '', disp].filter(Boolean).join('　');
    return [date, l.p, f ? f.subject : '', f ? f.name : '', e ? e.lv : '', mark(l), l.min || '', l.feel || '', l.sg === 'full' ? '' : (l.note || ''), comment].map(q).join(',');
  });
  return '﻿' + [head.join(','), ...rows].join('\r\n');
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function renderSettings() {
  const since = state.csvExportedAt || 0;
  const newCount = state.log.filter(l => l.t > since).length;
  view.innerHTML = `
    <div class="fade-in">
      <div class="kicker">v${VERSION}</div>
      <h1>設定</h1>
      ${sync ? '<h2>アカウントと同期</h2><div class="panel" id="acct"></div>' : ''}
      <h2>表示と音</h2>
      <div class="panel">
        <div class="setting"><span>画面のテーマ</span>
          <div class="segment theme" id="theme">${[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([k, v]) => `<button data-t="${k}" class="${(state.settings.theme || 'auto') === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="setting"><span>効果音</span><button class="switch ${state.settings.sound !== false ? 'on' : ''}" id="snd" role="switch" aria-checked="${state.settings.sound !== false}"><i></i></button></div>
        <div class="setting"><span>${BIRD_NAME}（鳥）の声かけ</span><button class="switch ${state.settings.bird !== false ? 'on' : ''}" id="brd" role="switch" aria-checked="${state.settings.bird !== false}"><i></i></button></div>
      </div>
      <h2>テスト記録の書き出し</h2>
      <div class="panel">
        <div class="btn-row" style="margin-top:0">
          <button class="btn primary" id="csvnew" ${newCount ? '' : 'disabled'}>新しい${newCount}件</button>
          <button class="btn" id="csvall" ${state.log.length ? '' : 'disabled'}>すべて（${state.log.length}件）</button>
        </div>
        ${since ? `<p class="muted" style="margin:8px 0 0">前回の書き出し：${new Date(since).toLocaleString('ja-JP')}</p>` : ''}
      </div>
      <h2>学習記録のバックアップ</h2>
      <div class="panel">
        <p class="muted" style="margin:0 0 10px">学習記録はこの端末のブラウザ内だけに保存されます。機種変更の前に書き出してください。</p>
        <div class="btn-row" style="margin-top:0">
          <button class="btn" id="exp">書き出す</button>
          <label class="btn" for="imp">読み込む</label>
          <input type="file" id="imp" accept="application/json" hidden>
        </div>
        <button class="btn ghost block" id="reset" style="margin-top:10px;color:var(--bad)">記録をすべて消す</button>
      </div>
      <h2>設計の根拠</h2>
      <div class="panel">
        <ul class="refs" style="margin:0;padding-left:1.1em">
          <li><strong>想起練習・分散学習</strong>：学習法10種の比較で最も評価が高い2つ。<a href="https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html" target="_blank" rel="noopener">Dunlosky ほか 2013</a></li>
          <li><strong>交互練習</strong>：中学1年787人の無作為化試験で、1か月後のテストが 61% 対 38%。<a href="https://www.structural-learning.com/research-briefings/mix-it-up" target="_blank" rel="noopener">Rohrer ほか 2020</a></li>
          <li><strong>答えを出さないヒント</strong>：制限なしのAIで練習した生徒は、AIなしの試験で成績が下がった。<a href="https://papers.ssrn.com/abstract=4895486" target="_blank" rel="noopener">Bastani ほか 2025</a></li>
        </ul>
        <p class="muted" style="margin:10px 0 0">復習間隔は FSRS の考え方を簡略化したモデルで推定しています。難関・最難関レベルでの効果は未検証です。</p>
      </div>
    </div>`;
  drawAccount();
  $$('#theme button').forEach(b => b.addEventListener('click', () => {
    state.settings.theme = b.dataset.t; save(); applyTheme(b.dataset.t); renderSettings();
  }));
  $('#snd').addEventListener('click', () => {
    state.settings.sound = state.settings.sound === false; save(); setSound(state.settings.sound); if (state.settings.sound) play('correct'); renderSettings();
  });
  $('#brd').addEventListener('click', () => {
    state.settings.bird = state.settings.bird === false; save();
    if (state.settings.bird) { mountBird(); birdSay('よろしくね。'); } else $('#bird')?.remove();
    renderSettings();
  });
  const csv = (from) => {
    download(`lemma-テスト記録-${dayKey()}.csv`, testLogCSV(from), 'text/csv');
    state.csvExportedAt = Date.now(); save(); renderSettings();
  };
  $('#csvnew').addEventListener('click', () => csv(since));
  $('#csvall').addEventListener('click', () => csv(0));
  $('#exp').addEventListener('click', () => download(`lemma-${dayKey()}.json`, JSON.stringify(state, null, 1), 'application/json'));
  $('#imp').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.problems || !data.log) throw new Error();
      state = { ...freshState(), ...data, pstat: data.pstat || {}, schema: 4 }; save(); toast('読み込みました'); route();
    } catch { toast('読み込めないファイルです'); }
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm(sync && sync.loggedIn() ? 'この端末の学習記録を消します（ログイン中なので、次の同期でサーバーの記録が戻ります。サーバーの記録も消すには「退会する」）。' : '学習記録をすべて消します。元に戻せません。')) return;
    state = freshState(); save(); session = null; toast('消去しました'); route();
  });
}

// テスト・確認用：指定した問題IDでセットを始める（例：__lemma.open(['I-EXP-001'])）
window.__lemma = { open: (ids) => startSession(ids.map(pid => ({ kind: 'problem', pid })), { size: ids.length }) };

// ---------- 起動 ----------
applyTheme(state.settings.theme || 'auto');
setSound(state.settings.sound !== false);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(state.settings.theme || 'auto'));
mountBird();
const drillCtx = { state, save, math, tex, esc, toast, play, ICON, birdSay, setImmersive: (on) => document.body.classList.toggle('immersive', on), go: (h) => { location.hash = h; } };
route();
loadCatalog().then((meta) => {
  ready = true;
  route();
  initSync();
  if (meta.ok) dataWarn();
  if (!meta.ok) showBanner(`<b>問題データを読み込めませんでした</b>${esc(meta.error || '')}。リポジトリに data フォルダがアップロードされているか確認してください。内蔵の${ENTRIES.length}問だけで動いています。`);
});
// アップロード漏れの検出：各ファイルの版が app.js と一致するか
function staleFiles() {
  const cssV = getComputedStyle(document.documentElement).getPropertyValue('--lemma-version').replace(/['"\s]/g, '');
  const list = { 'js/answer.js': M_ANS.FILE_VERSION, 'js/ui.js': M_UI.FILE_VERSION, 'js/drill.js': M_DRILL.FILE_VERSION, 'js/catalog.js': M_CAT.FILE_VERSION, 'js/content.js': M_CONTENT.FILE_VERSION, 'js/scheduler.js': M_SCHED.FILE_VERSION, 'js/graph.js': M_GRAPH.FILE_VERSION, 'js/graph3d.js': M_G3.FILE_VERSION, 'js/parser.js': M_PARSER.FILE_VERSION, 'css/style.css': cssV };
  return Object.entries(list).filter(([, v]) => v !== VERSION).map(([k]) => k);
}
function showBanner(html) {
  let b = $('.banner');
  if (!b) { b = document.createElement('div'); b.className = 'banner'; document.body.prepend(b); }
  b.innerHTML = html;
}
// 問題データの版の食い違い（一部の data/ ファイルだけ古い、形式が新しすぎる）
function dataWarn() {
  const files = M_CAT.staleDataFiles ? M_CAT.staleDataFiles() : [];
  const msgs = [...(META.warnings || [])];
  if (files.length) msgs.push(`${files.map(esc).join('、')} が data/index.json と違う版です。data フォルダをすべて上書きアップロードしてください。`);
  if (msgs.length) showBanner(`<b>問題データの版が揃っていません</b>${msgs.join('<br>')}`);
}
setTimeout(() => {
  const stale = staleFiles();
  if (stale.length) showBanner(`<b>古いファイルが混ざっています（v${VERSION}）</b>${stale.map(esc).join('、')} が更新されていません。リポジトリにzipの中身をすべて上書きアップロードしてください。`);
}, 400);
// 予期しないエラーを画面に出す（報告用）
window.addEventListener('error', (e) => showBanner(`<b>エラー</b>${esc(e.message || '')} <small>${esc((e.filename || '').split('/').pop())}:${e.lineno || ''}</small>`));
window.addEventListener('unhandledrejection', (e) => showBanner(`<b>エラー</b>${esc(String(e.reason && e.reason.message || e.reason))}`));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|claudeusercontent/.test(location.hostname)) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
