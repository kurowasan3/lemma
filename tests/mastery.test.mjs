// mastery.js（解法の習熟度）の単体テスト：実力を過大評価しないこと（v0.20 の感度の確認を含む）
import { techMastery, techCandidates, masterChecklist, makeCtx, transferTargets, MASTER } from '../js/mastery.js';
import { review } from '../js/scheduler.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

// 架空の問題：主な分野 f1 に p1〜p4、別の分野 f2 に p5・p6、ほかの解法も結びつく c1（f1）、補助として結びつく h1（f2）
const E = new Map([['p1', 'f1'], ['p2', 'f1'], ['p3', 'f1'], ['p4', 'f1'], ['p5', 'f2'], ['p6', 'f2'], ['c1', 'f1'], ['h1', 'f2'], ['q1', 'f3']].map(([id, f]) => [id, { id, f, lv: 2 }]));
const T = { id: 'x', ids: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'c1', 'h1'], main: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'c1'], pre: [] };
const BYP = new Map([['c1', [{ id: 'x', main: true }, { id: 'y', main: false }]]]);
const ctx = makeCtx(T, E, BYP);
const D = 86400000, now = Date.UTC(2026, 10, 22);
// 記録から state を作る（pstat は scheduler で計算＝実際のアプリと同じ）
const st = (log) => {
  const s = { log, problems: {}, pstat: {} };
  for (const l of log) { s.problems[l.p] = { last: l.t, n: 1 }; s.pstat[l.p] = review(s.pstat[l.p], l.g, l.t); }
  return s;
};
const M = (log, c = ctx, t = now) => techMastery(st(log), T, E, t, c);
const full = (p, dayAgo, extra = {}) => ({ p, t: now - dayAgo * D, g: 4, ...extra });

// ---- 文脈と転用の定義
ok(ctx('p5').cross && !ctx('p1').cross && ctx('c1').combo && !ctx('h1').main, '文脈：別の分野・ほかの解法も関わる・補助を区別');
ok(ctx.available, '収録問題に文脈が2種類以上あれば転用を判定できる');
{
  const tie = makeCtx({ id: 'z', ids: ['p1', 'p5'], main: ['p1', 'p5'] }, E, null);
  ok(!tie('p1').cross && !tie('p5').cross && !tie.available, '主な分野が同数なら両方を主な分野とし、1分野を勝手に選ばない（転用は判定できない）');
}
ok(M([]).status === 'none', '何も解いていなければ未学習');

// ---- 想起（r）：未回答は成功にも失敗にも数えない
{
  const m = M([full('p1', 5), full('p2', 4, { r: 1 }), full('p3', 3, { r: 3 }), full('p4', 2, { k: 't', r: 1 }), { p: 'p5', t: now - D, g: 1, r: 2 }]);
  ok(m.solo.join() === 'p1,p2', '知らされずに完答：未回答と「浮かんだ」は数え、「浮かばなかった」と解法カードからの回は数えない');
  ok(m.recalled.join() === 'p2', '想起の成功は r=1,2 と答えた完答だけ（未回答 p1 は数えない・知らされた p4 も数えない）');
  ok(m.noRecall.join() === 'p3', '浮かばなかったが完答を区別');
  ok(m.missed.join() === 'p5', '浮かんだが完答できなかったを区別');
  ok(m.unanswered.join() === 'p1', '想起について未回答を区別');
}

