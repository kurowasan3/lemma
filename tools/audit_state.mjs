// 学習記録（設定の「書き出す」で作ったファイル）の整合性を点検する（v0.23）
//   node tools/audit_state.mjs <バックアップ.json>                 点検の結果を表示（エラーがあれば終了コード 1）
//   node tools/audit_state.mjs <バックアップ.json> --json          結果を JSON で
//   node tools/audit_state.mjs <バックアップ.json> --fix <出力.json> 安全な自動修復（重複の統合・並べ替え・回数の引き上げ）をした
//                                                                  新しいファイルを作る。元のファイルは変えない。出力先が既にあれば止まる
// 問題ID・解法カードIDは、今のリポジトリの data/index.json・js/content.js と照らし合わせる。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = await import('../js/store.js');
const C = await import('../js/content.js');

export function idContext() {
  const idx = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
  const problemIds = new Set([...idx.problems.map(p => p.id), ...C.PROBLEMS.map(p => p.id)]);
  return { problemIds, cardIds: new Set(C.CARDS.map(c => c.id)) };
}

function main(argv) {
  const file = argv.find(a => !a.startsWith('--'));
  if (!file) { console.log('使い方：node tools/audit_state.mjs <バックアップ.json> [--json] [--fix 出力.json]'); return 2; }
  const fixAt = argv.indexOf('--fix'), out = fixAt >= 0 ? argv[fixAt + 1] : null;
  let obj;
  try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`読めません：${e.message}`); return 1; }
  // 形式の確認（確認用の値・schema）は readBackup に任せる。点検でエラーがあっても結果は見せたいので、state を取り出して点検する
  let state, meta = {};
  try { const r = S.readBackup(obj, idContext()); state = r.state; meta = r.meta; }
  catch (e) {
    if (!e.report) { console.log(`受け付けられないファイルです：${e.message}`); return 1; }
    state = obj.format === S.BACKUP_FORMAT ? obj.state : obj;
  }
  const rep = S.audit(state, idContext());
  if (argv.includes('--json')) console.log(JSON.stringify({ meta, ...rep }, null, 1));
  else {
    console.log(`記録：解答 ${rep.stats.log}件・復習状態 ${rep.stats.pstat}問・解いた問題 ${rep.stats.problems}問・ブックマーク ${rep.stats.bookmarks}・解法カード ${rep.stats.cards}（形式 ${meta.format ?? '?'}・schema ${state.schema}）`);
    for (const [label, list] of [['エラー', rep.errors], ['注意', rep.warnings]]) {
      for (const x of list) console.log(`${label}\t${x.code}\t${x.count}件\t${x.fix === 'auto' ? '自動で直せる' : '人が判断'}\t${x.msg}\t${x.ids.slice(0, 8).join(', ')}${x.count > 8 ? ' …' : ''}`);
    }
    if (!rep.errors.length && !rep.warnings.length) console.log('問題は見つかりませんでした');
  }
  if (out) {
    if (path.resolve(out) === path.resolve(file) || fs.existsSync(out)) { console.log(`出力先 ${out} は既にあります（元のファイル・既存のファイルは上書きしません）`); return 1; }
    const { state: fixed, changes } = S.repair(state);
    fs.writeFileSync(out, JSON.stringify(S.makeBackup(fixed, `audit_state(${meta.app || ''})`), null, 1));
    console.log(`直した記録を ${out} に書きました（元のファイルはそのまま）`);
    for (const c of changes) console.log(`変更\t${c.code}\t${c.ids.length}件\t${c.ids.slice(0, 8).join(', ')}`);
    if (!changes.length) console.log('変更はありませんでした');
  }
  return rep.errors.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
