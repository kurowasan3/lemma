// data/*.json のすべての数式を KaTeX で描画できるか確かめる
//   node tools/check_katex.cjs [フォルダ（省略時は data）]
const fs = require('fs');
const path = require('path');
const katex = require(path.join(__dirname, '..', 'vendor', 'katex.min.js'));

const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'data');
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let total = 0, bad = [];
// 問題の本文（f-*.json）と、解法カード（techniques.json）の文章
const sources = fs.readdirSync(dir).filter((f) => f.startsWith('f-')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
if (fs.existsSync(path.join(dir, 'techniques.json'))) {
  const td = JSON.parse(fs.readFileSync(path.join(dir, 'techniques.json'), 'utf8'));
  sources.push(Object.fromEntries(td.techniques.map((t) => ['解法:' + t.id, { name: t.name, summary: t.summary, essence: t.essence, when: t.when, cue: t.cue }])));
}
for (const data of sources) {
  for (const [id, b] of Object.entries(data)) {
    // 選択式の選択肢（ch）：1つ1つが TeX の数式そのもの
    for (const opts of Array.isArray(b.ch) ? b.ch : []) {
      for (const t of opts || []) {
        total++;
        try { katex.renderToString(t, { throwOnError: true, displayMode: true, strict: false }); }
        catch (e) { bad.push([id, 'ch', e.message.replace(/^KaTeX parse error: /, '').slice(0, 120), t.slice(0, 100)]); }
      }
    }
    for (const [k, html] of Object.entries(b)) {
      if (k === 'ch' || k === 'fg' || typeof html !== 'string') continue;   // 選択肢・問題の図（式の文字列）は別
      // 表示数式 \[...\] と 行内 $...$ を取り出す（\text{} の中の $ を考慮）
      const segs = [];
      let s = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => { segs.push([m, true]); return ' '; });
      let i = 0;
      while (i < s.length) {
        if (s[i] === '$') {
          let j = i + 1, depth = 0;
          while (j < s.length) {
            if (s[j] === '\\') { j += 2; continue; }
            if (s[j] === '{') depth++;
            else if (s[j] === '}') depth--;
            else if (s[j] === '$' && depth === 0) break;
            j++;
          }
          if (j >= s.length) { bad.push([id, k, '閉じていない $', s.slice(i, i + 60)]); break; }
          segs.push([s.slice(i + 1, j), false]);
          i = j + 1;
        } else i++;
      }
      for (const [m, disp] of segs) {
        total++;
        try { katex.renderToString(unesc(m), { throwOnError: true, displayMode: disp, strict: false }); }
        catch (e) { bad.push([id, k, e.message.replace(/^KaTeX parse error: /, '').slice(0, 120), unesc(m).slice(0, 100)]); }
      }
    }
  }
}
console.log(`数式 ${total}個を検査、描画できないもの ${bad.length}個`);
for (const b of bad.slice(0, 80)) console.log(b.join(' | '));
process.exitCode = bad.length ? 1 : 0;
