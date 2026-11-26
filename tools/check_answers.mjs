// 「入力用の答え」がアプリで読めるか検査する
//   node tools/check_answers.mjs data          … 取り込み済みの data/*.json を検査
//   node tools/check_answers.mjs specs.json    … {ID: {spec}} 形式のファイルを検査
import fs from 'fs';
import path from 'path';
import { parseSpec, checkField } from '../js/answer.js';

const target = process.argv[2] || 'data';
let specs = {};
const coverage = [];     // data/ を検査するとき：一覧の全問を走査できたか（欠けたまま成功にしない）
if (fs.statSync(target).isDirectory()) {
  // 本文ファイル：塊（data/b/*.json）と前の形（data/f-*.json）のどちらでも
  const files = [...(fs.existsSync(path.join(target, 'b')) ? fs.readdirSync(path.join(target, 'b')).filter(f => f.endsWith('.json')).map(f => path.join('b', f)) : []),
    ...fs.readdirSync(target).filter(f => f.startsWith('f-'))];
  const where = new Map();
  for (const f of files) {
    for (const [id, b] of Object.entries(JSON.parse(fs.readFileSync(path.join(target, f), 'utf8')))) {
      if (id === '_meta') continue;
      if (where.has(id)) coverage.push(`${id}: 本文が2つのファイルにある（${where.get(id)} と ${f}）`);
      where.set(id, f);
      if (b.in) specs[id] = b.in;
    }
  }
  const ip = path.join(target, 'index.json');
  if (!fs.existsSync(ip)) coverage.push('index.json が無いので，全問を走査したか確かめられない');
  else {
    const idx = JSON.parse(fs.readFileSync(ip, 'utf8'));
    const bl = idx.bodies;
    if (bl && bl.layout === 'chunks') for (const k of Object.keys(bl.chunks)) if (!fs.existsSync(path.join(target, bl.dir || 'b', k + '.json'))) coverage.push(`${bl.dir || 'b'}/${k}.json が無い`);
    for (const e of idx.problems) {
      if (!where.has(e.id)) coverage.push(`${e.id}: 本文が無い`);
      else if (e.in && !specs[e.id]) coverage.push(`${e.id}: 一覧では入力用の答えがあるのに，本文に無い`);
    }
    const inIndex = idx.problems.filter(e => e.in).length;
    console.log(`本文ファイル ${files.length}個・本文 ${where.size}問を走査（一覧 ${idx.problems.length}問・入力用の答え ${inIndex}問）`);
  }
} else {
  for (const [id, v] of Object.entries(JSON.parse(fs.readFileSync(target, 'utf8')))) if (v.spec) specs[id] = v.spec;
}

const bad = {};          // { ID: [だめな小問の番号(0始まり)] }
let fields = 0, auto = 0;
const kinds = {};
function selfCheck(f) {
  let input;
  if (f.kind === 'cases') input = { mode: 'cases', rows: f.cases.map(c => ({ cond: c.condSrc, val: c.valSrc })) };
  else if (f.kind === 'set') input = { mode: 'plain', text: f.items.map(i => i.src).join(', ') };
  else if (f.kind === 'expr') input = { mode: 'plain', text: f.value.src };
  else input = { mode: 'plain', text: f.src };
  const r = checkField(f, input);
  if (r.ok !== true) throw new Error(`正解を入れても正解にならない（${f.label || ''} ${f.src}）${r.error || ''}`);
}
const reasons = {};
for (const [id, text] of Object.entries(specs)) {
  const lines = String(text).split(/\n/);
  lines.forEach((line, k) => {
    try {
      const sp = parseSpec(line);
      for (const p of sp.parts) for (const f of p.fields) {
        fields++;
        kinds[f.kind] = (kinds[f.kind] || 0) + 1;
        if (f.kind === 'self') continue;
        auto++;
        selfCheck(f);
      }
    } catch (e) {
      (bad[id] = bad[id] || []).push(k);
      reasons[`${id}#${k + 1}`] = `${e.message} ｜ ${line}`;
    }
  });
}
console.log(`問題 ${Object.keys(specs).length}・答え ${fields}（自動採点 ${auto}）`, kinds);
console.log(`読めない・整合しない小問 ${Object.values(bad).flat().length}（${Object.keys(bad).length}問）`);
for (const [k, m] of Object.entries(reasons).slice(0, 30)) console.log(' ', k, m);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(bad, null, 1));
if (coverage.length) {
  console.log(`検査できなかった（data/ がそろっていない） ${coverage.length}件`);
  for (const x of coverage.slice(0, 30)) console.log(' ', x);
}
process.exitCode = Object.keys(bad).length || coverage.length ? 1 : 0;