// ---- 感度の確認：それぞれの場合に「習得」にしないこと／すること
const base = [full('p1', 30), full('p2', 29), full('p3', 28), full('p1', 10)];   // 主な分野で3問完答・p1 は20日あけて再完答
{
  const m = M([...base, full('p4', 1)]);
  ok(m.status === 'learning' && m.transfer.stage === 'none', '1) 4問すべて同じ分野（主な分野）：転用が未確認なので習得にしない');
}
{
  const m = M([...base, full('p5', 1)]);
  ok(m.status === 'mastered' && m.transfer.stage === 'candidate' && m.transfer.kinds.includes('cross'), '2) 4問のうち1問が別の分野：転用は「候補問題で完答」になり、ほかの条件を満たせば習得');
  ok(masterChecklist(m).every(c => c.ok), '   習得なら基準はすべて達成');
}
{
  const log = [...base.map(l => ({ ...l, k: 't' })), full('p5', 1, { k: 't' })];
  const m = M(log);
  ok(m.status === 'learning' && m.solo.length === 0 && m.transfer.stage === 'none', '3) 解法カードを見て解いた回だけ：知らされずに完答 0、転用も未確認で習得にしない');
}
{
  const m = M([...base, full('p5', 1)]);
  ok(m.recalled.length === 0 && m.transfer.stage === 'candidate', '4) 想起の回答がない：転用は「候補問題で完答」どまり（想起も確認にはならない）');
  const m2 = M([...base, full('p5', 1, { r: 2 })]);
  ok(m2.transfer.stage === 'recalled', '   別の分野で「浮かんだ」と答えると「想起も確認」');
  const m3 = M([...base.slice(0, 1), full('p2', 29, { r: 1 }), ...base.slice(2), full('p5', 1)]);
  ok(m3.transfer.stage === 'candidate', '   主な分野の問題でだけ「浮かんだ」と答えても「想起も確認」にはしない');
}
{
  const m = M([...base, full('p5', 1, { r: 3 })]);
  ok(m.transfer.stage === 'none' && m.status === 'learning', '5) 別の分野の完答で「浮かばなかった」：転用に数えず習得にしない');
}
{
  const log = []; for (let i = 0; i < 12; i++) log.push(full('p1', 40 - i * 3));
  const m = M(log);
  ok(m.status === 'learning' && m.full.length === 1, '6) 同じ問題を何度もくり返しただけ：完答は1問と数え、習得にしない');
}
{
  const m = M([...base, full('p5', 5), { p: 'p5', t: now - D, g: 1 }]);
  ok(m.status === 'review' && m.lapses.includes('p5'), '7) 完答した問題を最近解けなかった：要復習');
}
{
  const m = M([...base, full('p5', 6), { p: 'p4', t: now - 2 * D, g: 1 }, { p: 'p6', t: now - D, g: 2 }]);
  ok(m.status === 'review' && m.twoMiss, '8) 直近の成績が悪化（最後の2回が続けて完答でない）：要復習');
}
{
  // 9) 古い記録しかない：基準をすべて満たした記録でも、1年たてばどの問題も解き直しの時期 → 「今も覚えている」が確かめられない
  const log = [...base, full('p5', 1)];
  const m = techMastery(st(log), T, E, now + 365 * D, ctx);
  ok(m.status === 'learning' && m.stale && m.retention === 'stale' && !m.checks.fresh, '9) 古い記録しかない：今も覚えているか確かめられず習得にしない');
}
{
  // 10) 複数の解法が結びついた問題（c1）と主な分野だけ：c1 は「ほかの解法も関わる」文脈なので転用の候補になる。
  //     c1 だけをくり返しても、別の文脈の完答が無ければ転用にならない
  const onlyCombo = M([full('c1', 30), full('c1', 10), full('c1', 1)]);
  ok(onlyCombo.transfer.stage === 'none' && onlyCombo.status === 'learning', '10) ほかの解法も関わる問題だけ：文脈が1種類なので転用は未確認');
  const m = M([...base, full('c1', 1)]);
  ok(m.transfer.stage === 'candidate' && m.transfer.kinds.join() === 'combo', '   主な分野の問題とほかの解法も関わる問題：転用の根拠は「ほかの解法も関わる問題」');
}
{
  const m = M([...base, full('h1', 1)]);
  ok(m.transfer.stage === 'none', '補助として結びつく問題の完答は転用に数えない（解法を使ったか分からない）');
}
ok(techMastery(st([...base, full('p5', 1)]), T, E, now).transfer.stage === 'none', '文脈が分からない（ctx なし）ときは転用を確かめられないので未確認');
{
  const one = { id: 'w', ids: ['p1', 'p2', 'p3', 'p4'], main: ['p1', 'p2', 'p3', 'p4'] };
  const c = makeCtx(one, E, null);
  const m = techMastery(st([...base, full('p4', 1)]), one, E, now, c);
  ok(m.transfer.stage === 'unavailable' && m.status === 'mastered', '収録問題の文脈が1種類しかない解法は、転用を条件から外す（判定できないことを表示）');
}
{
  // 得意度の閾値 0.7：完答4・不正解1 は通り、完答4・不正解2 は通らない
  const m1 = M([...base, full('p5', 1), { p: 'p6', t: now - 15 * D, g: 1 }]);
  const m2 = M([...base, full('p5', 1), { p: 'p6', t: now - 15 * D, g: 1 }, { p: 'p4', t: now - 14 * D, g: 1 }]);
  ok(m1.checks.score && !m2.checks.score, `得意度：5問中4完答は ${Math.round(m1.score * 100)}（基準内）、6問中4完答は ${Math.round(m2.score * 100)}（基準外）`);
}

