// 複素平面とベクトルの式 → グラフの描き方（graph.js の Graph が描く）
//
// 複素平面（mode 'complex'）：z = x + yi を動く点とする
//   |z-1|=2（円）  arg(z)=π/4（半直線）  |z-1|=|z+i|（垂直二等分線）  Re(z)>=0, |z|<=2（領域）
//   z^3=1（解を点で）  α=1+2i（点。以後 α として使える）  e^(it) t:0..π（曲線）  |z|=1, Im(z)>=0（条件つき）
// ベクトル（mode 'vector'）：p = (x, y) を動く点の位置ベクトルとする
//   a=(2,1)（矢印）  A=(1,3)（点）  p=A+t(a)（直線）  p=A+t(B-A), 0<=t<=1（線分）
//   |p-A|=2（円）  (p-A)·(p-B)=0（AB を直径とする円）  p=sa+tb, s>=0, t>=0, s+t<=1（三角形の内部）
//
// 値：数は複素数 {re, im}（ベクトルのモードでも数は複素数として持ち、成分は実数）、ベクトルは実数の配列 [x, y]
// 1行の解析結果（graph.js の analyze() と同じ形に、矢印 arrow・解の点 roots・条件つき陰関数 implicitc を加えたもの）

export const FILE_VERSION = '0.12.0';
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 複素数
const C = (re, im = 0) => ({ re, im });
const isC = (v) => v && typeof v === 'object' && !Array.isArray(v);
const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
const csub = (a, b) => C(a.re - b.re, a.im - b.im);
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = (a) => Math.hypot(a.re, a.im);
const carg = (a) => Math.atan2(a.im === 0 ? 0 : a.im, a.re);   // -0 でも主値（-π<θ≦π）にする
const cexp = (a) => { const r = Math.exp(a.re); return C(r * Math.cos(a.im), r * Math.sin(a.im)); };
const clog = (a) => C(Math.log(cabs(a)), carg(a));
function cpow(a, b) {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let n = Math.abs(b.re), r = C(1), x = a;
    while (n) { if (n & 1) r = cmul(r, x); x = cmul(x, x); n >>= 1; }
    return b.re < 0 ? cdiv(C(1), r) : r;
  }
  if (a.re === 0 && a.im === 0) return b.re > 0 ? C(0) : C(NaN, NaN);
  if (a.im === 0 && b.im === 0 && a.re > 0) return C(Math.pow(a.re, b.re));
  return cexp(cmul(b, clog(a)));
}
const csqrt = (a) => { const r = cabs(a); const re = Math.sqrt((r + a.re) / 2), im = Math.sqrt(Math.max(0, (r - a.re) / 2)); return C(re, a.im < 0 ? -im : im); };
const csin = (a) => C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
const ccos = (a) => C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));

// ---------------------------------------------------------------- 字句・構文
const FUNCS = ['conj', 'sqrt', 'Re', 'Im', 'arg', 'abs', 'exp', 'log', 'ln', 'sin', 'cos', 'tan', 'dot', 'norm'];
const NAMES = [...FUNCS, 'pi'].sort((a, b) => b.length - a.length);

function normalize(src) {
  return String(src)
    .replace(/[−–]/g, '-').replace(/[×]/g, '*').replace(/[·・⋅∙]/g, '·').replace(/÷/g, '/')
    .replace(/＝/g, '=').replace(/（/g, '(').replace(/）/g, ')').replace(/，|、/g, ',').replace(/｜/g, '|')
    .replace(/≤|≦/g, '<=').replace(/≥|≧/g, '>=');
}

