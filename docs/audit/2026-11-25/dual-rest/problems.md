# 解き直し用の問題文（93問）

新規254問のうち、入力用の答えがない93問の問題文だけを並べたもの。答え、解説、着想、タグ、品質情報は含めていない。

## B-SEQ-299（レベル3）

$r$ を $r>-1,\ r\neq0,\ r\neq1$ をみたす定数とし，$a_1=1$，公比 $r$ の等比数列 $\{a_n\}$ を考える．
\[
S_n=\sum_{k=1}^n a_k,\qquad T_n=\sum_{k=1}^n k\,a_k
\]
とおく．
\begin{enumerate}
  \item $n\geqq2$ のとき，$(1-r)\left\{2T_n-(n+1)S_n\right\}=2\displaystyle\sum_{j=1}^{n-1}r^j-(n-1)(1+r^n)$ を示せ．
  \item $n\geqq2$ のとき，$2T_n-(n+1)S_n$ の符号を $r$ の値によって答えよ．
\end{enumerate}

## B-SEQ-329（レベル3）

初項 $1$，公比 $q$（$q>0$）の等比数列 $\{a_n\}$ の初項から第 $n$ 項までの和を $S_n$ とする．実数 $c$ に対して $T_n=S_n+c$（$n=1,2,3,\cdots$）とおく．
\begin{enumerate}
  \item すべての自然数 $n$ に対して $T_nT_{n+2}-T_{n+1}^2=q^n\{(q-1)c-1\}$ が成り立つことを示せ．
  \item すべての自然数 $n$ に対して $T_n>0$ かつ
  \[\log_{10}T_n+\log_{10}T_{n+2}\geqq2\log_{10}T_{n+1}\]
  が成り立つような $(q,c)$ の条件を求めよ．また，そのうちすべての $n$ で等号が成り立つものを求めよ．
  \item $q$ を固定する．すべての自然数 $n$ に対して $T_n>0$ かつ $\log_{10}T_n+\log_{10}T_{n+2}\leqq2\log_{10}T_{n+1}$ が成り立つような $c$ の範囲を求めよ．
\end{enumerate}

## II-LOG-095（レベル3）

$x>0$ とする．$3^x+5^x=7^x$ をみたす正の実数 $x$ を $x_0$ とする．
\begin{enumerate}
  \item $x_0$ はただ1つ存在し，$1<x_0<2$ であることを示せ．
  \item 3つの数 $3^x,5^x,7^x$ が三角形の3辺の長さとなるような $x$ の範囲と，それが鈍角三角形となるような $x$ の範囲を，$x_0$ を用いて表せ．
  \item 3つの数 $3^x,5^x,7^x$ を3辺の長さとする三角形が存在し，その最大の角が $120^\circ$ 以上となるような $x$ の範囲を，$x_0$ を用いて表せ．
\end{enumerate}

## III-DIF-402（レベル3）

$a$ を正の定数とし，$x>0$ で定義された関数 $g(x)=x-\log(1+x)$ を考える．
\begin{enumerate}
  \item $x>0$ のとき，$\dfrac{x^2}{2(1+x)}<g(x)<\dfrac{x^2}{2}$ が成り立つことを示せ．
  \item 方程式 $g(x)=a$ は $x>0$ の範囲にただ1つの解をもつことを示せ．
  \item (2) の解を $x_0$ とする．$\sqrt{2a}<x_0<a+\sqrt{a^2+2a}$ を示し，$\displaystyle\lim_{a\to+0}\frac{x_0}{\sqrt a}$ を求めよ．
\end{enumerate}

## III-LIM-313（レベル3）

$a>0$ とし，$f(x)=ax^2+bx+c$ とする．方程式 $f(x)=x$ は2つの実数解 $x_1$，$x_2$（$x_1<x_2$）をもつとする．
\begin{enumerate}
  \item $x_2-x_1\leqq\dfrac1a$ のとき，放物線 $y=f(x)$ の軸を $x=x_0$ とすると $x_0\leqq x_1$ であることを示せ．
  \item 「$x_1<x<x_2$ をみたすすべての $x$ に対して $x_1<f(x)<x$」が成り立つための必要十分条件は $x_2-x_1\leqq\dfrac1a$ であることを示せ．
  \item $x_2-x_1\leqq\dfrac1a$ とし，$x_1<p<x_2$ をみたす $p$ に対して数列 $\{u_n\}$ を $u_1=p$，$u_{n+1}=f(u_n)$ で定める．$\displaystyle\lim_{n\to\infty}u_n=x_1$ を示せ．
\end{enumerate}

## X-MIX-091（レベル3）

実数全体で定義された関数 $f(x)$ が，すべての実数 $x$ に対して
\[f(2-x)=f(2+x),\qquad f(7-x)=-f(7+x)\]
をみたしている．
\begin{enumerate}
  \item すべての実数 $x$ に対して $f(x+10)=-f(x)$ が成り立つことを示せ．また $f(x+20)=f(x)$ を示せ．
  \item さらに，$2\leqq x\leqq7$ の範囲で $f(x)=0$ となる $x$ は $x=3$ と $x=7$ だけであるとする．このとき $f(x)$ は偶関数でも奇関数でもないことを示せ．
  \item (2) の条件のもとで，方程式 $f(x)=0$ の$-2005\leqq x\leqq2005$ の範囲にある解の個数を求めよ．また，(2) の条件をすべてみたす関数 $f(x)$ が実際に存在することを示せ．
\end{enumerate}

## A-COM-497（レベル4）

$n$ 台のコンピュータ $1,2,\cdots,n$ があり，コンピュータ $i$ ははじめ数 $v_i$ を記憶している．1単位時間ごとに，各コンピュータは自分以外のコンピュータを高々2台選び，その時点でそれらが記憶している数を読み取って自分の記憶している数に加え，その和を新たに記憶する．すべてのコンピュータはこれを同時に行い，1台のコンピュータが同時に何台から読み取られてもよい．どの単位時間にどのコンピュータがどのコンピュータを読み取るかは，$v_1,\cdots,v_n$ の値によらずにあらかじめ決めておく．$v_1,\cdots,v_n$ がどのような実数であっても，すべてのコンピュータが $v_1+v_2+\cdots+v_n$ を記憶している状態にすることを「計算を完了する」という．
\begin{enumerate}
  \item $t$ 単位時間が経過した時点で各コンピュータが記憶している数は，$v_1,\cdots,v_n$ によらない0以上の整数 $c_1,\cdots,c_n$ を用いて $c_1v_1+c_2v_2+\cdots+c_nv_n$ と表され，$c_1+c_2+\cdots+c_n\leqq3^t$ であることを示せ．これを用いて，$t$ 単位時間で計算を完了できるならば $n\leqq3^t$ であることを示せ．
  \item $n=3^t$（$t$ は正の整数）のとき，$t$ 単位時間で計算を完了する方法があることを示せ．
  \item $n=100$ のとき，計算を完了するのに必要な時間の最小値を求めよ．
\end{enumerate}

## A-COM-499（レベル4）

$n$ を正の整数とする．各項が $0,1,2$ のいずれかである長さ $n$ の列 $X=(x_1,x_2,\cdots,x_n)$ 全体の集合を $T_n$ とする．$T_n$ の2つの要素 $A=(a_1,\cdots,a_n)$，$B=(b_1,\cdots,b_n)$ に対し，$a_i\neq b_i$ となる番号 $i$ の個数を $d(A,B)$ と書き，$A$ と $B$ の{\bf 距離}とよぶ．
\begin{enumerate}
  \item $m$ を2以上の整数とし，$P$ を $T_n$ の $m$ 個の要素からなる部分集合とする．$P$ から異なる2つの要素を選ぶ $\dfrac{m(m-1)}2$ 通りの選び方すべてについての距離の平均を $\overline{d}(P)$ とするとき，
  \[\overline{d}(P)\leqq\frac{2mn}{3(m-1)}\]
  が成り立つことを示せ．
  \item $n=4$ とする．$T_4$ の部分集合 $P$ のどの異なる2つの要素の距離も3以上であるとき，$P$ の要素の個数は9以下であることを示せ．
  \item $n=4$ とし，$T_4$ の9個の要素からなる部分集合 $P$ のどの異なる2つの要素の距離も3以上であるとする．このとき，$P$ のどの異なる2つの要素の距離もちょうど3であり，さらに各番号 $i$（$1\leqq i\leqq4$）について，$P$ の要素のうち第 $i$ 項が $0$，$1$，$2$ であるものはそれぞれちょうど3個ずつであることを示せ．
  \item (3) の条件をみたす $T_4$ の部分集合 $P$ を1つ具体的に挙げ，それが条件をみたすことを示せ．
\end{enumerate}

## A-COM-500（レベル4）

$n$ を2以上の整数とし，$1,2,\cdots,n$ を1列に並べかえたものを $(a_1,a_2,\cdots,a_n)$ とする．
\[X=|1-a_1|+|2-a_2|+\cdots+|n-a_n|\]
とおく．
\begin{enumerate}
  \item $X$ はつねに偶数であることを示せ．
  \item $r$ を正の整数とする．$n=2r$ のとき $X\leqq2r^2$，$n=2r+1$ のとき $X\leqq2r(r+1)$ であることを示せ．
  \item (2) の右辺の値を $X$ の値としてもつ並べかえの個数を，$n=2r$ のとき，$n=2r+1$ のときのそれぞれについて $r$ の式で表せ．
  \item $X=2$ となる並べかえの個数を求めよ．
\end{enumerate}

## A-COM-501（レベル4）

ある作業を，3人の候補者 $\mathrm X_1$，$\mathrm X_2$，$\mathrm X_3$ のうち1人ずつ順に送り出して行わせる．$\mathrm X_i$ は送り出されると確率 $p_i\ (0<p_i<1)$ で作業を完了させ，完了してもしなくても費用 $c_i\ (>0)$ がかかる．作業が完了した時点で終了し，完了しなければ次の人を送り出す（3人とも完了できなければそこで終了する）．各人が完了するかどうかは互いに独立である．送り出す順番を $(\mathrm X_i,\mathrm X_j,\mathrm X_k)$ としたときにかかる費用の合計の期待値を $E(i,j,k)$ とする．
\begin{enumerate}
  \item $E(i,j,k)-E(j,i,k)$ と $E(i,j,k)-E(i,k,j)$ をそれぞれ $p$，$c$ の式で表せ．
  \item 3つの値 $\dfrac{c_1}{p_1}$，$\dfrac{c_2}{p_2}$，$\dfrac{c_3}{p_3}$ が相異なるとき，$E$ を最小にする順番は「$\dfrac{c_i}{p_i}$ の値の小さい人から順に送り出す」ものただ1つであることを示せ．
  \item $(p_1,c_1)=\left(\dfrac12,3\right)$，$(p_2,c_2)=\left(\dfrac15,1\right)$，$(p_3,c_3)=\left(\dfrac45,6\right)$ のとき，$E$ を最小にする順番と $E$ の最小値を求めよ．また，成功確率の大きい順に送り出したときの $E$ の値を求めよ．
\end{enumerate}

## A-COM-509（レベル4）

