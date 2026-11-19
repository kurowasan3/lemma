// 問題の図（自動で取り出した式・管理表の「図の式」）の検査
//   node tests/figures.test.mjs
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { analyze } from '../js/graph.js';
import { analyzePlane } from '../js/plane.js';
import { analyzeSpace } from '../js/graph3d.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const py = process.env.PYTHON || 'python3';
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

// 1. 自動の図：すべての式がアプリの解析器で読める
const figs = JSON.parse(fs.readFileSync(path.join(root, 'content/figures.json'), 'utf8'));
let bad = [];
for (const [id, f] of Object.entries(figs)) {
  let res;
  if (f.mode === '2d') res = f.exprs.map((s) => { try { analyze(s); return null; } catch (e) { return e.message; } });
  else if (f.mode === '3d') res = analyzeSpace(f.exprs).map(r => r.error);
  else res = analyzePlane(f.exprs, f.mode).map(r => r.error);
  res.forEach((e, i) => { if (e) bad.push(`${id} ${f.exprs[i]}：${e}`); });
}
ok(bad.length === 0, `自動の図の式はすべて読める ${bad.slice(0, 5).join(' / ')}`);
ok(Object.keys(figs).length > 500, `自動の図がある問題 ${Object.keys(figs).length}問`);

// 2. 代表的な問題
const ex = (id) => figs[id] && figs[id].exprs;
ok(JSON.stringify(ex('II-GEO-049')) === JSON.stringify(['x^2+y^2=4', 'x^2+y^2-8x+6y+21=0']), '2つの円の問題');
ok(figs['C-CUR-148'] && figs['C-CUR-148'].mode === 'complex' && figs['C-CUR-148'].after === true, '「どのような直線か」の複素数の問題は、答え合わせのあと');
ok(figs['C-VEC-220'] && figs['C-VEC-220'].mode === '3d' && ex('C-VEC-220').filter(s => s.startsWith('p=')).length === 6, '四面体ABCD：4点と6辺');
ok(Object.values(figs).every(f => f.exprs.every(s => !/\b[fgh]\s*\(/.test(s))), '関数記号 f(x) が残った式はない');

// 3. 取り出し方（figure_candidates.py）
const cand = (tex) => JSON.parse(execFileSync(py, ['-c', `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(root, 'tools'))})
import figure_candidates as F
print(json.dumps(F.candidates(sys.argv[1]), ensure_ascii=False))`, tex]).toString());
const c1 = cand('$f(x)=x^2-2x$ のグラフと直線 $y=x$ で囲まれた部分の面積を求めよ．');
ok(c1.some(c => c.mode === '2d' && c.src === 'y=x^2-2x') && c1.some(c => c.src === 'y=x'), 'f(x)=… は y=… に直す');
const c2 = cand('$y=\\sin x\\ (0\\leqq x\\leqq\\pi)$ と $x$ 軸で囲まれた部分');
ok(c2.some(c => /^\(t, *sin t\) t:0\.\.π$/.test(c.src)), '範囲つきの関数は媒介変数に（2D の y=f(x) に範囲を付けられないため）');
const c3 = cand('確率 $p$ で表が出る硬貨．$0<p<1$ とする．');
ok(c3.length === 0, '確率の p はベクトルにしない');
const c4 = cand('$x+y+z=6,\\ xy+yz+zx=9$ を満たす実数');
ok(!c4.some(c => c.mode === '3d'), '空間図形の話でない x, y, z の連立方程式は描かない');

// 4. 管理表の「図の式」
const parse = (raw) => JSON.parse(execFileSync(py, ['-c', `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(root, 'tools'))})
import xlsx_to_content as X
print(json.dumps(X.parse_figure(sys.argv[1]), ensure_ascii=False))`, raw]).toString());
const m1 = parse('モード：ベクトル\nA=(0,0)\nB=(4,0)\nC=(1,3)\np=A+t(B-A), 0<=t<=1\n表示：答え合わせのあと');
ok(m1.mode === 'vector' && m1.exprs.length === 4 && m1.after === true, '「図の式」：モード・表示・式');
const m2 = parse('y=x^2\ny=2x');
ok(m2.mode === '2d' && m2.after === null, '「図の式」：モードを省略すると平面、表示は問題文から判断');
ok(parse('') === null, '「図の式」：空なら図なし');

console.log(`figures.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