function tokenize(src) {
  const s = normalize(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = parseFloat(s.slice(i, j));
      if (Number.isNaN(v)) throw new Error('数の書き方が正しくありません');
      out.push({ k: 'num', v }); i = j; continue;
    }
    if (c === 'π') { out.push({ k: 'name', v: 'pi' }); i++; continue; }
    if (c === '√') { out.push({ k: 'func', v: 'sqrt' }); i++; continue; }
    if (/[α-ωΑ-Ω]/.test(c)) { out.push({ k: 'name', v: c }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let run = s.slice(i, j);
      while (run.length) {
        const n = NAMES.find(x => run.startsWith(x));
        if (n) { out.push(FUNCS.includes(n) ? { k: 'func', v: n } : { k: 'name', v: n }); run = run.slice(n.length); }
        else { out.push({ k: 'name', v: run[0] }); run = run.slice(1); }   // 1文字ずつ（st は s·t）
      }
      i = j; continue;
    }
    if ('+-*/^(),|·'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    throw new Error(`「${c}」は使えません`);
  }
  return out;
}

export function parsePlane(src) {
  const toks = tokenize(src);
  let i = 0, absDepth = 0;
  const peek = () => toks[i];
  const isOp = (v) => toks[i] && toks[i].k === 'op' && toks[i].v === v;
  const expect = (v) => { if (!isOp(v)) throw new Error(v === ')' ? '括弧が閉じていません' : v === '|' ? '絶対値の | が閉じていません' : `「${v}」が必要です`); i++; };
  const startsAtom = () => {
    const t = peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'name' || t.k === 'func') return true;
    if (t.k === 'op' && t.v === '(') return true;
    if (t.k === 'op' && t.v === '|') return absDepth === 0;   // |…| の中では、次の | は閉じる側
    return false;
  };
  function sum() {
    let a = term();
    while (isOp('+') || isOp('-')) { const op = toks[i++].v; a = { t: op === '+' ? 'add' : 'sub', a, b: term() }; }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('·')) {
        const op = toks[i++].v;
        a = { t: op === '/' ? 'div' : op === '·' ? 'dot' : 'mul', a, b: unary() };
      } else if (startsAtom()) a = { t: 'mul', a, b: power() };   // 暗黙の積：2z, t(3,1), (1+i)z
      else return a;
    }
  }
  function unary() {
    if (isOp('-')) { i++; return { t: 'neg', a: unary() }; }
    if (isOp('+')) { i++; return unary(); }
    return power();
  }
  function power() {
    const a = atom();
    if (isOp('^')) { i++; return { t: 'pow', a, b: unary() }; }
    return a;
  }
  function atom() {
    const t = peek();
    if (!t) throw new Error('式が途中で終わっています');
    if (t.k === 'num') { i++; return { t: 'num', v: t.v }; }
    if (t.k === 'name') { i++; return { t: 'var', n: t.v }; }
    if (t.k === 'func') {
      i++;
      if (isOp('(')) {
        i++;
        const args = [sum()];
        while (isOp(',')) { i++; args.push(sum()); }
        expect(')');
        return { t: 'call', f: t.v, args };
      }
      return { t: 'call', f: t.v, args: [power()] };   // sin t のような括弧なし
    }
    if (isOp('(')) {
      i++;
      const items = [sum()];
      while (isOp(',')) { i++; items.push(sum()); }
      expect(')');
      return items.length === 1 ? items[0] : { t: 'vec', items };
    }
    if (isOp('|')) {
      i++; absDepth++;
      const a = sum();
      absDepth--; expect('|');
      return { t: 'call', f: 'abs', args: [a] };
    }
    throw new Error(`「${t.v}」の位置が正しくありません`);
  }
  const ast = sum();
  if (i < toks.length) throw new Error(`「${toks[i].v}」の位置が正しくありません`);
  return ast;
}

export function namesIn(ast, set = new Set()) {
  if (!ast) return set;
  if (ast.t === 'var') set.add(ast.n);
  for (const k of ['a', 'b']) if (ast[k]) namesIn(ast[k], set);
  for (const x of ast.args || ast.items || []) namesIn(x, set);
  return set;
}

// ---------------------------------------------------------------- 評価
const real = (v, what) => {
  if (!isC(v)) throw new Error(`${what}にベクトルは使えません`);
  return v.re;
};
function vecOf(v) { if (!Array.isArray(v)) throw new Error('ベクトルが必要です'); return v; }

