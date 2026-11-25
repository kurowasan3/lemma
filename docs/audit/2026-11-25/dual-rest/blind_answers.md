# ブラインド解答（93問）

- 作成日：2026-11-25
- 作成条件：リポジトリ外の空の作業ディレクトリ（`/tmp/blind-dual-rest`）で作成。`docs/audit/2026-11-25/dual-rest/problems.md` の1ファイルだけを GitHub API で単体取得して使用し、リポジトリのクローン・他ファイルの閲覧・Git の履歴／差分／ブランチの参照は一切していない。
- 数値・数え上げの答えは、作業ディレクトリ内の自作スクリプト（総当たり・数値計算・記号計算）で検算済み。
- 記法：「証明」と書いた小問は証明問題。要点のみ記す（主張が成り立つことを確認済み）。

---

## B-SEQ-299
1. 証明。$2T_n-(n+1)S_n=\sum_{k=1}^n(2k-n-1)r^{k-1}$ に $(1-r)$ を掛けて整理。右辺 $=-\sum_{j=1}^{n-1}(1-r^j)(1-r^{n-j})$ と書ける。
2. $r>1$ のとき正，$-1<r<1\ (r\neq0)$ のとき負。

## B-SEQ-329
1. 証明。
2. 条件：$q>1$ かつ $c\geqq\dfrac1{q-1}$。すべての $n$ で等号：$q>1,\ c=\dfrac1{q-1}$。
3. $q>1$ のとき $-1<c\leqq\dfrac1{q-1}$；$0<q\leqq1$ のとき $c>-1$。

## II-LOG-095
1. 証明。
2. 三角形：$0<x<x_0$。鈍角三角形：$\dfrac{x_0}2<x<x_0$。
3. $1\leqq x<x_0$（$3,5,7$ の三角形の最大角がちょうど $120^\circ$ になるのが $x=1$）。

## III-DIF-402
1. 証明。
2. 証明。
3. 不等式は証明。$\displaystyle\lim_{a\to+0}\frac{x_0}{\sqrt a}=\sqrt2$。

## III-LIM-313
1. 証明。
2. 証明。
3. 証明。

## X-MIX-091
1. 証明。
2. 証明。
3. 解の個数：$1203$ 個（解は $x\equiv1,3,7\pmod{10}$ の整数）。存在例：$f(x)=\cos\dfrac{\pi(x-2)}{10}\left(\cos\dfrac{\pi(x-2)}5-\cos\dfrac\pi5\right)$。

## A-COM-497
1. 証明。
2. 証明（各段で自分と $3^{j-1}$，$2\cdot3^{j-1}$ 離れたものを読む）。
3. $5$（$3^4=81<100$ より $5$ 以上。$100=25\times4$ とし，$25$ 台は $3$ 単位時間，$4$ 組の結合に $2$ 単位時間で完了）。

## A-COM-499
1. 証明。
2. 証明。
3. 証明。
4. 例：$P=\{(a,b,a+b,a+2b)\ (\mathrm{mod}\ 3)\}$，すなわち
   $0000,\ 0112,\ 0221,\ 1011,\ 1120,\ 1202,\ 2022,\ 2101,\ 2210$。どの2つの距離も $3$。

## A-COM-500
1. 証明。
2. 証明。
3. $n=2r$：$(r!)^2$ 個。$n=2r+1$：$(2r+1)(r!)^2$ 個。
4. $n-1$ 個（隣接互換）。

## A-COM-501
1. $E(i,j,k)-E(j,i,k)=p_jc_i-p_ic_j$，$E(i,j,k)-E(i,k,j)=(1-p_i)(p_kc_j-p_jc_k)$。
2. 証明。
3. 最小にする順番：$(\mathrm X_2,\mathrm X_1,\mathrm X_3)$，最小値 $\dfrac{29}5$。成功確率の大きい順 $(\mathrm X_3,\mathrm X_1,\mathrm X_2)$ のとき $E=\dfrac{67}{10}$。

## A-COM-509
1. $r_3=p^3-q^3=(p-q)(1-pq)$，$r_4=p^4-q^4=(p-q)(1-2pq)$（$q=1-p$）。$r_4<r_3$ は証明。
2. 証明。

