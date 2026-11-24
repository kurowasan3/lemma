// グラフ描画エンジン（Canvas 2D）
// 陽関数 y=f(x) / x=g(y)、陰関数 F(x,y)=0、不等式の領域（連立も可）、
// 媒介変数 (f(t), g(t))、極座標 r=f(θ)、点、パラメータ（スライダー）、予想描画（スケッチ）
// mode：'xy'（座標平面。ベクトルの書き方の行は plane.js の vector で読む）・'complex'（複素数平面）・'vector'（ベクトルだけ。旧版との互換）

import { parse, compile, splitRelation, freeVars } from './parser.js';
import { analyzePlane, solveRoots, fmtComplex, fmtNum, holds as holdsEq } from './plane.js';

export const FILE_VERSION = '0.29.1';
export const COLORS = ['#2f6fdf', '#d9463b', '#2e9d5b', '#8e4fd6', '#e08a1e', '#1a9aa8'];
const RESERVED = new Set(['x', 'y', 't', 'θ', 'r']);
const TAU = Math.PI * 2;

const paramsOf = (...asts) => {
  const s = new Set();
  for (const a of asts) for (const v of freeVars(a)) if (!RESERVED.has(v)) s.add(v);
  return s;
};
const constValue = (src) => {
  const a = parse(src);
  if (freeVars(a).size) throw new Error('範囲には数を入れてください');
  return compile(a)({});
};

// 1行の式を解析して描画方法を決める
export function analyze(raw) {
  let src = String(raw || '').trim();
  if (!src) return { kind: 'empty', params: new Set() };
  let trange = null;
  const m = src.match(/^(.*?)[\s;]+t\s*:\s*(.+?)\s*(?:\.\.|〜|~)\s*(.+)$/);
  if (m) { src = m[1]; trange = [constValue(m[2]), constValue(m[3])]; }

  const { parts, ops } = splitRelation(src);
  if (ops.length === 0) {
    const ast = parse(src);
    const fv = freeVars(ast);
    if (ast.t === 'tuple') {
      if (ast.items.length !== 2) throw new Error('点や媒介変数表示は (x, y) の2成分で書きます');
      const [ax, ay] = ast.items;
      if (fv.has('t')) {
        return { kind: 'pcurve', fx: compile(ax), fy: compile(ay), trange: trange || [0, TAU], params: paramsOf(ast) };
      }
      return { kind: 'point', fx: compile(ax), fy: compile(ay), params: paramsOf(ast) };
    }
    if (fv.has('y')) throw new Error('y を含む式には「=」か不等号が必要です');
    if (fv.has('θ')) return { kind: 'polar', f: compile(ast), trange: trange || [0, TAU], params: paramsOf(ast) };
    return { kind: 'fx', f: compile(ast), params: paramsOf(ast) };
  }

  if (ops.length === 1 && ops[0] === '=') {
    const [L, R] = parts;
    if (!L || !R) throw new Error('「=」の両側に式が必要です');
    const ra = parse(R);
    if (/^[a-zA-Z]$/.test(L) && !RESERVED.has(L) && freeVars(ra).size === 0) {
      return { kind: 'param', name: L, value: compile(ra)({}), params: new Set() };
    }
    const rv = freeVars(ra);
    if (L === 'y' && !rv.has('y')) return { kind: 'fx', f: compile(ra), params: paramsOf(ra) };
    if (L === 'x' && !rv.has('x') ) return { kind: 'fy', f: compile(ra), params: paramsOf(ra) };
    if (L === 'r') return { kind: 'polar', f: compile(ra), trange: trange || [0, TAU], params: paramsOf(ra) };
    const la = parse(L);
    const lv = freeVars(la);
    if (R === 'y' && !lv.has('y')) return { kind: 'fx', f: compile(la), params: paramsOf(la) };
    const fl = compile(la), fr = compile(ra);
    return { kind: 'implicit', g: (s) => fl(s) - fr(s), params: paramsOf(la, ra) };
  }

  if (ops.includes('=')) throw new Error('「=」と不等号を同時に使う形には対応していません');
  const conds = [], bounds = [];
  const params = new Set();
  for (let i = 0; i < ops.length; i++) {
    const L = parts[i], R = parts[i + 1];
    if (!L || !R) throw new Error('不等号の両側に式が必要です');
    const la = parse(L), ra = parse(R);
    for (const p of paramsOf(la, ra)) params.add(p);
    const fl = compile(la), fr = compile(ra);
    const g = (s) => fl(s) - fr(s);
    const op = ops[i];
    conds.push({ g, op });
    const strict = op === '<' || op === '>';
    if (L === 'y' && !freeVars(ra).has('y')) bounds.push({ type: 'fx', f: fr, strict });
    else if (R === 'y' && !freeVars(la).has('y')) bounds.push({ type: 'fx', f: fl, strict });
    else bounds.push({ type: 'implicit', g, strict });
  }
  return { kind: 'region', conds, bounds, params };
}

