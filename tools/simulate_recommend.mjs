// 「今日の演習」の推薦を、いくつかの架空の学習者で日を進めながら確かめる
//   node tools/simulate_recommend.mjs [日数=60] [seed=1]
//   node tools/simulate_recommend.mjs 60 1 daily        # 1人だけ
// 注意：学習者の正答率・解き方は仮定であり、実際の受験生の学習成果を示すものではない。
//       見ているのは推薦の性質（新しい学習が止まらないか・偏らないか・理由と規則が一致するか）だけ。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!globalThis.__lemmaFetch) {
  globalThis.__lemmaFetch = true;
  globalThis.fetch = async (url) => {
    const p = path.join(root, String(url));
    if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    const text = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
}
const CAT = await import('../js/catalog.js');
const { review, retrievability, TARGET_R } = await import('../js/scheduler.js');
const M = await import('../js/mastery.js');
await CAT.loadCatalog();
const TECH = await CAT.loadTechniques();
const CTX = new Map(TECH.list.map(t => [t.id, M.makeCtx(t, CAT.entryById, TECH.byProblem)]));
const ctxOf = (t) => CTX.get(t.id);
const DAY = 86400000;

// 架空の学習者（acc：難易度 lv の問題を完答する確率 = acc - 0.12*lv）
export const PERSONAS = {
  daily: { name: '毎日1回', acc: 0.85, levels: [0, 1, 2, 3, 4], days: (d) => true },
  weekly: { name: '週3回', acc: 0.85, levels: [0, 1, 2, 3, 4], days: (d) => [0, 2, 4].includes(d % 7) },
  weak: { name: '正答率が低い', acc: 0.5, levels: [0, 1, 2, 3, 4], days: (d) => true },
  basic: { name: '基礎・標準だけ', acc: 0.85, levels: [0, 1], days: (d) => true },
  hard: { name: '入試発展・数学探究だけ', acc: 0.95, levels: [4, 5], days: (d) => true },
  backlog: { name: '復習が大量にたまった', acc: 0.75, levels: [0, 1, 2, 3, 4], days: (d) => true, backlog: 200 },
  biased: { name: '1分野に偏った過去', acc: 0.85, levels: [0, 1, 2, 3, 4], days: (d) => true, biased: 150 },
  cards: { name: '解法カードからの演習が多い', acc: 0.85, levels: [0, 1, 2, 3, 4], days: (d) => true, cards: true },
};