## A-COM-511
1. $\dfrac{n!\,(n-2)(2n-3)}2$ 個。
2. $\dfrac{n!\,n(n-2)}2$ 個。

## A-COM-513
1. 証明。
2. $\dbinom{2n}{n}$ 個。
3. $\dbinom{2n}{\,n+\lceil r/2\rceil\,}$ 個（$r=2j$ または $2j-1$ のとき $\dbinom{2n}{n+j}$）。

## A-GEO-114
1. 証明。
2. $\mathrm{EF}=\dfrac72$，$\mathrm{FD}=\dfrac{39}{14}$，$\mathrm{DE}=\dfrac{55}{14}$，内接円の半径 $\dfrac{15\sqrt3}{28}$。

## A-GEO-115
1. 証明。
2. 証明。

## A-INT-454
1. 第 $12$ 項。
2. $x_{20}$。
3. $P_3$：$9$ 個，$P_4$：$27$ 個。

## A-INT-457
1. 証明。
2. 証明。
3. $N+1$ が平方数でないこと（$N+1$ が平方数のときは $q$ と $q+1$ を交互にとる）。

## B-SEQ-295
1. 等式は証明。$p=\dfrac18$，一定の値 $\dfrac1{1600}$。
2. 不等式は証明（$a_n$ は狭義単調増加）。$a_n=\dfrac1{40}$ となるのは $n=1$ のみ。

## B-SEQ-303
1. 証明。
2. 証明。
3. 証明。

## B-SEQ-308
1. 証明。
2. $a_2=8\cdot3^k,\ 8\cdot3^k-1,\ 10\cdot3^k,\ 10\cdot3^k-1,\ 40\cdot3^k,\ 40\cdot3^k-1$（$k=1,2,3,\cdots$）。
   すなわち $23,24,29,30,71,72,89,90,119,120,215,216,\cdots$。いずれも周期列 $8,32,40,72,24$ の巡回に入る。

## B-SEQ-311
1. 証明。
2. 証明。
3. $a_n=(-2)^m(3m+1-3n)$（$m$ は正の整数），そのとき $M=\{m,\ m+1,\ m+3\}$。
   （例：$m=1$ で $a_n=6n-8$，$M=\{1,2,4\}$）

## B-SEQ-314
1. 証明。
2. 証明。
3. 証明。

## B-SEQ-325
1. $a_1\geqq0$（公差 $3$），$a_1=-3$（$-3,0,3,\cdots$），$a_1=-\dfrac34$，$a_1=-\dfrac32$（定数列）。
2. $-\dfrac94\leqq a_1\leqq-\dfrac34$。

## B-SEQ-331
1. 証明。
2. 3つ。
   - $a_3=1$：$a_{2m-1}=1$，$a_{2m}=7\cdot4^{m-1}-4$。
   - $a_3=4$：$a_{2m-1}=3m-2$，$a_{2m}=3m$。
   - $a_3=8$：$a_{2m-1}=7\cdot2^{m-1}-6$，$a_{2m}=3$。
3. 順に $S_{2m}=\dfrac{7(4^m-1)}3-3m$，$S_{2m}=3m^2+m$，$S_{2m}=7\cdot2^m-3m-7$。

## B-SEQ-332
1. $a_n=\dfrac{p^n}{p+2}+\left(a_0-\dfrac1{p+2}\right)(-2)^n$。
2. 「$1<p<2$ かつ $a_0=\dfrac1{p+2}$」または「$p\geqq2$ かつ $\dfrac{3-p}6<a_0<\dfrac13$」。

## B-SEQ-339
1. 証明。
2. $c$ の最大値 $\log_2\dfrac{27}{40}$（$=3\log_23-3-\log_25$。$n=1$ で等号）。

## B-SEQ-340
1. 証明。
2. $P_n=\dfrac1{a_n+1}$，$\displaystyle\lim_{n\to\infty}P_n=\frac12$。
3. 証明。

## B-SEQ-343
1. 証明。
2. 証明。
3. 証明。

