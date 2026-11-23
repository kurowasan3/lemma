// 3次元グラフ（Canvas 2D による簡易3D描画）
// 対応：z=f(x,y) / z について2次までの陰関数（平面・球・楕円面・円錐など）
//       空間曲線 (x(t), y(t), z(t)) / 媒介変数曲面 (x(u,v), y(u,v), z(u,v)) / 点 (a, b, c)
//       a=2 などの文字はスライダー。1本指ドラッグで回転、ピンチ・ホイールで拡大縮小

import { parse, compile, splitRelation, freeVars } from './parser.js';
import { COLORS } from './graph.js';

export const FILE_VERSION = '0.27.3';
import { analyzePlane } from './plane.js';
const RESERVED = new Set(['x', 'y', 'z', 't', 'u', 'v']);
const TAU = Math.PI * 2;
const paramsOf = (...asts) => {
  const s = new Set();
  for (const a of asts) for (const v of freeVars(a)) if (!RESERVED.has(v) && v !== 'θ') s.add(v);
  return s;
};
const constValue = (src) => {
  const a = parse(src);
  if (freeVars(a).size) throw new Error('範囲には数を入れてください');
  return compile(a)({});
};

export function analyze3(raw) {
  let src = String(raw || '').trim();
  if (!src) return { kind: 'empty', params: new Set() };
  // 範囲指定：t:0..2pi  u:0..pi  v:0..2pi
  const ranges = {};
  src = src.replace(/[\s;]+([tuv])\s*:\s*([^\s;]+?)\s*(?:\.\.|〜|~)\s*([^\s;]+)/g, (_, n, a, b) => {
    ranges[n] = [constValue(a), constValue(b)];
    return '';
  }).trim();

  const { parts, ops } = splitRelation(src);
  if (ops.length === 0) {
    const ast = parse(src);
    const fv = freeVars(ast);
    if (ast.t === 'tuple') {
      if (ast.items.length !== 3) throw new Error('空間の点・曲線は (x, y, z) の3成分で書きます');
      const [fx, fy, fz] = ast.items.map(compile);
      if (fv.has('u') || fv.has('v')) {
        return { kind: 'psurf', fx, fy, fz, ur: ranges.u || [0, TAU], vr: ranges.v || [0, TAU], params: paramsOf(ast) };
      }
      if (fv.has('t')) return { kind: 'curve', fx, fy, fz, tr: ranges.t || [0, TAU], params: paramsOf(ast) };
      return { kind: 'point', fx, fy, fz, params: paramsOf(ast) };
    }
    if (fv.has('z')) throw new Error('z を含む式には「=」が必要です');
    return { kind: 'surf', f: compile(ast), params: paramsOf(ast) };
  }
  if (ops.length > 1 || ops[0] !== '=') throw new Error('3Dでは「=」の式に対応しています（不等式は2Dで）');
  const [L, R] = parts;
  if (!L || !R) throw new Error('「=」の両側に式が必要です');
  const ra = parse(R);
  if (/^[a-zA-Z]$/.test(L) && !RESERVED.has(L) && freeVars(ra).size === 0) {
    return { kind: 'param', name: L, value: compile(ra)({}), params: new Set() };
  }
  if (L === 'z' && !freeVars(ra).has('z')) return { kind: 'surf', f: compile(ra), params: paramsOf(ra) };
  const la = parse(L);
  if (R === 'z' && !freeVars(la).has('z')) return { kind: 'surf', f: compile(la), params: paramsOf(la) };
  const fl = compile(la), fr = compile(ra);
  const g = (s) => fl(s) - fr(s);
  const all = new Set([...freeVars(la), ...freeVars(ra)]);
  if (!all.has('z')) throw new Error('z を含まない式（円柱など）は媒介変数曲面 (cos u, sin u, v) で書いてください');
  // z について2次以下かを数点で確認
  const s = { x: 0.37, y: -0.61 };
  for (const p of paramsOf(la, ra)) s[p] = 1.3;
  const at = (z) => g({ ...s, z });
  const g0 = at(0), g1 = at(1), gm = at(-1);
  const a = (g1 + gm) / 2 - g0, b = (g1 - gm) / 2;
  if ([2, -3, 0.5].some(z => Math.abs(at(z) - (a * z * z + b * z + g0)) > 1e-6 * (1 + Math.abs(at(z))))) {
    throw new Error('z について2次までの式（平面・球・楕円面など）に対応しています');
  }
  return { kind: 'implicit', g, params: paramsOf(la, ra) };
}

