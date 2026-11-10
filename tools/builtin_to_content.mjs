// 内蔵問題（js/content.js）を正規データの形で書き出す
//   node tools/builtin_to_content.mjs [content フォルダ]
// 内蔵問題の正は js/content.js のまま（アプリもそちらを読む）。ここで作るファイルは検索・問題セット・照合のためのもの。
//   content/problems/builtin.json … 61問
//   content/methods.json         … 解法カード（CARDS）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROBLEMS, CARDS, cardById } from '../js/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = path.resolve(process.argv[2] || path.join(root, 'content'));
const tax = JSON.parse(fs.readFileSync(path.join(content, 'taxonomy.json'), 'utf8'));
const LEVEL = { 2: 1, 3: 3, 4: 4 };   // 内蔵問題の3段階 → 管理表の6段階（catalog.js の BUILTIN_LEVEL と同じ）

const unitField = (unit) => {
  const f = tax.builtinUnits[unit];
  if (!f) throw new Error(`taxonomy.json の builtinUnits に単元 ${unit} がありません`);
  return f;
};

const problems = PROBLEMS.map((p) => {
  const g = { format: 'builtin/1', type: p.type };
  for (const k of ['ans', 'vars', 'choices', 'prefix']) if (p[k] !== undefined) g[k] = p[k];
  const out = {
    id: p.id, schema: 'lemma.problem/1', kind: 'interactive',
    field: unitField(cardById[p.cards[0]].unit), level: LEVEL[p.level] ?? 3,
    statement: { tex: p.q },
    answer: { tex: p.type === 'choice' ? p.choices[0] : p.type === 'sketch' ? '（グラフの概形）' : String(p.ans ?? '') },
    grading: g,
    hints: p.hints || [],
    solutions: [{ id: 'main', kind: 'main', tex: p.sol || '' }],
    methods: p.cards.slice(),
    tags: [],
    provenance: { method: '内蔵' },
    quality: { status: 'published', checks: { sympy: true }, verified: true },
  };
  const assets = {};
  for (const k of ['graph', 'graph3', 'view']) if (p[k] !== undefined) assets[k] = p[k];
  if (Object.keys(assets).length) out.assets = assets;
  return out;
});

const methods = CARDS.map((c) => {
  const m = { id: c.id, name: c.name, field: unitField(c.unit), unit: c.unit, pre: c.pre || [], summary: { tex: c.point || '' } };
  if (c.graph) m.assets = { graph: c.graph };
  return m;
});

fs.mkdirSync(path.join(content, 'problems'), { recursive: true });
fs.writeFileSync(path.join(content, 'problems', 'builtin.json'), JSON.stringify(problems, null, 1) + '\n');
fs.writeFileSync(path.join(content, 'methods.json'), JSON.stringify({ schema: 'lemma.methods/1', methods }, null, 1) + '\n');
console.log(`内蔵問題 ${problems.length}問、解法 ${methods.length}件を書き出しました → ${content}`);