// env：{ z: 複素数 } または { p: [x, y] }、t・s・スライダーの値（実数）、定義（名前 → 値を返す関数）
export function compilePlane(ast, mode) {
  const ev = (n) => {
    switch (n.t) {
      case 'num': { const v = C(n.v); return () => v; }
      case 'var': return varRef(n.n, mode);
      case 'neg': { const a = ev(n.a); return (s) => { const x = a(s); return Array.isArray(x) ? x.map(c => -c) : C(-x.re, -x.im); }; }
      case 'add': case 'sub': {
        const a = ev(n.a), b = ev(n.b), sg = n.t === 'add' ? 1 : -1;
        return (s) => {
          const x = a(s), y = b(s);
          if (Array.isArray(x) && Array.isArray(y)) {
            if (x.length !== y.length) throw new Error('成分の数が違うベクトルは足せません');
            return x.map((c, k) => c + sg * y[k]);
          }
          if (Array.isArray(x) || Array.isArray(y)) throw new Error('ベクトルと数は足せません');
          return sg > 0 ? cadd(x, y) : csub(x, y);
        };
      }
      case 'mul': case 'dot': {
        const a = ev(n.a), b = ev(n.b);
        return (s) => {
          const x = a(s), y = b(s);
          if (Array.isArray(x) && Array.isArray(y)) {   // ベクトルどうしの積は内積
            if (x.length !== y.length) throw new Error('成分の数が違うベクトルの内積は取れません');
            return C(x.reduce((acc, c, k) => acc + c * y[k], 0));
          }
          if (Array.isArray(x)) return x.map(c => c * real(y, '実数倍'));
          if (Array.isArray(y)) return y.map(c => c * real(x, '実数倍'));
          return cmul(x, y);
        };
      }
      case 'div': {
        const a = ev(n.a), b = ev(n.b);
        return (s) => {
          const x = a(s), y = b(s);
          if (Array.isArray(y)) throw new Error('ベクトルでは割れません');
          if (Array.isArray(x)) { const k = real(y, '割る数'); return x.map(c => c / k); }
          return cdiv(x, y);
        };
      }
      case 'pow': {
        const a = ev(n.a), b = ev(n.b);
        return (s) => {
          const x = a(s), y = b(s);
          if (Array.isArray(y)) throw new Error('ベクトルの累乗はできません');
          if (Array.isArray(x)) {   // p^2 は |p|^2（教科書では |p|^2 と書くことが多い）
            if (y.re !== 2 || y.im) throw new Error('ベクトルは2乗（|p|^2）だけ使えます');
            return C(x.reduce((acc, c) => acc + c * c, 0));
          }
          return cpow(x, y);
        };
      }
      case 'vec': {
        const items = n.items.map(ev);
        return (s) => items.map((f) => { const v = f(s); if (Array.isArray(v)) throw new Error('ベクトルの成分にベクトルは入れられません'); return v.re; });
      }
      case 'call': return callOf(n.f, n.args.map(ev));
    }
    throw new Error('読めない式です');
  };
  return ev(ast);
}

function varRef(name, mode) {
  if (name === 'pi') { const v = C(Math.PI); return () => v; }
  if (name === 'e') return (s) => (s.$defs && s.$defs.e) ? s.$defs.e(s) : C(Math.E);
  if (name === 'i' && mode === 'complex') { const v = C(0, 1); return () => v; }
  if (mode === 'complex') {
    if (name === 'z') return (s) => s.z;
    if (name === 'x') return (s) => C(s.z.re);
    if (name === 'y') return (s) => C(s.z.im);
  }
  if (mode === 'vector') {
    if (name === 'p') return (s) => s.p;
    if (name === 'x') return (s) => C(s.p[0]);
    if (name === 'y') return (s) => C(s.p[1]);
  }
  return (s) => {
    const d = s.$defs && s.$defs[name];
    if (d) {
      if (s.$busy && s.$busy.has(name)) throw new Error(`${name} の定義が自分自身を使っています`);
      (s.$busy ||= new Set()).add(name);
      try { return d(s); } finally { s.$busy.delete(name); }
    }
    if (name in s) return C(s[name]);   // t・s・スライダー
    throw new Error(`${name} が決まっていません`);
  };
}

function callOf(f, args) {
  const one = () => { if (args.length !== 1) throw new Error(`${f} の引数は1つです`); return args[0]; };
  const scalarFn = (g) => { const a = one(); return (s) => { const v = a(s); if (Array.isArray(v)) throw new Error(`${f} にベクトルは使えません`); return g(v); }; };
  switch (f) {
    case 'abs': case 'norm': { const a = one(); return (s) => { const v = a(s); return C(Array.isArray(v) ? Math.hypot(...v) : cabs(v)); }; }
    case 'Re': return scalarFn(v => C(v.re));
    case 'Im': return scalarFn(v => C(v.im));
    case 'conj': return scalarFn(v => C(v.re, -v.im));
    case 'arg': return scalarFn(v => C(carg(v)));
    case 'sqrt': return scalarFn(v => (v.im === 0 && v.re >= 0 ? C(Math.sqrt(v.re)) : csqrt(v)));
    case 'exp': return scalarFn(cexp);
    case 'log': case 'ln': return scalarFn(clog);
    case 'sin': return scalarFn(csin);
    case 'cos': return scalarFn(ccos);
    case 'tan': return scalarFn(v => cdiv(csin(v), ccos(v)));
    case 'dot': {
      if (args.length !== 2) throw new Error('dot(a, b) の形で書きます');
      const [a, b] = args;
      return (s) => { const x = vecOf(a(s)), y = vecOf(b(s)); return C(x.reduce((acc, c, k) => acc + c * y[k], 0)); };
    }
  }
  throw new Error(`${f} は使えません`);
}

