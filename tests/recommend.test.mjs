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
console.log(`recommend.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exit(fail ? 1 : 0);
