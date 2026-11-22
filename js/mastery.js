// 解法の習熟度（v0.18）
//
// 問題の習熟（scheduler.js の pstat：その問題をいつ復習するか）とは別に、
// 「その解法を、言われなくても思い出して、違う問題に使えるか」を学習記録（state.log）から判定する。
// 記録の形は変えない。log の各回に k: 't'（解法カードから始めた演習＝解法を知らされて解いた）が付くことがある。
//
// 記録の印（どれも省略可）：k: 't' … 解法カードから始めた演習（解法を知らされて解いた）
//   r … 解答後に答えた「解法を思いついたか」1=すぐ浮かんだ 2=考えるうちに気づいた 3=浮かばなかった・別の方法で解いた
//
// 転用：同じ解法を「違う文脈」で使えたか。文脈は問題データから判定できるものだけ（ctx(pid) が返す）：
//   cross  … その解法の問題が最も多い分野以外の分野の問題
//   combo  … ほかの解法も結びついている問題（組み合わせて使う）
//   hidden … この解法が主な解法ではない（補助として使う）問題
// 転用できた＝これらの問題を、解法を知らされずに（k≠'t'）、思いつけずに（r≠3）完答したこと。
//
// 状態（基準は画面にも出す）：
//   none     未学習  … この解法に結びつく問題をまだ解いていない
//   review   要復習  … 3問以上解いて得意度 0.5 未満／一度完答した問題を直近30日に解けなかった／最後の2回が続けて完答でない
//   mastered 習得    … 次をすべて満たす（MASTER の値）
//   learning 学習中  … それ以外
export const FILE_VERSION = '0.19.0';
export const MASTER = { full: 4, recall: 2, transfer: 1, score: 0.7 };
export const STATUS = { none: '未学習', learning: '学習中', review: '要復習', mastered: '習得' };
const DAY = 86400000;

// tech: { ids, main }（main は主な解法として結びつく問題の ID）。entryById: 問題の索引
export function techMastery(state, tech, entryById, now = Date.now(), ctx = null) {
  const ids = new Set(tech.ids);
  const main = new Set(tech.main || []);
  const per = new Map();   // pid → 解いた記録（古い順）
  const seq = [];          // この解法の問題を解いた記録（古い順）
  for (const l of state.log) {
    if (!ids.has(l.p) || !entryById.has(l.p)) continue;
    if (!per.has(l.p)) per.set(l.p, []);
    per.get(l.p).push(l);
    seq.push(l);
  }
  const n = per.size;
  let sw = 0, ss = 0;
  const full = [], recall = [], wrong = [], fields = new Set(), lapses = [], transfer = [], noRecall = [], recalledButMissed = [];
  let retained = false;
  for (const [pid, ls] of per) {
    const e = entryById.get(pid);
    const last = ls[ls.length - 1];
    const w = (main.has(pid) ? 1 : 0.5) * (1 + 0.25 * e.lv);
    sw += w; ss += w * (last.g >= 3 ? 1 : last.g === 2 ? 0.5 : 0);
    if (last.g >= 3) {
      full.push(pid); fields.add(e.f);
      const self = ls.filter(l => l.g >= 3 && l.k !== 't' && l.r !== 3);
      if (self.length) recall.push(pid);
      if (ls.some(l => l.g >= 3 && l.r === 3)) noRecall.push(pid);
      const c = ctx ? ctx(pid) : null;
      if (self.length && c && (c.cross || c.combo || c.hidden)) transfer.push(pid);
      // 間をあけて（3日以上）もう一度完答した問題があるか
      const prev = ls.slice(0, -1).filter(l => l.g >= 3);
      if (prev.length && last.t - prev[prev.length - 1].t >= 3 * DAY) retained = true;
    } else {
      wrong.push(pid);
      if (last.r === 1 || last.r === 2) recalledButMissed.push(pid);
      if (ls.slice(0, -1).some(l => l.g >= 3) && now - last.t <= 30 * DAY) lapses.push(pid);
    }
  }
  const score = n >= 3 ? (ss + 1) / (sw + 2) : null;
  const last2 = seq.slice(-2);
  const twoMiss = last2.length === 2 && last2.every(l => l.g < 3);
  let status;
  if (!n) status = 'none';
  else if ((score != null && score < 0.5) || lapses.length || twoMiss) status = 'review';
  else if (full.length >= MASTER.full && recall.length >= MASTER.recall && transfer.length >= MASTER.transfer && retained && score >= MASTER.score) status = 'mastered';
  else status = 'learning';
  const lastT = seq.length ? seq[seq.length - 1].t : 0;
  return { status, n, score, full, recall, wrong, lapses, fields: [...fields], retained, twoMiss, lastT, transfer, noRecall, recalledButMissed };
}

