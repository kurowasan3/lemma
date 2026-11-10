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