甲と乙が卓球の練習をする．1球ごとに勝った方が1点を得て，各球で甲が勝つ確率は $p$ $\left(\dfrac12<p<1\right)$，乙が勝つ確率は $q=1-p$ であり，各球の勝敗は独立とする．$k$ 球を打ち終えた時点での（甲の得点）$-$（乙の得点）を $D_k$ とし，
\[p_k=P(D_k\geqq3),\quad q_k=P(D_k\leqq-3),\quad r_k=p_k-q_k\]
とおく．
\begin{enumerate}
  \item $r_3$，$r_4$ を $p$ の式で表し，$r_4<r_3$ を示せ．
  \item すべての正の整数 $m$ に対して $r_{2m}<r_{2m+2}<r_{2m+1}$ が成り立つことを示せ．
\end{enumerate}

## A-COM-511（レベル4）

$n$ を3以上の整数とし，$X=\{1,2,\cdots,n\}$ とする．$X$ から $X$ への関数 $f$（$X$ の各要素 $x$ に $X$ の要素 $f(x)$ をただ1つ対応させるもの）について，$x$ が $X$ 全体を動くときの $f(x)$ の値全体の集合を $f(X)$ と書き，同様に $f(f(x))$ の値全体の集合を $f(f(X))$，$f(f(f(x)))$ の値全体の集合を $f(f(f(X)))$ と書く．
\begin{enumerate}
  \item $f(f(X))$ の要素の個数が $n-2$ となる $f$ の個数を求めよ．
  \item $f(f(f(X)))$ の要素の個数が $n-2$ となる $f$ の個数を求めよ．
\end{enumerate}

## A-COM-513（レベル4）

数列 $A:\ a_1,a_2,\dots,a_N\ (N\geqq2)$ について，$2\leqq n\leqq N$ をみたす整数 $n$ が「$1\leqq k<n$ をみたすすべての整数 $k$ について $a_k<a_n$」をみたすとき，$n$ を $A$ の G時刻という．$A$ の G時刻全体の集合を $G(A)$ とする．

$n$ を正の整数とし，$N=2n+1$，$a_1=0$ で，$k=1,2,\dots,2n$ に対して $a_{k+1}-a_k$ が $1$ または $-1$ である数列 $A$ 全体（$2^{2n}$ 個）を考える．
\begin{enumerate}
  \item $a_1,a_2,\dots,a_N$ のうち最大のものを $M$ とする．$G(A)$ の要素の個数は $M$ に等しいことを示せ．
  \item $G(A)$ が空集合となる $A$ の個数を求めよ．
  \item $1\leqq r\leqq2n$ とする．$G(A)$ の要素の個数がちょうど $r$ である $A$ の個数を求めよ．
\end{enumerate}

## A-GEO-114（レベル4）

$\angle\mathrm{A}>90^\circ$ である三角形 ABC において，頂点 A，B，C から直線 BC，CA，AB に下ろした垂線の足をそれぞれ D，E，F とし，3直線 AD，BE，CF の交点（垂心）を H とする．
\begin{enumerate}
  \item 点 A は三角形 DEF の内心であることを示せ．さらに，3点 B，C，H はいずれも三角形 DEF の傍心（1つの内角の二等分線と他の2つの外角の二等分線の交点）であることを示せ．
  \item $\mathrm{BC}=7$，$\mathrm{CA}=3$，$\mathrm{AB}=5$ のとき，三角形 DEF の3辺の長さ $\mathrm{EF}$，$\mathrm{FD}$，$\mathrm{DE}$ と，三角形 DEF の内接円の半径を求めよ．
\end{enumerate}

## A-GEO-115（レベル4）

円に内接する四角形 ABCD において，半直線 AB と半直線 DC は B，C の先の点 P で交わり，半直線 AD と半直線 BC は D，C の先の点 Q で交わるとする．$\angle\mathrm{APD}$ の二等分線が線分 BC，線分 AD と交わる点をそれぞれ K，L とし，$\angle\mathrm{AQB}$ の二等分線が線分 CD，線分 AB と交わる点をそれぞれ N，M とする．
\begin{enumerate}
  \item 点 K，L が実際にそれぞれ線分 BC，AD の内部にあり，P，K，L がこの順に並ぶことを示せ．また，$\mathrm{QK}=\mathrm{QL}$ であることを示せ．
  \item 四角形 KMLN はひし形であることを示せ．
\end{enumerate}

## A-INT-454（レベル4）

$243=3^5$ 個の項からなる数列 $x_1,x_2,\dots,x_{243}$ がある．項数が3の倍数である数列に対して，次の操作 T を考える．
\begin{center}
T：その数列の中での番号を3で割った余りが1である項，余りが2である項，余りが0である項を，\\
この順に（それぞれの中ではもとの順序を保って）並べた数列にかえる．
\end{center}
$x_1,\dots,x_{243}$ 全体に T を行った数列を $P_1$ とする．$k=2,3,4$ に対し，$P_{k-1}$ を前から $3^{6-k}$ 項ずつのブロックに分け，各ブロックに T を行って得られる数列を $P_k$ とする．
\begin{enumerate}
  \item $P_2$ において $x_{100}$ は第何項か．
  \item $P_4$ の第100項は $x_1,\dots,x_{243}$ のどれか．
  \item $P_3$，$P_4$ のそれぞれにおいて，$x_i$ が第 $i$ 項にある（もとの位置にある）ような $i$ の個数を求めよ．
\end{enumerate}

## A-INT-457（レベル4）

実数 $x$ を超えない最大の整数を $[x]$ で表す．正の整数 $N$ に対して $q=[\sqrt N]$ とし，数列 $\{x_n\}$ を
\[x_1=N,\qquad x_{n+1}=\left[\frac{x_n+\left[\dfrac N{x_n}\right]}2\right]\quad(n=1,2,3,\cdots)\]
で定める．
\begin{enumerate}
  \item 正の整数 $x$ に対して $\left[\dfrac{x+[N/x]}2\right]=\left[\dfrac12\left(x+\dfrac Nx\right)\right]$ が成り立つことを示せ．また，すべての $n$ について $x_n$ は正の整数で $x_n\geqq q$ であることを示せ．
  \item $x_n>q$ ならば $x_{n+1}<x_n$ であることを示し，$x_k=q$ となる番号 $k$ が存在することを示せ．
  \item ある番号から先の $x_n$ がすべて等しくなるための，$N$ についての必要十分条件を求めよ．
\end{enumerate}

## B-SEQ-295（レベル4）

実数 $p$ に対して，数列 $\{a_n\}$ を
\[a_n=\left(\frac25n^2+\frac12n+p\right)\sqrt n-\sum_{k=1}^nk\sqrt k\qquad(n=1,2,3,\cdots)\]
で定める．また，$n\geqq2$ に対して
\[A_n=\frac25n^2-\frac12n+p,\qquad B_n=\frac25(n-1)^2+\frac12(n-1)+p\]
とおく．
\begin{enumerate}
  \item $n\geqq2$ のとき $a_n-a_{n-1}=A_n\sqrt n-B_n\sqrt{n-1}$ であることを示せ．さらに，$nA_n^{\,2}-(n-1)B_n^{\,2}$ の値が $n\ (\geqq2)$ によらず一定となるような $p$ の値と，そのときの一定の値を求めよ．
  \item $p$ を (1) で求めた値とする．すべての正の整数 $n$ に対して
  \[\frac1{40}\leqq a_n<\frac1{38}\]
  が成り立つことを示せ．また，$a_n=\dfrac1{40}$ となる $n$ をすべて求めよ．
\end{enumerate}

## B-SEQ-303（レベル4）

$k$ を2以上の整数とし，数列 $\{a_n\}$ を
\[a_1=1,\qquad a_{n+1}=a_n+\frac1{ka_n}\quad(n=1,2,3,\ldots)\]
で定める．
\begin{enumerate}
  \item すべての正の整数 $n$ について $a_n>0$ かつ $a_n{}^2\geqq1+\dfrac{2(n-1)}k$ であることを示せ．
  \item $3+\dfrac1{3k+1}<a_{k+1}{}^2<3+\dfrac1k$ を示せ．
  \item $\dfrac1{12k+4}<a_{k+1}-\sqrt3<\dfrac1{3k}$ を示せ．
\end{enumerate}

## B-SEQ-308（レベル4）

正の整数からなる数列 $\{a_n\}$ が，すべての正の整数 $n$ に対して
\[
a_{n+2}=\begin{cases}a_{n+1}+a_n & (a_{n+1}\ \text{が3の倍数でないとき})\\[4pt] \dfrac13a_{n+1} & (a_{n+1}\ \text{が3の倍数のとき})\end{cases}
\]
をみたしている．
\begin{enumerate}
  \item ある正の整数 $N$ が存在して，$n\geqq N$ をみたすすべての整数 $n$ に対して $a_{n+5}=a_n$ が成り立つことを示せ．
  \item $a_1=1$ とする．$a_n=40$ となる $n$ が無限に多く存在するような $a_2$ の値をすべて求めよ．
\end{enumerate}

## B-SEQ-311（レベル4）

等差数列 $\{a_n\}$ と，初項が $0$ でなく公比 $r$ が $r\neq0$，$r\neq1$，$r\neq-1$ をみたす等比数列 $\{b_n\}$ がある．$a_k=b_k$ をみたす正の整数 $k$ 全体の集合を $M$ とする．
\begin{enumerate}
  \item $r>0$ のとき，$M$ の要素は2個以下であることを示せ．
  \item $r<0$ のとき，$M$ の要素は3個以下であることを示せ．
  \item $b_n=(-2)^n$ とする．$M$ の要素がちょうど3個となるような $\{a_n\}$ の一般項をすべて求め，そのときの $M$ を答えよ．
\end{enumerate}

## B-SEQ-314（レベル4）

無限数列 $\{a_n\}$ が「$a_p=a_q$（$p,q$ は正の整数）ならば必ず $a_{p+1}=a_{q+1}$」をみたすとき，$\{a_n\}$ は性質 P をもつという．

無限数列 $\{b_n\}$ が与えられたとき，実数 $a_1$ を初項として $a_{n+1}=b_n+a_n^2\ (n=1,2,3,\dots)$ により数列 $\{a_n\}$ を定める．
\begin{enumerate}
  \item すべての $n$ について $b_n>\dfrac14$ ならば，どのような $a_1$ に対しても $\{a_n\}$ は性質 P をもつことを示せ．
  \item $b_1\leqq\dfrac14$ であり，かつ，どのような $a_1$ に対しても $\{a_n\}$ が性質 P をもつとする．このとき $\{b_n\}$ は定数数列であることを示せ．
  \item $b_n=\dfrac14+\dfrac{(-1)^n}{2n}$ のとき，ある $a_1$ に対して $\{a_n\}$ は性質 P をもたないことを示せ．
\end{enumerate}

## B-SEQ-325（レベル4）

$f(x)=3|x+1|-2|x|$ とし，数列 $\{a_n\}$ を $a_{n+1}=f(a_n)$（$n=1,2,3,\dots$）で定める．
\begin{enumerate}
  \item $\{a_n\}$ が等差数列となるような $a_1$ の値をすべて求めよ．
  \item $\{a_n\}$ が有界である，すなわち，ある正の定数 $M$ があってすべての $n$ について $|a_n|\leqq M$ が成り立つような $a_1$ の値の範囲を求めよ．
