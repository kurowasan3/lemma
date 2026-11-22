// catalog.js の単体テスト（ブラウザなしで data/ を読む）
//   node tests/catalog.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// catalog.js は相対 URL で fetch するので、リポジトリのファイルを返す fetch に差し替える
globalThis.fetch = async (url) => {
  const p = path.join(root, String(url));
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
  const text = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};
const CAT = await import('../js/catalog.js');
const { PROBLEMS } = await import('../js/content.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };

const meta = await CAT.loadCatalog();
const idx = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
ok(meta.ok, '問題データを読めること');
ok(CAT.ENTRIES.length === idx.count + PROBLEMS.length, `ENTRIES の数 ${CAT.ENTRIES.length} = ${idx.count} + ${PROBLEMS.length}`);
ok(meta.warnings.length === 0, `形式の警告がないこと ${meta.warnings}`);
ok(CAT.FIELDS.every(f => idx.fields.some(x => x.key === f.key)), '内蔵問題のために余分な分野（b-番号）が作られていないこと');

// 既存の API がそのまま動くこと
ok(CAT.pool({ levels: [0] }).length > 0, 'pool() で基礎の問題がとれる');
const st = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v0.6.json'), 'utf8'));
ok(CAT.pickPractice(st, { size: 8 }).length === 8, 'pickPractice()');
ok(Array.isArray(CAT.pickReview(st, { size: 5 })), 'pickReview()');

// 今日の演習（v0.16）：復習待ちを先に、残りを新しい問題で。苦手分野から最大2問
{
  const now = Date.now(), old = now - 60 * 86400000;
  const ids = CAT.ENTRIES.filter(e => e.kind === 'bank').slice(0, 3).map(e => e.id);
  const st = { problems: {}, pstat: {}, log: [] };
  for (const id of ids) { st.problems[id] = { last: old, n: 1 }; st.pstat[id] = { S: 1, D: 5, last: old, reps: 1, lapses: 0 }; }
  const weak = CAT.FIELDS.find(f => f.key !== CAT.entryById.get(ids[0]).f).key;
  const plan = CAT.pickToday(st, { size: 8, weak });
  const got = plan.steps.map(x => x.pid);
  ok(plan.due === 3 && plan.fresh === 5 && got.length === 8 && new Set(got).size === 8, `今日の演習：復習3問＋新しい問題5問（${plan.due}+${plan.fresh}）`);
  ok(ids.every(id => got.includes(id)), '今日の演習に復習待ちがすべて入る');
  ok(got.filter(id => CAT.entryById.get(id).f === weak && !ids.includes(id)).length >= 2, '今日の演習に苦手分野の新しい問題が2問入る');
  const only = CAT.pickToday({ problems: {}, pstat: {}, log: [] }, { size: 6, levels: [0] });
  ok(only.due === 0 && only.steps.length === 6 && only.steps.every(x => CAT.entryById.get(x.pid).lv === 0), '今日の演習：難易度の選択を守る');
}
// 類題（v0.16）：同じ分野・難易度の差1以内・共通タグあり
{
  const e0 = CAT.ENTRIES.find(e => e.kind === 'bank' && (e.tg || []).length >= 2);
  const sim = CAT.similarTo({ problems: {} }, e0.id);
  ok(sim && sim.id !== e0.id && sim.f === e0.f && Math.abs(sim.lv - e0.lv) <= 1 && sim.tg.some(t => e0.tg.includes(t)), `類題：${e0.id} → ${sim && sim.id}`);
  const sim2 = CAT.similarTo({ problems: {} }, e0.id, [sim.id]);
  ok(!sim2 || sim2.id !== sim.id, '類題：除外した問題は選ばない');
}

// 解法カード（v0.17）：どのカードにも問題が結びつき、前提・関連の参照先がある。問題の8割以上がどれかの解法に結びつく
{
  const T = await CAT.loadTechniques();
  ok(T.list.length >= 60, `解法カードが ${T.list.length}枚`);
  ok(T.list.every(t => t.ids.length > 0 && t.summary && t.essence && t.when && t.cue), 'どのカードにも問題と説明がある');
  ok(T.list.every(t => [...t.pre, ...t.rel].every(x => T.byId.has(x))), '前提・関連の参照先がある');
  ok(T.list.every(t => t.ids.every((id, i) => i === 0 || CAT.entryById.get(t.ids[i - 1]).lv <= CAT.entryById.get(id).lv)), 'カードの問題はやさしい順');
  const bank = CAT.ENTRIES.filter(e => e.kind === 'bank').length;
  ok(T.byProblem.size / bank > 0.8, `解法に結びつく問題 ${T.byProblem.size} / ${bank}`);
  ok(T.byId.get('recurrence').ids.every(id => (CAT.entryById.get(id).tg || []).some(t => /漸化式|不動点|階差/.test(t))), '漸化式のカードの問題は漸化式のタグをもつ');
}

// 推薦（v0.18）：理由はすべて決まった規則から付き、解法の候補があれば解法の理由の問題が入る
{
  const { techCandidates, makeCtx } = await import('../js/mastery.js');
  const T = await CAT.loadTechniques();
  const st = { problems: {}, pstat: {}, log: [] };
  const CX = new Map(T.list.map(t => [t.id, makeCtx(t, CAT.entryById, T.byProblem)]));
  const { transferWhy } = await import('../js/mastery.js');
  const tech = { ...techCandidates(st, T.list, CAT.entryById, Date.now(), (t) => CX.get(t.id)), name: (id) => T.byId.get(id).name, transferWhy: (id, pid) => transferWhy(CX.get(id), pid, T.byId.get(id).name) };
  const plan = CAT.pickToday(st, { size: 8, tech });
  const RULES = [/^前回完答できなかった問題の復習$/, /^復習の時期$/, /^要復習の解法「.+」を立て直す$/, /^まだ学んでいない解法「.+」を学ぶ$/, /^「.+」を別の分野の問題で使う$/, /^「.+」を、ほかの解法も関わる問題で使う$/, /^苦手な分野「.+」を補う$/, /^新しい問題$/];
  ok(plan.steps.length === 8 && plan.steps.every(x => RULES.some(r => r.test(x.why))), '今日の演習：すべての問題に規則どおりの理由');
  const nw = plan.items.find(x => x.tag === 'new');
  ok(nw && T.byProblem.get(nw.pid).some(x => x.main), `何も解いていなければ、まだ学んでいない解法の問題が入る（${nw && nw.why}）`);
  ok(plan.items.filter(x => x.tag === 'fresh').length === plan.count.fresh, '「新しい問題」の数が count と合う');
  // 復習が積み上がっても新しい学習の枠を残す（v0.19）・復習以外は1つの分野から3分の1まで
  {
    const old = Date.now() - 90 * 86400000;
    // 分野をまたいで40問（同じ分野の復習は1回の半分までなので、分野を散らす）
    const byF = {}; for (const e of CAT.ENTRIES.filter(e => e.kind === 'bank')) (byF[e.f] = byF[e.f] || []).push(e);
    const fs = Object.values(byF); const many = [];
    for (let i = 0; many.length < 40; i++) many.push(fs[i % fs.length][Math.floor(i / fs.length)]);
    const s2 = { problems: {}, pstat: {}, log: [] };
    for (const e of many) { s2.problems[e.id] = { last: old, n: 1 }; s2.pstat[e.id] = { S: 1, D: 5, last: old, reps: 1, lapses: 0 }; s2.log.push({ p: e.id, t: old, g: 3 }); }
    const p2 = CAT.pickToday(s2, { size: 8 });
    ok(p2.count.due === 6 && p2.steps.length === 8, `復習が40問（1回分の4倍超）たまっていても、新しい問題の枠を2問残す（復習 ${p2.count.due}）`);
    const sameF = fs[0].slice(0, 10), s5 = { problems: {}, pstat: {}, log: [] };
    for (const e of sameF) { s5.problems[e.id] = { last: old, n: 1 }; s5.pstat[e.id] = { S: 1, D: 5, last: old, reps: 1, lapses: 0 }; s5.log.push({ p: e.id, t: old, g: 3 }); }
    const p5 = CAT.pickToday(s5, { size: 8 });
    ok(p5.count.due === 4 && p5.items.filter(x => CAT.entryById.get(x.pid).f === sameF[0].f).length <= 4, `復習が1分野に10問あっても、その分野は1回の半分まで（復習 ${p5.count.due}）`);
    const s3 = { problems: {}, pstat: {}, log: [] };
    for (const e of many.slice(0, 5)) { s3.problems[e.id] = { last: old, n: 1 }; s3.pstat[e.id] = { S: 1, D: 5, last: old, reps: 1, lapses: 0 }; s3.log.push({ p: e.id, t: old, g: 3 }); }
    ok(CAT.pickToday(s3, { size: 8 }).count.due === 5, '復習が少ないときは新しい問題の枠を3問残す（復習5問はすべて出す）');
    for (let k = 0; k < 20; k++) {
      const p4 = CAT.pickToday({ problems: {}, pstat: {}, log: [] }, { size: 9 });
      const c = {}; for (const it of p4.items) { const f = CAT.entryById.get(it.pid).f; c[f] = (c[f] || 0) + 1; }
      if (Math.max(...Object.values(c)) > 3) { ok(false, '1つの分野から3分の1を超えない'); break; }
      if (k === 19) ok(true, '1つの分野から3分の1を超えない');
    }
  }
  // 旧 ID（former）で引ける
  ok(T.byId.get('ivt-mvt') && T.byId.get('ivt-mvt').id === 'mvt', '旧 ID ivt-mvt は平均値の定理のカードへ');
  ok(T.list.every(t => t.main.every(id => t.ids.includes(id))), '主な解法の問題は結びつく問題に含まれる');
  // 類題：同じ主な解法の問題を優先
  const e0 = CAT.ENTRIES.find(e => (T.byProblem.get(e.id) || []).some(x => x.main));
  const m0 = T.byProblem.get(e0.id).find(x => x.main).id;
  const sim = CAT.similarTo({ problems: {} }, e0.id, [], T.byProblem);
  ok(sim && (T.byProblem.get(sim.id) || []).some(x => x.id === m0), `類題は同じ解法を共有する（${e0.id} → ${sim && sim.id}）`);
}

// 頻出度：1〜3 だけが入り、出題では頻出度の高い問題が多めに選ばれること
ok(CAT.ENTRIES.every(e => e.v === undefined || e.v === 1 || e.v === 3), '頻出度は 1 か 3 だけが書かれる（2 は既定）');
ok(CAT.ENTRIES.some(e => e.v === 3) && CAT.ENTRIES.some(e => e.v === 1), '頻出度の高・低がどちらもある');
{
  const empty = { attempts: {}, problems: {} };
  const hi = CAT.pool({ levels: [3] }).filter(e => CAT.valueOf(e) === 3).length / CAT.pool({ levels: [3] }).length;
  const byId = new Map(CAT.ENTRIES.map(e => [e.id, e]));
  let n = 0, h = 0;
  for (let i = 0; i < 40; i++) for (const it of CAT.pickPractice(empty, { size: 10, levels: [3] })) { n++; if (CAT.valueOf(byId.get(it.pid)) === 3) h++; }
  ok(h / n > hi, `頻出度の高い問題が多めに出る（出題 ${(h / n).toFixed(2)} > 全体 ${hi.toFixed(2)}）`);
}

// 全問の本文を読み、共通ビューが作れること
await CAT.ensureBodies(CAT.ENTRIES.map(e => e.id));
ok(CAT.staleDataFiles().length === 0, `本文ファイルの版が揃っていること ${CAT.staleDataFiles()}`);
let bad = 0;
for (const e of CAT.ENTRIES) {
  const p = CAT.getProblem(e.id);
  const good = p && p.id === e.id && p.field === e.f && p.level === e.lv && p.subject && p.fieldName && p.html && p.html.q
    && (p.kind === 'interactive' ? p.grading.format === 'builtin/1' : (!!p.grading === !!e.in) && (!p.grading || typeof p.grading.spec === 'string'))
    && (e.kind === 'bank' ? CAT.getBody(e.id) : true);
  if (!good) { bad++; if (bad < 5) console.log('  bad', e.id, p && Object.keys(p)); }
}
ok(bad === 0, `getProblem() が全 ${CAT.ENTRIES.length}問で正しい形（だめ ${bad}問）`);
ok(CAT.getProblem('no-such-id') === undefined, '無い ID は undefined');
ok(CAT.getBody('_meta') === undefined, '_meta を本文として登録しないこと');

// v0.6 の学習記録が新しいデータでも使えること
const ids = new Set([...Object.keys(st.pstat), ...Object.keys(st.problems), ...st.log.map(l => l.p), ...Object.keys(st.explains)]);
const missing = [...ids].filter(i => !CAT.entryById.has(i));
ok(missing.length === 0, `v0.6 の記録にある問題ID がすべてある（無い ${missing.slice(0, 5)}）`);
ok(st.practice.fields.every(k => CAT.fieldByKey[k]), 'v0.6 の記録にある分野ID がすべてある');
ok(CAT.fieldByKey['I-02'].name === '2次関数' && CAT.fieldByKey['III-17'].name === '積分法', '分野ID の意味が v0.6 と同じ');

// 検索・問題セット（v0.8）
ok(CAT.normText('最大・最小') === CAT.normText('最大最小') && CAT.normText('ＡＢ　c') === 'abc', 'normText が表記ゆれを吸収する');
const r1 = await CAT.searchProblems('数学的帰納法');
ok(r1.length > 10 && r1.every(e => (e.tg || []).includes('数学的帰納法') || true), `「数学的帰納法」で見つかる（${r1.length}問）`);
const r2 = await CAT.searchProblems('帰納法');
ok(r2.length >= r1.length, '別名「帰納法」でも同じ問題が見つかる');
ok((r1[0].tg || []).includes('数学的帰納法'), 'タグが一致する問題が先頭');
const r3 = await CAT.searchProblems('漸化式 確率', { levels: [0, 1, 2] });
ok(r3.length > 0 && r3.every(e => e.lv <= 2), `複数語・難易度の絞り込み（${r3.length}問）`);
ok((await CAT.searchProblems('')).length === 0, '空の検索は0件');
const cols = await CAT.loadCollections();
ok(cols.length >= 1 && cols.every(c => c.items.every(it => CAT.entryById.has(it.id))), `問題セット ${cols.length}件、すべての問題がある`);
const pc = CAT.pickCollection({ problems: { [cols[0].items[0].id]: { last: 1, n: 1 } } }, cols[0], 5);
ok(pc.length === Math.min(5, cols[0].items.length) && pc[0].pid === cols[0].items[1].id, 'pickCollection は未着手の問題から順に');
const tagsInIndex = new Set(CAT.ENTRIES.flatMap(e => e.tg || []));
ok(!tagsInIndex.has('帰納法') && !tagsInIndex.has('最大最小'), 'アプリ用データのタグは正規名に置き換わっている');

console.log(`catalog.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
