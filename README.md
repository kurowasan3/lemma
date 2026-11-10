# Lemma 受験数学

答えを見せるのではなく、自力で解ける頭をつくる大学受験数学アプリ（試作版 v0.9）。
iPhone・iPad のブラウザで動き、ホーム画面に追加するとアプリとして使えます（PWA）。

## できること

- **全分野からランダム**：数I〜数Cの全範囲から、単元を混ぜて出題（交互練習）
- **分野ごとに演習**：科目または単元をタップして出題。難易度と問題数を指定でき、未着手・久しぶりの問題を優先
- **復習**：解法ごとに忘れ方を推定し、忘れかけたものを出題
- **段階ヒント**：答えは出さず、方針 → 道具 → 最初の一手の3段階
- **自信度**：答える前に「自信なし / たぶん / 確実」を選び、過信とのズレを記録
- **答えを入力して自動採点**：証明・図示以外は答えを入力。`2x/(1+x^2)` と `2x/(x^2+1)` のように書き方が違っても同じなら正解（乱数代入で判定）。範囲・順不同の組・比・積分定数つきの式にも対応し、場合分けが要る答えは「場合分けする」ボタンで条件ごとに入力
- **判定がおかしい？**：正しいはずなのに×のときは、その欄を正解として記録（CSVに残る）
- **計算トレーニング**：微分・積分・極限・展開と因数分解・三角関数・指数対数を、その場で作る問題で反復。自己ベストを記録
- **ルート（鳥）**：休憩や体調を気づかう声かけ、勉強のアドバイス、名言（アプリを開いているあいだだけ）
- **アカウントと同期**：メールに届くコードでログインすると、学習記録を複数の端末で使え、サーバーにも保存される（Supabase）。ログインしなければ今まで通り端末の中だけ
- **ライト／ダーク**：設定で 自動・ライト・ダーク を選択。採点の効果音（オン・オフ可）
- **予想してから描く**：グラフの概形を指で描き、本物と重ねて見比べる
- **グラフ電卓（2D）**：陽関数・陰関数・不等式の領域（連立も可）・媒介変数・極座標・点・スライダー
- **グラフ電卓（3D）**：`z=f(x,y)`、平面・球・楕円面など z について2次までの式、空間曲線、媒介変数曲面、点。ドラッグで回転
- **定着度**：科目のレーダー図と分野ごとの色分けで得意・苦手がひと目でわかる（タップでその分野を演習）。自信と結果のズレも
- **検索**：テーマ・タグ・問題文の言葉で問題を探す（表記ゆれ・言い換えはタグ辞書でまとめて検索）。結果からそのまま演習
- **問題セット**：「基礎ひとまわり」などのセットを順番に。`#set=<ID>`（セット）・`#ids=<問題ID,…>`（問題）・`#search=<言葉>`（検索）のリンクで共有できる
- オフライン動作、記録の書き出し・読み込み

収録範囲：問題管理表の 4,075問（20分野）＋ 自動判定つきの内蔵問題 61問。難易度は 0=基礎・1=標準・2=2次基礎・3=国立2次・4=難関・5=最難関 の6段階（「今日」の難易度ボタンで絞り込める。基礎だけを選べば易しいセットになる）。

## 問題管理表から問題を取り込む

問題は `Lemma問題管理表.xlsx`（問題一覧シート）で管理し、スクリプトで「正規データ `content/`」と「アプリ用データ `data/`」に変換します（形式の詳細は [docs/data-spec.md](docs/data-spec.md)）。

```sh
pip3 install openpyxl jsonschema
python3 tools/import_xlsx.py Lemma問題管理表.xlsx          # content/ と data/ を作り直す
node tests/run.mjs                                       # 検査（全部 ✓ になればOK）
```

更新するときの手順：

1. いまのリポジトリの zip と管理表を、日付を付けて保存しておく（戻すとき用）
2. 上の2行を実行。`--check` を付けると、書き出さずに「今のファイルと違うか」だけ確かめられる
3. `content`・`data`・`tests` フォルダごとリポジトリにアップロード（一部だけだと「問題データの版が揃っていません」と表示されます）
4. GitHub の「Actions」タブで ✓ になっているか確認