\end{enumerate}

## B-SEQ-331（レベル4）

正の整数からなる数列 $\{a_n\}$ が
\[a_1=1,\qquad a_2=3,\qquad a_{n+1}a_n=(a_{n-1}+3)(a_{n-2}+3)\quad(n=3,4,5,\cdots)\]
をみたしている（$a_3$ は与えられていない）．
\begin{enumerate}
  \item $a_3$ は $1$，$4$，$8$ のいずれかであることを示せ．
  \item 条件をみたす数列 $\{a_n\}$ をすべて求め，それぞれの一般項を答えよ．
  \item (2) で求めた各数列について，初項から第 $2m$ 項までの和 $S_{2m}$ を $m$ の式で表せ．
\end{enumerate}

## B-SEQ-332（レベル4）

$p$ を正の定数，$a_0$ を実数の定数とし，数列 $\{a_n\}$ を
\[a_n=p^{\,n-1}-2a_{n-1}\qquad(n=1,2,3,\cdots)\]
で定める．
\begin{enumerate}
  \item $a_n$ を $n$，$p$，$a_0$ を用いて表せ．
  \item すべての正の整数 $n$ に対して $a_n>a_{n-1}$ が成り立つための，$p$ と $a_0$ についての必要十分条件を求めよ．
\end{enumerate}

## B-SEQ-339（レベル4）

数列 $\{a_n\}$ を $a_n=3n-1$ で定め，数列 $\{b_n\}$ を $a_n\left(2^{b_n}-1\right)=1$ $(n=1,2,3,\cdots)$ で定める．$T_n=b_1+b_2+\cdots+b_n$ とする．
\begin{enumerate}
  \item すべての正の整数 $n$ に対して $3T_n<\log_2(3n+1)$ が成り立つことを示せ．
  \item すべての正の整数 $n$ に対して
  \[3T_n\geqq\log_2(3n+2)+c\]
  が成り立つような実数 $c$ の最大値を求めよ．
\end{enumerate}

## B-SEQ-340（レベル4）

数列 $\{a_n\}$ は，$a_1=0$，$a_n\geqq0$ であり，
\[a_{n+1}^2+a_{n+1}=a_n+1\quad(n=1,2,3,\ldots)\]
をみたす．$S_n=a_1+a_2+\cdots+a_n$ とする．
\begin{enumerate}
  \item すべての自然数 $n$ に対して $0\leqq a_n<a_{n+1}<1$ が成り立つことを示せ．
  \item $n\geqq2$ に対して $P_n=a_2a_3\cdots a_n$ とおく．$P_n$ を $a_n$ で表し，$\displaystyle\lim_{n\to\infty}P_n$ を求めよ．
  \item すべての自然数 $n$ に対して $S_n>n-\dfrac85$ が成り立つことを示せ．
\end{enumerate}

## B-SEQ-343（レベル4）

数列 $\{u_n\}$ について，ある正の定数 $M$ があって，すべての正の整数 $n$ に対して
\[
|u_2-u_1|+|u_3-u_2|+\cdots+|u_{n+1}-u_n|\leqq M
\]
が成り立つとき，$\{u_n\}$ は{\bf 変動有界}であるという．
\begin{enumerate}
  \item $u_n=\dfrac{(-1)^n}n$ で定まる数列 $\{u_n\}$ は変動有界でないことを示せ．また，$v_n=\dfrac{(-1)^n}{n^2}$ で定まる数列 $\{v_n\}$ は変動有界であることを示せ．
  \item 数列 $\{a_n\}$ が変動有界であるための必要十分条件は，次の (i)，(ii) をみたす数列 $\{p_n\}$，$\{q_n\}$ があって，すべての $n$ で $a_n=p_n-q_n$ と表せることであることを示せ．
  \begin{enumerate}
    \item[(i)] すべての $n$ で $p_n\leqq p_{n+1}$，$q_n\leqq q_{n+1}$．
    \item[(ii)] ある定数 $K$ があって，すべての $n$ で $|p_n|\leqq K$，$|q_n|\leqq K$．
  \end{enumerate}
  \item 数列 $\{a_n\}$，$\{b_n\}$ がともに変動有界であるとする．各 $n$ について $a_n$ と $b_n$ のうち小さくない方を $c_n$ とするとき，数列 $\{c_n\}$ も変動有界であることを示せ．
\end{enumerate}

## C-CUR-460（レベル4）

放物線 $C:\ y^2=4x$ の焦点を F，$C$ の準線と $x$ 軸の交点を M とする．F を通る直線が $C$ と異なる2点 A，B で交わるとする．
\begin{enumerate}
  \item 直線 MA，MB の傾きの和は $0$ であることを示せ．
  \item 傾き $2$ の直線 $l$ が，直線 MA，MB，AB，$x$ 軸とそれぞれ点 P，Q，R，N で交わり，R が線分 PQ の中点であるとする．N の $x$ 座標のとりうる値の範囲を求めよ．
\end{enumerate}

## C-CUR-462（レベル4）

楕円 $C:\ \dfrac{x^2}4+\dfrac{y^2}3=1$ の焦点の1つを $\mathrm F(1,0)$ とする．$C$ 上の相異なる3点を頂点とし，重心が F であるような三角形を考える．
\begin{enumerate}
  \item このような三角形 ABP について，$\mathrm{FA}+\mathrm{FB}+\mathrm{FP}$ は三角形によらない一定の値であることを示し，その値を求めよ．
  \item $C$ 上の点 A に対し，A を1つの頂点とするこのような三角形 ABP が存在するとき，A を「よい点」とよぶ．A がよい点全体を動くとき，$\mathrm{FA}$ のとりうる値の範囲を求めよ．
\end{enumerate}

## C-CUR-466（レベル4）

座標平面上の楕円 $E:\dfrac{x^2}{25}+\dfrac{y^2}{9}=1$ と，2点 A$(-5,0)$，B$(5,0)$，F$(4,0)$ を考える．A，B における $E$ の接線をそれぞれ $l_1:x=-5$，$l_2:x=5$ とする．A，B と異なる $E$ 上の点 P における $E$ の接線を $l$ とし，$l$ と $l_1$，$l_2$ の交点をそれぞれ C，D とする．
\begin{enumerate}
  \item $l$ は $l_1$，$l_2$ のどちらとも1点で交わることを示し，$\mathrm{AC}\cdot\mathrm{BD}$ は P によらない一定の値であることを示してその値を求めよ．
  \item $\angle\mathrm{CFD}=90^\circ$ であることを示せ．
  \item P が A，B 以外の $E$ 上を動くとき，三角形 CFD の面積の最小値と，そのときの点 P の座標を求めよ．
\end{enumerate}

## C-CUR-467（レベル4）

座標平面上に点 A$(2,\,0)$ と，原点 O を中心とする半径1の円の $y>0$ の部分の上を動く点 B$(\cos\theta,\,\sin\theta)$（$0<\theta<\pi$）がある．三角形 ABC が正三角形となり，かつ C が直線 AB に関して O と反対側にあるように点 C をとる．
\begin{enumerate}
  \item C の座標を $\theta$ で表し，$\theta$ が $0<\theta<\pi$ の範囲を動くときの C の描く図形を求めよ．
  \item 線分 OC の長さの最大値と，そのときの $\theta$ を求めよ．
  \item 三角形 OBC の面積の最大値と，そのときの $\theta$ を求めよ．
\end{enumerate}

## C-CUR-469（レベル4）

$a>0$，$b>0$ とし，$c=\sqrt{a^2+b^2}$ とおく．双曲線
\[H:\ \frac{x^2}{a^2}-\frac{y^2}{b^2}=1\]
の頂点を A$(a,0)$，A$'(-a,0)$，焦点を F$(c,0)$，F$'(-c,0)$ とする．$H$ 上の点 P$(x_1,y_1)$（$y_1\neq0$）における $H$ の接線を $\ell$ とし，$\ell$ と直線 $x=a$，$x=-a$ との交点をそれぞれ Q，Q$'$ とする．
\begin{enumerate}
  \item Q，Q$'$ の $y$ 座標 $q$，$q'$ を $a,b,x_1,y_1$ で表せ．さらに $qq'=-b^2$ を示し，$\mathrm{AQ}\cdot\mathrm{A'Q'}$ の値を求めよ．
  \item 線分 QQ$'$ を直径とする円は2点 F，F$'$ を通ることを示せ．
  \item 2直線 AQ$'$，A$'$Q はただ1点 R で交わることを示し，R の座標を $x_1,y_1$ で表せ．
  \item P が $H$ 上の $y_1\neq0$ である点全体を動くとき，R の軌跡を求めよ．
\end{enumerate}

## C-CUR-471（レベル4）

楕円 $E:\ \dfrac{x^2}4+y^2=1$ と点 A$\left(1,\ \dfrac12\right)$ がある．A を通る直線 $\ell$ は $E$ と異なる2点で交わる．その2点を B，C とする．
\begin{enumerate}
  \item AB$\neq$AC であるとき，直線 $\ell$ 上の点 P で，線分 BC 上になく，かつ
  \[\mathrm{PB}:\mathrm{PC}=\mathrm{AB}:\mathrm{AC}\]
  をみたすものがただ1つ存在することを示せ．また，AB$=$AC であるときは，このような点 P が存在しないことを示せ．
  \item $\ell$ が AB$\neq$AC となる直線全体を動くとき，(1) の点 P の軌跡を求めよ．
  \item 線分 BC の中点を Q とする．AB$\neq$AC のとき $\mathrm{AP}\cdot\mathrm{AQ}=\mathrm{AB}\cdot\mathrm{AC}$ が成り立つことを示せ．さらに，$\ell$ が AB$\neq$AC となる直線全体を動くとき，$\mathrm{AP}\cdot\mathrm{AQ}$ の最大値と最小値，およびそれぞれを与える直線 $\ell$ の方程式を求めよ．
\end{enumerate}

## C-CUR-473（レベル4）

座標平面上に原点 O と点 A$(1,0)$ がある．正の定数 $t$ に対して直線 $l:x=t$ をとり，点 B が $l$ 上の $x$ 軸上にない点全体を動くとする．$\angle\mathrm{OAB}$ の二等分線と線分 OB の交点を C とする．
\begin{enumerate}
  \item 点 C の軌跡を，$x,y$ の方程式と $x$ の範囲で表せ．
  \item (1) の軌跡を含む曲線が楕円，放物線，双曲線，2直線のいずれになるかを，$t$ の値で分類せよ．
\end{enumerate}

## C-CUR-474（レベル4）

$0<k<1$ とする．四角形 ABCD は AB$\parallel$DC，AD$=$BC の等脚台形で，$|\mathrm{DC}|=k|\mathrm{AB}|$ をみたす．A，B を焦点とし C，D を通る双曲線を $H$，その離心率を $e$ とする．
\begin{enumerate}
  \item 線分 AC は C 以外にただ1つの点 E で $H$ と交わることを示せ．さらに $\mathrm{AE}:\mathrm{EC}=\lambda:1$ とおくとき，$\lambda$ を $k$ と $e$ で表せ．
  \item $k$ を固定して台形の高さをいろいろに変える．$e$ のとりうる値の範囲と，$\lambda$ のとりうる値の範囲をそれぞれ $k$ で表せ．
  \item E が線分 AC の中点となるような台形 ABCD が存在するための $k$ の条件を求めよ．また，そのときの $e$ を $k$ で表せ．