// ---------------------------------------------------------------- 1行の分解
// トップレベルのカンマで分ける（括弧の中のカンマは成分の区切り）
function splitTop(src, ch) {
  const out = [];
  let depth = 0, last = 0;
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === ch) { out.push(src.slice(last, k)); last = k + 1; }
  }
  out.push(src.slice(last));
  return out.map(x => x.trim()).filter(Boolean);
}
function splitRel(src) {
  const parts = [], ops = [];
  let depth = 0, last = 0;
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (c === '<' || c === '>' || c === '=')) {
      let op = c;
      if ((c === '<' || c === '>') && src[k + 1] === '=') op += '=';
      parts.push(src.slice(last, k)); ops.push(op);
      k += op.length - 1; last = k + 1;
    }
  }
  parts.push(src.slice(last));
  return { parts: parts.map(p => p.trim()), ops };
}

const RESERVED = { complex: new Set(['z', 'x', 'y', 't', 'i', 'e', 'pi']), vector: new Set(['p', 'x', 'y', 't', 's', 'e', 'pi']) };
const MOVING = { complex: ['z', 'x', 'y'], vector: ['p', 'x', 'y'] };

// 1行の「範囲」t:0..1、s:0..2 を取り出す
function takeRanges(src) {
  const ranges = {};
  const re = /[\s,;]*\b([ts])\s*:\s*([^,;]+?)\s*(?:\.\.|〜|~)\s*([^,;\s]+)\s*$/;
  let m;
  while ((m = src.match(re))) {
    const v = (x) => { const f = compilePlane(parsePlane(x), 'complex'); return real(f({}), '範囲'); };
    ranges[m[1]] = [v(m[2]), v(m[3])];
    src = src.slice(0, m.index);
  }
  return { src: src.trim(), ranges };
}

// ---------------------------------------------------------------- 全体の解析
// srcs：各行の文字列 → [{ a, error }]（a は描き方。graph.js の Graph.drawItem で描く）
export function analyzePlane(srcs, mode) {
  if (mode !== 'complex' && mode !== 'vector') throw new Error('mode は complex か vector');
  const defs = {};            // 名前 → 値を返す関数（行の順番によらず使える）
  const pre = srcs.map((raw) => {
    const src0 = normalize(raw || '').trim();
    if (!src0) return { kind: 'empty' };
    try {
      const { src, ranges } = takeRanges(src0);
      const pieces = splitTop(src, ',');
      const rels = pieces.map((p) => {
        const r = splitRel(p);
        return { ...r, asts: r.parts.map((x) => { if (!x) throw new Error('「=」や不等号の両側に式が必要です'); return parsePlane(x); }), text: p };
      });
      const main = rels[0];
      // 定義：名前 = 式（動く点 z・p や t・s を含まない）
      if (rels.length === 1 && main.ops.length === 1 && main.ops[0] === '=' && /^[A-Za-zα-ωΑ-Ω]$/.test(main.parts[0]) && !RESERVED[mode].has(main.parts[0])) {
        const name = main.parts[0], rhs = main.asts[1];
        const used = namesIn(rhs);
        const moving = MOVING[mode].some(v => used.has(v)) || used.has('t') || (mode === 'vector' && used.has('s'));
        if (!moving) return { kind: 'def', name, rhs, src };
      }
      return { kind: 'line', rels, ranges, src };
    } catch (e) { return { kind: 'error', error: e.message }; }
  });
  for (const p of pre) if (p.kind === 'def') defs[p.name] = compilePlane(p.rhs, mode);

  const known = new Set([...Object.keys(defs), ...RESERVED[mode], ...FUNCS]);
  const paramsOf = (...asts) => {
    const s = new Set();
    for (const a of asts) for (const n of namesIn(a)) if (!known.has(n)) s.add(n);
    return s;
  };
  // 定義の中に出てくる未定義の文字（スライダー）を、その定義を使う行の params に足すため
  const defParams = {};
  for (const p of pre) if (p.kind === 'def') defParams[p.name] = paramsOf(p.rhs);
  const withDefParams = (set, asts) => {
    const seen = new Set();
    const visit = (names) => { for (const n of names) if (defParams[n] && !seen.has(n)) { seen.add(n); for (const q of defParams[n]) set.add(q); const d = pre.find(x => x.kind === 'def' && x.name === n); if (d) visit(namesIn(d.rhs)); } };
    for (const a of asts) visit(namesIn(a));
    return set;
  };

  return pre.map((p) => {
    try {
      if (p.kind === 'empty') return { a: { kind: 'empty', params: new Set() }, error: null };
      if (p.kind === 'error') return { a: null, error: p.error };
      if (p.kind === 'def') return { a: defItem(p, defs, mode, withDefParams(paramsOf(p.rhs), [p.rhs])), error: null };
      return { a: lineItem(p, defs, mode, (asts) => withDefParams(paramsOf(...asts), asts)), error: null };
    } catch (e) { return { a: null, error: e.message }; }
  });
}