- **管理表（xlsx）はリポジトリに入れない**（参考元を含むため）。「参考元」「メモ」は content/・data/ に出しません。`python3 tools/audit_data.py --xlsx Lemma問題管理表.xlsx` で漏れがないか確かめられます
- 分野ID（`I-01` など）は `content/taxonomy.json` で固定されていて、「分野一覧」シートの並びを変えても変わりません。新しい分野を足すときは `--new-fields` を付けて取り込みます
- 問題ID は変えない・消さない。消えると `tests/golden/ids.txt` との照合で検査が失敗します。出さない問題はタグに `非表示`（`content/` には残る）
- 問題を追加して検査が「問題ID の台帳」で止まることはありません（増えるのは自由）。台帳を最新にするには `python3 tools/audit_data.py --write-golden`
- 数式は `$...$` と `\[...\]`、文章の `enumerate`・`itemize`・`tabular`・`\textbf`・`\fbox` などは自動で変換します。難易度は 0=基礎 〜 5=最難関
- 問題セットを作るとき：`content/collections/` に既存のファイルをまねて JSON を置き、`python3 tools/build_app_data.py`。問題ID の並びがそのまま出題順
- タグの言い換えをまとめるとき：`content/tags.json` の該当タグの `aliases` に別の表記を足して `python3 tools/build_app_data.py`
- 前の方法（Excel → data/ を直接）に戻すとき：`python3 tools/import_xlsx.py Lemma問題管理表.xlsx data --legacy`

### 入力用の答え（T列）

アプリの自動採点は「入力用の答え」列を正とします。書き方は管理表の「使い方」シートにあります。要点：

```
(1) $c_4$：1 ; $c_3$：0          ← 小問ごとに1行、欄は「 ; 」、ラベルは全角「：」
(2) {(10, 60), (28, 42)}        ← { } は順不同、( ) は順序あり
(3) -16<k<9                     ← 範囲（または・かつ・なし・すべての実数）
(4) 場合分け{ p<=1/2 → 2p+1 | p>1/2 → 2-2p }
(5) 証明                         ← 証明・図示・記述 は自己採点
```

空欄の問題は従来どおり記述式（紙に解く → 答え合わせ → 自己採点）。編集したら検査してください：

```sh
python3 tools/import_xlsx.py Lemma問題管理表.xlsx
node tools/check_answers.mjs data   # 入力用の答えが読めるか・自己整合するか
node tools/check_katex.cjs          # 数式がすべて描画できるか
```

新しい問題をまとめて作ったときは、管理表に入れる前に `python3 tools/validate_new.py 新しい問題.json` で検査できます（書式・KaTeX・入力用の答え・答え列との SymPy 照合・既存問題との重複）。

`tools/build_input_answers.sh` は、「答え」列（LaTeX）から入力用の答えを自動で下書きし、SymPy で元の答えと一致するか照合する一式です（初回の一括作成に使用）。

### 弟テスト記録

設定 →「テスト記録の書き出し」で CSV を書き出せます（日付・問題ID・科目・分野・難易度・正誤・所要時間・手応え・どこで詰まったか・感想）。手応えは 1=手が出ない 〜 5=余裕。「判定がおかしい？」を押した欄は感想列に残ります。

## アカウントと同期（Supabase）

- 接続先は `js/config.js`（Project URL と Publishable key。公開してよい値だけ。Secret key は書かない）。空にすると同期の機能は出ない
- データベースの準備は `supabase/schema.sql` を SQL Editor で1回実行する（1人1行の表 `lemma_state` と、退会用の関数）
- ログインはメールの **コード**（iPhone のホーム画面アプリは Safari と保存領域が別なので、リンクではなくコードを入れる方式）。
  Supabase の Authentication → Emails の「Magic link」と「Confirm signup」の本文に `{{ .Token }}` を入れておく
- 記録の合わせ方：解答の記録は両方を足し合わせ、復習の予定は問題ごとに新しい方、設定は最後に変えた方（`js/sync.js` の `mergeState`）。2台が同時に書いても、版番号で取り直して合わせ直す
- Supabase の標準のメール送信は、プロジェクトのメンバーのアドレスにしか送れず、1時間に数通まで。ほかの人に使ってもらうときは Authentication → Emails → SMTP Settings で外部のメール送信サービスを設定する

## GitHub Pages で公開する