\end{enumerate}

## C-CUR-476（レベル4）

$q$ を実数の定数とし，曲線 $E:\ x^2+xy+2y^2+qx-2y=4$ を考える．
\begin{enumerate}
  \item 実数 $k$ に対し，直線 $y=kx$ は $E$ と異なる2点で交わり，それらの $x$ 座標 $\alpha,\beta$ はいずれも $0$ でないことを示せ．また $\dfrac1\alpha+\dfrac1\beta$ を $q,k$ で表せ．
  \item $k_1\neq k_2$ とする．直線 $y=k_1x$ と $E$ の2交点を $\mathrm C(x_1,k_1x_1)$，$\mathrm D(x_2,k_1x_2)$，直線 $y=k_2x$ と $E$ の2交点を $\mathrm G(x_3,k_2x_3)$，$\mathrm H(x_4,k_2x_4)$ とする．直線 CH，GD がいずれも $x$ 軸と平行でないとき，それらと $x$ 軸の交点をそれぞれ $\mathrm P(p,0)$，$\mathrm Q(r,0)$ とする．$p\neq0$，$r\neq0$ であることを示し，$\dfrac1p+\dfrac1r$ は $k_1,k_2$ によらない一定の値であることを示してその値を求めよ．
  \item $q=0$ のとき，(2) の P，Q について $\mathrm{OP}=\mathrm{OQ}$ であることを示せ（O は原点）．
\end{enumerate}

## C-CUR-479（レベル4）

放物線 $C:y^2=4x$ 上の点 $\mathrm P(1,2)$ を考える．直線 $\ell$ に平行なベクトル $(\cos\varphi,\sin\varphi)$ がとれるような角 $\varphi$ のうち $0\leqq\varphi<\pi$ をみたすものを $\ell$ の{\bf 傾斜角}とよぶ．

$C$ 上の P と異なる相異なる2点 $\mathrm A(a^2,2a)$，$\mathrm B(b^2,2b)$ をとり，直線 PA，PB の傾斜角をそれぞれ $\alpha$，$\beta$ とする．また $\theta$ は $0<\theta<\pi$ をみたす定数とし，$s=a+b$，$q=ab$ とおく．
\begin{enumerate}
  \item $\alpha$ は複素数 $(a+1)+2i$ の偏角のうち $0$ より大きく $\pi$ より小さいものに等しいことを示せ．さらに，$\alpha+\beta=\theta$ であることは
  \[(q+s-3)\sin\theta=2(s+2)\cos\theta\quad\text{かつ}\quad s>-2\]
  であることと同値であることを示せ．
  \item $\alpha+\beta=\theta$ をみたすような2点 A，B が存在することを示せ．また，$\alpha+\beta=\theta$ をみたすどのような2点 A，B に対しても直線 AB が通る点 $\mathrm F_\theta$ がただ1つ存在することを示し，その座標を $\theta$ で表せ．
  \item $\theta$ が $0<\theta<\pi$ の範囲を動くとき，点 $\mathrm F_\theta$ の軌跡を求めよ．
\end{enumerate}

## C-CUR-480（レベル4）

放物線 $C:y=\dfrac{x^2}4$ の焦点を F$(0,1)$ とする．$C$ 上の異なる2点 A$(2s,s^2)$，B$(2t,t^2)$ における $C$ の接線の交点を P とする．
\begin{enumerate}
  \item P の座標を $s,t$ で表せ．また $\mathrm{FA}=s^2+1$ であることと，$\mathrm{FP}^2=\mathrm{FA}\cdot\mathrm{FB}$ が成り立つことを示せ．
  \item $\angle\mathrm{PFA}=\angle\mathrm{PFB}$ であることを示せ．さらに $\angle\mathrm{FPA}=\angle\mathrm{FBP}$ であることを示せ．
  \item 点 P が直線 $l:x-y-3=0$ 上を動くとき，P から $C$ へちょうど2本の接線が引けることを示せ．また，その2つの接点を A，B とするとき，積 $\mathrm{FA}\cdot\mathrm{FB}$ の最小値と，そのときの P の座標を求めよ．
\end{enumerate}

## C-CUR-482（レベル4）

楕円 $E:\dfrac{x^2}4+y^2=1$ 上の異なる2点 A，B を結ぶ弦 AB が $y$ 軸に平行でなく，線分 AB の垂直二等分線が $x$ 軸と点 P$(p,0)$ で交わるとき，弦 AB を点 P の関連弦とよぶ．ただし $p\neq0$ とする．
\begin{enumerate}
  \item 点 P$(p,0)$ の関連弦の中点の $x$ 座標は，弦によらず $p$ だけで定まることを示せ．また，点 P$(p,0)$ が関連弦をもつような $p$ の値の範囲を求めよ．
  \item 点 P$(p,0)$ の関連弦の長さに最大値が存在するような $p$ の値の範囲と，そのときの最大値を求めよ．
\end{enumerate}

## C-CUR-484（レベル4）

楕円 $C:\dfrac{x^2}4+\dfrac{y^2}3=1$ 上の点 A$\left(1,\dfrac32\right)$ を考える．$C$ 上の2点 E，F は A と異なり，E $\neq$ F で，直線 AE，AF はどちらも $y$ 軸に平行でないとする．直線 AE，AF の傾きをそれぞれ $k_1,k_2$ とする．
\begin{enumerate}
  \item $\lambda$ を0でない定数とする．$k_1+k_2=\lambda$ をみたすような E，F をどのようにとっても，直線 EF はある定点 $\mathrm P_\lambda$ を通ることを示し，$\mathrm P_\lambda$ の座標を $\lambda$ で表せ．
  \item $\lambda$ が0以外の実数全体を動くとき，点 $\mathrm P_\lambda$ 全体の集合を求めよ．また，$k_1+k_2=0$ のとき，直線 EF はつねにその集合を含む直線と平行であることを示せ．
\end{enumerate}

## C-CUR-486（レベル4）

楕円 $C:\dfrac{x^2}4+\dfrac{y^2}3=1$ と点 $\mathrm B\left(\dfrac83,\ 0\right)$ がある．$x$ 軸に垂直でない直線 $l$ が $C$ と異なる2点 P，Q で交わり，P，Q はどちらも $x$ 軸上になく，$x$ 軸が $\angle\mathrm{PBQ}$ の二等分線になっているとする．
\begin{enumerate}
  \item 直線 $l$ はある定点を通ることを示し，その座標を求めよ．
  \item $\triangle\mathrm{BPQ}$ の面積の最大値と，そのときの直線 $l$ の方程式を求めよ．
\end{enumerate}

## C-CUR-487（レベル4）

楕円 $C:\dfrac{x^2}4+\dfrac{y^2}3=1$ と点 $\mathrm F(1,0)$ がある．$C$ 上の点 $\mathrm P(x_0,y_0)$（$y_0\neq0$）における $C$ の接線を $l$ とし，$l$ と直線 $x=1$ の交点を M とする．また，$s$ は $1$ でない定数とし，$l$ と直線 $x=s$ の交点を N とする．
\begin{enumerate}
  \item 線分 MF の長さを $x_0$，$y_0$ で表せ．
  \item P が $C$ 上の $y_0\neq0$ をみたす点全体を動くとき，$\dfrac{\mathrm{MF}}{\mathrm{NF}}$ が P によらず一定となるような $s$ をすべて求めよ．また，そのときの一定の値を求めよ．
\end{enumerate}

## C-CUR-489（レベル4）

2点 $\mathrm F_1$，$\mathrm F_2$ を焦点とする楕円 $E$ と，同じ2点を焦点とする双曲線 $H$ が点 P を共有し，$\angle\mathrm F_1\mathrm P\mathrm F_2=\theta$（$0<\theta<\pi$）であるとする．$E$，$H$ の離心率をそれぞれ $e_1$，$e_2$ とする．
\begin{enumerate}
  \item $\dfrac{\sin^2\frac\theta2}{e_1^2}+\dfrac{\cos^2\frac\theta2}{e_2^2}=1$ が成り立つことを示せ．
  \item $\theta=\dfrac\pi3$ とする．$\mathrm F_1$，$\mathrm F_2$，$E$，$H$，P がこの条件をみたしながら変わるとき，$e_1e_2$ のとりうる値の範囲を求めよ．
  \item $\theta=\dfrac{2\pi}3$ とする．(2) と同様に，$e_1e_2$ のとりうる値の範囲を求めよ．
\end{enumerate}

## C-VEC-452（レベル4）

空間に点 O と，O を中心とする半径 $1$ の球面 $S$ がある．点 A と $S$ 上の3点 $\mathrm B_1,\mathrm B_2,\mathrm B_3$ が，
\[\overrightarrow{\mathrm{AB}_1},\ \overrightarrow{\mathrm{AB}_2},\ \overrightarrow{\mathrm{AB}_3}\ \text{はどれも }\vec0\text{ でなく，どの2つも垂直}\]
をみたしているとする．点 P を $\overrightarrow{\mathrm{AP}}=\overrightarrow{\mathrm{AB}_1}+\overrightarrow{\mathrm{AB}_2}+\overrightarrow{\mathrm{AB}_3}$ で定める．
\begin{enumerate}
  \item $\mathrm{OP}^2+2\,\mathrm{OA}^2=3$ が成り立つことを示せ．
  \item 上の条件と $\mathrm{OP}<1$ をみたすように点 A，$\mathrm B_1$，$\mathrm B_2$，$\mathrm B_3$ が動くとき，線分 OA の長さのとりうる値の範囲を求めよ．
\end{enumerate}

## C-VEC-454（レベル4）

座標空間において，球面 $S:\ x^2+y^2+z^2=4$ と，2つの平面
\[
\alpha:\ x+z=4,\qquad \beta:\ x+\sqrt3\,y+2z=8
\]
がある．$S$ 上の2点 $\mathrm P$，$\mathrm Q$ から $\alpha$ に下ろした垂線の足をそれぞれ $\mathrm P_1$，$\mathrm Q_1$，$\beta$ に下ろした垂線の足をそれぞれ $\mathrm P_2$，$\mathrm Q_2$ とし，
\[
E=2\,\mathrm{PQ}^2-\mathrm P_1\mathrm Q_1{}^2-\mathrm P_2\mathrm Q_2{}^2
\]
とおく．
\begin{enumerate}
  \item $\vec u=\overrightarrow{\mathrm{PQ}}$，$\vec n_1=\dfrac{1}{\sqrt2}(1,0,1)$，$\vec n_2=\dfrac{1}{2\sqrt2}(1,\sqrt3,2)$ とするとき，$E=(\vec u\cdot\vec n_1)^2+(\vec u\cdot\vec n_2)^2$ であることを示せ．
  \item $\mathrm P$，$\mathrm Q$ が $z$ 座標の等しい $S$ 上の2点を動くとき，$E$ の最大値と，最大値をとるときの $\mathrm P$，$\mathrm Q$ の組を1つ求めよ．
  \item $\mathrm P$，$\mathrm Q$ が $S$ 上を自由に動くとき，$E$ の最大値と，最大値をとるときの $\mathrm P$，$\mathrm Q$ の組を1つ求めよ．
