// 複素数平面・ベクトルの式（js/plane.js）の単体テスト
//   node tests/plane.test.mjs
import { analyzePlane, solveRoots, fmtComplex, parsePlane, compilePlane } from '../js/plane.js';

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const one = (mode, lines, k = lines.length - 1) => analyzePlane(lines, mode)[k];
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const at = (g, x, y, extra = {}) => g({ x, y, ...extra });

// ---------------------------------------------------------------- 構文・評価
{
  const ev = (src, env = {}) => compilePlane(parsePlane(src), 'complex')(env);
  const v = ev('(1+2i)(3-i)');
  ok(near(v.re, 5) && near(v.im, 5), '複素数の積 (1+2i)(3-i)=5+5i');
  const w = ev('e^(iπ)');
  ok(near(w.re, -1) && near(w.im, 0, 1e-12), 'オイラーの公式 e^(iπ)=-1');
  ok(near(ev('|3+4i|').re, 5), '|3+4i|=5');
  ok(near(ev('arg(-1)').re, Math.PI), 'arg(-1)=π（主値は -π<θ≦π）');
  ok(near(ev('Im(conj(2+3i))').re, -3), 'conj・Im');
  const r = ev('i^2');
  ok(near(r.re, -1) && near(r.im, 0), 'i^2=-1');
  const vv = compilePlane(parsePlane('(1,2)·(3,4)'), 'vector')({});
  ok(near(vv.re, 11), '内積 (1,2)·(3,4)=11');
  const vs = compilePlane(parsePlane('2(1,2)-(3,4)'), 'vector')({});
  ok(vs[0] === -1 && vs[1] === 0, '実数倍と差 2(1,2)-(3,4)=(-1,0)');
  let err = '';
  try { parsePlane('|z-1'); } catch (e) { err = e.message; }
  ok(/\|/.test(err), '閉じていない絶対値は日本語のエラー');
  ok(fmtComplex(-0.5, -0.8660254) === '-0.5-0.866i' && fmtComplex(0, 1) === 'i' && fmtComplex(2, 0) === '2', '複素数の表示');
}

// ---------------------------------------------------------------- 複素数平面
{
  const c = one('complex', ['|z-1|=2']);
  ok(c.a.kind === 'implicitc' && near(at(c.a.g, 3, 0), 0) && near(at(c.a.g, 1, 2), 0) && at(c.a.g, 1, 0) < 0, '|z-1|=2 は中心1・半径2の円');
  const b = one('complex', ['α=2+i', 'β=-1+2i', '|z-α|=|z-β|']);
  ok(b.a.kind === 'implicitc' && near(at(b.a.g, 0.5, 1.5), 0), '|z-α|=|z-β| は α, β の垂直二等分線（中点を通る）');
  const ray = one('complex', ['arg(z)=π/4']);
  ok(ray.a.kind === 'implicitc' && near(at(ray.a.g, 2, 2), 0) && !near(at(ray.a.g, -2, -2), 0), 'arg(z)=π/4 は半直線（反対側は含まない）');
  const reg = one('complex', ['1<=|z|<=2, Re(z)>=0']);
  const inR = (x, y) => reg.a.conds.every(k => { const v = at(k.g, x, y); return k.op === '<=' ? v <= 1e-9 : v >= -1e-9; });
  ok(reg.a.kind === 'region' && inR(1.5, 0) && !inR(0.5, 0) && !inR(-1.5, 0), '1<=|z|<=2, Re(z)>=0 は半円環');
  const arc = one('complex', ['|z|=1, Im(z)>=0']);
  ok(arc.a.kind === 'implicitc' && arc.a.mask.length === 1, '条件つきの曲線（|z|=1 の上半分）');
  const roots = one('complex', ['z^3=1']);
  const pts = solveRoots(roots.a.g1, roots.a.g2, {}, { xmin: -3, xmax: 3, ymin: -2, ymax: 2 });
  const labels = pts.map(([x, y]) => fmtComplex(x, y)).sort();
  ok(roots.a.kind === 'roots' && JSON.stringify(labels) === JSON.stringify(['-0.5+0.866i', '-0.5-0.866i', '1'].sort()), `z^3=1 の解は3つ（${labels}）`);
  const nonan = one('complex', ['z+2conj(z)=3+i']);
  const p2 = solveRoots(nonan.a.g1, nonan.a.g2, {}, { xmin: -3, xmax: 3, ymin: -3, ymax: 3 });
  ok(p2.length === 1 && near(p2[0][0], 1, 1e-6) && near(p2[0][1], -1, 1e-6), 'conj を含む方程式 z+2conj(z)=3+i の解 1-i');
  const line = one('complex', ['z-conj(z)=0']);
  ok(line.a.kind === 'implicitc' && near(at(line.a.g, 5, 0), 0), 'z-conj(z)=0（虚部だけの式）は実軸の直線として描く');
  const pt = one('complex', ['α=1+2i']);
  const pv = pt.a.f({});
  ok(pt.a.kind === 'cpoint' && pv.re === 1 && pv.im === 2, 'α=1+2i は点');
  const k = analyzePlane(['|z-α|=k', 'α=1', 'k=2'], 'complex');
  ok(k[2].a.kind === 'param' && k[1].a.kind === 'param' && [...k[0].a.params].length === 0, '後の行の定義・スライダーを前の行で使える');
  const sl = one('complex', ['|z|=r']);
  ok([...sl.a.params].join() === 'r', '決まっていない文字はスライダー');
  const cur = one('complex', ['z=e^(it) t:0..π']);
  ok(cur.a.kind === 'pcurve2' && cur.a.trange[1] === Math.PI && near(cur.a.xy({ t: Math.PI / 2 })[1], 1), 'z=e^(it) t:0..π は上半円');
  ok(/大小/.test(one('complex', ['z>1']).error), '虚数の大小は日本語のエラー');
  ok(/=|不等号/.test(one('complex', ['z^2']).error), '関係のない z の式はエラー');
  ok(/定義/.test(one('complex', ['w=(1+i)z']).error), 'z を含む式を名前に入れるとエラー');
}

