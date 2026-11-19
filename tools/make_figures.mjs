// 「問題の図」を作る：問題文から取り出した式の候補（tools/figure_candidates.py）を、アプリと同じ解析器で確かめて選ぶ
//   node tools/make_figures.mjs [content フォルダ]          … content/figures.json を作り直す
//   node tools/make_figures.mjs [content] --check           … 書き出さずに、今の figures.json と同じか調べる
//
// figures.json：{ 問題ID: { h: 問題文のハッシュ, mode: '2d'|'complex'|'3d'（ベクトルの式は 2d に入る）, exprs: [式…], after: 答え合わせのあとで見せるか } }
// 管理表の「図の式」列に書いた問題は、こちらではなくそれ（content の figure）を使う（build_app_data.py が選ぶ）。
// 問題文が変わると h が合わなくなるので、build_app_data.py はその問題の自動の図を使わない（ここを実行し直す）。
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { analyze } from '../js/graph.js';
import { analyzePlane } from '../js/plane.js';
import { analyzeSpace } from '../js/graph3d.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const content = path.resolve(args[0] || path.join(ROOT, 'content'));
const CHECK = process.argv.includes('--check');
const MAX = 14;

const raw = execFileSync(process.env.PYTHON || 'python3', [path.join(ROOT, 'tools/figure_candidates.py'), content], { maxBuffer: 64 << 20 }).toString();
const cands = JSON.parse(raw);