\end{enumerate}

## C-VEC-455（レベル4）

座標空間に球面 $S:\ x^2+y^2+z^2=25$ と点 $\mathrm{P}(0,4,3)$ がある．点 P を通る平面 $\alpha$ で $S$ を切ったとき，切り口が半径 $3$ の円 $C$ になるとする．$C$ を $xy$ 平面に正射影して得られる図形の面積を $T$ とする．
\begin{enumerate}
  \item このような平面 $\alpha$ すべてを考えるとき，$T$ の最大値と，そのときの平面 $\alpha$ の方程式を求めよ．
  \item 円 $C$ 全体が $z\geqq0$ の部分に含まれるような平面 $\alpha$ だけを考えるとき，$T$ の最小値と，そのときの平面 $\alpha$ の方程式を求めよ．
\end{enumerate}

## C-VEC-456（レベル4）

空間に4点 A，B，C，D がある．平面 $\alpha$ は，線分 AB とも線分 CD とも共有点をもたず，線分 AC とは共有点をもつとする．このような平面 $\alpha$ に対して，4点 A，B，C，D から $\alpha$ までの距離のうち最も小さいものを $d(\alpha)$ とする．
\begin{enumerate}
  \item 線分 AB 上の任意の点 X と線分 CD 上の任意の点 Y に対して，$d(\alpha)\leqq\dfrac{\mathrm{XY}}2$ が成り立つことを示せ．
  \item A$(0,\ 0,\ 0)$，B$(4,\ 0,\ 0)$，C$(-1,\ 6,\ 2)$，D$(2,\ 2,\ 2)$ のとき，$d(\alpha)$ の最大値を求めよ．また，最大値を与える平面 $\alpha$ はただ1つであることを示し，その方程式を求めよ．
\end{enumerate}

## C-VEC-459（レベル4）

実数 $t$ に対して，$f(t)=1\ (t>0)$，$f(0)=0$，$f(t)=-1\ (t<0)$ と定める．平面上の互いに異なる3つの単位ベクトル $\vec a,\vec b,\vec c$ が
\[f(\vec a\cdot\vec b)+f(\vec b\cdot\vec c)+f(\vec c\cdot\vec a)=1\]
をみたしている．
\begin{enumerate}
  \item $\vec a\cdot\vec b$，$\vec b\cdot\vec c$，$\vec c\cdot\vec a$ のうち2つ以上が $0$ になることはないことを示せ．
  \item $|\vec a+\vec b+\vec c|$ のとりうる値の範囲を求めよ．
\end{enumerate}

## II-CAL-313（レベル4）

$p$ を $p\geqq2$ をみたす定数とし，
\[
f(x)=x^4-2x^2,\qquad g(x)=p(x^2-2)
\]
とする．$-\sqrt2\leqq m<n\leqq\sqrt2$ をみたす実数 $m,\ n$ に対して，$m\leqq x\leqq n$ をみたす実数 $x$ 全体の集合を $D$ とする．$D$ が次の条件をみたすとき，$D$ を「よい区間」とよぶ．
\begin{center}
ある実数 $k,\ b$ があって，$D$ に属するすべての $x$ に対して $g(x)\leqq kx+b\leqq f(x)$ が成り立つ．
\end{center}
\begin{enumerate}
  \item $-\sqrt2\leqq x\leqq\sqrt2$ ならば $f(x)\geqq g(x)$ であることを示せ．
  \item よい区間 $D$ が $-1$ と $1$ をともに含むならば，$n-m\leqq2\sqrt{2-\dfrac1p}$ であることを示せ．
  \item よい区間 $D$ について，$n-m$ の最大値を求めよ．
\end{enumerate}

## II-EQ-270（レベル4）

$a$，$b$ を正の定数とし，$x>0$ に対して
\[f(x)=\frac1{\sqrt{1+x}}+\frac1{\sqrt{1+a}}+\frac1{\sqrt{1+b}}+\sqrt{\frac{abx}{abx+81}}\]
とする．
\begin{enumerate}
  \item $0<p<1$，$0<q<1$，$0<r<1$ のとき，$p+q+r-2<pqr$ を示せ．
  \item 正の数 $s$，$t$，$u$ に対して $s+t+u\geqq3\sqrt[3]{stu}$ を示せ．
  \item すべての $x>0$ に対して $1<f(x)<3$ が成り立つことを示せ．
\end{enumerate}

## II-GEO-300（レベル4）

直線 $l:\ px+qy+r=0$ と2点 $\mathrm P_1(x_1,y_1)$，$\mathrm P_2(x_2,y_2)$ に対し $\eta=(px_1+qy_1+r)(px_2+qy_2+r)$ とおき，$\eta<0$ のとき「$\mathrm P_1,\mathrm P_2$ は $l$ で隔てられる」という．曲線 $K$ と直線 $l$ が共有点をもたず，かつ $K$ 上に $l$ で隔てられる2点が存在するとき，$l$ を $K$ の\textbf{分割線}とよぶ．

$c$ を正の定数とし，点 $\mathrm Q(0,2)$ をとる．点 P から Q までの距離と，P から $x$ 軸までの距離の積が $c$ に等しいような点 P の軌跡を $E$ とする．
\begin{enumerate}
  \item $E$ の方程式を求めよ．また，$x$ 軸に平行でないどんな直線も $E$ と共有点をもつことを示せ．
  \item $E$ の分割線をすべて求めよ（$c$ の値で場合分けして答えよ）．
\end{enumerate}

## II-GEO-302（レベル4）

座標平面上の曲線 $C:y=x^3-3x$ と原点 O を考える．O を通り，$x$ 軸とも $y$ 軸とも異なる直線 $l$ をとり，その傾きを $k$ とする．$C$ 上の点 M で $l$ 上にないものに対し，M から $l$ に下ろした垂線と $l$ の交点を A，M を通り $y$ 軸に平行な直線と $l$ の交点を B とする．
\begin{enumerate}
  \item M の $x$ 座標を $t$ とするとき，OB，OA を $k$，$t$ で表せ．
  \item 自然数 $n$ と直線 $l$ の組であって，A が O と異なるようなすべての M について $\dfrac{\mathrm{OB}^n}{\mathrm{OA}}$ が M によらず一定となるものをすべて求めよ．また，そのときの一定の値を求めよ．
\end{enumerate}

## II-TRI-188（レベル4）

三角錐 PABC において，頂点 P から平面 ABC に下ろした垂線の足 H は $\triangle$ABC の内部にあるとする．$\mathrm{PH}=k$ とし，H から直線 BC，CA，AB までの距離をそれぞれ $r_1$，$r_2$，$r_3$，二面角 P-BC-A，P-CA-B，P-AB-C の大きさをそれぞれ $\alpha_1$，$\alpha_2$，$\alpha_3$ とする．
\begin{enumerate}
  \item $i=1,2,3$ に対し，$\alpha_i$ は鋭角であり，$r_i\tan\alpha_i=k$ が成り立つことを示せ．
  \item $\alpha_1$，$\alpha_2$，$\alpha_3$ がこの順に等差数列をなし，$r_1$，$r_2$，$r_3$ がこの順に等比数列をなすとする．このとき，$\alpha_1=\alpha_2=\alpha_3$ であるか，または $\alpha_2=\dfrac\pi4$ であることを示せ．
  \item $\triangle$ABC は1辺の長さが $\ell$ の正三角形で，$k=1$ とする．(2) の2つの条件をみたし，かつ $\alpha_1$，$\alpha_2$，$\alpha_3$ がすべて等しいわけではないような三角錐 PABC が存在するための $\ell$ の値の範囲を求めよ．
\end{enumerate}

## II-TRI-190（レベル4）

$a$ を実数，$n$ を正の整数とし，$F(x)=\sin2x+a(\sin x+\cos x)$ とする．区間 $0<x<n\pi$ における方程式 $F(x)=0$ の実数解の個数を $N(a,n)$ とする．
\begin{enumerate}
  \item $N(0,n)$ を求めよ．
  \item $a\neq0$ のとき，$N(a,n)$ を $a$ と $n$ で表せ．
  \item $N(a,n)=2025$ となるような実数 $a$ と正の整数 $n$ の組をすべて求めよ．
\end{enumerate}

## II-TRI-192（レベル4）

$0<r<\dfrac12$ とする．頂点を O とし，母線の長さが $2$，底面の半径が $r$ の直円錐を，底面が水平な地面に接するように置く．底面の円周上に点 A をとり，線分 OA の中点を B とする．この円錐の側面を母線 OA に沿って切り開くと，中心 O，半径 $2$，中心角 $\theta=\pi r$ の扇形になる．

$n=1,2$ に対し，この扇形を $n$ 枚，O を共有し隣り合うものが半径で接するように並べてできる中心角 $n\theta$ の扇形を $F_n$ とする．$F_n$ の一方の端の半径上で O からの距離が $2$ の点を A，他方の端の半径上で O からの距離が $1$ の点を $\mathrm B_n'$ とし，$F_n$ の各扇形を元の円錐の側面に貼り戻したときに線分 $\mathrm{AB}_n'$ が移る，側面上の A から B に至る曲線を $C_n$ とする（$C_n$ は円錐の軸のまわりを $n$ 周する）．$C_n$ を A から B へ進むとき，地面からの高さが減少していく部分を $C_n$ の「下り坂」と呼ぶ．
\begin{enumerate}
  \item $C_1$ が下り坂を含むような $r$ の値の範囲を求め，そのときの下り坂の長さを $r$ で表せ．
  \item $C_2$ が下り坂を含むような $r$ の値の範囲を求めよ．また，(1) で求めた範囲の $r$ に対し，$C_2$ の下り坂は $C_1$ の下り坂より長いことを示せ．
  \item $r=\dfrac13$ のとき，$C_2$ が自分自身と交わる点はちょうど1つであることを示し，その点と O との距離を求めよ．
\end{enumerate}

## III-DIF-350（レベル4）

$a$，$b$ を実数とし，$f(x)=\cos ax+\log(1+bx^2)$ を $1+bx^2>0$ をみたす $x$ の範囲で考える．ここで「$f(x)$ が $x=0$ で極大となる」とは，正の数 $\delta$ があって，$0<|x|<\delta$ をみたす（定義域内の）すべての $x$ で $f(x)<f(0)$ となることをいう．
\begin{enumerate}
  \item すべての実数 $u$ について $1-\dfrac{u^2}2\leqq\cos u\leqq1-\dfrac{u^2}2+\dfrac{u^4}{24}$ が成り立つことを示せ．また，$y>-1$ のとき $\log(1+y)\leqq y$，$y\geqq0$ のとき $y-\dfrac{y^2}2\leqq\log(1+y)\leqq y-\dfrac{y^2}2+\dfrac{y^3}3$ が成り立つことを示せ．
  \item $f(x)$ が $x=0$ で極大となるような点 $(a,b)$ の範囲を求めよ．
\end{enumerate}

## III-DIF-357（レベル4）