export async function simulate(key, { days = 60, seed = 1, size = 8 } = {}) {
  const P = PERSONAS[key];
  let s = seed * 7919 + key.length;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const realRandom = Math.random, realNow = Date.now;
  Math.random = rnd;
  const T0 = Date.UTC(2026, 0, 1, 10);
  let NOW = T0;
  Date.now = () => NOW;
  const state = { problems: {}, pstat: {}, log: [], practice: {} };
  const solve = (pid, t, k) => {
    const e = CAT.entryById.get(pid);
    const pf = Math.max(0.05, P.acc - 0.12 * e.lv), r = rnd();
    const g = r < pf ? 3 : r < pf + (1 - pf) / 2 ? 2 : 1;
    state.pstat[pid] = review(state.pstat[pid], g, t);
    state.problems[pid] = { last: t, n: ((state.problems[pid] || {}).n || 0) + 1 };
    state.log.push({ p: pid, t, g, ok: g >= 3, ...(k ? { k } : {}) });
  };
  // 開始前の記録
  const bank = CAT.ENTRIES.filter(e => e.kind === 'bank');
  if (P.backlog) bank.filter((_, i) => i % 13 === 0).slice(0, P.backlog).forEach((e, i) => solve(e.id, T0 - 40 * DAY + i * 1000));
  if (P.biased) { const f = bank[0].f; bank.filter(e => e.f === f).slice(0, P.biased).forEach((e, i) => solve(e.id, T0 - 30 * DAY + i * 60000)); }
  const out = { key, name: P.name, sessions: 0, reason: {}, levelViolations: 0, repeats3d: 0, items: 0, fieldMaxShare: 0, perField: {}, techPicks: {}, dueLeft: [], freshPerSession: [], mismatches: [], levels: {} };
  const shown = new Map();
  for (let d = 0; d < days; d++) {
    if (!P.days(d)) continue;
    NOW = T0 + d * DAY;
    // 解法カードからの演習（cards）：同じ3つの解法を順に、その解法の問題を4問
    if (P.cards) {
      const ts = ['recurrence', 'inner-product', 'mod'];
      const t = TECH.byId.get(ts[d % 3]);
      for (const pid of t.main.filter(id => !state.problems[id] && P.levels.includes(CAT.entryById.get(id).lv)).slice(0, 4)) solve(pid, NOW, 't');
      NOW += 3600000;
    }
    const cand = M.techCandidates(state, TECH.list, CAT.entryById, NOW, ctxOf);
    const tech = { ...cand, name: (id) => TECH.byId.get(id).name, transferWhy: (id, pid) => M.transferWhy(CTX.get(id), pid, TECH.byId.get(id).name) };
    const weakF = null;
    const dueBefore = new Set(CAT.dueEntries(state).map(e => e.id));
    const plan = CAT.pickToday(state, { levels: P.levels, size, tech });
    out.sessions++;
    const fieldCnt = {};
    let fresh = 0;
    for (const it of plan.items) {
      const e = CAT.entryById.get(it.pid);
      out.reason[it.tag] = (out.reason[it.tag] || 0) + 1;
      out.levels[e.lv] = (out.levels[e.lv] || 0) + 1;
      if (!P.levels.includes(e.lv) && it.tag !== 'due') out.levelViolations++;
      if (it.tag !== 'due' && shown.has(it.pid) && NOW - shown.get(it.pid) < 3 * DAY) out.repeats3d++;
      shown.set(it.pid, NOW);
      fieldCnt[e.f] = (fieldCnt[e.f] || 0) + 1;
      out.perField[e.f] = (out.perField[e.f] || 0) + 1;
      if (it.tag !== 'due') fresh++;
      // 理由と規則の一致を、選んだ時点の状態で確かめる
      const techOf = (it.why.match(/「(.+?)」/) || [])[1];
      const t = techOf && TECH.list.find(x => x.name === techOf);
      const bad = (m) => out.mismatches.push(`${it.tag} ${it.pid}: ${m}`);
      if (it.tag === 'due' && !dueBefore.has(it.pid)) bad('復習の時期でない');
      if (it.tag === 'tech' && !(t && cand.ms.get(t.id).status === 'review' && t.main.includes(it.pid))) bad('要復習の解法の問題でない');
      if (it.tag === 'new' && !(t && cand.ms.get(t.id).status === 'none' && t.main.includes(it.pid))) bad('未学習の解法の問題でない');
      if (it.tag === 'transfer' && !(t && (cand.targets.get(t.id) || []).includes(it.pid))) bad('転用の対象でない');
      if (it.tag === 'fresh' && state.problems[it.pid]) { /* 未着手が尽きたら古い順。理由は「新しい問題」のまま */ }
      if (t && (it.tag === 'tech' || it.tag === 'new' || it.tag === 'transfer')) out.techPicks[t.id] = (out.techPicks[t.id] || 0) + 1;
    }
    out.fieldMaxShare = Math.max(out.fieldMaxShare, Math.max(...Object.values(fieldCnt)) / plan.items.length);
    out.freshPerSession.push(fresh);
    out.items += plan.items.length;
    for (const it of plan.items) solve(it.pid, NOW + 60000, null);
    out.dueLeft.push(CAT.dueEntries(state).length);
  }
  Math.random = realRandom; Date.now = realNow;
  const techTotal = Object.values(out.techPicks).reduce((a, b) => a + b, 0);
  out.topTechShare = techTotal ? Math.max(...Object.values(out.techPicks)) / techTotal : 0;
  out.minFresh = Math.min(...out.freshPerSession);
  return out;
}

function report(o) {
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const R = o.reason;
  const step = Math.max(1, Math.floor(o.dueLeft.length / 6));
  console.log(`■ ${o.name}（${o.sessions}回・${o.items}問）`);
  console.log(`  理由：復習 ${R.due || 0}・要復習の解法 ${R.tech || 0}・新しい解法 ${R.new || 0}・転用 ${R.transfer || 0}・苦手分野 ${R.weak || 0}・新しい問題 ${R.fresh || 0}`);
  console.log(`  1回の復習以外の問題：最少 ${o.minFresh}問・平均 ${(o.freshPerSession.reduce((a, b) => a + b, 0) / o.sessions).toFixed(1)}問`);
  console.log(`  難易度の分布：${Object.entries(o.levels).map(([l, n]) => `${l}:${pct(n, o.items)}`).join(' ')}・選択外の難易度（復習以外） ${o.levelViolations}`);
  console.log(`  1回で同じ分野の最大の割合 ${pct(o.fieldMaxShare * 100, 100)}・分野の数 ${Object.keys(o.perField).length}・3日以内の再出題（復習以外） ${o.repeats3d}`);
  console.log(`  解法の推薦：${Object.keys(o.techPicks).length}種類・最多の解法の割合 ${pct(o.topTechShare * 100, 100)}`);
  console.log(`  復習待ちの推移：${o.dueLeft.filter((_, i) => i % step === step - 1).join(' → ')}`);
  console.log(`  理由と規則の不一致：${o.mismatches.length}${o.mismatches.length ? '（例 ' + o.mismatches.slice(0, 2).join('、') + '）' : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = +(process.argv[2] || 60), seed = +(process.argv[3] || 1), only = process.argv[4];
  console.log('※ 学習者の正答率・解き方は仮定。推薦の性質を確かめるためのもので、学習成果の予測ではない。\n');
  for (const k of only ? [only] : Object.keys(PERSONAS)) report(await simulate(k, { days, seed }));
}