const sampleEnv = (defs, extra) => ({ $defs: defs, ...extra });

function defItem(p, defs, mode, params) {
  const f = defs[p.name];
  const used = namesIn(p.rhs);
  const plain = [...used].every(n => n === 'pi' || n === 'e' || (n === 'i' && mode === 'complex'));
  const v = f(sampleEnv(defs, Object.fromEntries([...params].map(k => [k, 1]))));
  // a=2 のような実数の定数は、ふつうのグラフと同じくスライダー
  if (plain && p.rhs.t === 'num') return { kind: 'param', name: p.name, value: v.re, params: new Set() };
  if (plain && isC(v) && v.im === 0 && p.rhs.t === 'neg' && p.rhs.a.t === 'num') return { kind: 'param', name: p.name, value: v.re, params: new Set() };
  const val = (s) => f({ ...s, $defs: defs });
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error('平面のベクトルは2成分 (x, y) で書きます');
    // 大文字は点（位置ベクトルの終点）、小文字は原点からの矢印
    if (/^[A-ZΑ-Ω]$/.test(p.name)) return { kind: 'vpoint', name: p.name, f: val, params, defName: p.name };
    return { kind: 'arrow', name: p.name, f: val, params, defName: p.name };
  }
  if (mode === 'complex') return { kind: 'cpoint', name: p.name, f: val, params, defName: p.name };
  return { kind: 'note', name: p.name, f: val, params, defName: p.name };   // ベクトルのモードの数（スカラー）は描かない
}

// 実数として扱えるか（数で、虚部がほぼ0）
function realSide(f, defs, mode, params) {
  const s = sampleEnv(defs, Object.fromEntries([...params].map(k => [k, 1.3])));
  let n = 0;
  for (let k = 0; k < 9; k++) {
    const x = -2.7 + 0.71 * k, y = 1.9 - 0.53 * k;
    if (mode === 'complex') s.z = C(x, y); else s.p = [x, y];
    let v;
    try { v = f(s); } catch (e) { if (/ベクトル|成分/.test(e.message)) throw e; continue; }
    if (Array.isArray(v)) return 'vector';
    if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) continue;
    n++;
    if (Math.abs(v.im) > 1e-9 * (1 + Math.abs(v.re))) return 'complex';
  }
  return n ? 'real' : 'unknown';
}

// (x, y) を受け取る関数に直す
function atXY(f, mode, defs) {
  return mode === 'complex'
    ? (s) => { s.$defs = defs; s.z = C(s.x, s.y); return f(s); }
    : (s) => { s.$defs = defs; s.p = [s.x, s.y]; return f(s); };
}