実数 $x$ に対し，$x$ を超えない最大の整数を $[x]$ で表す．関数 $f(x)$ を
\[
f(x)=\begin{cases} x-[x] & ([x]\ \text{が偶数のとき})\\[2pt] 2\,(x-[x]) & ([x]\ \text{が奇数のとき})\end{cases}
\]
で定める．多項式 $g(x)$ に対し，合成関数 $g(f(x))$ を考える．
\begin{enumerate}
  \item $g(x)$ が $g(0)=0$ をみたす3次関数であるとき，$g(f(x))$ がすべての実数 $x$ で連続となるような $g(x)$ をすべて求めよ．
  \item $g(x)$ の次数が4以下であり，$g(f(x))$ がすべての実数 $x$ で微分可能であるならば，$g(x)$ は定数であることを示せ．
  \item $g(x)$ が $g(0)=0$ をみたす5次式であるとき，$g(f(x))$ がすべての実数 $x$ で微分可能となるような $g(x)$ をすべて求めよ．
\end{enumerate}

## III-DIF-364（レベル4）

$f(x)=\dfrac{\pi}{3}(x^3-3x)$ とし，
\[
g(x)=f(x)+2\sin f(x)
\]
とする．
\begin{enumerate}
  \item $g'(1)=0$ であり，$g(x)$ は $x=1$ で極小となることを示せ．
  \item $-3<x<3$ において，$g(x)$ が極小となる $x$ の個数を求めよ．また，そこでの極小値のうち最小のものを求めよ．
\end{enumerate}

## III-DIF-368（レベル4）

2つの曲線
\[
C_1:\ y=\log_2(x+1)\quad(x>-1),\qquad C_2:\ y=3\left(2^{\frac{x}{3}}-1\right)
\]
がある．$C_1$ 上の第1象限にある点 A に対し，直線 $y=x$ に関して A と対称な点を $\mathrm{A}'$ とする．O は原点，$\log$ は自然対数を表す．
\begin{enumerate}
  \item 直線 $\mathrm{OA}'$ と $C_2$ は O 以外にただ1つの共有点 B をもち，B は第1象限にあって $\overrightarrow{\mathrm{OB}}=3\overrightarrow{\mathrm{OA}'}$ をみたすことを示せ．
  \item A が $C_1$ の第1象限にある部分全体を動くとき，直線 AB が $y$ 軸に平行でない場合のその傾きのとりうる値の範囲を求めよ．
  \item 直線 AB の傾きが $9$ となるような点 A の座標を求めよ．
\end{enumerate}

## III-DIF-370（レベル4）

$a,\ b,\ c,\ d,\ e$ を実数の定数とし，
\[
f(x)=a\cos2x+b\sin2x+c\cos x+d\sin x+e
\]
とする．$|f(x)|$ の最大値を $A$ とおき，$\alpha=\dfrac{2+\sqrt2}4$，$\beta=\dfrac{2-\sqrt2}4$ とする．
\begin{enumerate}
  \item すべての実数 $x$ に対して
  \[
  f'(x)=\alpha\left\{f\!\left(x+\frac\pi4\right)-f\!\left(x-\frac\pi4\right)\right\}-\beta\left\{f\!\left(x+\frac{3\pi}4\right)-f\!\left(x-\frac{3\pi}4\right)\right\}
  \]
  が成り立つことを示せ．
  \item すべての実数 $x$ に対して $|f'(x)|\leqq2A$ が成り立つことを示せ．
  \item (2) の不等式の右辺の定数 $2$ をより小さい正の定数 $\lambda$ に置き換えると，ある $a,b,c,d,e$ と $x$ について $|f'(x)|\leqq\lambda A$ が成り立たないことを示せ．
\end{enumerate}

## III-DIF-377（レベル4）

実数 $a,\ b$ に対し，$f(x)=a\left(e^{x-1}+e^{1-x}\right)+x^2-2x+b$ とする．
\begin{enumerate}
  \item $t\neq0$ のとき $e^t+e^{-t}-2>t^2$ であることを示せ．
  \item 方程式 $f(x)=0$ がただ1つの実数解をもつような点 $(a,b)$ 全体を求めよ．
  \item $b=1-2a$ のとき，方程式 $f(x)=0$ の異なる実数解の個数を，$a$ の値で分類して答えよ．
\end{enumerate}

## III-DIF-379（レベル4）

$a,b$ を実数の定数とし，
\[
f(x)=(2+bx+ax^2)\sin x-x^2-2x
\]
とする．$x=0$ で $f(x)$ が極値をとるための $a,b$ の条件を求めよ．また，そのとき $f(0)$ は極大値か極小値かを答えよ．

ただし，$f(0)$ が極大値であるとは，ある正の数 $\delta$ があって $0<|x|<\delta$ をみたすすべての $x$ で $f(x)<f(0)$ が成り立つことをいう．極小値も同様に定める．

## III-DIF-380（レベル4）

$a,b$ を正の実数とし，$f(x)=a^x+b^x-x-2$ とする．
\begin{enumerate}
  \item 方程式 $f(x)=0$ の実数解がちょうど1個であるような $(a,b)$ の条件を求めよ．
  \item 方程式 $f(x)=0$ の実数解がちょうど2個であるとき，それは $0$ と $0$ でない数 $\gamma$ であることを示し，$\gamma>0$ となるための $a,b$ の条件を求めよ．
\end{enumerate}

## III-DIF-381（レベル4）

$m$，$L$ は正の定数とする．実数全体で定義された関数 $f(x)$ が，すべての実数 $x_1$，$x_2$ に対して
\[
\text{(A)}\quad m(x_1-x_2)^2\leqq(x_1-x_2)\{f(x_1)-f(x_2)\},\qquad
\text{(B)}\quad |f(x_1)-f(x_2)|\leqq L|x_1-x_2|
\]
をみたしている．
\begin{enumerate}
  \item $m\leqq L$ であることを示せ．また，方程式 $f(x)=0$ はただ1つの実数解をもつことを示せ．
  \item (1) の実数解を $\alpha$ とする．正の数 $\mu$ と実数 $a$ に対して $b=a-\mu f(a)$ とおくとき，
  \[(b-\alpha)^2\leqq(1-2\mu m+\mu^2L^2)(a-\alpha)^2\]
  が成り立つことを示せ．
  \item $m=1$，$L=2$ とする．
  \begin{enumerate}
    \item[(i)] 正の数 $\mu$ を動かすとき，(2) の係数 $1-2\mu+4\mu^2$ を最小にする $\mu$ と，その最小値を求めよ．
    \item[(ii)] さらに $f(x)$ は微分可能で，すべての実数 $x$ で $1\leqq f'(x)\leqq2$ をみたすとする．正の数 $\mu$ に対し，$|1-\mu|$ と $|1-2\mu|$ のうち小さくない方を $k(\mu)$ とする．すべての実数 $a$ に対して $|b-\alpha|\leqq k(\mu)|a-\alpha|$ が成り立つことを示せ．また，この条件をみたす関数 $f(x)$ と $a\neq\alpha$ をうまく選ぶと等号が成り立つことを示し，$k(\mu)$ を最小にする $\mu$ と，その最小値を求めよ．
  \end{enumerate}
\end{enumerate}

## III-DIF-387（レベル4）

$\alpha$ を $\alpha>-1$ をみたす実数とし，
\[c_n=1+\frac12+\frac13+\cdots+\frac1n-\log(n+\alpha)\quad(n=1,2,3,\ldots)\]
とおく．また，$y>0$ に対して $\varphi(y)=\dfrac1{e^y-1}-\dfrac1y$ とする．
\begin{enumerate}
  \item $\varphi(y)$ は $y>0$ で増加することを示せ．
  \item すべての自然数 $n$ について $c_{n+1}<c_n$ が成り立つような $\alpha$ の値の範囲を求めよ．また，すべての自然数 $n$ について $c_{n+1}>c_n$ が成り立つような $\alpha$ の値の範囲を求めよ．
\end{enumerate}

## III-DIF-389（レベル4）

$k$，$d$ を正の定数とし，$f(x)=x^2(x-d)^2e^{kx}$ とする．
\begin{enumerate}
  \item $f(x)$ が極値をとる $x$ の値（極値点）はちょうど4つあることを示し，そのそれぞれで $f(x)$ が極大値・極小値のどちらをとるかを答えよ．
  \item 4つの極値点から3つを選び，適当な順に並べると等差数列になるようにできるための $kd$ の値をすべて求めよ．
  \item どのような正の定数 $k$，$d$ と実数 $t$ に対しても，4つの極値点と $t$ の合わせて5つの数を，どのような順に並べても等差数列にはならないことを示せ．
\end{enumerate}

## III-DIF-392（レベル4）

$f(x)=\log x+\dfrac1x\ (x>0)$ とし，$a$ は $a>1$ をみたす定数とする．
\begin{enumerate}
  \item 方程式 $f(x)=a$ はちょうど2つの実数解をもつことを示せ．以下，その2つの解を $x_1,\ x_2\ (x_1<x_2)$ とする．
  \item $x_1x_2>1$ を示せ．
  \item $\dfrac1{x_1}+\dfrac1{x_2}>2$ を示せ．
\end{enumerate}

## III-DIF-393（レベル4）

正の数 $a,\ b,\ c$ が
\[
2a\geqq3c,\qquad b\leqq8c,\qquad c\log b\geqq a+c\log c
\]
をみたしながら動くとき，$\dfrac{b}{a-c}$ のとりうる値の範囲を求めよ．ただし $\log$ は自然対数である．

## III-DIF-395（レベル4）

関数 $f(x)=xe^{x}$ について，曲線 $C:\ y=f(x)$ 上の点 $\mathrm P(t,\ te^{t})$ における $C$ の接線を $\ell_t$ とする．
\begin{enumerate}
  \item $f(x)$ の増減と $C$ の凹凸を調べよ．
  \item $\ell_t$ と $C$ の共有点が P だけであるような実数 $t$ の値の範囲を求めよ．
\end{enumerate}

## III-DIF-398（レベル4）

$f(x)=x\log x\ (x>0)$ とし，$a$ を $-\dfrac1e<a<0$ をみたす定数とする．
\begin{enumerate}
  \item 方程式 $f(x)=a$ はちょうど2つの実数解 $x_1,x_2$（$x_1<x_2$）をもち，$0<x_1<\dfrac1e<x_2<1$ であることを示せ．
  \item $x_2-x_1<1+2a+\dfrac1{e^2}$ を示せ．
  \item $x_2-x_1>1+ea$ を示せ．
\end{enumerate}

## III-DIF-399（レベル4）

$a>0$ とし，$f(x)=e^{ax}\sin x\ (x\geqq0)$ とする．$f(x)$ が極値をとる $x$ を小さい順に $x_1,x_2,x_3,\cdots$ とする．
\begin{enumerate}
  \item 数列 $\{f(x_n)\}$ は等比数列であることを示し，その公比を求めよ．
  \item $a\geqq1$ ならば，すべての正の整数 $n$ について $x_n^{\,2}<|f(x_n)|$ が成り立つことを示せ．
  \item $a=\dfrac12$ のとき，$x_1^{\,2}>|f(x_1)|$ であることを示せ．ただし $e<2.72$，$\pi>3.14$，$\sqrt5>2.236$ を用いてよい．