## C-CUR-460
1. 証明。
2. $\dfrac13\leqq x_N\leqq\dfrac75$ かつ $x_N\neq1$。
   （$A(a^2,2a)$，$u=a-\frac1a$ とすると $x_N=\dfrac{u^2+u+2}{u^2-u+4}$。$u=1$ は $l\parallel\mathrm{AB}$ で除外され，$x_N=1$ は実現しない）

## C-CUR-462
1. $\mathrm{FA}+\mathrm{FB}+\mathrm{FP}=\dfrac92$（$\mathrm{FX}=2-\frac{x}2$ と重心の $x$ 座標 $1$ より）。
2. $1\leqq\mathrm{FA}<\dfrac94$ かつ $\mathrm{FA}\neq\dfrac98$。
   （よい点 $\Leftrightarrow -\frac12<x_A\leqq2,\ x_A\neq\frac74$）

## C-CUR-466
1. 証明。$\mathrm{AC}\cdot\mathrm{BD}=9$。
2. 証明。
3. 最小値 $9$，$\mathrm P\left(4,\ \pm\dfrac95\right)$。

## C-CUR-467
1. $\mathrm C\left(1+\cos\left(\theta-\dfrac\pi3\right),\ \sqrt3+\sin\left(\theta-\dfrac\pi3\right)\right)$。
   描く図形：中心 $(1,\sqrt3)$，半径 $1$ の円のうち，偏角 $\theta-\frac\pi3$ が $-\frac\pi3<\theta-\frac\pi3<\frac{2\pi}3$ の部分の弧（両端 $\left(\frac32,\frac{\sqrt3}2\right)$，$\left(\frac12,\frac{3\sqrt3}2\right)$ を除く）。
2. 最大値 $3$，$\theta=\dfrac{2\pi}3$。
3. 最大値 $1+\dfrac{\sqrt3}4$，$\theta=\dfrac{5\pi}6$。

## C-CUR-469
1. $q=\dfrac{b^2(x_1-a)}{ay_1}$，$q'=-\dfrac{b^2(x_1+a)}{ay_1}$。$qq'=-b^2$ は証明。$\mathrm{AQ}\cdot\mathrm{A'Q'}=b^2$。
2. 証明。
3. $\mathrm R\left(x_1,\ \dfrac{y_1}2\right)$。
4. 双曲線 $\dfrac{x^2}{a^2}-\dfrac{4y^2}{b^2}=1$ の $y\neq0$ の部分。

## C-CUR-471
1. 証明。
2. 直線 $x+2y=4$ 全体（A の極線）。
3. 等式は証明。$\mathrm{AP}\cdot\mathrm{AQ}=\dfrac2{1+3\sin^2t}$（$t$ は $\ell$ の方向角）。最大値 $2$（$\ell:\ y=\frac12$），最小値 $\dfrac12$（$\ell:\ x=1$）。

## C-CUR-473
1. $(2-t)x^2-2x-ty^2+t=0$，ただし $t\geqq1$ のとき $0<x<1$，$0<t<1$ のとき $0<x<\dfrac t{2-t}$。
2. $0<t<1$，$1<t<2$：双曲線；$t=1$：2直線；$t=2$：放物線；$t>2$：楕円。

## C-CUR-474
1. 証明。$\lambda=\dfrac{e^2-1}{2(ke^2+1)}$。
2. $e>\dfrac1k$，$\dfrac{1-k}{2k}<\lambda<\dfrac1{2k}$。
3. $\dfrac13<k<\dfrac12$，そのとき $e=\sqrt{\dfrac3{1-2k}}$。

## C-CUR-476
1. 証明。$\dfrac1\alpha+\dfrac1\beta=\dfrac{q-2k}4$。
2. 証明。$\dfrac1p+\dfrac1r=\dfrac q4$。
3. 証明（$q=0$ で $\frac1p+\frac1r=0$）。

## C-CUR-479
1. 証明。
2. 存在は証明。$\mathrm F_\theta\left(-3-\dfrac4{\tan\theta},\ -2+\dfrac4{\tan\theta}\right)$（$\theta=\frac\pi2$ では $(-3,-2)$）。
3. 直線 $x+y+5=0$ 全体。