// ---------------------------------------------------------------- ベクトル
{
  const L = analyzePlane(['A=(1,3)', 'B=(4,1)', 'p=A+t(B-A)', 'p=A+t(B-A), 0<=t<=1'], 'vector');
  ok(L[0].a.kind === 'vpoint' && L[1].a.kind === 'vpoint', '大文字は点');
  ok(L[2].a.kind === 'pcurve2' && L[2].a.trange[0] < -10, '直線（t の範囲は広く）');
  const seg = L[3].a;
  ok(seg.kind === 'pcurve2' && seg.trange[0] === 0 && seg.trange[1] === 1, '0<=t<=1 で線分');
  const mid = seg.xy({ t: 0.5 });
  ok(near(mid[0], 2.5) && near(mid[1], 2), '線分の中点');
  const a = analyzePlane(['a=(2,1)'], 'vector')[0];
  ok(a.a.kind === 'arrow', '小文字は矢印');
  const circ = one('vector', ['A=(1,1)', '|p-A|=2']);
  ok(circ.a.kind === 'implicitc' && near(at(circ.a.g, 3, 1), 0), '|p-A|=2 は円');
  const dia = one('vector', ['A=(1,1)', 'B=(4,3)', '(p-A)·(p-B)=0']);
  ok(near(at(dia.a.g, 1, 1), 0) && near(at(dia.a.g, 4, 3), 0) && near(at(dia.a.g, 2.5, 2), -(1.5 ** 2 + 1)), '(p-A)·(p-B)=0 は AB を直径とする円');
  const tri = one('vector', ['a=(3,1)', 'b=(1,2)', 'p=sa+tb, s>=0, t>=0, s+t<=1']);
  const inside = (x, y) => tri.a.conds.every(k => { const v = at(k.g, x, y); return k.op === '<=' ? v <= 1e-9 : v >= -1e-9; });
  ok(tri.a.kind === 'region' && inside(1.2, 0.9) && !inside(3, 3) && !inside(-0.5, 0.2), '三角形の内部（s, t の条件を x, y に直す）');
  const seg2 = one('vector', ['a=(3,1)', 'b=(1,2)', 'p=sa+tb, s+t=1, s>=0, t>=0']);
  ok(seg2.a.kind === 'implicitc' && near(at(seg2.a.g, 2, 1.5), 0), 's+t=1 なら線分（直線 AB の一部）');
  const nrm = one('vector', ['n=(1,2)', 'A=(2,1)', 'n·(p-A)=0']);
  ok(near(at(nrm.a.g, 2, 1), 0) && near(at(nrm.a.g, 0, 2), 0), '法線ベクトルと直線');
  const dot = one('vector', ['a=(3,1)', 'b=(1,2)', 'a·b']);
  ok(dot.a.kind === 'note' && dot.a.f({}).re === 5, '内積は値として表示');
  const sum = one('vector', ['a=(3,1)', 'b=(1,2)', 'a+b']);
  const sv = sum.a.f({});
  ok(sum.a.kind === 'arrow' && sv[0] === 4 && sv[1] === 3, 'a+b は矢印');
  ok(/1次/.test(one('vector', ['p=(s^2, t)']).error), 's, t の2次式は日本語のエラー');
  ok(/足せません/.test(one('vector', ['a=(1,2)', 'a+1']).error), 'ベクトルと数の和はエラー');
}

console.log(`plane.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
