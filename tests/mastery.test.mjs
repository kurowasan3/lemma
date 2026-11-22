// mastery.js（解法の習熟度）の単体テスト：判定の基準どおりに状態が決まること
import { techMastery, techCandidates, masterChecklist, makeCtx, MASTER } from '../js/mastery.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };

// 架空の問題：分野 f1 に p1〜p4、分野 f2 に p5〜p6、別の解法の問題 q1
const E = new Map([['p1', 'f1'], ['p2', 'f1'], ['p3', 'f1'], ['p4', 'f1'], ['p5', 'f2'], ['p6', 'f2'], ['q1', 'f3']].map(([id, f]) => [id, { id, f, lv: 2 }]));
const T = { id: 'x', ids: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], main: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], pre: [] };
const D = 86400000, now = Date.UTC(2026, 10, 22);
const st = (log) => ({ log, problems: Object.fromEntries(log.map(l => [l.p, { last: l.t, n: 1 }])) });

ok(techMastery(st([]), T, E, now).status === 'none', '何も解いていなければ未学習');
ok(techMastery(st([{ p: 'q1', t: now, g: 4 }]), T, E, now).status === 'none', '別の解法の問題だけなら未学習');
ok(techMastery(st([{ p: 'p1', t: now, g: 4 }]), T, E, now).status === 'learning', '1問完答しただけでは学習中（習得にしない）');
const ctx = makeCtx(T, E, null);   // f1 が最も多い分野 → f2 の問題（p5, p6）は「別の分野」
ok(ctx('p5').cross && !ctx('p1').cross, '文脈：最も多い分野以外の問題は「別の分野」');
{
  const log = ['p1', 'p2', 'p3', 'p4'].map((p, i) => ({ p, t: now - 20 * D + i * D, g: 4 }));
  log.push({ p: 'p1', t: now - 2 * D, g: 4 });
  const m0 = techMastery(st(log), T, E, now, ctx);
  ok(m0.status === 'learning' && m0.transfer.length === 0, '同じ分野の問題だけでは転用が確かめられず、習得にしない');
  log.push({ p: 'p5', t: now - D, g: 4, k: 't' });
  ok(techMastery(st(log), T, E, now, ctx).transfer.length === 0, '解法を知らされて別の分野を解いても転用に数えない');
  log.push({ p: 'p6', t: now - D / 2, g: 4, r: 3 });
  ok(techMastery(st(log), T, E, now, ctx).transfer.length === 0, '解法が浮かばなかったと答えた完答は転用に数えない');
  log.push({ p: 'p6', t: now, g: 4, r: 1 });
  const m2 = techMastery(st(log), T, E, now, ctx);
  ok(m2.status === 'mastered' && m2.transfer.length === 1, '別の分野で知らされずに完答して、基準をすべて満たすと習得');
  ok(masterChecklist(m2).every(c => c.ok), '習得なら基準のチェックはすべて達成');
  ok(techMastery(st(log), T, E, now).status === 'learning', '文脈が分からない（ctx なし）ときは転用を確かめられないので習得にしない');
}
{
  const log = [{ p: 'p1', t: now - D, g: 4, r: 3 }, { p: 'p2', t: now, g: 4 }];
  const m = techMastery(st(log), T, E, now, ctx);
  ok(m.recall.length === 1 && m.noRecall.length === 1, '「浮かばなかった」完答は想起に数えず、別に数える');
  const m2 = techMastery(st([{ p: 'p1', t: now, g: 1, r: 1 }]), T, E, now, ctx);
  ok(m2.recalledButMissed.length === 1, '解法は浮かんだが完答できなかった問題を区別する');
}
{
  // 解法カードから解いた（k:'t'）完答は「知らされずに完答」に数えない
  const log = ['p1', 'p2', 'p3', 'p5'].map((p, i) => ({ p, t: now - 20 * D + i * D, g: 4, k: 't' }));
  log.push({ p: 'p1', t: now - 2 * D, g: 4, k: 't' });
  const m = techMastery(st(log), T, E, now);
  ok(m.recall.length === 0 && m.status === 'learning', '解法カードからの完答だけでは習得にならない');
}
{
  const log = [{ p: 'p1', t: now - 10 * D, g: 4 }, { p: 'p1', t: now - D, g: 1 }];
  ok(techMastery(st(log), T, E, now).status === 'review', '一度完答した問題を最近解けなかったら要復習');
  const log2 = [{ p: 'p1', t: now - 2 * D, g: 1 }, { p: 'p2', t: now - D, g: 2 }];
  ok(techMastery(st(log2), T, E, now).status === 'review', '最後の2回が続けて完答でなければ要復習');
  const log3 = [{ p: 'p1', t: now - 3 * D, g: 1 }, { p: 'p2', t: now - D, g: 4 }];
  ok(techMastery(st(log3), T, E, now).status === 'learning', '1回の失敗だけなら学習中');
}
{
  // 推薦の候補：要復習・未学習（前提を学び始めているもの）・別の分野
  const A = { ...T, id: 'a' }, B = { id: 'b', ids: ['q1'], main: ['q1'], pre: ['a'] }, C = { id: 'c', ids: ['q1'], main: ['q1'], pre: ['z'] };
  const c0 = techCandidates(st([]), [A, B], E, now);
  ok(c0.fresh.map(t => t.id).join() === 'a', '前提のない未学習の解法は候補、前提を学んでいない解法は候補にしない');
  const c1 = techCandidates(st([{ p: 'p1', t: now, g: 4 }]), [A, B, C], E, now, (t) => makeCtx(t, E, null));
  ok(c1.fresh.map(t => t.id).join() === 'b', '前提を学び始めたら次の解法が候補に（存在しない前提の解法は出さない）');
  ok(c1.transfer.map(t => t.id).join() === 'a', '完答して転用をまだ確かめていない解法は「違う文脈で」の候補');
}
console.log(`mastery.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exit(fail ? 1 : 0);
