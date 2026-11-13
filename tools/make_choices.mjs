// 選択式の選択肢を作る：入力用の答え（grading.spec）の各欄に、まちがいの選択肢を3つ足す
//   node tools/make_choices.mjs [content フォルダ]        … content/choices.json を作り直す
//   node tools/make_choices.mjs [content] --check          … 書き出さずに、今の choices.json と同じか調べる
//
// 作り方（AI ではなく決まった手順なので、何度実行しても同じ結果）：
//   正解の書き方（例 2sqrt(3)/3）の数字を1つ変える・符号を変える・不等号の等号を付け外しする などで候補を作り、
//   1. アプリの採点（answer.js の checkField）で「不正解」になること
//   2. 候補どうし・正解と、表示も値も重ならないこと
//   3. √4 や 2/4 のような、見ただけで不自然とわかる形でないこと
//   を確かめて、残ったものから3つ選ぶ。2つしか作れない欄は選択肢3つ、1つ以下の欄は選択肢なし（その欄は入力式）。
// choices.json：{ 問題ID: { spec: 入力用の答え, f: [ [正解のTeX, 誤答のTeX, …] | null, …（欄の順） ] } }
// 入力用の答えが変わった問題は spec が合わなくなるので、build_app_data.py は使わない（ここを実行し直す）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSpec, checkField, fieldTeX, fieldToText } from '../js/answer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const content = path.resolve(args[0] || path.join(ROOT, 'content'));
const CHECK = process.argv.includes('--check');