// 問題文から取り出した式に出てきてよい文字（それ以外の文字を含む式は、取り出し方を誤ったものとして捨てる）
// 定数の文字（a, b, k など）はスライダーになる
const PARAMS = 'abckmnpqrs';
const FUNCS = /\b(sin|cos|tan|log|ln|exp|sqrt|abs|conj|arg|Re|Im|dot|cross|norm)\b/g;
const ALLOWED = {
  '2d': new RegExp(`^[xytθπe${PARAMS}]$`),
  complex: new RegExp(`^[zixytθπeα-ω${PARAMS}]$`),
  vector: new RegExp(`^[A-Za-zα-ωπ]$`),
  '3d': new RegExp(`^[A-Za-zα-ωπ]$`),
};
// 恒等式（どこでも 0）など、描いても何も出ない式を捨てる
function drawsSomething(a) {
  try {
    if (a.kind === 'plane3') return !!a.frame({});
    if (a.kind === 'implicit' || a.kind === 'implicitN') {
      const pts = [[0.3, -1.2, 0.7], [1.9, 0.4, -0.8], [-1.1, 2.3, 1.6], [0.8, 0.9, -2.2]];
      return pts.some(([x, y, z]) => Math.abs(a.g({ x, y, z })) > 1e-9);
    }
  } catch (e) { return false; }
  return true;
}
function lettersOk(mode, src) {
  if (/^\s*\([^()]*,[^()]*\)\s*=/.test(src) && mode !== '2d') return false;   // (x,y,z)=(…) のような書き方
  if (/\b[fgh]\s*\(/.test(src)) return false;          // y=f(x) のように関数記号が残ったもの
  const L = src.replace(FUNCS, ' ').match(/[A-Za-zα-ωπθ]/g) || [];
  if (mode === '2d' && /[A-Z]/.test(src.replace(FUNCS, ' '))) return false;
  if (mode === '2d' && /\bd[xyt]\b/.test(src)) return false;    // dx/dt のような微分の記号
  return L.every(c => ALLOWED[mode].test(c));
}

const DRAWN = new Set(['fx', 'fy', 'implicit', 'region', 'pcurve', 'polar', 'point', 'implicitc', 'pcurve2', 'roots', 'cpoint', 'vpoint', 'arrow',
  'surf', 'psurf', 'curve', 'curve3', 'plane3', 'patch3', 'implicitN']);
const POINTISH = new Set(['point', 'cpoint', 'vpoint', 'arrow']);

// 1つのモードの式の一覧を確かめる → 描ける式だけ（順番は保つ）
function check(mode, list) {
  let res;
  if (mode === '2d') res = list.map((src) => { try { return { a: analyze(src), error: null }; } catch (e) { return { a: null, error: e.message }; } });
  else if (mode === '3d') res = analyzeSpace(list);
  else res = analyzePlane(list, mode);
  const keep = [];
  const defined = new Set();
  list.forEach((src, i) => {
    // 同じ名前の点・ベクトルが何度も出るもの（N=(0,0), N=(1,0), … のような点の列）は最初の1つだけ
    const dm = mode !== '2d' && src.match(/^\s*([A-Za-oq-yα-ω])\s*=/);   // p=…・z=… は定義ではない
    if (dm) { if (defined.has(dm[1])) return; defined.add(dm[1]); }
    const r = res[i];
    if (!r || r.error || !r.a) return;
    if (!DRAWN.has(r.a.kind)) return;
    if (!lettersOk(mode, src)) return;
    if (!drawsSomething(r.a)) return;
    keep.push({ src, kind: r.a.kind });
  });
  // 定義を使う式が、定義を外したことで読めなくなっていないか、残した式だけでもう一度確かめる
  if (mode !== '2d') {
    const again = mode === '3d' ? analyzeSpace(keep.map(k => k.src)) : analyzePlane(keep.map(k => k.src), mode);
    const defs = new Set(keep.map(k => (k.src.match(/^\s*([A-Za-zα-ω])\s*=/) || [])[1]).filter(Boolean));
    return keep.filter((k, i) => again[i] && !again[i].error && (mode === 'complex' || (k.src.replace(FUNCS, ' ').match(/[A-Z]/g) || []).every(c => defs.has(c))));
  }
  return keep;
}

const out = {};
let nProb = 0;
const byMode = {};
for (const id of Object.keys(cands).sort()) {
  const { cands: cs, after, h } = cands[id];
  const lists = { '2d': [], complex: [], vector: [], '3d': [] };
  for (const c of cs) {
    if (c.mode === '2d-point') lists['2d'].push(c.src);
    else if (lists[c.mode]) lists[c.mode].push(c.src);
  }
  let best = null;
  for (const mode of ['3d', 'complex', 'vector', '2d']) {
    const L = [...new Set(lists[mode])];
    if (!L.length) continue;
    const ok = check(mode, L);
    const curves = ok.filter(k => !POINTISH.has(k.kind)).length, points = ok.length - curves;
    // 描く価値があるのは、曲線・領域・面が1つ以上か、点が2つ以上
    if (!curves && points < 2) continue;
    const score = curves * 3 + points;
    if (!best || score > best.score) best = { mode, ok, score };
  }
  if (!best) continue;
  let exprs = best.ok.map(k => k.src);
  // 2D の点だけ（関数のない問題）は図にしない（点を並べても状況は分からない）
  if (best.mode === '2d' && best.ok.every(k => POINTISH.has(k.kind))) continue;
  exprs = exprs.slice(0, MAX);
  const outMode = best.mode === 'vector' ? '2d' : best.mode;   // アプリの「平面」はベクトルの書き方も読む
  out[id] = { h, mode: outMode, exprs, after: !!after };
  nProb++;
  byMode[outMode] = (byMode[outMode] || 0) + 1;
}

const ids = Object.keys(out).sort();
const text = '{\n' + ids.map(id => JSON.stringify(id) + ':' + JSON.stringify(out[id])).join(',\n') + '\n}\n';
const dest = path.join(content, 'figures.json');
if (CHECK) {
  const same = fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === text;
  console.log('content/figures.json：', same ? '同じ' : '違いがあります');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(dest, text);
console.log(`問題の図（自動）：${nProb}問（${Object.entries(byMode).map(([k, v]) => `${k} ${v}`).join('・')}）→ ${path.relative(process.cwd(), dest)}`);