// ---- 推薦の候補（転用の問題は mastery の定義と同じ）
{
  const s = st([full('p1', 3)]);
  const m = techMastery(s, T, E, now, ctx);
  const ts = transferTargets(s, T, ctx, m);
  ok(ts.length && ts.every(id => ctx(id).sig !== ctx('p1').sig && T.main.includes(id)), '転用の問題：完答した文脈と違う文脈の、主な解法の未着手問題');
  const A = { ...T, id: 'a' }, B = { id: 'b', ids: ['q1'], main: ['q1'], pre: ['a'] }, C = { id: 'c', ids: ['q1'], main: ['q1'], pre: ['z'] };
  const c0 = techCandidates(st([]), [A, B], E, now, (t) => makeCtx(t, E, BYP));
  ok(c0.fresh.map(t => t.id).join() === 'a', '前提のない未学習の解法は候補、前提を学んでいない解法は候補にしない');
  const c1 = techCandidates(s, [A, B, C], E, now, (t) => makeCtx(t, E, BYP));
  ok(c1.fresh.map(t => t.id).join() === 'b', '前提を学び始めたら次の解法が候補に（存在しない前提の解法は出さない）');
  ok(c1.transfer.map(t => t.id).join() === 'a' && c1.targets.get('a').length > 0, '転用が未確認の解法は、違う文脈の問題とともに候補');
}
// ---- 古い記録（r も k も pstat も無い）でも動く
{
  const s = { log: [{ p: 'p1', t: now - D, g: 3 }, { p: 'p2', t: now, g: 4, ok: true }], problems: {} };
  const m = techMastery(s, T, E, now, ctx);
  ok(m.status === 'learning' && m.retention === 'unknown' && m.unanswered.length === 2, '古い形の記録（r・k・pstat なし）でも判定でき、想起は未回答・保持は確認できないとして扱う');
}
// ---- v0.21：保持（今も覚えているか）。pstat が無い記録では確認できない
{
  // 習得のほかの条件をすべて満たす記録（p1 を20日あけて再完答・別の分野 p5 で完答）
  const log = [...base, full('p5', 1)];
  const R = (pids, dayAgo) => Object.fromEntries(pids.map(p => [p, review(undefined, 4, now - dayAgo * D)]));
  const at = (pstat) => techMastery({ log, problems: {}, pstat }, T, E, now, ctx);
  const m1 = at({});
  ok(m1.retention === 'unknown' && !m1.checks.fresh && m1.status === 'learning', 'P1-1) 古い形式で4問以上完答・他の条件も満たすが pstat が無い：保持は確認できず習得にしない');
  ok(Object.entries(m1.checks).filter(([k, v]) => !v).map(([k]) => k).join() === 'fresh', '   満たしていないのは保持だけ（ほかの条件の判定はそのまま）');
  const m2 = at(R(['p5'], 1));
  ok(m2.retention === 'held' && m2.status === 'mastered', 'P1-2) pstat が1つだけで、その問題を今も覚えている：習得');
  const m3 = at(R(['p5'], 200));
  ok(m3.retention === 'stale' && m3.status === 'learning', 'P1-3) pstat が1つだけで、解き直しの時期を過ぎている：習得にしない');
  const m4 = at({ ...R(['p1', 'p2'], 200), ...R(['p5'], 1) });
  ok(m4.retention === 'held' && m4.heldPids.join() === 'p5' && m4.status === 'mastered', 'P1-4) pstat が複数で一部だけ覚えている：1問でも覚えていれば保持あり');
  const m5 = at(R(['p1', 'p2', 'p5'], 200));
  ok(m5.retention === 'stale' && m5.status === 'learning', 'P1-5) すべての pstat が解き直しの時期を過ぎている：習得にしない');
  const m6 = at(R(['p3'], 200));
  ok(m6.retention === 'stale' && m6.status === 'learning', 'P1-6) 古い記録（pstat なし）と新しい記録が混在し、pstat のある問題は時期を過ぎている：pstat の無い問題を保持の根拠にしない');
  ok(masterChecklist(m1).find(c => c.label.includes('今も覚えている')).now.includes('確認できない'), '   画面の説明：「確認できない」と表示する');
}

console.log(`mastery.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exit(fail ? 1 : 0);