## C-CUR-480
1. $\mathrm P(s+t,\ st)$。$\mathrm{FA}=s^2+1$，$\mathrm{FP}^2=\mathrm{FA}\cdot\mathrm{FB}$ は証明。
2. 証明。
3. 2本引けることは証明。最小値 $8$，$\mathrm P(2,-1)$。

## C-CUR-482
1. 中点の $x$ 座標 $\dfrac{4p}3$。$p$ の範囲：$-\dfrac32<p<\dfrac32,\ p\neq0$。
2. $0<|p|<\dfrac{3\sqrt3}4$，最大値 $4-\dfrac{4\sqrt3}3|p|$。

## C-CUR-484
1. $\mathrm P_\lambda\left(1-\dfrac3\lambda,\ -\dfrac32-\dfrac3{2\lambda}\right)$。
2. 直線 $x-2y-4=0$ から点 $\left(1,-\dfrac32\right)$ を除いたもの。$k_1+k_2=0$ のとき EF の傾きは $\frac12$ で平行（証明）。

## C-CUR-486
1. 定点 $\left(\dfrac32,\ 0\right)$。
2. 最大値 $\dfrac{7\sqrt3}9$，$l:\ y=\pm\sqrt6\left(x-\dfrac32\right)$。

## C-CUR-487
1. $\mathrm{MF}=\dfrac{3(4-x_0)}{4|y_0|}$。
2. $s=4$，一定の値 $\dfrac{\mathrm{MF}}{\mathrm{NF}}=\dfrac12$。

## C-CUR-489
1. 証明。
2. $e_1e_2\geqq\dfrac{\sqrt3}2$。
3. $e_1e_2>1$。

## C-VEC-452
1. 証明。
2. $1<\mathrm{OA}\leqq\dfrac{\sqrt6}2$。

## C-VEC-454
1. 証明。
2. 最大値 $12$。例：$\mathrm P(-\sqrt3,-1,0)$，$\mathrm Q(\sqrt3,1,0)$。
3. 最大値 $28$。例：$\mathrm P\left(-\dfrac3{\sqrt7},-\dfrac{\sqrt3}{\sqrt7},-\dfrac4{\sqrt7}\right)$，$\mathrm Q\left(\dfrac3{\sqrt7},\dfrac{\sqrt3}{\sqrt7},\dfrac4{\sqrt7}\right)$。

## C-VEC-455
1. 最大値 $\dfrac{216}{25}\pi$，$\alpha:\ 7y+24z=100$。
2. 最小値 $\dfrac{27}5\pi$，$\alpha:\ \pm3\sqrt{15}\,x+11y+12z=80$。

## C-VEC-456
1. 証明。
2. 最大値 $\sqrt2$。平面はただ1つで $y+z=2$。

## C-VEC-459
1. 証明。
2. $1<|\vec a+\vec b+\vec c|<1+\sqrt2$。

## II-CAL-313
1. 証明（$f-g=(x^2-2)(x^2-p)\geqq0$）。
2. 証明。
3. 最大値 $2\sqrt{2-\dfrac1p}$（$D=\left[-\sqrt{2-\frac1p},\ \sqrt{2-\frac1p}\right]$，直線 $y=-1$）。

## II-EQ-270
1. 証明。
2. 証明。
3. 証明。

## II-GEO-300
1. $E:\ \{x^2+(y-2)^2\}y^2=c^2$。後半は証明。
2. $0<c<1$ のとき：$y=0$ および $y=k\ \left(1-\sqrt{1-c}<k<1+\sqrt{1-c}\right)$。
   $c\geqq1$ のとき：$y=0$ のみ。

## II-GEO-302
1. $\mathrm{OB}=|t|\sqrt{1+k^2}$，$\mathrm{OA}=\dfrac{|t|\,|kt^2+1-3k|}{\sqrt{1+k^2}}$。
2. $n=3$，$l:\ y=\dfrac13x$ のみ。一定の値 $\dfrac{100}{27}$。

## II-TRI-188
1. 証明。
2. 証明。
3. $\ell>2\sqrt3$。

