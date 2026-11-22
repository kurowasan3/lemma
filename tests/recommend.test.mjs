// 推薦のストレステスト：架空の学習者8人で「今日の演習」を回し、推薦の性質を確かめる（tools/simulate_recommend.mjs）
// 学習者の正答率は仮定。学習成果ではなく、推薦の規則が守られているかだけを見る。
const { simulate, PERSONAS } = await import('../tools/simulate_recommend.mjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
for (const k of Object.keys(PERSONAS)) {
  const o = await simulate(k, { days: 40, seed: 2 });
  const n = o.name;
  ok(o.minFresh >= 2, `${n}：毎回、復習以外の問題が2問以上（最少 ${o.minFresh}）`);
  ok(o.levelViolations === 0, `${n}：選んだ難易度の外から新しい問題を出さない（${o.levelViolations}）`);
  ok(o.repeats3d === 0, `${n}：復習以外で3日以内に同じ問題を出さない（${o.repeats3d}）`);
  ok(o.fieldMaxShare <= 0.5, `${n}：1回で同じ分野が半分を超えない（${Math.round(o.fieldMaxShare * 100)}%）`);
  ok(o.topTechShare <= 0.3, `${n}：同じ解法ばかり推薦しない（最多 ${Math.round(o.topTechShare * 100)}%）`);
  ok(o.mismatches.length === 0, `${n}：推薦の理由と選んだ規則が一致（${o.mismatches.slice(0, 2)}）`);
}
// ---- 境界条件（v0.21）：制限を越えず、足りないときは理由を返す
{
  const CAT = await import('../js/catalog.js');
  const M = await import('../js/mastery.js');
  const T = await CAT.loadTechniques();
  const now = Date.now(), old = now - 90 * 86400000;
  const fresh = () => ({ problems: {}, pstat: {}, log: [] });
  const withDue = (es) => { const s = fresh(); for (const e of es) { s.problems[e.id] = { last: old, n: 1 }; s.pstat[e.id] = { S: 1, D: 5, last: old, reps: 1, lapses: 0 }; s.log.push({ p: e.id, t: old, g: 3 }); } return s; };
  const check = (plan, size, levels, label) => {
    const ids = plan.items.map(x => x.pid);
    ok(new Set(ids).size === ids.length, `${label}：同じ問題を2回入れない`);
    ok(plan.items.every(x => x.tag === 'due' || !levels || levels.includes(CAT.entryById.get(x.pid).lv)), `${label}：選んだ難易度を越えない（復習を除く）`);
    const nd = {}, all = {};
    for (const x of plan.items) { const f = CAT.entryById.get(x.pid).f; all[f] = (all[f] || 0) + 1; if (x.tag !== 'due') nd[f] = (nd[f] || 0) + 1; }
    ok(Math.max(0, ...Object.values(nd)) <= Math.max(2, Math.ceil(size / 3)) && Math.max(0, ...Object.values(all)) <= Math.max(2, Math.ceil(size / 2)), `${label}：分野の上限を越えない`);
    ok(plan.steps.length === size || (plan.short && plan.short.got === plan.steps.length && plan.short.text), `${label}：${size}問に足りなければ理由を返す（${plan.steps.length}問${plan.short ? '・' + plan.short.cause : ''}）`);
  };
  for (const size of [1, 3, 5, 12, 20]) check(CAT.pickToday(fresh(), { size, levels: [0, 1, 2, 3, 4] }), size, [0, 1, 2, 3, 4], `size ${size}`);
  const p0 = CAT.pickToday(fresh(), { size: 8 });
  ok(p0.count.due === undefined && p0.steps.length === 8, '復習待ちが無いときは新しい問題だけで8問');
  const bank = CAT.ENTRIES.filter(e => e.kind === 'bank');
  const many = bank.filter((_, i) => i % 9 === 0).slice(0, 400);
  const pm = CAT.pickToday(withDue(many), { size: 8 });
  check(pm, 8, null, '復習待ち400問');
  ok(pm.count.due === 6, `復習待ちが大量でも新しい学習の枠を2問残す（復習 ${pm.count.due}）`);
  // 選べる問題が少ない：数学探究（難易度5）だけ・ほとんど解き終えた
  check(CAT.pickToday(fresh(), { size: 8, levels: [5] }), 8, [5], '数学探究だけ');
  const lv0 = bank.filter(e => e.lv === 0);
  const almost = fresh(); for (const e of lv0) { almost.problems[e.id] = { last: now - 3600000, n: 1 }; almost.pstat[e.id] = { S: 30, D: 5, last: now - 3600000, reps: 2, lapses: 0 }; }
  const pa = CAT.pickToday(almost, { size: 8, levels: [0] });
  check(pa, 8, [0], '基礎をすべて解き終えた直後');
  // 1つの分野の問題しか無い状況：その分野の問題だけを残して、ほかを今日解いたことにする
  const f0 = bank[0].f, one = fresh();
  for (const e of bank.filter(e => e.f !== f0 && e.lv === 0)) { one.problems[e.id] = { last: now - 60000, n: 1 }; one.pstat[e.id] = { S: 30, D: 5, last: now - 60000, reps: 2, lapses: 0 }; }
  const p1 = CAT.pickToday(one, { size: 8, levels: [0] });
  check(p1, 8, [0], '未着手が1分野だけ');
  // 解法の推薦の候補が無い・前提が循環・欠損
  ok(CAT.pickToday(fresh(), { size: 8, tech: null }).steps.length === 8, '解法の候補が無くても出題できる');
  const A2 = { id: 'a', ids: [], main: [], pre: ['b'] }, B2 = { id: 'b', ids: [], main: [], pre: ['a'] }, C2 = { id: 'c', ids: [], main: [], pre: ['zz'] };
  const cc = M.techCandidates(fresh(), [A2, B2, C2], CAT.entryById, now);
  ok(cc.fresh.length === 0, '前提が循環・欠損した解法は「まだ学んでいない解法」に出さない（止まらずに終わる）');
  // 同じ問題が複数の理由に当たる：復習の時期で、要復習の解法の問題でもある
  const rt = T.list.find(t => t.main.length > 20);
  const s3 = withDue([CAT.entryById.get(rt.main[0])]);
  s3.log.push({ p: rt.main[1], t: now - 86400000 * 2, g: 1 }, { p: rt.main[2], t: now - 86400000 * 2, g: 1 });
  const CX = new Map(T.list.map(t => [t.id, M.makeCtx(t, CAT.entryById, T.byProblem)]));
  const cand = M.techCandidates(s3, T.list, CAT.entryById, now, (t) => CX.get(t.id));
  const p3 = CAT.pickToday(s3, { size: 8, tech: { ...cand, name: (id) => id, transferWhy: (id, pid) => M.transferWhy(CX.get(id), pid, id) } });
  const hits = p3.items.filter(x => x.pid === rt.main[0]);
  ok(hits.length === 1 && hits[0].tag === 'due', '復習の時期でも要復習の解法の問題でもある問題は、1回だけ・最初に当たった理由（復習）で出す');
}

console.log(`recommend.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exit(fail ? 1 : 0);