\end{enumerate}

## III-DIF-400（レベル4）

$\log$ は自然対数とする．
\begin{enumerate}
  \item 実数の組 $(a,\,b)$ で，次の条件をみたすものをすべて求めよ．
  \begin{center}
  「ある正の数 $t$ が存在して，$0<x<t$ をみたすすべての $x$ について\\
  $1+bx>0$ かつ $\left|\log(1+x)-\dfrac{ax}{1+bx}\right|<x^3$ が成り立つ．」
  \end{center}
  \item $\dfrac{17}{25}<\log2<\dfrac7{10}$ を示せ．
\end{enumerate}

## III-INT-714（レベル4）

$m$，$M$ は $0<m<M$ をみたす定数とする．区間 $0\leqq x\leqq1$ で連続な関数 $f(x)$ が，この区間で $m\leqq f(x)\leqq M$ をみたすとき，
\[I=\int_0^1f(x)\,dx,\qquad J=\int_0^1\frac{dx}{f(x)}\]
とおく．
\begin{enumerate}
  \item $IJ<\dfrac{(m+M)^2}{4mM}$ が成り立つことを示せ．
  \item $c<\dfrac{(m+M)^2}{4mM}$ をみたす任意の実数 $c$ に対して，区間 $0\leqq x\leqq1$ で連続かつ $m\leqq f(x)\leqq M$ をみたす関数 $f(x)$ で $IJ>c$ となるものが存在することを示せ．
\end{enumerate}

## III-INT-715（レベル4）

$0<x<1$ とし，数列 $\{u_k\}$ を
\[u_0=x,\qquad u_{k+1}=u_k^{\,2}\quad(k=0,1,2,\cdots)\]
で定める．正の整数 $n$ に対して
\[Q_n=\sum_{k=0}^{n-1}\left(u_k^{\,3}-u_k^{\,4}\right)\]
とおく．
\begin{enumerate}
  \item すべての正の整数 $n$ に対して $Q_n<\dfrac12$ が成り立つことを示せ．
  \item すべての正の整数 $n$ に対して $Q_n>\dfrac{x^3-u_n^{\,3}}3$ が成り立つことを示せ．
  \item $x$ と $n$ をうまく選ぶと $Q_n>\dfrac{33}{100}$ となることを示せ．
\end{enumerate}

## III-INT-723（レベル4）

実数全体で定義された連続関数 $f(x)$ が次の条件をみたしている．
\begin{itemize}
  \item すべての実数 $x$ で $f(x)\geqq0$ であり，$x<0$ では $f(x)=-xe^{-x}$ である．
  \item すべての正の数 $t$ について，$x$ の方程式 $f(x)=t$ は異なる実数解をちょうど $2$ 個もつ．その小さい方を $g(t)$，大きい方を $h(t)$ とすると，ある定数 $k$ が存在して，すべての正の数 $t$ について $h(t)=\{g(t)\}^2+k$ が成り立つ．
\end{itemize}
\begin{enumerate}
  \item $k\geqq0$ であることと，$0\leqq x\leqq k$ で $f(x)=0$ であることを示せ．
  \item $x>k$ における $f(x)$ を $x$，$k$ で表せ．
  \item $\displaystyle\int_0^9f(x)\,dx=4e^2-4$ であるとき，$k$ の値と $\dfrac{f(14)}{f(9)}$ の値を求めよ．
\end{enumerate}

## III-LIM-314（レベル4）

実数全体で定義された関数 $f(x)$ が次の条件 (i)，(ii)，(iii) をみたしている．
\begin{enumerate}[label=(\roman*)]
  \item $y=f(x)$ のグラフは原点に関して対称であり，直線 $x=1$ に関しても対称である．
  \item $0\leqq x_1\leqq\dfrac12$，$0\leqq x_2\leqq\dfrac12$ をみたすすべての $x_1$，$x_2$ に対して $f(x_1+x_2)=f(x_1)+f(x_2)$．
  \item $0\leqq x<y\leqq1$ ならば $f(x)\leqq f(y)$ であり，$f(1)=1$．
\end{enumerate}
\begin{enumerate}
  \item すべての実数 $x$ に対して $f(x+4)=f(x)$ が成り立つことを示せ．
  \item $0\leqq x\leqq1$ のとき $f(x)=x$ であることを示せ．
  \item 方程式 $15f(x)=x$ の実数解の個数を求めよ．
\end{enumerate}

## X-MIX-086（レベル4）

$S$ を実数からなる集合とする．実数全体で定義された関数 $f(x)$ が「$x_1-x_2$ が $S$ に属するような任意の実数 $x_1,\ x_2$ に対して，$f(x_1)-f(x_2)$ も $S$ に属する」をみたすとき，$f$ は $S$ 関連であるという．実数 $x$ を超えない最大の整数を $[x]$ で表す．

$c>1$ をみたす実数 $c$ に対し，$1\leqq t\leqq c$ をみたす実数 $t$ 全体の集合を $A_c$，$t\geqq0$ をみたす実数 $t$ 全体の集合を $B$ とする．次の命題 $P(c)$ を考える．
\begin{center}
$P(c)$：実数全体で定義された任意の関数 $f$ について，「$f$ が $A_c$ 関連である」ことと「$f$ が $\{1\}$ 関連であり，かつ $B$ 関連である」こととは同値である．
\end{center}
\begin{enumerate}
  \item $c$ が2以上の整数ならば $P(c)$ は真であることを示せ．
  \item $P(c)$ が真となる $c>1$ をすべて求めよ．
\end{enumerate}

## X-MIX-088（レベル4）

$n$ を自然数とする．
\begin{enumerate}
  \item すべての実数 $x$，$y$ に対して
  \[|\cos nx-\cos ny|\leqq n^2|\cos x-\cos y|\]
  が成り立つことを示せ．
  \item 正の数 $c$ が「すべての実数 $x$，$y$ に対して $|\cos nx-\cos ny|\leqq c|\cos x-\cos y|$」をみたすならば，$c\geqq n^2$ であることを示せ．
  \item $n\geqq2$ とする．(1) の不等式で等号が成り立つための必要十分条件は $\cos x=\cos y$ であることを示せ．
\end{enumerate}

## A-COM-493（レベル5）

数列 $a_1,a_2,\cdots,a_N$ から $i_1<i_2<\cdots<i_s$ をみたす第 $i_1$ 項，第 $i_2$ 項，$\cdots$，第 $i_s$ 項を取り出し，$a_{i_1}<a_{i_2}<\cdots<a_{i_s}$ となるとき，数列 $a_{i_1},a_{i_2},\cdots,a_{i_s}$ を長さ $s$ の増加部分列とよび，$a_{i_s}$ をその末項とよぶ（1つの項だけからなる数列も長さ1の増加部分列とする）．長さ $s$ の増加部分列が存在するとき，それらの末項のうち最小のものを $T_s$ とする．
\begin{enumerate}
  \item 数列 $3,6,1,5,2,8,4,7$ について，$T_s$ が定まる $s$ をすべて挙げ，それぞれの $T_s$ を求めよ．
  \item $m\geqq2$ とし，$1,2,\cdots,2m$ を1列に並べた数列 $a_1,a_2,\cdots,a_{2m}$ が次の条件(i)をみたすとする．
  \begin{center}
  (i)\ 長さ $m+1$ の増加部分列は存在せず，$s=1,2,\cdots,m$ に対して $T_s=2s-1$ である．
  \end{center}
  このとき，各 $s=1,2,\cdots,m$ に対して，長さ $s$ で末項が $2s-1$ である増加部分列は $2^{s-1}$ 個以下であることを示せ．
  \item $m\geqq2$ とする．$1,2,\cdots,2m$ の並べ方のうち，(i) と次の条件(ii)をともにみたすものの個数を $m$ で表せ．
  \begin{center}
  (ii)\ $s=1,2,\cdots,m$ に対して，長さ $s$ で末項が $2s-1$ である増加部分列はちょうど $2^{s-1}$ 個ある．
  \end{center}
\end{enumerate}

## A-COM-495（レベル5）

石が全部で8個あり，いくつかの山（どの山にも石が1個以上ある）に分かれている．山の個数を $m$ とし，各山の石の個数を大きい順に並べた組 $B=(b_1,b_2,\dots,b_m)$（$b_1\geqq b_2\geqq\dots\geqq b_m\geqq1$）をこのときの状態とよぶ．次の操作を考える．
\begin{center}
操作：すべての山から石を1個ずつ取り，取った $m$ 個の石で新しい山を1つ作る．\\
（石がなくなった山は消える．）
\end{center}
状態 $B$ に操作を1回行った後の状態を $T(B)$ と書く．すなわち $T(B)$ は，$m$，$b_1-1$，$\dots$，$b_m-1$ のうち正であるものを大きい順に並べたものである．また，状態 $B$ に対して
\[P(B)=\sum_{i=1}^m\left(ib_i+\frac{b_i(b_i+1)}2\right)\]
と定める．
\begin{enumerate}
  \item すべての状態 $B$ について $P(T(B))\leqq P(B)$ であることを示せ．さらに，等号が成り立つのは $b_1\leqq m+1$ のときであり，かつそのときに限ることを示せ．
  \item 状態 $B_0$ から始めて $B_{k+1}=T(B_k)$（$k=0,1,2,\dots$）と定める．どのような $B_0$ から始めても，ある番号から先の $B_k$ はすべて，ある6個の状態のいずれかになることを示し，その6個の状態を求めよ．ただし，求める6個の状態はどれも，ある $B_0$ に対しては番号をいくら大きくしても現れることも示すこと．
\end{enumerate}

## A-COM-496（レベル5）

$N$ を3以上の整数とする．相異なる $N$ 個の実数の列 $a_1,a_2,\cdots,a_N$ が{\bf 単峰}であるとは，ある番号 $p$（$1\leqq p\leqq N$）があって
\[a_1<a_2<\cdots<a_p\quad\text{かつ}\quad a_p>a_{p+1}>\cdots>a_N\]
となることをいう（$p=1$ のときは前半の条件，$p=N$ のときは後半の条件を考えない）．この $p$ を{\bf 峰}とよぶ．

単峰な列が1つ隠されている．1回の{\bf 質問}では番号 $i$ を1つ指定し，$a_i$ の値を教えてもらう．次にどの番号を指定するかは，それまでに教わった値を見て決めてよい．質問をくり返して峰 $p$ を確定させたい．
\begin{enumerate}
  \item $1\leqq i<j\leqq N$ とする．$a_i<a_j$ ならば $p>i$ であり，$a_i>a_j$ ならば $p<j$ であることを示せ．
  \item $N=12$ のとき，5回の質問で必ず $p$ を確定できる質問のしかたを1つ示し，それで確定できることを証明せよ．
  \item $N=13$ のとき，どのような質問のしかたをしても，5回の質問では $p$ を確定できない場合があることを示せ．
\end{enumerate}

## A-INT-455（レベル5）