// 習得の基準ごとの達成状況（画面の「習得まで」に使う）
// 解法と問題の「文脈」：データから判定できるものだけ。dominant はその解法の問題が最も多い分野
export function makeCtx(tech, entryById, byProblem) {
  const cnt = {};
  for (const id of tech.ids) { const e = entryById.get(id); if (e) cnt[e.f] = (cnt[e.f] || 0) + 1; }
  const dominant = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const main = new Set(tech.main || []);
  return (pid) => {
    const e = entryById.get(pid);
    const others = ((byProblem && byProblem.get(pid)) || []).filter(x => x.id !== tech.id);
    return { cross: !!e && e.f !== dominant, combo: others.length > 0, hidden: !main.has(pid), dominant };
  };
}

export function masterChecklist(m) {
  return [
    { label: `完答した問題 ${MASTER.full}問`, now: m.full.length, need: MASTER.full },
    { label: `解法を知らされずに完答 ${MASTER.recall}問（今日の演習・分野の演習などで）`, now: m.recall.length, need: MASTER.recall },
    { label: `違う文脈（別の分野・他の解法と組み合わせ・補助として使う問題）で完答 ${MASTER.transfer}問`, now: m.transfer.length, need: MASTER.transfer },
    { label: '3日以上あけて、同じ問題をもう一度完答', now: m.retained ? 1 : 0, need: 1 },
    { label: `得意度 ${Math.round(MASTER.score * 100)} 以上`, now: m.score == null ? 0 : Math.round(m.score * 100), need: Math.round(MASTER.score * 100) },
  ].map(x => ({ ...x, ok: x.now >= x.need }));
}

// 解法ごとの推薦の候補（pickToday に渡す）
//   review   … 要復習の解法（得意度の低い順）
//   fresh    … 未学習で、必須の前提（pre）がすべて学習済み以上の解法（主な問題の多い順）
//   transfer … 完答したことがあり、まだ転用を確かめていない解法（違う文脈の未着手の問題があるもの）
// ctxOf(tech) → (pid → { cross, combo, hidden })（省略可）
export function techCandidates(state, techs, entryById, now = Date.now(), ctxOf = null) {
  const ms = new Map(techs.map(t => [t.id, techMastery(state, t, entryById, now, ctxOf ? ctxOf(t) : null)]));
  const review = techs.filter(t => ms.get(t.id).status === 'review')
    .sort((a, b) => (ms.get(a.id).score ?? 0.5) - (ms.get(b.id).score ?? 0.5));
  const fresh = techs.filter(t => ms.get(t.id).status === 'none' && t.main.length && t.pre.every(p => ms.has(p) && ms.get(p).status !== 'none'))
    .sort((a, b) => b.main.length - a.main.length);
  const transfer = techs.filter(t => {
    const m = ms.get(t.id);
    if (!m.full.length || m.status === 'review' || m.transfer.length) return false;
    const c = ctxOf ? ctxOf(t) : null;
    return !!c && t.ids.some(id => !state.problems[id] && entryById.has(id) && (c(id).cross || c(id).combo));
  }).sort((a, b) => ms.get(b.id).full.length - ms.get(a.id).full.length);
  return { ms, review, fresh, transfer };
}