// ---- 決まった乱数（問題ID と欄の番号から）
function seedOf(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let x = seed || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

// ---- 候補づくり（書式の文字列のまま変える）
const NUM = /\d+(\.\d+)?/g;
function numberTweaks(s) {
  const out = [];
  const toks = [...s.matchAll(NUM)];
  for (const m of toks) {
    const v = Number(m[0]), dec = m[0].includes('.');
    const deg = /^\s*°/.test(s.slice(m.index + m[0].length));
    const alts = dec ? [v + 0.1, v - 0.1, v * 2, v / 2].map(x => +x.toFixed(m[0].split('.')[1].length + 1))
      : deg ? [v + 15, v - 15, v + 30, v - 30, v * 2, v / 2].filter(x => Number.isInteger(x))
        : [v + 1, v - 1, v * 2, v % 2 === 0 ? v / 2 : v + 2, v * 3];
    for (const w of alts) {
      if (!(w > 0) || w === v) continue;
      const before = s.slice(0, m.index), after = s.slice(m.index + m[0].length);
      if (/[.\d]$/.test(before) || /^[.\d]/.test(after)) continue;
      let t = before + String(w) + after;
      // 係数の 1 は書かない（1sqrt(3) → sqrt(3)）
      if (w === 1 && /^[a-zA-Zα-ωπ(√]/.test(after) && !/[\^_]$/.test(before)) t = before + after;
      out.push(t);
    }
  }
  return out;
}
function signTweaks(s) {
  const out = [];
  // 先頭の符号
  // （数だけの答え・単位つきの答えは、符号を変えると見ただけで違うとわかるので変えない）
  const numeric = /^[\d.\/\s]+$/.test(s) || /[^\x00-\x7Fπα-ω√]$/.test(s);
  if (/^-/.test(s)) out.push(s.slice(1));
  else if (!numeric && /^[^<>=≦≧,{(]+$/.test(s) && !/[+]|(?<!^)-/.test(s)) out.push('-' + s);
  // かっこの外の + と - を入れ替える（1か所ずつ）
  // （直前が数・文字・閉じかっこのときだけ＝2項の演算。x^-1 や (-3 のような単項の符号は変えない）
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if ((c === '+' || c === '-') && /[\w)πα-ω]/.test(s[i - 1])) {
      out.push(s.slice(0, i) + (c === '+' ? '-' : '+') + s.slice(i + 1));
    }
  }
  return out;
}
function constTweaks(s) {
  const out = [];
  if (/π/.test(s)) { out.push(s.replace(/(?<![\d.])π/, '2π')); out.push(s.replace(/(\d*)π\/(\d+)/, (m, a, b) => `${a}π/${+b * 2}`)); }
  if (/log\(/.test(s)) out.push(s.replace(/log\(([^()]*)\)/, 'log($1)/2'));
  return out;
}
function rangeTweaks(s) {
  const out = [];
  // 等号の付け外し（1か所ずつ）
  const re = /<=|>=|≦|≧|<|>/g;
  for (const m of s.matchAll(re)) {
    const swap = { '<=': '<', '>=': '>', '≦': '<', '≧': '>', '<': '<=', '>': '>=' }[m[0]];
    out.push(s.slice(0, m.index) + swap + s.slice(m.index + m[0].length));
  }
  // a<x<b ⇔ x<a または b<x（範囲の内と外）
  const m = s.match(/^\s*([^<>=]+?)\s*(<=?)\s*([A-Za-zα-ω])\s*(<=?)\s*([^<>=]+?)\s*$/);
  if (m) {
    const flip = (op) => (op === '<' ? '<=' : '<');
    out.push(`${m[3]}${flip(m[2])}${m[1]} または ${m[5]}${flip(m[4])}${m[3]}`);
  }
  const n = s.match(/^\s*([A-Za-zα-ω])\s*(<=?)\s*([^<>=]+?)\s*または\s*([^<>=]+?)\s*(<=?)\s*([A-Za-zα-ω])\s*$/);
  if (n && n[1] === n[6]) {
    const flip = (op) => (op === '<' ? '<=' : '<');
    out.push(`${n[3]}${flip(n[2])}${n[1]}${flip(n[5])}${n[4]}`);
  }
  return out;
}

// ---- 不自然な形を除く
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function looksOdd(s) {
  for (const m of s.matchAll(/sqrt\((\d+)\)/g)) {
    const v = +m[1]; if (v < 2) return true;
    for (let k = 2; k * k <= v; k++) if (v % (k * k) === 0) return true;   // √4, √8 のような、まだ簡単にできる形
  }
  for (const m of s.matchAll(/(?<![\w.^)])(\d+)\/(\d+)(?![\w.(])/g)) {
    const a = +m[1], b = +m[2];
    if (b === 1 || gcd(a, b) > 1) return true;
  }
  if (/(?<![\d.])0(?=[a-zA-Zα-ωπ(])|\/0(?!\.)|\^1(?!\d)|\^0/.test(s)) return true;
  if (/π\/1(?!\d)|\/1(?![\d.])|log\(1\)|\(1\)\^/.test(s)) return true;
  return false;
}

function emptyRange(g) {
  const c = g.cond;
  if (c.kind !== 'cond' || c.vars.size !== 1) return false;
  const v = [...c.vars][0];
  for (let i = -4000; i <= 4000; i++) {
    const x = i / 40;
    try { if (c.test({ [v]: x })) return false; } catch { return false; }
  }
  return true;
}
function lineFor(f, text) { return (f.label ? `${f.label}：` : '') + text; }
function asInput(g) {
  if (g.kind === 'cases') return { mode: 'cases', rows: g.cases.map(c => ({ cond: c.condSrc, val: c.valSrc })) };
  if (g.kind === 'set') return { mode: 'plain', text: g.items.map(i => i.src).join(', ') };
  if (g.kind === 'expr') return { mode: 'plain', text: g.value.src + (g.value.unit || '') };
  return { mode: 'plain', text: g.src };
}
function reparse(f, text) {
  const sp = parseSpec(lineFor(f, text));
  if (!sp || sp.parts.length !== 1 || sp.parts[0].fields.length !== 1) return null;
  const g = sp.parts[0].fields[0];
  return g.kind === f.kind ? g : null;
}
function same(a, b) { const r = checkField(a, asInput(b)); return r.ok === true; }

function choicesFor(f, seed) {
  if (f.kind === 'self') return null;
  const base = fieldToText({ ...f, label: null });
  const correctTeX = fieldTeX(f);
  let cands = [];
  if (f.kind === 'range') cands = [...rangeTweaks(base), ...numberTweaks(base)];
  else cands = [...signTweaks(base), ...numberTweaks(base), ...constTweaks(base)];
  // 候補の順番を決まった乱数で混ぜる（符号・定数の候補は前寄りに残す）
  const r = rng(seed);
  cands = [...new Set(cands)].map((c, i) => [c, i < 2 ? r() * 0.5 : r()]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const picked = [], texs = new Set([correctTeX]);
  function tryCand(c) {
    if (c === base || looksOdd(c)) return null;
    let g;
    try { g = reparse(f, c); } catch { return null; }
    if (!g) return null;
    const res = checkField(f, asInput(g));
    if (res.ok !== false || res.syntax || res.error) return null;          // 正解と区別できない・読めないものは使わない
    if (same(g, f)) return null;
    if (g.kind === 'range' && emptyRange(g)) return null;                 // 「5/12<r<5/24」のような、解のない範囲は使わない
    let t;
    try { t = fieldTeX(g); } catch { return null; }
    if (!t || texs.has(t)) return null;
    if (picked.some(p => same(p.g, g) || same(g, p.g))) return null;
    return { g, t };
  }
  for (const c of cands) {
    if (picked.length >= 3) break;
    const p = tryCand(c);
    if (p) { picked.push(p); texs.add(p.t); }
  }
  // 3つ目は、選んだ誤答をさらに1か所変えたものを優先する（正解だけが「全員の真ん中」にならないように）
  if (picked.length >= 2) {
    const r2 = rng(seed ^ 0x9e3779b9);
    const from = picked[Math.floor(r2() * 2)];
    const src = fieldToText({ ...from.g, label: null });
    const more = f.kind === 'range' ? [...rangeTweaks(src), ...numberTweaks(src)] : [...numberTweaks(src), ...signTweaks(src)];
    for (const c of more.map(c => [c, r2()]).sort((a, b) => a[1] - b[1]).map(x => x[0])) {
      const p = tryCand(c);
      if (p) { picked.splice(2, 1, p); break; }
    }
  }
  if (picked.length < 2) return null;
  return [correctTeX, ...picked.map(p => p.t)];
}

// ---- 実行
const pdir = path.join(content, 'problems');
const out = {};
let nProb = 0, nField = 0, nChoice = 0, nWithAll = 0;
for (const file of fs.readdirSync(pdir).filter(f => f.endsWith('.json') && f !== 'builtin.json').sort()) {
  for (const p of JSON.parse(fs.readFileSync(path.join(pdir, file), 'utf8'))) {
    const spec = p.grading && p.grading.format === 'lemma-input/1' ? p.grading.spec : null;
    if (!spec) continue;
    let sp;
    try { sp = parseSpec(spec); } catch { continue; }
    const fields = sp.parts.flatMap(x => x.fields);
    const f = fields.map((fl, k) => { if (fl.kind !== 'self') nField++; return choicesFor(fl, seedOf(p.id + '#' + k)); });
    const got = f.filter(Boolean).length;
    if (!got) continue;
    nProb++; nChoice += got;
    if (got === fields.filter(x => x.kind !== 'self').length) nWithAll++;
    out[p.id] = { spec, f };
  }
}
const ids = Object.keys(out).sort();
const text = '{\n' + ids.map(id => JSON.stringify(id) + ':' + JSON.stringify(out[id])).join(',\n') + '\n}\n';
const dest = path.join(content, 'choices.json');
if (CHECK) {
  const same = fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === text;
  console.log('content/choices.json：', same ? '同じ' : '違いがあります');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(dest, text);
console.log(`選択肢：${nProb}問（自動採点の欄 ${nField} のうち ${nChoice} 欄、すべての欄に選択肢がある問題 ${nWithAll}問） → ${path.relative(process.cwd(), dest)}`);
