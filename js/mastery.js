// 解法の習熟度
//
// 問題の習熟（scheduler.js の pstat：その問題をいつ解き直すか）とは別に、
// 「その解法を、知らされなくても使い、違う文脈の問題でも使えるか」を学習記録（state.log）から判定する。
// 記録の形は変えない。log の各回に次の印が付くことがある（どれも省略可。無い古い記録もそのまま読む）。
//   k: 't' … 解法カードから始めた演習（解法を知らされて解いた）
//   r      … 解答後に任意で答える「解法は浮かんだか」：1=すぐ浮かんだ 2=考えるうちに気づいた 3=浮かばなかった・別の方法で解いた
//            r が無い回は「未回答」。想起の成功にも失敗にも数えない。
//
// 1つの解法について、問題ごとに次を区別する（どれも「その問題で一度でも」）：
//   solo        解法を知らされずに完答（k≠'t'）。ただし r=3（浮かばなかった・別の方法）と答えた回は除く
//   recalled    解法を知らされずに完答し、解法が浮かんだと答えた（r=1,2）
//   noRecall    完答したが、解法が浮かばなかったと答えた（r=3）
//   missed      最後の回が完答でなく、その回に解法は浮かんだと答えた（r=1,2）＝解法は浮かんだが実行で崩れた
//   unanswered  知らされずに完答したが、想起について一度も答えていない
//
// 転用（違う文脈で使えたか）。問題データから分かる「文脈」だけを使う（ctx。makeCtx が作る）：
//   主な分野：その解法を主に使う問題が最も多い分野（同数なら同数の分野すべて。1つを勝手に選ばない）
//   文脈の印 sig：主な分野の問題か、どの別の分野の問題か × ほかの解法も結びつく問題か
//   これは「別の分野の問題」「ほかの解法とも結びつく問題」という代理の指標で、その解法を実際に使ったことを観測したものではない。
//   補助として結びつく問題（その解法が主な解法でない問題）は、使ったかどうか分からないので転用の判定に使わない。
// 転用の段階：
//   unavailable  収録問題の文脈が1種類しかなく、判定できない（習得の条件から外す）
//   none         未確認：違う2つの文脈で、知らされずに完答した記録がない
//   candidate    候補問題で完答：違う2つの文脈で完答した（解法を使ったかは確認していない）
//   recalled     想起も確認：そのうえで、主な分野以外・ほかの解法も関わる文脈の問題で、解法が浮かんだと答えた（自己申告）
//
// 状態（基準は画面にも出す）：
//   none     未学習  … この解法に結びつく問題をまだ解いていない
//   review   要復習  … 3問以上解いて得意度 0.5 未満／一度完答した問題を直近30日に解けなかった／最後の2回が続けて完答でない
//   mastered 習得    … MASTER の条件と転用・間をあけた再完答をすべて満たし、かつ今も覚えていること
//                     （問題ごとの復習の記録 pstat のある完答問題のうち1問以上が、まだ解き直しの時期でない＝R ≥ 0.9。
//                       pstat が1つも無ければ確認できないので満たさない）
//   learning 学習中  … それ以外
import { retrievability, TARGET_R } from './scheduler.js';

export const FILE_VERSION = '0.27.3';
export const MASTER = { full: 4, solo: 2, score: 0.7 };
export const STATUS = { none: '未学習', learning: '学習中', review: '要復習', mastered: '習得' };
// 転用の段階の表示。「転用できた」「応用力が身についた」とは言わない（代理の指標のため）
export const TRANSFER = {
  unavailable: '判定できる問題がない',
  none: '異なる文脈の問題はまだ未確認',
  candidate: '異なる文脈の問題で完答',
  recalled: '異なる文脈の問題で完答・解法の想起も自己申告あり',
};
export const RETENTION = { held: 'はい', stale: 'すべて解き直しの時期を過ぎている', unknown: '確認できない（問題ごとの復習の記録がない）' };
const DAY = 86400000;
const RECALLED = (r) => r === 1 || r === 2;

// 解法と問題の文脈。データから判定できるものだけ
export function makeCtx(tech, entryById, byProblem) {
  const cnt = {};
  for (const id of tech.main || []) { const e = entryById.get(id); if (e) cnt[e.f] = (cnt[e.f] || 0) + 1; }
  const max = Math.max(0, ...Object.values(cnt));
  const home = new Set(Object.keys(cnt).filter(f => cnt[f] === max));   // 同数の分野はすべて「主な分野」
  const main = new Set(tech.main || []);
  const fn = (pid) => {
    const e = entryById.get(pid);
    const others = ((byProblem && byProblem.get(pid)) || []).filter(x => x.id !== tech.id);
    const cross = !!e && !home.has(e.f);
    const combo = others.length > 0;
    return { main: main.has(pid), cross, combo, sig: (cross ? 'f:' + e.f : 'home') + (combo ? '+c' : '') };
  };
  fn.home = [...home];
  // 主な解法として結びつく問題に、文脈が2種類以上あるか（無ければ転用は判定できない）
  fn.available = new Set((tech.main || []).filter(id => entryById.has(id)).map(id => fn(id).sig)).size >= 2;
  return fn;
}