## II-TRI-190
1. $N(0,n)=2n-1$。
2. - $0<a\leqq\dfrac{\sqrt2}2$：$n$ 奇数で $2n-1$，$n$ 偶数で $2n$。
   - $-\dfrac{\sqrt2}2\leqq a<0$：$n$ 奇数で $2n+1$，$n$ 偶数で $2n$。
   - $|a|>\dfrac{\sqrt2}2$：$n$。
3. $(a,n)$：$0\leqq a\leqq\dfrac{\sqrt2}2$ かつ $n=1013$，または $|a|>\dfrac{\sqrt2}2$ かつ $n=2025$。

## II-TRI-192
1. $\dfrac13<r<\dfrac12$。下り坂の長さ $\dfrac{1-2\cos\pi r}{\sqrt{5-4\cos\pi r}}$。
2. $\dfrac16<r<\dfrac12$。後半は証明。
3. 交点がただ1つは証明。O との距離 $\dfrac{2\sqrt7}7$。

## III-DIF-350
1. 証明。
2. $b<\dfrac{a^2}2$，または $b=\dfrac{a^2}2$ かつ $a\neq0$（すなわち $b\leqq\frac{a^2}2$ かつ $(a,b)\neq(0,0)$）。

## III-DIF-357
1. $g(x)=cx(x-1)(x-2)$（$c\neq0$）。
2. 証明。
3. $g(x)=cx(x-1)(x-2)(19x^2-39x+4)$（$c\neq0$）。

## III-DIF-364
1. 証明。
2. 個数 $7$，極小値の最小 $-\dfrac{14}3\pi-\sqrt3$。

## III-DIF-368
1. 証明（$\mathrm B(3\log_2(a+1),\ 3a)$）。
2. 傾き $<-3$，または 傾き $>\dfrac{3\log2-1}{3-\log2}$。
3. $\mathrm A(7,\ 3)$。

## III-DIF-370
1. 証明。
2. 証明。
3. 証明。

## III-DIF-377
1. 証明。
2. $b=1-2a$ かつ（$a\leqq-1$ または $a\geqq0$）をみたす点 $(a,b)$ 全体。
3. $a\leqq-1$ または $a\geqq0$ のとき $1$ 個；$-1<a<0$ のとき $3$ 個。

## III-DIF-379
条件：$b\neq1$（$a$ は任意），または $(a,b)=\left(\dfrac13,\ 1\right)$。
- $b>1$：極小値
- $b<1$：極大値
- $(a,b)=\left(\frac13,1\right)$：極大値

## III-DIF-380
1. $ab=e$，または（$a\leqq1$ かつ $b\leqq1$）。
2. 前半は証明。$\gamma>0$ となる条件：$ab<e$ かつ（$a>1$ または $b>1$）。

## III-DIF-381
1. 証明。
2. 証明。
3. (i) $\mu=\dfrac14$，最小値 $\dfrac34$。
   (ii) 不等式・等号成立は証明。$k(\mu)$ を最小にするのは $\mu=\dfrac23$，最小値 $\dfrac13$。

## III-DIF-387
1. 証明。
2. $c_{n+1}<c_n$（すべての $n$）：$-1<\alpha\leqq\dfrac12$。
   $c_{n+1}>c_n$（すべての $n$）：$\alpha>\dfrac1{\sqrt e-1}-1\ \left(=\dfrac{2-\sqrt e}{\sqrt e-1}\right)$。

## III-DIF-389
1. 極値点は $f'(x)=0$ の $x=0,\ d$ と $kx^2+(4-kd)x-2d=0$ の2解 $\beta_1<0<\beta_2<d$ の4つ。$x=0,\ d$ で極小，$x=\beta_1,\ \beta_2$ で極大。
2. $kd=3,\ 4$。
3. 証明。

## III-DIF-392
1. 証明。
2. 証明。
3. 証明。

## III-DIF-393
$e^2\leqq\dfrac b{a-c}\leqq16$。

## III-DIF-395
1. $x<-1$ で減少，$x>-1$ で増加（極小値 $-\frac1e$）。$x<-2$ で上に凸，$x>-2$ で下に凸，変曲点 $\left(-2,\ -\frac2{e^2}\right)$。
2. $t=-2$ または $t\geqq-1$。

## III-DIF-398
1. 証明。
2. 証明。
3. 証明。