function lineItem(p, defs, mode, paramsFor) {
  const { rels, ranges } = p;
  const allAsts = rels.flatMap(r => r.asts);
  const params = paramsFor(allAsts);
  const main0 = rels[0];
  // z = …・p = … の左辺の z・p は「動く点」ではなく、右辺で表した点の名前
  const isParamForm = main0.ops.length === 1 && main0.ops[0] === '=' && main0.parts[0] === (mode === 'complex' ? 'z' : 'p');
  const bodyAsts = isParamForm ? [main0.asts[1], ...rels.slice(1).flatMap(r => r.asts)] : allAsts;
  const usedAll = new Set(bodyAsts.flatMap(a => [...namesIn(a)]));
  if (main0.ops.length === 1 && main0.ops[0] === '=' && /^[A-Za-zα-ωΑ-Ω]$/.test(main0.parts[0]) && !RESERVED[mode].has(main0.parts[0])) {
    throw new Error(`${main0.parts[0]} に${mode === 'complex' ? ' z' : ' p'}・t・s を含む式は入れられません（定義には定数の式を書きます）`);
  }
  const moving = MOVING[mode].some(v => usedAll.has(v));
  const usesT = usedAll.has('t'), usesS = mode === 'vector' && usedAll.has('s');
  const main = rels[0];
  const label = p.src.length <= 14 ? p.src : '';

  // --- 動く点を含まない
  if (!moving) {
    // 媒介変数：z(t)、p(t)、p(s,t)（左辺が z・p だけのときも、右辺だけのときも）
    let body = null;
    if (main.ops.length === 0) body = main.asts[0];
    else if (isParamForm) body = main.asts[1];
    if (!body) throw new Error(mode === 'complex' ? '点 z の式には「=」か不等号を使います（例：|z-1|=2）' : '点 p の式には「=」か不等号を使います（例：|p-A|=2）');
    const f = compilePlane(body, mode);
    const condFns = rels.slice(1).flatMap(r => relCondsST(r, mode, defs));   // t・s の条件
    if (usesT && usesS) return twoParam(f, defs, condFns, params, ranges);
    if (usesT || usesS) {
      const tv = usesT ? 't' : 's';
      const trange = ranges[tv] || boundsFrom(rels.slice(1), tv) || (mode === 'complex' ? [0, TAU] : [-30, 30]);
      const xy = (s) => { const v = f({ ...s, $defs: defs }); return Array.isArray(v) ? v : [v.re, v.im]; };
      if (condFns.some(c => c.op === '=')) throw new Error(`${tv} の条件には不等号を使います`);
      return { kind: 'pcurve2', tv, trange, xy, mask: condFns.length ? (s) => condFns.every(c => holds(c.g(s), c.op)) : null, params };
    }
    // 点・矢印
    const sv = f(sampleEnv(defs, Object.fromEntries([...params].map(k => [k, 1]))));
    const val = (s) => f({ ...s, $defs: defs });
    if (Array.isArray(sv)) return { kind: 'arrow', name: label, f: val, params };
    if (mode === 'complex') return { kind: 'cpoint', name: label, f: val, params };
    return { kind: 'note', text: `= ${fmtNum(sv.re)}`, f: val, params };   // 内積などの数は値だけ表示
  }

  // --- 動く点 z・p を含む関係式（カンマで区切った条件はすべて「かつ」）
  if (usesT || usesS) throw new Error(`動く点 ${mode === 'complex' ? 'z' : 'p'} と ${usesT ? 't' : 's'} は同じ式に入れられません（${mode === 'complex' ? 'z=' : 'p='}… の形にします）`);
  const eqs = [], ineqs = [];
  for (const r of rels) {
    if (!r.ops.length) throw new Error(r === main ? (mode === 'complex' ? '点 z の式には「=」か不等号を使います（例：|z-1|=2）' : '点 p の式には「=」か不等号を使います（例：|p-A|=2）') : '条件には「=」か不等号が必要です');
    for (const c of relConds(r, mode, defs, params)) (c.op === '=' ? eqs : ineqs).push(c);
  }
  // 複素数の等式（両辺が実数でない）は、実部と虚部の2つの式
  const reals = [];
  for (const c of eqs) {
    if (c.complex) {
      const re = { g: (s) => c.cg(s).re, op: '=' }, im = { g: (s) => c.cg(s).im, op: '=' };
      const zr = vanishes(re.g, params), zi = vanishes(im.g, params);
      if (zr && zi) throw new Error('どの点でも成り立つ式です');
      if (zr) reals.push(im); else if (zi) reals.push(re); else reals.push(re, im);
    } else reals.push(c);
  }
  if (reals.length === 0) {
    return { kind: 'region', conds: ineqs, bounds: ineqs.map(c => ({ type: 'imp', g: c.g, strict: c.op === '<' || c.op === '>' })), params, verify: true };
  }
  if (reals.length === 1) return { kind: 'implicitc', g: reals[0].g, mask: ineqs, params };
  if (reals.length === 2) return { kind: 'roots', g1: reals[0].g, g2: reals[1].g, mask: ineqs, params, complexLabel: mode === 'complex' };
  throw new Error('「=」の条件は2つまでです（2つなら交点を描きます）');
}