$k$ を2以上の整数とする．$k$ 個の整数からなる集合 $A$ が
\begin{center}
「$a\in A$ ならば $-a\notin A$」
\end{center}
をみたすとする．$a\in A$，$b\in A$，$a+b\in A$ をみたす順序対 $(a,b)$（$a=b$ でもよい）の個数を $m(A)$ と書く．
\begin{enumerate}
  \item $m(A)$ は，$c\in A$，$b\in A$，$c-b\in A$ をみたす順序対 $(c,b)$ の個数に等しいことを示せ．
  \item $k$ を固定して $A$ を上の条件のもとで動かすとき，$m(A)$ の最大値を $k$ で表せ．また，最大値をとる $A$ をすべて求めよ．
\end{enumerate}

## B-SEQ-302（レベル5）

\begin{enumerate}
  \item 正の数 $x_1,x_2,\cdots,x_n$ に対して
  \[\left(\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}\right)\left(1^2x_1+2^2x_2+\cdots+n^2x_n\right)\geqq\left\{\frac{n(n+1)}2\right\}^2\]
  を示せ．
  \item 正の整数 $k\leqq N$ に対して $\displaystyle\sum_{n=k}^{N}\frac1{n(n+1)^2}<\frac1{2k^2}$ を示せ．
  \item 各項が正の数列 $\{a_n\}$ に対し $H_n=\dfrac1{a_1}+\dfrac1{a_2}+\cdots+\dfrac1{a_n}$ とおく．すべての正の整数 $N$ について
  \[\sum_{n=1}^{N}\frac{n}{H_n}<2\sum_{n=1}^{N}a_n\]
  が成り立つことを示せ．
\end{enumerate}

## B-SEQ-326（レベル5）

$n\geqq3$ とする．$n$ 個の実数からなる集合 $A=\{a_1,a_2,\dots,a_n\}$（$1\leqq a_1<a_2<\dots<a_n$）が次の性質Qをもつとする．
\begin{center}
性質Q：$1\leqq i<j\leqq n$ をみたす任意の $i,j$ について，$a_ia_j$ と $\dfrac{a_j}{a_i}$ の少なくとも一方が $A$ に属する．
\end{center}
\begin{enumerate}
  \item 集合 $\{2,3,6\}$，$\{2,3,6,18\}$ のそれぞれについて，性質Qをもつかどうかを判定せよ．
  \item 性質Qをもつ $A$ について，次を示せ．
  \begin{itemize}
    \item $a_1>1$ ならば，$k=1,2,\dots,n-1$ に対して $a_ka_{n-k}=a_n$．
    \item $a_1=1$ ならば，$k=1,2,\dots,n$ に対して $a_ka_{n+1-k}=a_n$．
  \end{itemize}
  \item $n=5$ のとき，性質Qをもつ集合 $A$ をすべて求めよ．
\end{enumerate}

## II-EQ-267（レベル5）

$p,q,r$ を実数とし，$f(x)=x^2+2x$，$g(x)=x^3+px^2+qx+r$ とする．次の条件(C)を考える．
\begin{center}
(C)　方程式 $f(x)=0$ の実数解はすべて方程式 $g(f(x))=0$ の解であり，\\逆に $g(f(x))=0$ の実数解はすべて $f(x)=0$ の解である．
\end{center}
\begin{enumerate}
  \item (C) が成り立つならば $r=0$ であることを示せ．
  \item (C) が成り立つような点 $(p,q)$ の範囲を求めよ．
\end{enumerate}

## III-DIF-373（レベル5）

$a$ を $0$ でない実数とし，$x>0$ で定義された関数 $f(x)=a\log x+\sqrt{x+1}$ を考える．条件
\[
(\ast)\qquad\text{すべての正の実数 } x \text{ に対して } f(x)\leqq\frac{\sqrt x}{2a}
\]
について，次の問いに答えよ．ただし $e=2.718\cdots$ は自然対数の底であり，$\log$ は自然対数を表す．
\begin{enumerate}
  \item $(\ast)$ が成り立つならば $0<a\leqq\dfrac{\sqrt2}4$ であることを示せ．
  \item $\dfrac14\leqq a\leqq\dfrac{\sqrt2}4$ ならば $(\ast)$ が成り立つことを示せ．
  \item $a=\dfrac1{10}$ のとき $(\ast)$ は成り立たないことを示せ．
\end{enumerate}

## III-DIF-374（レベル5）

$b>e^4$ とし，$f(x)=e^x-bx+e^2$ とする．ただし $e$ は自然対数の底，$\log$ は自然対数を表し，$L=\log b$ とおく．
\begin{enumerate}
  \item $f(x)=0$ はちょうど2つの実数解 $x_1,\ x_2\ (x_1<x_2)$ をもち，$0<x_1<1$，$L<x_2<L+2\log L$ であることを示せ．
  \item $x_2>\dfrac{bL}{e^2+1}\,x_1$ であることを示せ．
  \item $0<c<e^2+1$ をみたす任意の定数 $c$ に対して，ある $b>e^4$ では $x_2<\dfrac{bL}{c}\,x_1$ となることを示せ．
\end{enumerate}

## III-INT-721（レベル5）

$f(x)$ は $x\geqq0$ で定義された連続な関数で，$x\geqq0$ で増加し，$f(0)=0$ かつ $f(x)$ の値域は $0$ 以上の実数全体であるとする．さらに $f(x)$ は $x>0$ で微分可能で，$f'(x)$ は $x>0$ で連続とする．$f(x)$ の逆関数を $g(x)$ とするとき，
\[
g(x+1)=f(x)+1\qquad(x\geqq0)
\]
が成り立つとする．
\begin{enumerate}
  \item $0$ 以上の整数 $n$ について $f(n)=n$ を示せ．さらに $I_n=\displaystyle\int_n^{n+1}f(x)\,dx$ とおくとき，$1$ 以上の整数 $n$ について $I_n+I_{n-1}=2n$ を示せ．
  \item 正の整数 $N$ について $\displaystyle\int_0^{2N}\{f(x)-x\}\,dx=0$ を示せ．
  \item $0\leqq x\leqq1$ で $f(x)=\dfrac{x}{2-x}$ となる，上の条件をみたす関数 $f(x)$ がただ1つ存在することを示し，$1\leqq x\leqq2$ における $f(x)$ を求めよ．
  \item (3) の $f(x)$ について，正の整数 $N$ に対し $\displaystyle\int_0^{2N+1}x f'(x)\,dx$ を求めよ．
\end{enumerate}

## III-LIM-312（レベル5）

数列 $\{a_n\}$ を
\[
a_1=\frac12,\qquad a_{n+1}=a_n-a_n^3\quad(n=1,2,3,\dots)
\]
で定め，$T_n=a_1^3+a_2^3+\cdots+a_n^3$ とおく．
\begin{enumerate}
  \item すべての $n$ について $0<a_{n+1}<a_n\leqq\dfrac12$ が成り立つことを示し，$T_n$ を $a_{n+1}$ で表せ．
  \item すべての $n$ について $2\leqq\dfrac1{a_{n+1}^2}-\dfrac1{a_n^2}\leqq2+\dfrac{16}3a_n^2$ を示せ．
  \item すべての $n$ について $2n+2\leqq\dfrac1{a_n^2}\leqq2n+2+\dfrac83\log n$ を示せ．
  \item 極限 $\displaystyle\lim_{n\to\infty}\sqrt n\,a_n$ と $\displaystyle\lim_{n\to\infty}\sqrt n\left(\frac12-T_n\right)$ を求めよ．
\end{enumerate}

## X-MIX-082（レベル5）

実数全体で定義された連続関数 $f(x)$ が，$x<y$ ならば $f(x)<f(y)$ をみたしているとする．正の数 $T$ が，すべての実数 $x$ に対して $\cos f(x+T)=\cos f(x)$ をみたすとき，$T$ を $f$ の{\bf 余弦周期}とよぶ．
\begin{enumerate}
  \item $T$ が $f$ の余弦周期ならば，各実数 $x$ に対して，$f(x+T)-f(x)$ と $f(x+T)+f(x)$ の少なくとも一方は $2\pi$ の整数倍であることを示せ．
  \item $T$ が $f$ の余弦周期ならば，ある正の整数 $N$ があって，すべての実数 $x$ に対して $f(x+T)=f(x)+2N\pi$ が成り立つことを示せ．
  \item $1$ が $f$ の余弦周期であるとし，(2) で $T=1$ としたときの正の整数を $N$ とする．正の数 $S$ も $f$ の余弦周期ならば，$NS$ は整数であることを示せ．特に，$1$ と $\sqrt2$ がともに余弦周期となるような $f$ は存在しないことを示せ．
  \item $f(x)=4\pi x+\sin2\pi x$ は問題文の条件をみたし，$1$ を余弦周期にもち，(3) の $N$ が $2$ であることを示せ．さらに，$S=\dfrac12$ は $NS$ が整数であるにもかかわらず $f$ の余弦周期でないことを示せ．
\end{enumerate}

## X-MIX-085（レベル5）

実数全体で定義された関数 $f(x)$，$g(x)$ が次をみたすとする．
\begin{itemize}
  \item すべての実数 $x$ で $f(x)>0$ であり，$x_1<x_2$ ならば $f(x_1)\leqq f(x_2)$ である．
  \item すべての実数 $x$ で $g(x)>0$ であり，ある正の数 $T_g$ に対して $g(x+T_g)=g(x)$ がすべての $x$ で成り立つ．また $g(x)$ は最大値 $M$ をもつ．
\end{itemize}
$h(x)=f(x)g(x)$ とする．さらに，正の定数 $T,\ \lambda$ があって，すべての実数 $x$ に対して $h(x+T)=\lambda h(x)$ が成り立つとする．
\begin{enumerate}
  \item $\lambda\geqq1$ であることを示せ．
  \item $\lambda=1$ であるための必要十分条件は，$f(x)$ が定数関数であることである．これを示せ．
  \item 任意の $\lambda>1$ に対して，上の条件をすべてみたす $f,\ g,\ T$ の例を1つ挙げよ．
\end{enumerate}

## X-MIX-090（レベル5）

有限個の正の数が与えられていて，どの数も $25$ 以下であり，その総和は $640$ である．これらの数を次の手順で組に分ける．

まず，和が $100$ 以下となるように1個以上の数を選んで第1組とする．ただしその選び方は，$100$ から選んだ数の和を引いた値（これを第1組の{\bf 余り}といい $r_1$ で表す）が，和が $100$ 以下となるすべての選び方の中で最小になるようにする（そのような選び方が複数あるときはどれを選んでもよい）．次に，第1組に入れた数を除いた残りの数から同じ規則で第2組を作り，その余りを $r_2$ とする．これを数がなくなるまでくり返し，最後にできた組を第 $N$ 組，その余りを $r_N$ とする．
\begin{enumerate}
  \item $r_1\leqq r_2\leqq\cdots\leqq r_N$ を示せ．また $1\leqq n<N$ のとき，第 $n$ 組を作ったあとに残っている数はどれも $r_n$ より大きいこと，および第 $N$ 組以外の組はどれも4個以上の数を含むことを示せ．
  \item $2\leqq n<N$ のとき，$r_{n-1}>\dfrac{100n-640}{n-1}$ が成り立つことを示せ．
  \item $N\leqq8$ であることを示せ．また，$N=8$ となるような数の例を1つ挙げ，実際に $N=8$ となることを確かめよ．
\end{enumerate}