// 空間ベクトルの書き方の行（p を使う・(…, …, …) を名前に入れる・その名前を使う・内積や外積）は plane.js で、
// それ以外（z=x^2-y^2、x+2y+3z=6、(cos t, sin t, t) など）は今まで通り analyze3 で読む
const VDEF = /^\s*([A-Za-zα-ωΑ-Ω])\s*=\s*\(/;
export function analyzeSpace(srcs) {
  const vnames = new Set();
  for (const src of srcs) {
    const m = String(src || '').match(VDEF);
    if (m && !['x', 'y', 'z', 't', 'u', 'v', 'p', 's'].includes(m[1])) vnames.add(m[1]);
  }
  const isVec = (src) => {
    const t = String(src || '');
    if (!t.trim()) return false;
    if (VDEF.test(t) && vnames.has(t.match(VDEF)[1])) return true;
    if (/[·×]|\bdot\(|\bcross\(/.test(t)) return true;
    const letters = t.replace(/\b(sin|cos|tan|log|exp|sqrt|abs|pi|dot|cross|norm)\b/g, ' ').match(/[A-Za-zα-ωΑ-Ω]/g) || [];
    return letters.some(c => c === 'p' || vnames.has(c));
  };
  const vecIdx = srcs.map((s, i) => isVec(s) ? i : -1).filter(i => i >= 0);
  const vres = vecIdx.length ? analyzePlane(vecIdx.map(i => srcs[i]), 'vector3') : [];
  return srcs.map((src, i) => {
    const k = vecIdx.indexOf(i);
    if (k >= 0) return vres[k];
    try { return { a: analyze3(src), error: null }; } catch (e) { return { a: null, error: e.message }; }
  });
}

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Graph3D {
  constructor(host) {
    this.host = host;
    host.classList.add('graph-host');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'graph-canvas';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.W = 0; this.H = 0;
    this.home = { yaw: -0.75, pitch: 0.45, R: 3 };
    Object.assign(this, this.home);
    this.items = [];
    this.params = {};
    this.lastDefs = {};
    this.geom = null;
    this.ptrs = new Map();
    this.sketchMode = false;
    this.bindPointers();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }
  destroy() { this.ro.disconnect(); }
  resize() {
    const r = this.host.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W; this.H = H;
    this.draw();
  }

  setExpressions(list) {
    const defs = {};
    const res = analyzeSpace(list.map(it => it.src));
    this.items = list.map((it, i) => {
      const color = it.color || COLORS[i % COLORS.length];
      const r = res[i];
      if (r.a && r.a.kind === 'param') defs[r.a.name] = r.a.value;
      return { ...it, color, a: r.a, error: r.error };
    });
    for (const [k, v] of Object.entries(defs)) if (!(k in this.params) || this.lastDefs[k] !== v) this.params[k] = v;
    this.lastDefs = defs;
    for (const k of this.paramNames()) if (!(k in this.params)) this.params[k] = 1;
    this.geom = null;
    this.draw();
    return this.items;
  }
  paramNames() {
    const s = new Set();
    for (const it of this.items) {
      if (!it.a) continue;
      if (it.a.kind === 'param') s.add(it.a.name);
      for (const p of it.a.params) s.add(p);
    }
    return [...s].sort();
  }
  setParam(n, v) { this.params[n] = v; this.geom = null; this.requestDraw(); }
  noteOf(it) {
    if (!it || !it.a || it.a.kind !== 'note') return '';
    try { const v = it.a.f({ ...this.params }); return Array.isArray(v) ? '' : `= ${+v.re.toFixed(3)}`; } catch (e) { return ''; }
  }
  resetView() { Object.assign(this, this.home); this.geom = null; this.draw(); }
  zoomBy(f) { this.R = Math.min(200, Math.max(0.2, this.R / f)); this.geom = null; this.requestDraw(); }
  setView() {}
  setSketchMode() {}
  setRevealed() {}
  clearSketch() {}

  bindPointers() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, pos(e));
      if (this.ptrs.size === 2) this.pinch = this.pinchD();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const prev = this.ptrs.get(e.pointerId), p = pos(e);
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size === 1) {
        this.yaw -= (p.x - prev.x) * 0.01;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + (p.y - prev.y) * 0.01));
        this.requestDraw();
      } else if (this.ptrs.size === 2 && this.pinch) {
        const d = this.pinchD();
        this.zoomBy(d / this.pinch);
        this.pinch = d;
      }
    });
    const end = (e) => { this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  pinchD() { const [a, b] = [...this.ptrs.values()]; return Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)); }
  requestDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.draw(); });
  }

  // ---------- 形状の計算（範囲・パラメータが変わったときだけ） ----------
  build() {
    const R = this.R, N = 56;
    const prims = []; // {type:'quad'|'seg'|'pt', P:[[x,y,z]...], color}
    const s0 = { ...this.params };
        // z の範囲 [-R, R] で多角形を切り取る（はみ出た部分をギザギザにせず平らに切る）
    const clipZ = (poly) => {
      for (const [sgn] of [[1], [-1]]) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const A = poly[i], B = poly[(i + 1) % poly.length];
          const ia = sgn * A[2] <= R, ib = sgn * B[2] <= R;
          if (ia) out.push(A);
          if (ia !== ib) {
            const t = (sgn * R - A[2]) / (B[2] - A[2]);
            out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, sgn * R]);
          }
        }
        poly = out;
        if (poly.length < 3) return null;
      }
      return poly;
    };
    const pushPoly = (poly, color) => { const c = clipZ(poly); if (c) prims.push({ type: 'quad', P: c, color }); };
    // 高さ関数 fn(x,y)（定義されない所は NaN）を格子で面にする。定義域の境界は二分法で滑らかに
    const grid = (fn, color) => {
      const h = new Float64Array((N + 1) * (N + 1));
      const X = (i) => -R + 2 * R * i / N;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h[j * (N + 1) + i] = fn(X(i), X(j));
      const edgePt = (p, q) => { // p は定義される点、q はされない点
        let a = p, b = q, z = p[2];
        for (let k = 0; k < 14; k++) {
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const v = fn(m[0], m[1]);
          if (Number.isFinite(v)) { a = [m[0], m[1], v]; z = v; } else b = m;
        }
        return [a[0], a[1], z];
      };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * (N + 1) + i;
        const V = [[X(i), X(j), h[k]], [X(i + 1), X(j), h[k + 1]], [X(i + 1), X(j + 1), h[k + N + 2]], [X(i), X(j + 1), h[k + N + 1]]];
        const ok = V.map(v => Number.isFinite(v[2]));
        if (ok.every(Boolean)) { pushPoly(V, color); continue; }
        if (!ok.some(Boolean)) continue;
        const poly = [];
        for (let e = 0; e < 4; e++) {
          const A = V[e], B = V[(e + 1) % 4];
          if (ok[e]) poly.push(A);
          if (ok[e] !== ok[(e + 1) % 4]) poly.push(ok[e] ? edgePt(A, B) : edgePt(B, A));
        }
        if (poly.length >= 3) pushPoly(poly, color);
      }
    };
    for (const it of this.items) {
      if (it.hidden || !it.a) continue;
      const a = it.a, s = { ...s0 };
      try {
        if (a.kind === 'surf') {
          grid((x, y) => { s.x = x; s.y = y; return a.f(s); }, it.color);
        } else if (a.kind === 'implicit') {
          const root = (x, y, sign) => {
            s.x = x; s.y = y;
            s.z = 0; const g0 = a.g(s); s.z = 1; const g1 = a.g(s); s.z = -1; const gm = a.g(s);
            const A = (g1 + gm) / 2 - g0, B = (g1 - gm) / 2, C = g0;
            if (Math.abs(A) < 1e-12) return sign > 0 ? -C / B : NaN;
            const D = B * B - 4 * A * C;
            if (D < 0) return NaN;
            return (-B + sign * Math.sqrt(D)) / (2 * A);
          };
          grid((x, y) => root(x, y, 1), it.color);
          grid((x, y) => root(x, y, -1), it.color);
        } else if (a.kind === 'psurf') {
          const M = 48, [u0, u1] = a.ur, [v0, v1] = a.vr;
          const pts = [];
          for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
            s.u = u0 + (u1 - u0) * i / M; s.v = v0 + (v1 - v0) * j / M;
            pts.push([a.fx(s), a.fy(s), a.fz(s)]);
          }
          for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
            const k = j * (M + 1) + i;
            const P = [pts[k], pts[k + 1], pts[k + M + 2], pts[k + M + 1]];
            if (P.every(q => q.every(Number.isFinite)) && P.some(q => Math.abs(q[0]) <= R && Math.abs(q[1]) <= R)) pushPoly(P, it.color);
          }
        } else if (a.kind === 'curve') {
          const K = 800, [t0, t1] = a.tr;
          let prev = null;
          for (let k = 0; k <= K; k++) {
            s.t = t0 + (t1 - t0) * k / K;
            const q = [a.fx(s), a.fy(s), a.fz(s)];
            const ok = q.every(Number.isFinite) && q.every(c => Math.abs(c) <= R * 1.0001);
            if (ok && prev) prims.push({ type: 'seg', P: [prev, q], color: it.color });
            prev = ok ? q : null;
          }
        } else if (a.kind === 'point') {
          const q = [a.fx(s), a.fy(s), a.fz(s)];
          if (q.every(Number.isFinite)) prims.push({ type: 'pt', P: [q], color: it.color });
        } else if (a.kind === 'vpoint') {
          const q = a.f(s);
          if (Array.isArray(q) && q.length === 3 && q.every(Number.isFinite)) prims.push({ type: 'pt', P: [q], color: it.color, label: a.name });
        } else if (a.kind === 'arrow') {
          const q = a.f(s);
          if (Array.isArray(q) && q.length === 3 && q.every(Number.isFinite) && Math.hypot(...q) > 1e-12) prims.push({ type: 'arrow', P: [[0, 0, 0], q], color: it.color, label: a.name });
        } else if (a.kind === 'curve3') {
          // 範囲を書かない直線は、表示範囲（±R の立方体）を通り抜けるだけの長さにする
          let [t0, t1] = a.trange || [-12, 12];
          if (!a.trange && a.linear) {
            const P0 = a.xyz({ ...s, [a.tv]: 0 }), P1 = a.xyz({ ...s, [a.tv]: 1 });
            const d = Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]) || 1;
            const T = (Math.hypot(...P0) + Math.sqrt(3) * R) / d;
            [t0, t1] = [-T, T];
          }
          const K = a.linear ? 400 : 800;
          let prev = null;
          for (let k = 0; k <= K; k++) {
            s[a.tv] = t0 + (t1 - t0) * k / K;
            const q = (!a.mask || a.mask(s)) ? a.xyz(s) : null;
            const ok = q && q.every(Number.isFinite) && q.every(c => Math.abs(c) <= R * 1.0001);
            if (ok && prev) prims.push({ type: 'seg', P: [prev, q], color: it.color });
            prev = ok ? q : null;
          }
        } else if (a.kind === 'plane3' || a.kind === 'patch3') {
          this.buildPatch(a, s, R, it.color, prims);
        } else if (a.kind === 'implicitN') {
          // z の方向に区切って符号の変わる所を探し、いちばん下といちばん上の解を面にする（|p-A|=2 など）
          const Z = 48;
          const roots = (x, y, top) => {
            s.x = x; s.y = y;
            let prevZ = top ? R : -R; s.z = prevZ; let prevG = a.g(s);
            for (let k = 1; k <= Z; k++) {
              const z = top ? R - 2 * R * k / Z : -R + 2 * R * k / Z;
              s.z = z; const gz = a.g(s);
              if (Number.isFinite(gz) && Number.isFinite(prevG) && (gz === 0 || (gz > 0) !== (prevG > 0))) {
                let lo = prevZ, hi = z, glo = prevG;
                for (let it2 = 0; it2 < 30; it2++) { const m = (lo + hi) / 2; s.z = m; const gm = a.g(s); if ((gm > 0) === (glo > 0)) { lo = m; glo = gm; } else hi = m; }
                return (lo + hi) / 2;
              }
              prevZ = z; prevG = gz;
            }
            return NaN;
          };
          grid((x, y) => roots(x, y, true), it.color);
          grid((x, y) => roots(x, y, false), it.color);
        }
      } catch (e) { /* 評価できない式は飛ばす */ }
    }
    this.geom = prims;
  }

  // 平面（plane3）・平面の一部（patch3）を、格子に分けて面にする。条件（s, t の1次不等式）と表示範囲の立方体で、多角形を正確に切り取る
  buildPatch(a, s, R, color, prims) {
    let at, sr, tr, conds = [];
    if (a.kind === 'plane3') {
      const fr = a.frame(s);
      if (!fr) return;
      const L = Math.hypot(...fr.p0) + Math.sqrt(3) * R;
      at = (u, v) => fr.p0.map((c, k) => c + u * fr.u[k] + v * fr.v[k]);
      sr = [-L, L]; tr = [-L, L];
    } else {
      at = (u, v) => a.at(u, v, s);
      const c0 = at(0, 0), du = at(1, 0).map((x, k) => x - c0[k]), dv = at(0, 1).map((x, k) => x - c0[k]);
      // 範囲のない向きは、立方体を覆う長さ（2つの向きの小さい方の特異値で割る）
      const g11 = du[0] ** 2 + du[1] ** 2 + du[2] ** 2, g22 = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2, g12 = du[0] * dv[0] + du[1] * dv[1] + du[2] * dv[2];
      const smin = Math.sqrt(Math.max(1e-18, (g11 + g22 - Math.sqrt((g11 - g22) ** 2 + 4 * g12 * g12)) / 2));
      const L = (Math.hypot(...c0) + Math.sqrt(3) * R) / smin;
      sr = a.sr || [-L, L]; tr = a.tr || [-L, L];
      conds = a.conds.map(c => ({ op: c.op, g: (u, v) => c.g({ ...s, s: u, t: v }) }));
    }
    const M = 20;
    const clipHalf = (poly, f, keepPos) => {   // f(u,v) の符号で切る（1次なので交点は線形補間で正確）
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        const fa = f(A), fb = f(B);
        const ia = keepPos ? fa >= -1e-12 : fa <= 1e-12, ib = keepPos ? fb >= -1e-12 : fb <= 1e-12;
        if (ia) out.push(A);
        if (ia !== ib) { const t = fa / (fa - fb); out.push(A.map((c, k) => c + (B[k] - c) * t)); }
      }
      return out;
    };
    const lin3 = (poly) => {   // 立方体 |x|,|y|,|z| <= R で切る（頂点は3次元座標）
      for (let ax = 0; ax < 3; ax++) for (const sg of [1, -1]) {
        poly = clipHalf(poly, (P) => R - sg * P[ax], true);
        if (poly.length < 3) return null;
      }
      return poly;
    };
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const u0 = sr[0] + (sr[1] - sr[0]) * i / M, u1 = sr[0] + (sr[1] - sr[0]) * (i + 1) / M;
      const v0 = tr[0] + (tr[1] - tr[0]) * j / M, v1 = tr[0] + (tr[1] - tr[0]) * (j + 1) / M;
      let poly = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      for (const c of conds) {
        const keepPos = c.op === '>=' || c.op === '>';
        poly = clipHalf(poly, (P) => c.g(P[0], P[1]), keepPos);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;
      const P3 = lin3(poly.map(([u, v]) => at(u, v)));
      if (P3 && P3.every(q => q.every(Number.isFinite))) prims.push({ type: 'quad', P: P3, color });
    }
  }

  // 世界座標 → カメラ座標（右, 上, 奥）
  cam([x, y, z]) {
    const R = this.R, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const X = x / R, Y = y / R, Z = z / R;
    const x1 = X * cy - Y * sy, y1 = X * sy + Y * cy;
    return [x1, Z * cp + y1 * sp, y1 * cp - Z * sp];
  }
  scr([r, u, d]) {
    const S = Math.min(this.W, this.H) * 0.3, f = 1 / (1 + 0.16 * d);
    return [this.W / 2 + r * S * f, this.H / 2 - u * S * f];
  }

  css(name, fb) { return getComputedStyle(this.host).getPropertyValue(name).trim() || fb; }

  draw() {
    const { ctx, W, H } = this;
    if (W < 2) return;
    if (!this.geom) this.build();
    const col = { bg: this.css('--g-bg', '#fff'), grid: this.css('--g-major', '#ddd'), axis: this.css('--g-axis', '#555'), label: this.css('--g-label', '#777') };
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
    const R = this.R;
    const line = (a, b, color, w = 1, dash = null) => {
      const p = this.scr(this.cam(a)), q = this.scr(this.cam(b));
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
    };
    // 床の格子と外枠
    const st = R / 3;
    for (let k = -3; k <= 3; k++) {
      line([-R, k * st, -R], [R, k * st, -R], col.grid);
      line([k * st, -R, -R], [k * st, R, -R], col.grid);
    }
    const c = [-R, R];
    for (const a of c) for (const b of c) {
      line([a, b, -R], [a, b, R], col.grid);
      line([a, -R, b], [a, R, b], col.grid);
      line([-R, a, b], [R, a, b], col.grid);
    }
    // 軸（原点を通る）
    line([-R, 0, 0], [R, 0, 0], col.axis, 1.2, [4, 4]);
    line([0, -R, 0], [0, R, 0], col.axis, 1.2, [4, 4]);
    line([0, 0, -R], [0, 0, R], col.axis, 1.2, [4, 4]);

    // 面・線を奥から順に描く（画家のアルゴリズム）
    const light = [0.35, 0.55, -0.76];
    const items = this.geom.map(p => {
      const C = p.P.map(q => this.cam(q));
      const depth = C.reduce((s, q) => s + q[2], 0) / C.length;
      return { p, C, depth };
    }).sort((a, b) => b.depth - a.depth);
    for (const { p, C } of items) {
      const S = C.map(q => this.scr(q));
      const rgb = hexToRgb(p.color);
      if (p.type === 'quad') {
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < C.length; i++) {
          const a = C[i], b = C[(i + 1) % C.length];
          nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
        }
        const nl = Math.hypot(nx, ny, nz) || 1;
        const k = 0.42 + 0.58 * Math.abs((nx * light[0] + ny * light[1] + nz * light[2]) / nl);
        ctx.fillStyle = `rgba(${Math.round(rgb[0] * k + 255 * (1 - k) * 0.25)},${Math.round(rgb[1] * k + 255 * (1 - k) * 0.25)},${Math.round(rgb[2] * k + 255 * (1 - k) * 0.25)},0.9)`;
        ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1]);
        for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`; ctx.lineWidth = 0.5; ctx.stroke();
      } else if (p.type === 'arrow') {
        const [a0, b0] = S;
        const dx = b0[0] - a0[0], dy = b0[1] - a0[1], len = Math.hypot(dx, dy);
        ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        if (len > 1) {
          const ux = dx / len, uy = dy / len, hd = Math.min(12, len * 0.4);
          ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0] - ux * hd * 0.6, b0[1] - uy * hd * 0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(b0[0], b0[1]);
          ctx.lineTo(b0[0] - ux * hd - uy * hd * 0.5, b0[1] - uy * hd + ux * hd * 0.5);
          ctx.lineTo(b0[0] - ux * hd + uy * hd * 0.5, b0[1] - uy * hd - ux * hd * 0.5);
          ctx.closePath(); ctx.fill();
          if (p.label) {
            ctx.font = 'italic 600 13px "Times New Roman", serif'; ctx.textAlign = 'center';
            const lx = (a0[0] + b0[0]) / 2 - uy * 12, ly = (a0[1] + b0[1]) / 2 + ux * 12 + 4;
            ctx.fillText(p.label, lx, ly);
            if (/^[a-zα-ω]$/.test(p.label)) {
              const w = ctx.measureText(p.label).width;
              ctx.lineWidth = 1; ctx.beginPath();
              ctx.moveTo(lx - w / 2 - 1, ly - 12); ctx.lineTo(lx + w / 2 + 2, ly - 12);
              ctx.moveTo(lx + w / 2 - 1, ly - 14); ctx.lineTo(lx + w / 2 + 2, ly - 12); ctx.lineTo(lx + w / 2 - 1, ly - 10);
              ctx.stroke();
            }
          }
        }
      } else if (p.type === 'seg') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1]); ctx.lineTo(S[1][0], S[1][1]); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(S[0][0], S[0][1], 5, 0, TAU); ctx.fill();
        const q = p.P[0];
        ctx.font = '12px -apple-system, "Hiragino Sans", system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`${p.label || ''}(${+q[0].toFixed(2)}, ${+q[1].toFixed(2)}, ${+q[2].toFixed(2)})`, S[0][0] + 8, S[0][1] - 8);
      }
    }
    // 軸ラベル
    ctx.fillStyle = col.axis; ctx.font = 'italic 600 14px "Times New Roman", serif'; ctx.textAlign = 'center';
    for (const [name, q] of [['x', [R * 1.12, 0, 0]], ['y', [0, R * 1.12, 0]], ['z', [0, 0, R * 1.12]]]) {
      const s = this.scr(this.cam(q)); ctx.fillText(name, s[0], s[1] + 5);
    }
    ctx.fillStyle = col.label; ctx.font = '11px -apple-system, "Hiragino Sans", system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`表示範囲 ±${+R.toFixed(2)}`, 10, H - 10);
  }
}