// 関係式 → [{ g, op }]（a<b<c は2つ）。g は (x, y) の関数で「左辺 − 右辺」
function relConds(r, mode, defs, params = new Set()) {
  const fs = r.asts.map(a => atXY(compilePlane(a, mode), mode, defs));
  const out = [];
  for (let k = 0; k < r.ops.length; k++) {
    const op = r.ops[k], L = fs[k], R = fs[k + 1];
    const diff = (s) => { const a = L(s), b = R(s); return [a, b]; };
    const kindL = realSide((s) => L({ ...s, x: s.z ? s.z.re : s.p[0], y: s.z ? s.z.im : s.p[1] }), defs, mode, params);
    const kindR = realSide((s) => R({ ...s, x: s.z ? s.z.re : s.p[0], y: s.z ? s.z.im : s.p[1] }), defs, mode, params);
    if (kindL === 'vector' || kindR === 'vector') {
      if (op !== '=') throw new Error('ベクトルに不等号は使えません（大きさ |…| にします）');
      // ベクトルの等式は成分ごとの2式
      out.push({ g: (s) => { const [a, b] = diff(s); return vecOf(a)[0] - vecOf(b)[0]; }, op: '=' });
      out.push({ g: (s) => { const [a, b] = diff(s); return vecOf(a)[1] - vecOf(b)[1]; }, op: '=' });
      continue;
    }
    if (op === '=' && (kindL === 'complex' || kindR === 'complex')) {
      out.push({ op: '=', complex: true, cg: (s) => { const [a, b] = diff(s); return csub(a, b); } });
      continue;
    }
    if (op !== '=' && (kindL === 'complex' || kindR === 'complex')) throw new Error('虚数には大小がありません（|z|・Re(z)・Im(z)・arg(z) などの実数にします）');
    out.push({ g: (s) => { const [a, b] = diff(s); return a.re - b.re; }, op });
  }
  return out;
}

// 媒介変数の範囲を条件から取り出す（0<=t<=1、t>=0 など、片側が t だけで反対側が定数のもの）
function boundsFrom(rels, tv) {
  let lo = null, hi = null;
  for (const r of rels) {
    for (let k = 0; k < r.ops.length; k++) {
      const L = r.parts[k], R = r.parts[k + 1], op = r.ops[k];
      const num = (x) => { try { const v = compilePlane(parsePlane(x), 'complex')({}); return v.re; } catch { return null; } };
      if (R === tv && (op === '<' || op === '<=')) { const v = num(L); if (v != null) lo = Math.max(lo ?? -Infinity, v); }
      if (R === tv && (op === '>' || op === '>=')) { const v = num(L); if (v != null) hi = Math.min(hi ?? Infinity, v); }
      if (L === tv && (op === '<' || op === '<=')) { const v = num(R); if (v != null) hi = Math.min(hi ?? Infinity, v); }
      if (L === tv && (op === '>' || op === '>=')) { const v = num(R); if (v != null) lo = Math.max(lo ?? -Infinity, v); }
    }
  }
  if (lo == null && hi == null) return null;
  return [lo ?? (hi - 60), hi ?? (lo + 60)];
}

// p = c + s u + t v（s, t について1次）なら、(x, y) から s, t を逆算して領域として塗る
function twoParam(f, defs, conds, params, ranges) {
  const at = (sv, tv, s) => { const v = f({ ...s, s: sv, t: tv, $defs: defs }); if (!Array.isArray(v)) throw new Error('p = … の右辺はベクトルにします'); return v; };
  const test = Object.fromEntries([...params].map(k => [k, 1.1]));
  const c0 = at(0, 0, test), u0 = at(1, 0, test).map((x, k) => x - c0[k]), v0 = at(0, 1, test).map((x, k) => x - c0[k]);
  const chk = at(2, -3, test), chk2 = at(-0.5, 1.5, test);
  const lin = (a, b, w) => c0.map((x, k) => x + a * u0[k] + b * v0[k] - w[k]);
  if (lin(2, -3, chk).some(e => Math.abs(e) > 1e-7) || lin(-0.5, 1.5, chk2).some(e => Math.abs(e) > 1e-7)) {
    throw new Error('s, t の2つを使う式は、s, t について1次の形（p = A + s a + t b）にします');
  }
  const st = (s) => {
    const c = at(0, 0, s), u = at(1, 0, s).map((x, k) => x - c[k]), v = at(0, 1, s).map((x, k) => x - c[k]);
    const det = u[0] * v[1] - u[1] * v[0];
    const dx = s.x - c[0], dy = s.y - c[1];
    return [(dx * v[1] - dy * v[0]) / det, (u[0] * dy - u[1] * dx) / det];
  };
  if (Math.abs(u0[0] * v0[1] - u0[1] * v0[0]) < 1e-12) throw new Error('2つの向きのベクトルが平行なので、平面の領域になりません');
  const rangeConds = [];
  for (const [k, [lo, hi]] of Object.entries(ranges || {})) {
    const idx = k === 's' ? 0 : 1;
    rangeConds.push({ op: '>=', g0: (sv) => sv[idx] - lo }, { op: '<=', g0: (sv) => sv[idx] - hi });
  }
  // 条件（s, t の式）は env の s, t で評価する
  const condsXY = conds.map(c => ({ op: c.op, g: (s) => { const [a, b] = st(s); return c.g({ ...s, s: a, t: b }); } }));
  for (const rc of rangeConds) condsXY.push({ op: rc.op, g: (s) => rc.g0(st(s)) });
  const eqs = condsXY.filter(c => c.op === '='), ineqs = condsXY.filter(c => c.op !== '=');
  if (eqs.length === 1) return { kind: 'implicitc', g: eqs[0].g, mask: ineqs, params };
  if (eqs.length > 1) throw new Error('s, t の「=」の条件は1つまでです');
  return { kind: 'region', conds: ineqs, bounds: ineqs.map(c => ({ type: 'imp', g: c.g, strict: c.op === '<' || c.op === '>' })), params, verify: true };
}

