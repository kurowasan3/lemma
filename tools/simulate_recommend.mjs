// 「今日の演習」の推薦を、架空の学習者で日を進めながら確かめる（偏り・復習の積み上がり・理由の内訳・処理時間）
//   node tools/simulate_recommend.mjs [日数=40] [1日の回数=1] [seed=1]
// 学習者：問題の難易度 lv のとき完答の確率 0.85-0.12*lv、それ以外は半々で一部正解・不正解。毎日「今日の演習」を回数分解く。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.fetch = async (url) => {
  const p = path.join(root, String(url));
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
  const text = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};
const days = +(process.argv[2] || 40), perDay = +(process.argv[3] || 1);
let seed = +(process.argv[4] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
Math.random = rnd;
const T0 = Date.UTC(2026, 0, 1, 10);
let NOW = T0;
Date.now = () => NOW;

const CAT = await import('../js/catalog.js');
const { review } = await import('../js/scheduler.js');
const { techCandidates, makeCtx } = await import('../js/mastery.js');
await CAT.loadCatalog();
const TECH = await CAT.loadTechniques();
const CTX = new Map(TECH.list.map(t => [t.id, makeCtx(t, CAT.entryById, TECH.byProblem)]));
const ctxOf = (t) => CTX.get(t.id);
const state = { problems: {}, pstat: {}, log: [], practice: {} };
const levels = [0, 1, 2, 3, 4];
const stats = [];
const seenAt = new Map();
let tPick = 0, tCand = 0, nPick = 0;
for (let d = 0; d < days; d++) {
  for (let s = 0; s < perDay; s++) {
    NOW = T0 + d * 86400000 + s * 3600000;
    let t = performance.now();
    const tech = { ...techCandidates(state, TECH.list, CAT.entryById, NOW, ctxOf), name: (id) => TECH.byId.get(id).name, ctx: (id) => CTX.get(id) };
    tCand += performance.now() - t;
    t = performance.now();
    const plan = CAT.pickToday(state, { levels, size: 8, tech });
    tPick += performance.now() - t; nPick++;
    const fields = new Set(), lv = [];
    let repeatWeek = 0;
    for (const it of plan.items) {
      const e = CAT.entryById.get(it.pid);
      fields.add(e.f); lv.push(e.lv);
      if (seenAt.has(it.pid) && NOW - seenAt.get(it.pid) < 2 * 86400000 && it.tag !== 'due') repeatWeek++;
      seenAt.set(it.pid, NOW);
      const pf = Math.max(0.1, 0.85 - 0.12 * e.lv), r = rnd();
      const g = r < pf ? 3 : r < pf + (1 - pf) / 2 ? 2 : 1;
      state.pstat[it.pid] = review(state.pstat[it.pid], g, NOW);
      state.problems[it.pid] = { last: NOW, n: ((state.problems[it.pid] || {}).n || 0) + 1 };
      state.log.push({ p: it.pid, t: NOW, g, ok: g >= 3 });
    }
    const due = CAT.dueEntries(state).length;
    const maxField = Math.max(...[...fields].map(f => plan.items.filter(x => CAT.entryById.get(x.pid).f === f).length));
    stats.push({ d, ...plan.count, fields: fields.size, maxField, lvAvg: lv.reduce((a, b) => a + b, 0) / lv.length, dueLeft: due, repeat2d: repeatWeek });
  }
}
const sum = (k) => stats.reduce((a, s) => a + (s[k] || 0), 0);
console.log(`日数 ${days}・1日 ${perDay}回・計 ${stats.length}回（8問ずつ）`);
console.log('理由の内訳：' + ['due', 'tech', 'new', 'transfer', 'weak', 'fresh'].map(k => `${k} ${sum(k)}`).join('、'));
console.log(`1回あたりの分野の数 平均 ${(sum('fields') / stats.length).toFixed(1)}・同じ分野の最大 平均 ${(sum('maxField') / stats.length).toFixed(1)}（最大 ${Math.max(...stats.map(s => s.maxField))}）`);
console.log(`難易度の平均 ${(sum('lvAvg') / stats.length).toFixed(2)}・2日以内の再出題（復習以外） ${sum('repeat2d')}`);
console.log('復習待ちの残り（10回ごと）：' + stats.filter((_, i) => i % 10 === 9).map(s => s.dueLeft).join(' → '));
console.log('復習の数（10回ごと）：' + stats.filter((_, i) => i % 10 === 9).map(s => s.due || 0).join(' → '));
console.log(`処理時間：techCandidates 平均 ${(tCand / nPick).toFixed(1)}ms・pickToday 平均 ${(tPick / nPick).toFixed(1)}ms（記録 ${state.log.length}件の時点まで）`);