// tech: { ids, main }。entryById: 問題の索引。ctx: makeCtx の結果（無ければ転用は「未確認」のまま）
export function techMastery(state, tech, entryById, now = Date.now(), ctx = null) {
  const ids = new Set(tech.ids);
  const main = new Set(tech.main || []);
  const per = new Map();   // pid → 解いた記録（古い順）
  const seq = [];
  for (const l of state.log) {
    if (!ids.has(l.p) || !entryById.has(l.p)) continue;
    if (!per.has(l.p)) per.set(l.p, []);
    per.get(l.p).push(l);
    seq.push(l);
  }
  const n = per.size;
  let sw = 0, ss = 0;
  const full = [], solo = [], recalled = [], noRecall = [], unanswered = [], missed = [], wrong = [], lapses = [], fields = new Set();
  let retained = false;
  for (const [pid, ls] of per) {
    const e = entryById.get(pid);
    const last = ls[ls.length - 1];
    const w = (main.has(pid) ? 1 : 0.5) * (1 + 0.25 * e.lv);
    sw += w; ss += w * (last.g >= 3 ? 1 : last.g === 2 ? 0.5 : 0);
    const fulls = ls.filter(l => l.g >= 3);
    const fullSelf = fulls.filter(l => l.k !== 't');
    if (fullSelf.some(l => l.r !== 3)) solo.push(pid);
    if (fullSelf.some(l => RECALLED(l.r))) recalled.push(pid);
    if (fulls.some(l => l.r === 3)) noRecall.push(pid);
    if (fullSelf.length && fullSelf.every(l => l.r === undefined)) unanswered.push(pid);
    if (last.g >= 3) {
      full.push(pid); fields.add(e.f);
      // 間をあけて（3日以上）もう一度完答した問題があるか
      const prev = ls.slice(0, -1).filter(l => l.g >= 3);
      if (prev.length && last.t - prev[prev.length - 1].t >= 3 * DAY) retained = true;
    } else {
      wrong.push(pid);
      if (RECALLED(last.r)) missed.push(pid);
      if (fulls.length && now - last.t <= 30 * DAY) lapses.push(pid);
    }
  }
  const score = n >= 3 ? (ss + 1) / (sw + 2) : null;
  const last2 = seq.slice(-2);
  const twoMiss = last2.length === 2 && last2.every(l => l.g < 3);
  const tr = transferOf(solo, recalled, ctx);
  // 今も覚えているか（保持）：最後に完答した問題のうち、問題ごとの復習の記録（pstat）がある問題で判定する。
  //   held    … 少なくとも1問が、まだ解き直しの時期になっていない（R ≥ 0.9）
  //   stale   … pstat のある問題がすべて解き直しの時期を過ぎている
  //   unknown … pstat のある問題が1問もない（古い形式の記録だけ）→ 保持は確認できない。成功とは推定しない
  // pstat の無い古い記録も、完答・想起・転用の記録としては使う。記録は書きかえない。
  const withStat = full.filter(pid => state.pstat && state.pstat[pid]);
  const heldPids = withStat.filter(pid => retrievability(state.pstat[pid], now) >= TARGET_R);
  const retention = !withStat.length ? 'unknown' : heldPids.length ? 'held' : 'stale';
  const stale = retention === 'stale';
  const checks = {
    full: full.length >= MASTER.full,
    solo: solo.length >= MASTER.solo,
    transfer: tr.stage === 'candidate' || tr.stage === 'recalled' || tr.stage === 'unavailable',
    retained,
    score: score != null && score >= MASTER.score,
    fresh: retention === 'held',
  };
  let status;
  if (!n) status = 'none';
  else if ((score != null && score < 0.5) || lapses.length || twoMiss) status = 'review';
  else if (Object.values(checks).every(Boolean)) status = 'mastered';
  else status = 'learning';
  return {
    status, n, score, full, solo, recalled, noRecall, unanswered, missed, wrong, lapses, fields: [...fields],
    retained, twoMiss, stale, retention, heldPids, checks, transfer: tr, lastT: seq.length ? seq[seq.length - 1].t : 0,
  };
}