// t・s の条件（0<=t<=1、s+t<=1 など）→ [{ g, op }]。g は env の t・s で評価する
function relCondsST(r, mode, defs) {
  const fs = r.asts.map(a => compilePlane(a, mode));
  const out = [];
  for (let k = 0; k < r.ops.length; k++) {
    const L = fs[k], R = fs[k + 1], op = r.ops[k];
    out.push({ op, g: (s) => real(L({ ...s, $defs: defs }), '条件') - real(R({ ...s, $defs: defs }), '条件') });
  }
  return out;
}

function vanishes(g, params) {
  const s = Object.fromEntries([...params].map(k => [k, 1.3]));
  let n = 0;
  for (let k = 0; k < 9; k++) {
    s.x = -2.7 + 0.71 * k; s.y = 1.9 - 0.53 * k;
    const v = g(s);
    if (!Number.isFinite(v)) continue;
    n++;
    if (Math.abs(v) > 1e-9) return false;
  }
  return n > 0;
}

export function holds(v, op) {
  switch (op) {
    case '<': return v < 0;
    case '<=': return v <= 1e-9;
    case '>': return v > 0;
    case '>=': return v >= -1e-9;
    case '=': return Math.abs(v) < 1e-6;
  }
  return false;
}

// 2つの式 g1=0, g2=0 の解（交点）を、見えている範囲からニュートン法で探す
export function solveRoots(g1, g2, s, box, mask) {
  const { xmin, xmax, ymin, ymax } = box;
  const nx = 20, ny = 14, found = [];
  const F = (x, y) => { s.x = x; s.y = y; return [g1(s), g2(s)]; };
  const tol = 1e-9 * Math.max(1, xmax - xmin);
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      let x = xmin + (xmax - xmin) * (i + 0.37) / nx, y = ymin + (ymax - ymin) * (j + 0.61) / ny;
      let ok = false;
      for (let it = 0; it < 40; it++) {
        const [f1, f2] = F(x, y);
        if (!Number.isFinite(f1) || !Number.isFinite(f2)) break;
        const h = 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
        const [a1, a2] = F(x + h, y), [b1, b2] = F(x, y + h);
        const J11 = (a1 - f1) / h, J21 = (a2 - f2) / h, J12 = (b1 - f1) / h, J22 = (b2 - f2) / h;
        const det = J11 * J22 - J12 * J21;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-14) break;
        const dx = (f1 * J22 - f2 * J12) / det, dy = (J11 * f2 - J21 * f1) / det;
        x -= dx; y -= dy;
        if (Math.hypot(dx, dy) < tol) { ok = true; break; }
      }
      if (!ok || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const [r1, r2] = F(x, y);
      if (Math.abs(r1) > 1e-6 * (1 + Math.abs(x) + Math.abs(y)) || Math.abs(r2) > 1e-6 * (1 + Math.abs(x) + Math.abs(y))) continue;
      if (x < xmin - 1e-9 || x > xmax || y < ymin || y > ymax) continue;
      if (mask && mask.length && !mask.every(c => holds(c.g(s), c.op))) continue;
      const span = Math.max(xmax - xmin, ymax - ymin);
      if (found.some(q => Math.hypot(q[0] - x, q[1] - y) < 1e-6 * span)) continue;
      found.push([x, y]);
      if (found.length > 60) return found;
    }
  }
  return found;
}

// 数・複素数の表示
export function fmtNum(v) {
  if (!Number.isFinite(v)) return '?';
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}
export function fmtComplex(re, im) {
  const a = fmtNum(re), b = fmtNum(Math.abs(im));
  if (fmtNum(im) === '0') return a;
  const ib = b === '1' ? 'i' : `${b}i`;
  if (a === '0') return im < 0 ? `-${ib}` : ib;
  return `${a}${im < 0 ? '-' : '+'}${ib}`;
}
