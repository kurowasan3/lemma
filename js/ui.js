// アイコン・効果音・テーマ・アプリの鳥「ルート」
export const FILE_VERSION = '0.32.0';

// ---------------------------------------------------------------- アイコン（線画、currentColor）
const S = (body, extra = '') => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
export const ICON = {
  // 自信度：自信なし（?）・たぶん（半分の円）・確実（チェック付きの円）
  low: S('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 3"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.1" fill="currentColor"/>'),
  mid: S('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity=".55"/>'),
  high: S('<circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.8 12.4l2.8 2.8 5.6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // 採点：完答（二重丸）・一部正解（三角）・不正解（×）
  full: S('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="2"/>'),
  part: S('<path d="M12 3.8l8.6 15.4H3.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  none: S('<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  ok: S('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  ng: S('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  self: S('<path d="M4 20l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7.5l3 3" stroke="currentColor" stroke-width="1.8"/>'),
  hint: S('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
  cases: S('<path d="M5 4v16M5 7h4M5 17h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 7h7M12 17h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  sound: S('<path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
};

// ---------------------------------------------------------------- 効果音（音声ファイルを使わず合成）
let ctx = null;
let soundOn = true;
export function setSound(on) { soundOn = on; }
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, start, dur, { type = 'sine', gain = 0.16, glide = null } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
export function play(name) {
  if (!soundOn) return;
  try {
    switch (name) {
      case 'correct': tone(1046.5, 0, 0.16); tone(1318.5, 0.09, 0.32); break;            // ド→ミ
      case 'full': tone(784, 0, 0.14); tone(1046.5, 0.08, 0.16); tone(1318.5, 0.16, 0.42); break;
      case 'part': tone(659.3, 0, 0.18, { gain: 0.12 }); tone(784, 0.1, 0.3, { gain: 0.12 }); break;
      case 'wrong': tone(233, 0, 0.26, { type: 'triangle', gain: 0.2, glide: 175 }); break;
      case 'tap': tone(1600, 0, 0.04, { gain: 0.05 }); break;
      case 'finish': [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.4, { gain: 0.12 })); break;
      case 'bird': tone(2637, 0, 0.07, { gain: 0.05, glide: 3136 }); tone(2794, 0.1, 0.09, { gain: 0.05, glide: 3520 }); break;
    }
  } catch { /* 音が出せない環境 */ }
}

// ---------------------------------------------------------------- テーマ（自動・ライト・ダーク）
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode; else delete root.dataset.theme;
  const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0b1424' : '#1d3050'));
}

// ---------------------------------------------------------------- 鳥「ルート」
// 丸いエナガ風の小鳥（オリジナル）。色はテーマに合わせて CSS 変数から
export const BIRD_SVG = `<svg viewBox="0 0 64 64" class="bird-svg" aria-hidden="true">
  <path d="M50 38c6 1 10 4 11 8-4 0-8-1-12-3z" fill="var(--bird-dark)"/>
  <ellipse cx="31" cy="35" rx="21" ry="19" fill="var(--bird-body)"/>
  <path d="M18 40c4 9 22 11 30 2-3 8-10 11-16 11-8 0-13-5-14-13z" fill="var(--bird-belly)"/>
  <path d="M37 33c6-2 12 1 13 6-6 2-11 0-13-6z" fill="var(--bird-dark)" opacity=".9"/>
  <circle cx="23.5" cy="29" r="3" fill="var(--bird-eye)"/><circle cx="24.4" cy="28" r="1" fill="#fff"/>
  <path d="M13.5 31l-5 2 5 2z" fill="var(--bird-beak)"/>
  <ellipse cx="19" cy="35.5" rx="3.2" ry="2" fill="var(--bird-cheek)" opacity=".7"/>
  <path d="M27 54l-1.5 5M34 54l1.5 5" stroke="var(--bird-dark)" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

export const BIRD_NAME = 'ルート';

const HEALTH = [
  'お身体は大丈夫ですか？ 肩に力が入っていたら、一度深呼吸しましょう。',
  '水分はとっていますか？ のどが渇く前に一口どうぞ。',
  '20分ごとに、20秒ほど遠くを見ると目が楽になります。',
  '背中が丸まっていませんか？ 画面は目の高さに近づけて。',
  '眠気が強いときは、5〜15分の短い仮眠も手です。',
  '手首と指を軽くほぐしましょう。ペンを持つ手も休ませてあげて。',
  '部屋の空気、こもっていませんか？ 窓を少し開けると頭がすっきりします。',
  'ゆっくり4秒吸って、6秒で吐く。これを3回で、気持ちが落ち着きます。',
  '首を左右にゆっくり倒してみよう。じんわり伸びるのが分かるはず。',
  '画面が明るすぎると目が疲れます。部屋の明るさと合わせてみて。',
  'おなかが空いていると集中が続きません。軽く何か食べてからでも大丈夫。',
  '座りっぱなしが続いたら、一度立って歩くだけでも血のめぐりが変わります。',
];
const ADVICE = [
  '解説を読み返すより、閉じてもう一度解いてみる方が記憶に残ります（想起練習）。',
  '同じ問題を一気にやるより、日をあけて解き直す方が長持ちします（分散学習）。',
  '分野を混ぜて解くと「どの解法を使うか」を選ぶ力がつきます。',
  '間違えた問題は宝です。どこで道を誤ったか、1行で書いておこう。',
  '答えを見る前に「なぜその方針か」を説明してみると、理解が深まります。',
  '自信があったのに外した問題は、検算の習慣で防げます。',
  '解けない問題は、条件を1つ外した易しい問題から考えてみよう。',
  '眠っている間に記憶は整理されます。夜ふかしより、早めに寝る方が得です。',
  '計算はスピードより正確さから。正確になれば速さは後からついてきます。',
  '図やグラフを描くと、式だけでは見えない構造が見えてきます。',
  'n=1, 2, 3 と小さい場合を手で試すと、規則が見えてくることが多いです。',
  '答えが出たら、極端な値（0 や 1、端の点）を入れて確かめてみよう。',
  '「求めるもの」と「使える条件」を最初に書き出すと、方針が立てやすくなります。',
  '場合分けは「もれなく・重なりなく」。境界の値がどちらに入るかを必ず確認。',
  '行き詰まったら、結論から逆にたどってみよう。何が言えれば終わるかを考えます。',
  '同値変形か、必要条件だけか。矢印の向きを意識すると答案が引き締まります。',
  '対称性に気づくと、計算が半分になることがあります。',
  '答案は「読む人に伝わるか」が大事。式と式の間に一言の説明を入れよう。',
  '5分考えて手が動かなければ、ヒントを1つ見るのも立派な作戦です。',
  '解き終わった問題こそ、別の解き方がないか考えると力がつきます。',
  '苦手な分野は、短い時間でもいいので毎日少しずつ触れるのが近道です。',
  '単位や次元、符号の確認は、答えを見直すいちばん速い方法です。',
  '定義に戻ると解ける問題は意外と多いです。言葉の意味を確かめてみよう。',
  '「なんとなく正しい」は要注意。反例が作れないか、少しだけ疑ってみて。',
];
const QUOTES = [
  ['数学の本質は、その自由性にある。', 'ゲオルク・カントール'],
  ['我々は知らねばならない。我々は知るであろう。', 'ダフィット・ヒルベルト'],
  ['問題を解くことは、泳ぐことと同じように、実践で身につく技術である。', 'ジョージ・ポリア'],
  ['解けない問題があるなら、それより易しくて解ける問題がある。それを見つけよ。', 'ジョージ・ポリア'],
  ['数学とは、異なるものに同じ名前を与える技術である。', 'アンリ・ポアンカレ'],
  ['千里の行も足下に始まる。', '老子'],
  ['学びて思わざれば則ち罔し、思いて学ばざれば則ち殆し。', '孔子『論語』'],
  ['為せば成る、為さねば成らぬ何事も。', '上杉鷹山'],
  ['純粋数学は、それなりのやり方で、論理的な思考の詩である。', 'アルベルト・アインシュタイン'],
  ['幾何学に王道なし。', 'ユークリッド（とされる）'],
  ['数学は科学の女王であり、数論は数学の女王である。', 'カール・フリードリヒ・ガウス'],
  ['私が遠くを見ることができたのは、巨人の肩に乗っていたからだ。', 'アイザック・ニュートン'],
  ['これを知る者はこれを好む者に如かず。これを好む者はこれを楽しむ者に如かず。', '孔子『論語』'],
  ['故きを温ねて新しきを知る。', '孔子『論語』'],
  ['数学において、問いを立てる技術は、それを解く技術よりも価値がある。', 'ゲオルク・カントール'],
  ['継続は力なり。', 'ことわざ'],
  ['急がば回れ。', 'ことわざ'],
  ['七転び八起き。', 'ことわざ'],
];
// あいさつ（時間帯ごと）
const GREET = {
  night: ['こんばんは。夜遅くまでおつかれさま。', '夜ふかしさん、こんばんは。無理はしないでね。', 'こんな時間まで勉強とは、えらいです。'],
  morning: ['おはようございます。', 'おはよう！ 朝の頭はよく働きます。', 'おはようございます。今日も1問ずつ進めよう。', '朝の勉強、いいスタートです。'],
  day: ['こんにちは。', 'こんにちは！ 今日はどの分野にしますか？', 'こんにちは。すきま時間の1問も立派な積み重ねです。', 'やあ、来てくれてうれしいです。'],
  evening: ['こんばんは。', 'こんばんは。今日もおつかれさまでした。', 'こんばんは！ 夜の静かな時間は集中しやすいですね。', 'こんばんは。寝る前の復習は記憶に残りやすいですよ。'],
};
const LATE = [
  'もう遅い時間です。今日はここまでにして、ぐっすり眠ろう。睡眠中に記憶が整理されます。',
  '深夜です。眠いまま解くより、寝て明日解く方がずっと身につきます。',
  'そろそろ寝る時間ですよ。今日がんばった分は、眠っている間に定着します。',
  '夜ふかしは明日の集中力を削ります。続きは明日、すっきりした頭で。',
];
const BREAK_SHORT = [
  '{min}分たちました。少し目を閉じて休憩しませんか？',
  '{min}分がんばりました。1分だけ遠くを見て、目を休めよう。',
  '{min}分経過。ここで水を一口どうぞ。',
  '{min}分集中できています。肩を回して、ひと呼吸おこう。',
];
const BREAK_LONG = [
  '{min}分続けて勉強しています。お身体は大丈夫ですか？ 5〜10分、立って体を伸ばしましょう。',
  '{min}分たちました。いったん席を立って、少し歩いてきませんか？',
  '{min}分の長丁場です。休憩をはさむと、後半の集中力が戻ってきます。',
];
const SUMMARY = {
  perfect: ['全部自力で解けました！ 次は難易度を1つ上げてみては？', '全問自力で完答！ すばらしいです。', 'パーフェクト！ この調子で、日をあけてもう一度解けたら本物です。', '全部解けましたね。余裕があれば、別解も考えてみよう。'],
  hard: ['難しかったですね。でも、難しく感じた日の方があとで伸びます。間違えた問題は近いうちにまた出します。', '手ごわいセットでしたね。解説の「核となるアイデア」だけでも、もう一度見ておこう。', 'くやしい問題が多かったかも。そのくやしさが次の1問につながります。', '今日は苦戦しましたね。でも、つまずいた所が分かったのは大きな収穫です。'],
  normal: ['おつかれさま。間違えたところは、復習で必ず取り返せます。', 'おつかれさまでした！ 少しずつ、確実に前に進んでいます。', 'いい演習でした。解けなかった問題は、日をあけてまた挑戦しよう。', 'おつかれさま。今日の1セットが、本番の1点になります。'],
};

export function birdMessage(kind, ctxInfo = {}) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const h = new Date().getHours();
  if (kind === 'late') return pick(LATE);
  if (kind === 'break') return pick(ctxInfo.min >= 50 ? BREAK_LONG : BREAK_SHORT).replace('{min}', ctxInfo.min);
  if (kind === 'summary') {
    const { solo = 0, missed = 0, n = 0 } = ctxInfo;
    if (n && solo === n) return pick(SUMMARY.perfect);
    if (n && missed >= n / 2) return pick(SUMMARY.hard);
    return pick(SUMMARY.normal);
  }
  if (kind === 'greet') {
    const g = pick(h < 5 ? GREET.night : h < 11 ? GREET.morning : h < 18 ? GREET.day : GREET.evening);
    const r = Math.random();
    if (r < 0.3) return g + pick(HEALTH);
    if (r < 0.7) return g + pick(ADVICE);
    const q = pick(QUOTES); return `${g}今日のことば：「${q[0]}」（${q[1]}）`;
  }
  const r = Math.random();
  if (r < 0.3) return pick(HEALTH);
  if (r < 0.65) return pick(ADVICE);
  const q = pick(QUOTES); return `「${q[0]}」\n― ${q[1]}`;
}
// 掛け声の種類ごとの数（テスト用）
export const BIRD_LINES = { HEALTH, ADVICE, QUOTES, GREET, LATE, BREAK_SHORT, BREAK_LONG, SUMMARY };