function transferOf(solo, recalled, ctx) {
  if (!ctx) return { stage: 'none', kinds: [], pids: [], sigs: [] };
  if (!ctx.available) return { stage: 'unavailable', kinds: [], pids: [], sigs: [] };
  const bySig = new Map();
  for (const pid of solo) {
    const c = ctx(pid);
    if (!c.main) continue;            // 補助として結びつく問題は使わない
    if (!bySig.has(c.sig)) bySig.set(c.sig, []);
    bySig.get(c.sig).push(pid);
  }
  if (bySig.size < 2) return { stage: 'none', kinds: [], pids: [], sigs: [...bySig.keys()] };
  const pids = [...bySig.values()].flat();
  // 根拠の種類：分野の違い（cross）・ほかの解法も関わるかの違い（combo）
  const fieldPart = new Set([...bySig.keys()].map(s => s.split('+')[0]));
  const comboPart = new Set([...bySig.keys()].map(s => s.endsWith('+c')));
  const kinds = [...(fieldPart.size >= 2 ? ['cross'] : []), ...(comboPart.size >= 2 ? ['combo'] : [])];
  // 想起も確認：主な分野でほかの解法も関わらない問題（'home'）以外の文脈の問題で、浮かんだと答えたこと
  const rec = new Set(recalled);
  const recOther = [...bySig].some(([sig, ps]) => sig !== 'home' && ps.some(p => rec.has(p)));
  return { stage: recOther ? 'recalled' : 'candidate', kinds, pids, sigs: [...bySig.keys()] };
}

// 転用を確かめるための問題：主な解法として結びつき、まだ解いていない問題のうち、
// 知らされずに完答した問題のどの文脈とも違う文脈のもの（完答が無ければ空）
export function transferTargets(state, tech, ctx, m) {
  if (!ctx || !ctx.available || !m.solo.length) return [];
  const have = new Set(m.solo.filter(p => ctx(p).main).map(p => ctx(p).sig));
  if (!have.size) return [];
  return (tech.main || []).filter(id => !state.problems[id] && !have.has(ctx(id).sig));
}
// 転用の問題の理由（推薦・解法カードで同じ言い方にする）
export function transferWhy(ctx, pid, name) {
  return ctx(pid).cross ? `「${name}」を別の分野の問題で使う` : `「${name}」を、ほかの解法も関わる問題で使う`;
}
export const TRANSFER_KIND = { cross: '別の分野', combo: 'ほかの解法も関わる問題' };

// 習得の基準ごとの達成状況（画面の「習得まで」に使う）
export function masterChecklist(m) {
  return [
    { label: `完答した問題 ${MASTER.full}問`, ok: m.checks.full, now: `${m.full.length}問` },
    { label: `解法を知らされずに完答 ${MASTER.solo}問（「浮かばなかった」と答えた問題を除く）`, ok: m.checks.solo, now: `${m.solo.length}問` },
    { label: '違う2つの文脈（主な分野と別の分野、ほかの解法も関わるかどうか）の問題で、知らされずに完答', ok: m.checks.transfer, now: TRANSFER[m.transfer.stage] },
    { label: '3日以上あけて、同じ問題をもう一度完答', ok: m.checks.retained, now: m.retained ? 'あり' : 'なし' },
    { label: `得意度 ${Math.round(MASTER.score * 100)} 以上`, ok: m.checks.score, now: m.score == null ? '3問から' : `${Math.round(m.score * 100)}` },
    { label: '完答した問題のどれかが、まだ解き直しの時期になっていない（今も覚えている）', ok: m.checks.fresh, now: RETENTION[m.retention] },
  ];
}

// 解法ごとの推薦の候補（pickToday に渡す）
//   review   … 要復習の解法（得意度の低い順）
//   fresh    … 未学習で、必須の前提（pre）がすべて学習済み以上の解法（主な問題の多い順）
//   transfer … 完答したことがあり、転用が未確認で、違う文脈の未着手の問題がある解法（targets にその問題）
// ctxOf(tech) → makeCtx の結果（省略可。省略すると転用は判定・推薦しない）
export function techCandidates(state, techs, entryById, now = Date.now(), ctxOf = null) {
  const ms = new Map(techs.map(t => [t.id, techMastery(state, t, entryById, now, ctxOf ? ctxOf(t) : null)]));
  const review = techs.filter(t => ms.get(t.id).status === 'review')
    .sort((a, b) => (ms.get(a.id).score ?? 0.5) - (ms.get(b.id).score ?? 0.5));
  const fresh = techs.filter(t => ms.get(t.id).status === 'none' && t.main.length && t.pre.every(p => ms.has(p) && ms.get(p).status !== 'none'))
    .sort((a, b) => b.main.length - a.main.length);
  const targets = new Map();
  const transfer = techs.filter(t => {
    const m = ms.get(t.id);
    if (!ctxOf || !m.full.length || m.status === 'review' || m.transfer.stage !== 'none') return false;
    const ts = transferTargets(state, t, ctxOf(t), m);
    if (ts.length) targets.set(t.id, ts);
    return ts.length > 0;
  }).sort((a, b) => ms.get(b.id).full.length - ms.get(a.id).full.length);
  return { ms, review, fresh, transfer, targets };
}