function holds(v, op) {
  switch (op) {
    case '<': return v < 0;
    case '<=': return v <= 1e-12;
    case '>': return v > 0;
    case '>=': return v >= -1e-12;
  }
  return false;
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

function fmt(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const s = v.toFixed(Math.min(d, 6));
  return s === '-0' ? '0' : s;
}

// 座標平面の式の一覧を読む：ベクトルの書き方の行（p を使う・A=(1,2) のように名前に (…, …) を入れる・その名前を使う・内積 · や外積 ×）は
// plane.js の vector で、それ以外（y=x^2、x^2+y^2=4、(cos t, sin t)、点 (1,2) など）は今まで通り analyze で読む
const VDEF2 = /^\s*([A-Za-zα-ωΑ-Ω])\s*=\s*\(/;
const NOT_VEC = ['x', 'y', 't', 'p', 's', 'r', 'θ', 'e'];
export function analyzeFlat(srcs) {
  const vnames = new Set();
  for (const src of srcs) {
    const m = String(src || '').match(VDEF2);
    if (m && !NOT_VEC.includes(m[1])) vnames.add(m[1]);
  }
  const isVec = (src) => {
    const t = String(src || '');
    if (!t.trim()) return false;
    const m = t.match(VDEF2);
    if (m && vnames.has(m[1])) return true;
    if (/[·×]|\bdot\(|\bcross\(/.test(t)) return true;
    const letters = t.replace(/\b(sin|cos|tan|log|exp|sqrt|abs|pi|dot|cross|norm)\b/g, ' ').match(/[A-Za-zα-ωΑ-Ω]/g) || [];
    return letters.some(c => c === 'p' || vnames.has(c));
  };
  const vecIdx = srcs.map((s, i) => isVec(s) ? i : -1).filter(i => i >= 0);
  const vres = vecIdx.length ? analyzePlane(vecIdx.map(i => srcs[i]), 'vector') : [];
  return srcs.map((src, i) => {
    const k = vecIdx.indexOf(i);
    if (k >= 0) return vres[k];
    try { return { a: analyze(src), error: null }; } catch (e) { return { a: null, error: e.message }; }
  });
}

export class Graph {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.mode = opts.mode || 'xy';
    host.classList.add('graph-host');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'graph-canvas';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.W = 0; this.H = 0;
    this.view = { cx: 0, cy: 0, scale: 40 };
    this.home = { xmin: -6, xmax: 6, ymin: -4, ymax: 4 };
    this.pendingBounds = this.home;
    this.items = [];
    this.params = {};
    this.strokes = [];
    this.sketchMode = false;
    this.revealed = true;
    this.trace = null;
    this.ptrs = new Map();
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
    if (this.pendingBounds && W > 1) { this.applyBounds(this.pendingBounds); this.pendingBounds = null; }
    this.draw();
  }

  applyBounds({ xmin, xmax, ymin, ymax }) {
    const scale = Math.min(this.W / (xmax - xmin), this.H / (ymax - ymin));
    this.view = { cx: (xmin + xmax) / 2, cy: (ymin + ymax) / 2, scale };
  }

  setView(b) {
    this.home = b;
    if (this.W > 1) { this.applyBounds(b); this.draw(); } else this.pendingBounds = b;
  }
  resetView() { this.setView(this.home); this.trace = null; this.draw(); }
  zoomBy(f) { this.zoomAt(this.W / 2, this.H / 2, f); }

  sx(x) { return this.W / 2 + (x - this.view.cx) * this.view.scale; }
  sy(y) { return this.H / 2 - (y - this.view.cy) * this.view.scale; }
  wx(px) { return this.view.cx + (px - this.W / 2) / this.view.scale; }
  wy(py) { return this.view.cy - (py - this.H / 2) / this.view.scale; }

  setMode(mode) { this.mode = mode || 'xy'; this.trace = null; }

  // items: [{src, color, hidden}]
  setExpressions(list) {
    const defs = {};
    if (this.mode === 'complex' || this.mode === 'vector') {
      const res = analyzePlane(list.map(it => it.src), this.mode);
      this.items = list.map((it, i) => {
        const color = it.color || COLORS[i % COLORS.length];
        const r = res[i];
        if (r.a && r.a.kind === 'param') defs[r.a.name] = r.a.value;
        return { ...it, color, a: r.a, error: r.error };
      });
    } else {
      const res = analyzeFlat(list.map(it => it.src));
      this.items = list.map((it, i) => {
        const color = it.color || COLORS[i % COLORS.length];
        const r = res[i];
        if (r.a && r.a.kind === 'param') defs[r.a.name] = r.a.value;
        return { ...it, color, a: r.a, error: r.error };
      });
    }
    this.lastDefs = this.lastDefs || {};
    for (const [k, v] of Object.entries(defs)) {
      if (!(k in this.params) || this.lastDefs[k] !== v) this.params[k] = v; // 「a=2」を書き換えたら反映
    }
    this.lastDefs = defs;
    for (const k of this.paramNames()) if (!(k in this.params)) this.params[k] = 1;
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
  setParam(name, v) { this.params[name] = v; this.draw(); }

  // 式の行の横に出す値（ベクトルの内積など、描かずに値だけ見せるもの）
  noteOf(it) {
    if (!it || !it.a || it.a.kind !== 'note') return '';
    try { const v = it.a.f({ ...this.params }); return Array.isArray(v) ? '' : `= ${this.mode === 'complex' ? fmtComplex(v.re, v.im) : fmtNum(v.re)}`; }
    catch (e) { return ''; }
  }

  setSketchMode(on) { this.sketchMode = on; this.host.classList.toggle('sketching', on); }
  setRevealed(on) { this.revealed = on; this.draw(); }
  clearSketch() { this.strokes = []; this.draw(); }

  // ---------- 入力 ----------
  bindPointers() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size === 1) {
        this.down = { ...p, t: performance.now(), moved: false };
        if (this.sketchMode) { this.curStroke = [[this.wx(p.x), this.wy(p.y)]]; this.strokes.push(this.curStroke); }
      } else if (this.ptrs.size === 2) {
        if (this.curStroke) { this.strokes.pop(); this.curStroke = null; }
        this.pinch = this.pinchState();
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const prev = this.ptrs.get(e.pointerId);
      const p = pos(e);
      this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size === 1) {
        if (this.down && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 4) this.down.moved = true;
        if (this.sketchMode && this.curStroke) {
          this.curStroke.push([this.wx(p.x), this.wy(p.y)]);
        } else {
          this.view.cx -= (p.x - prev.x) / this.view.scale;
          this.view.cy += (p.y - prev.y) / this.view.scale;
          this.trace = null;
        }
        this.requestDraw();
      } else if (this.ptrs.size === 2 && this.pinch) {
        const now = this.pinchState();
        const f = now.d / this.pinch.d;
        this.view.cx -= (now.mx - this.pinch.mx) / this.view.scale;
        this.view.cy += (now.my - this.pinch.my) / this.view.scale;
        this.zoomAt(now.mx, now.my, f, false);
        this.pinch = now;
        this.trace = null;
        this.requestDraw();
      }
    });
    const end = (e) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size === 0) {
        if (this.down && !this.down.moved && !this.sketchMode && performance.now() - this.down.t < 400) this.tap(p.x, p.y);
        if (this.curStroke && this.curStroke.length < 2) this.strokes.pop();
        this.curStroke = null;
        this.down = null;
        this.opts.onSketch && this.sketchMode && this.opts.onSketch(this.strokes.length);
      }
      if (this.ptrs.size < 2) this.pinch = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }

  pinchState() {
    const [a, b] = [...this.ptrs.values()];
    return { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  zoomAt(px, py, f, redraw = true) {
    const wx = this.wx(px), wy = this.wy(py);
    this.view.scale = Math.min(1e5, Math.max(1e-3, this.view.scale * f));
    this.view.cx = wx - (px - this.W / 2) / this.view.scale;
    this.view.cy = wy + (py - this.H / 2) / this.view.scale;
    if (redraw) this.requestDraw();
  }

  tap(px, py) {
    const x = this.wx(px);
    let best = null;
    if (this.revealed) {
      const s = { ...this.params, x };
      for (const it of this.items) {
        if (it.hidden || !it.a || it.a.kind !== 'fx') continue;
        const y = it.a.f(s);
        if (!Number.isFinite(y)) continue;
        const d = Math.abs(this.sy(y) - py);
        if (d < 28 && (!best || d < best.d)) best = { d, x, y, color: it.color };
      }
    }
    this.trace = best || { x, y: this.wy(py), color: null };
    this.draw();
  }

  requestDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.draw(); });
  }

  // ---------- 描画 ----------
  css(name, fallback) {
    const v = getComputedStyle(this.host).getPropertyValue(name).trim();
    return v || fallback;
  }

  draw() {
    const { ctx, W, H } = this;
    if (W < 2) return;
    const col = {
      bg: this.css('--g-bg', '#fff'), grid: this.css('--g-grid', '#eef0f3'),
      major: this.css('--g-major', '#d9dde3'), axis: this.css('--g-axis', '#5b6270'),
      label: this.css('--g-label', '#6b7280'), sketch: this.css('--g-sketch', '#e08a1e'),
    };
    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, W, H);
    this.drawGrid(col);
    if (this.revealed) {
      for (const it of this.items) {
        if (it.hidden || !it.a) continue;
        try { this.drawItem(it); } catch (e) { /* 評価できない式は飛ばす */ }
      }
    }
    this.drawStrokes(col.sketch);
    this.drawTrace(col);
  }

  drawGrid(col) {
    const { ctx, W, H } = this;
    const step = niceStep(70 / this.view.scale);
    const lead = Math.round(step / Math.pow(10, Math.floor(Math.log10(step))));
    const minor = step / (lead === 2 ? 4 : 5);
    const x0 = this.wx(0), x1 = this.wx(W), y0 = this.wy(H), y1 = this.wy(0);
    const lines = (st, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0 / st) * st; x <= x1; x += st) { const p = Math.round(this.sx(x)) + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, H); }
      for (let y = Math.ceil(y0 / st) * st; y <= y1; y += st) { const p = Math.round(this.sy(y)) + 0.5; ctx.moveTo(0, p); ctx.lineTo(W, p); }
      ctx.stroke();
    };
    if (minor * this.view.scale > 8) lines(minor, col.grid);
    lines(step, col.major);
    // 軸
    ctx.strokeStyle = col.axis; ctx.lineWidth = 1.25; ctx.beginPath();
    const ax = this.sx(0), ay = this.sy(0);
    ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
    // 目盛り
    ctx.fillStyle = col.label;
    ctx.font = '11px -apple-system, "Hiragino Sans", system-ui, sans-serif';
    const ly = Math.min(H - 6, Math.max(14, ay + 14));
    ctx.textAlign = 'center';
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      if (Math.abs(x) < step / 2 || this.sx(x) < 14 || this.sx(x) > W - 14) continue;
      ctx.fillText(fmt(x, step), this.sx(x), ly);
    }
    const lx = Math.min(W - 6, Math.max(6, ax - 6));
    ctx.textAlign = ax - 6 < 30 ? 'left' : 'right';
    const lxx = ax - 6 < 30 ? Math.max(4, ax + 6) : lx;
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      if (Math.abs(y) < step / 2 || this.sy(y) < 10 || this.sy(y) > H - 6) continue;
      ctx.fillText(fmt(y, step), lxx, this.sy(y) + 4);
    }
    ctx.textAlign = 'right';
    if (ax > 0 && ax < W && ay > 0 && ay < H) ctx.fillText('O', ax - 4, ay + 14);
    if (this.mode === 'complex' || this.mode === 'vector') {   // 軸の名前（複素数平面は 実軸・虚軸）
      const [nx, ny] = this.mode === 'complex' ? ['実軸', '虚軸'] : ['x', 'y'];
      ctx.font = '600 12px -apple-system, "Hiragino Sans", system-ui, sans-serif';
      ctx.fillStyle = col.axis;
      if (ay > 12 && ay < H - 4) { ctx.textAlign = 'right'; ctx.fillText(nx, W - 6, ay - 6); }
      if (ax > 4 && ax < W - 30) { ctx.textAlign = 'left'; ctx.fillText(ny, ax + 6, 14); }
    }
  }

  strokePath(color, dashed, width = 2.25) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(dashed ? [7, 6] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  pathFx(f, s) {
    const { ctx, W, H } = this;
    ctx.beginPath();
    let pen = false, prevY = null;
    const lim = H * 4;
    for (let px = -1; px <= W + 1; px += 1) {
      s.x = this.wx(px);
      const y = f(s);
      if (!Number.isFinite(y)) { pen = false; prevY = null; continue; }
      const py = this.sy(y);
      const cl = Math.max(-lim, Math.min(lim + H, py));
      if (pen && prevY !== null && Math.abs(py - prevY) > H * 1.5) pen = false; // 漸近線での縦線を防ぐ
      if (pen) ctx.lineTo(px, cl); else { ctx.moveTo(px, cl); pen = true; }
      prevY = py;
    }
  }

  pathFy(f, s) {
    const { ctx, W, H } = this;
    ctx.beginPath();
    let pen = false, prevX = null;
    for (let py = -1; py <= H + 1; py += 1) {
      s.y = this.wy(py);
      const x = f(s);
      if (!Number.isFinite(x)) { pen = false; prevX = null; continue; }
      const px = this.sx(x);
      if (pen && prevX !== null && Math.abs(px - prevX) > W * 1.5) pen = false;
      const cl = Math.max(-W * 4, Math.min(W * 5, px));
      if (pen) ctx.lineTo(cl, py); else { ctx.moveTo(cl, py); pen = true; }
      prevX = px;
    }
  }

  // opts.keep：[{ g, op }] を満たす所だけ描く（|z|=1, Im(z)>=0 のような条件つき）
  // opts.verify：符号が変わっても値が0に近くない所（arg の不連続など）は描かない
  pathImplicit(g, s, opts = null) {
    const { ctx, W, H } = this;
    const cell = 5;
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const v = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      s.y = this.wy(j * cell);
      for (let i = 0; i < nx; i++) { s.x = this.wx(i * cell); v[j * nx + i] = g(s); }
    }
    ctx.beginPath();
    const lerp = (a, b) => a / (a - b);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
        if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
        const pts = [];
        const X = i * cell, Y = j * cell;
        if ((a > 0) !== (b > 0)) pts.push([X + cell * lerp(a, b), Y]);
        if ((b > 0) !== (c > 0)) pts.push([X + cell, Y + cell * lerp(b, c)]);
        if ((d > 0) !== (c > 0)) pts.push([X + cell * lerp(d, c), Y + cell]);
        if ((a > 0) !== (d > 0)) pts.push([X, Y + cell * lerp(a, d)]);
        if (pts.length < 2) continue;
        // 符号が逆でも値が大きく跳ぶ所（1/x の極など）は境界でない
        const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
        if (m > 1e3 * (1 + Math.min(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)))) continue;
        if (opts) {
          const mx = (pts[0][0] + pts[1][0]) / 2, my = (pts[0][1] + pts[1][1]) / 2;
          s.x = this.wx(mx); s.y = this.wy(my);
          if (opts.verify) { const gv = g(s); if (!Number.isFinite(gv) || Math.abs(gv) > 0.2 * m + 1e-12) continue; }
          if (opts.keep && opts.keep.length && !opts.keep.every(c => { const v = c.g(s); return Number.isFinite(v) && holdsEq(v + (c.op.startsWith('<') ? -1e-7 : c.op.startsWith('>') ? 1e-7 : 0), c.op); })) continue;
        }
        ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]);
        if (pts.length === 4) { ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); }
      }
    }
  }

  fillRegion(conds, s, color) {
    const { ctx, W, H } = this;
    const cell = 3;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    for (let py = 0; py < H; py += cell) {
      s.y = this.wy(py + cell / 2);
      let run = -1;
      for (let px = 0; px <= W; px += cell) {
        let ok = px < W;
        if (ok) {
          s.x = this.wx(px + cell / 2);
          for (const c of conds) { const val = c.g(s); if (!Number.isFinite(val) || !holds(val, c.op)) { ok = false; break; } }
        }
        if (ok && run < 0) run = px;
        if (!ok && run >= 0) { ctx.fillRect(run, py, px - run, cell); run = -1; }
      }
      if (run >= 0) ctx.fillRect(run, py, W - run, cell);
    }
    ctx.globalAlpha = 1;
  }

  drawItem(it) {
    const a = it.a;
    const s = { ...this.params };
    const { ctx } = this;
    switch (a.kind) {
      case 'fx': this.pathFx(a.f, s); this.strokePath(it.color); break;
      case 'fy': this.pathFy(a.f, s); this.strokePath(it.color); break;
      case 'implicit': this.pathImplicit(a.g, s); this.strokePath(it.color); break;
      case 'region':
        this.fillRegion(a.conds, s, it.color);
        a.bounds.forEach((b, k) => {
          if (b.type === 'fx') this.pathFx(b.f, s);
          else if (a.verify) this.pathImplicit(b.g, s, { verify: true, keep: a.conds.filter((_, j) => j !== k) });   // 境界は、ほかの条件を満たす部分だけ
          else this.pathImplicit(b.g, s);
          this.strokePath(it.color, b.strict, 1.75);
        });
        break;
      case 'implicitc': this.pathImplicit(a.g, s, { verify: true, keep: a.mask }); this.strokePath(it.color); break;
      case 'pcurve2': {
        const [t0, t1] = a.trange;
        const N = 1500;
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= N; k++) {
          s[a.tv] = t0 + (t1 - t0) * k / N;
          let xy;
          try { xy = (!a.mask || a.mask(s)) ? a.xy(s) : null; } catch (e) { xy = null; }
          if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) { pen = false; continue; }
          const px = this.sx(xy[0]), py = this.sy(xy[1]);
          if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
        }
        this.strokePath(it.color);
        break;
      }
      case 'roots': {
        const box = { xmin: this.wx(0), xmax: this.wx(this.W), ymin: this.wy(this.H), ymax: this.wy(0) };
        const pts = solveRoots(a.g1, a.g2, s, box, a.mask);
        for (const [x, y] of pts) this.dot(x, y, it.color, a.complexLabel ? fmtComplex(x, y) : `(${fmtNum(x)}, ${fmtNum(y)})`);
        break;
      }
      case 'cpoint': {
        const v = a.f(s);
        if (!v || Array.isArray(v)) break;
        const val = fmtComplex(v.re, v.im);
        this.dot(v.re, v.im, it.color, a.name && a.name !== val ? `${a.name} = ${val}` : val);
        break;
      }
      case 'vpoint': {
        const v = a.f(s);
        if (!Array.isArray(v)) break;
        this.dot(v[0], v[1], it.color, `${a.name}(${fmtNum(v[0])}, ${fmtNum(v[1])})`);
        break;
      }
      case 'arrow': {
        const v = a.f(s);
        if (!Array.isArray(v) || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) break;
        this.arrow(0, 0, v[0], v[1], it.color, a.name);
        break;
      }
      case 'pcurve':
      case 'polar': {
        const [t0, t1] = a.trange;
        const N = 1200;
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= N; k++) {
          const t = t0 + (t1 - t0) * k / N;
          let x, y;
          if (a.kind === 'pcurve') { s.t = t; x = a.fx(s); y = a.fy(s); }
          else { s['θ'] = t; s.t = t; const r = a.f(s); x = r * Math.cos(t); y = r * Math.sin(t); }
          if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
          const px = this.sx(x), py = this.sy(y);
          if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
        }
        this.strokePath(it.color);
        break;
      }
      case 'point': {
        const x = a.fx(s), y = a.fy(s);
        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
        ctx.fillStyle = it.color;
        ctx.beginPath(); ctx.arc(this.sx(x), this.sy(y), 4.5, 0, TAU); ctx.fill();
        ctx.font = '12px -apple-system, "Hiragino Sans", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`(${+x.toFixed(3)}, ${+y.toFixed(3)})`, this.sx(x) + 8, this.sy(y) - 8);
        break;
      }
    }
  }

  dot(x, y, color, label) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(this.sx(x), this.sy(y), 4.5, 0, TAU); ctx.fill();
    if (label) {
      ctx.font = '12px -apple-system, "Hiragino Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, this.sx(x) + 8, this.sy(y) - 8);
    }
  }

  arrow(x0, y0, x1, y1, color, label) {
    const { ctx } = this;
    const ax = this.sx(x0), ay = this.sy(y0), bx = this.sx(x1), by = this.sy(y1);
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) return;
    const ux = (bx - ax) / len, uy = (by - ay) / len, head = Math.min(12, len * 0.4);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * head * 0.6, by - uy * head * 0.6);
    this.strokePath(color, false, 2.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - ux * head - uy * head * 0.5, by - uy * head + ux * head * 0.5);
    ctx.lineTo(bx - ux * head + uy * head * 0.5, by - uy * head - ux * head * 0.5);
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = 'italic 600 13px "Times New Roman", serif';
      ctx.textAlign = 'center';
      // 矢印の中ほど、左側に名前（ベクトルの記号として上に矢印を付ける）
      const lx = (ax + bx) / 2 - uy * 12, ly = (ay + by) / 2 + ux * 12 + 4;
      ctx.fillText(label, lx, ly);
      if (/^[a-zα-ω]$/.test(label)) {
        const w = ctx.measureText(label).width;
        ctx.lineWidth = 1; ctx.strokeStyle = color; ctx.beginPath();
        ctx.moveTo(lx - w / 2 - 1, ly - 12); ctx.lineTo(lx + w / 2 + 2, ly - 12);
        ctx.moveTo(lx + w / 2 - 1, ly - 14); ctx.lineTo(lx + w / 2 + 2, ly - 12); ctx.lineTo(lx + w / 2 - 1, ly - 10);
        ctx.stroke();
      }
    }
  }

  drawStrokes(color) {
    const { ctx } = this;
    for (const st of this.strokes) {
      if (st.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(this.sx(st[0][0]), this.sy(st[0][1]));
      for (const [x, y] of st) ctx.lineTo(this.sx(x), this.sy(y));
      ctx.globalAlpha = 0.85;
      this.strokePath(color, false, 3);
      ctx.globalAlpha = 1;
    }
  }

  drawTrace(col) {
    if (!this.trace) return;
    const { ctx } = this;
    const { x, y, color } = this.trace;
    const px = this.sx(x), py = this.sy(y);
    const step = niceStep(70 / this.view.scale) / 100;
    ctx.fillStyle = color || col.axis;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
    const label = this.mode === 'complex' ? fmtComplex(+fmt(x, step), +fmt(y, step)) : `(${fmt(x, step)}, ${fmt(y, step)})`;
    ctx.font = '600 12px -apple-system, "Hiragino Sans", system-ui, sans-serif';
    const w = ctx.measureText(label).width + 12;
    const bx = Math.min(this.W - w - 4, px + 10), by = Math.max(4, py - 30);
    ctx.fillStyle = col.bg; ctx.globalAlpha = 0.92;
    ctx.fillRect(bx, by, w, 22); ctx.globalAlpha = 1;
    ctx.strokeStyle = col.major; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, 21);
    ctx.fillStyle = col.axis; ctx.textAlign = 'left';
    ctx.fillText(label, bx + 6, by + 15);
  }
}