## III-DIF-399
1. 証明。公比 $-e^{a\pi}$。
2. 証明。
3. 証明。

## III-DIF-400
1. $(a,b)=\left(1,\ \dfrac12\right)$。
2. 証明。

## III-INT-714
1. 証明。
2. 証明。

## III-INT-715
1. 証明。
2. 証明。
3. 証明。

## III-INT-723
1. 証明。
2. $f(x)=\sqrt{x-k}\,e^{\sqrt{x-k}}$（$x>k$）。
3. $k=5$，$\dfrac{f(14)}{f(9)}=\dfrac{3e}2$。

## III-LIM-314
1. 証明。
2. 証明。
3. $15$ 個。

## X-MIX-086
1. 証明。
2. $c=2,3,4,\cdots$（2以上の整数全体）。

## X-MIX-088
1. 証明。
2. 証明。
3. 証明。

## A-COM-493
1. $s=1,2,3,4$；$T_1=1,\ T_2=2,\ T_3=4,\ T_4=7$。
2. 証明。
3. $2m-1$ 個。

## A-COM-495
1. 証明。
2. 6個の状態：$(4,3,1)$，$(4,2,2)$，$(4,2,1,1)$，$(3,3,2)$，$(3,3,1,1)$，$(3,2,2,1)$（この6状態で1つの周期6の巡回をなす）。

## A-COM-496
1. 証明。
2. 質問のしかた（フィボナッチ探索）：まず $a_5,a_8$ を聞く。以後，$p$ を含む区間 $[L,R]$ と，その内部で値の分かっている点 $c$ を保ち，$L+R-c$ を聞いて2点を比べ，(1) により区間を縮める。区間の長さは $12\to7\to4\to2\to1$ と縮み，5回で $p$ が確定する。
3. 証明（5回で区別できるのは高々12通り）。

## A-INT-455
1. 証明。
2. 最大値 $\dfrac{k(k-1)}2$。最大をとる $A$ は $\{d,\ 2d,\ \cdots,\ kd\}$（$d$ は0でない整数）。

## B-SEQ-302
1. 証明。
2. 証明。
3. 証明。

## B-SEQ-326
1. $\{2,3,6\}$：もつ。$\{2,3,6,18\}$：もたない（$2\cdot18,\ 18/2$ がともに属さない）。
2. 証明。
3. $A=\{1,\ a,\ a^2,\ a^3,\ a^4\}$ または $A=\{a,\ a^2,\ a^3,\ a^4,\ a^5\}$（$a>1$）。

## II-EQ-267
1. 証明。
2. 「$p\leqq2$ かつ $q>\dfrac{p^2}4$」または「$p>2$ かつ $q>p-1$」または「$q=0$ かつ（$p=0$ または $p>1$）」。

## III-DIF-373
1. 証明。
2. 証明。
3. 証明。

## III-DIF-374
1. 証明。
2. 証明。
3. 証明。

## III-INT-721
1. 証明。
2. 証明。
3. 存在・一意性は証明。$1\leqq x\leqq2$ で $f(x)=3-\dfrac2x$。
4. $2N^2+2N+2-2\log2$。

## III-LIM-312
1. 前半は証明。$T_n=\dfrac12-a_{n+1}$。
2. 証明。
3. 証明。
4. $\displaystyle\lim_{n\to\infty}\sqrt n\,a_n=\frac1{\sqrt2}$，$\displaystyle\lim_{n\to\infty}\sqrt n\left(\frac12-T_n\right)=\frac1{\sqrt2}$。

## X-MIX-082
1. 証明。
2. 証明。
3. 証明。
4. 証明。

## X-MIX-085
1. 証明。
2. 証明。
3. 例：$f(x)=\lambda^x$，$g(x)=1$（$T_g$ は任意），$T=1$。

## X-MIX-090
1. 証明。
2. 証明。
3. $N\leqq8$ は証明。例：$21$ を $30$ 個と $10$ を $1$ 個（総和 $640$）。第1組は $21\times4+10=94$（余り $6$），以後 $21\times4=84$ の組が6つ，最後に $21\times2=42$ の組で $N=8$。