1. GitHub で新しいリポジトリを作る（例：`lemma-math`、Public）
2. このフォルダの中身を**そのまま**リポジトリの直下にアップロード
   - Web から：「Add file」→「Upload files」に、フォルダの中身（`index.html` など）をまとめてドラッグ
   - ターミナルから：
     ```sh
     cd lemma
     git init && git add . && git commit -m "Lemma v0.1"
     git branch -M main
     git remote add origin https://github.com/<ユーザー名>/lemma-math.git
     git push -u origin main
     ```
3. リポジトリの「Settings」→「Pages」→ Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save
4. 1〜2分後に `https://<ユーザー名>.github.io/lemma-math/` で開ける
5. iPhone の Safari で開き、共有ボタン →「ホーム画面に追加」

更新したときは `sw.js` の `VERSION` を上げると、端末のキャッシュも入れ替わります。

## 問題を追加する

`js/content.js` の `PROBLEMS` に追記します。数式は `$...$`（KaTeX）。

```js
{
  id: 'q62', cards: ['sixth'], level: 2, type: 'num',
  q: String.raw`放物線 $y=x^2-1$ と $x$ 軸で囲まれた部分の面積を求めよ。`,
  ans: '4/3',
  hints: ['…', '…', '…'],
  sol: String.raw`…`,
  graph: ['y=x^2-1', 'x^2-1<=y<=0'],
},
```

| type | 答え方 | 判定 |
| --- | --- | --- |
| `num` | 数（`14/3`, `e^2`, `pi/4` も可） | 値が一致 |
| `expr` | 文字式 | `vars` の範囲で乱数を代入して一致 |
| `nums` | カンマ区切りの数 | 順不同で一致 |
| `choice` | 選択肢（`choices[0]` が正解） | 表示時にシャッフル |
| `sketch` | グラフを指で描く | 本物と重ねて自己評価 |

`cards[0]` がその問題の主な解法です。新しい解法カードは `CARDS` に追加し、`pre` に前提カードを書きます。

## 構成

```
index.html            画面の骨組み
css/style.css         見た目（ライト／ダーク対応）
js/app.js             画面と学習ループ
js/parser.js          数式パーサ、TeX変換、答えの同値判定
js/graph.js           グラフ描画エンジン（2D, Canvas）
js/graph3d.js         3Dグラフ
js/catalog.js         問題データの読み込み・出題の組み立て
js/answer.js          入力用の答えの読み取りと採点（範囲・集合・場合分け）
js/drill.js           計算トレーニング（問題の自動生成）
js/ui.js              アイコン・効果音・テーマ・鳥のルート
js/sync.js            アカウント（メールのコードでログイン）と学習記録の同期
js/config.js          同期の接続先（公開してよい値だけ）
privacy.html          プライバシーポリシー
supabase/schema.sql   同期用のデータベースの定義
content/              正規データ（LaTeX のまま。taxonomy.json＝分野ID、problems/＝問題、methods.json＝解法）
data/                 アプリ用データ（content/ から tools/build_app_data.py で生成）
docs/data-spec.md     データ仕様
tools/                取り込み・変換・検査スクリプト（import_xlsx.py が入口）、schema/＝JSON Schema
tests/                検査（run.mjs がまとめ役、e2e.mjs＝ブラウザでの通し操作、golden/＝問題ID の台帳）
content/tags.json     タグ辞書（正規名と別名。手で直してよい）
content/collections/  問題セット（1セット1ファイル。order＝表示順）
js/scheduler.js       復習間隔の推定（FSRSを簡略化）と出題の組み立て
js/content.js         単元・解法カード・問題
sw.js                 オフライン用キャッシュ
vendor/               KaTeX 0.16（MIT License）
```

ビルド不要。ローカルで試すときは `python3 -m http.server` を実行して `http://localhost:8000` を開きます。

## 設計の根拠

- 想起練習・分散学習：Dunlosky et al. (2013), *Psychological Science in the Public Interest*
- 交互練習：Rohrer et al. (2020), *Journal of Educational Psychology*（中1・787人の無作為化試験）
- 答えを出さないAI支援：Bastani et al. (2025), *PNAS*

難関・最難関レベルでの効果は未検証です。記録データ（書き出しJSON）を使って、自分で効果を確かめることを想定しています。
