# II-CAL-312

## 監査で指摘された内容

(3) 「3c(3-β)=3, c(β-1)=3 を辺々加えて 2c=4」は第1式を3で割る一段が抜けている（C）。

## 問題文

最高次の係数が正である3次関数 $f(x)$ と実数 $t$ に対し，関数 $g(x)$ を
\[
g(x)=\begin{cases}-f(x) & (x<t)\\ \ \ f(x) & (x\geqq t)\end{cases}
\]
で定める．$g(x)$ は実数全体で連続であり，さらにすべての実数 $a$ について，2つの極限
\[
R(a)=\lim_{x\to a+0}\frac{g(x)}{x(x-2)},\qquad L(a)=\lim_{x\to a-0}\frac{g(x)}{x(x-2)}
\]
がともに（有限の値として）存在するとする．$R(m)<0$ となる整数 $m$ 全体の集合を $P$，$L(m)<0$ となる整数 $m$ 全体の集合を $Q$ とする．
\begin{enumerate}
  \item 正の数 $c$ と実数 $\beta$ を用いて $f(x)=cx(x-2)(x-\beta)$ と表せること，および $t$ は $0,\ 2,\ \beta$ のいずれかに等しいことを示せ．
  \item $P,\ Q$ はともに有限個の整数からなることを示せ．さらに，$P$ と $Q$ の要素の個数の和が奇数ならば，$t$ は $0$ または $2$ であり，かつ $t\neq\beta$ であることを示せ．
  \item $P$ と $Q$ の要素の個数の和が $5$ であり，$P$ に属する整数の総和が $g(3)$ に，$Q$ に属する整数の総和が $g(1)$ に等しいとする．$f(x)$，$t$ および $g(-3)$ を求めよ．
\end{enumerate}

## 答え（修正後）

(1) 証明　(2) 証明　(3) $f(x)=2x^3-9x^2+10x$，$t=0$，$g(-3)=165$

## 解答・解説（修正後，全文） main

(1) \textbf{$f(t)=0$．}$g$ は $x=t$ で連続なので $\displaystyle\lim_{x\to t-0}g(x)=g(t)$．左辺は $f$ の連続性から $-f(t)$，右辺は $f(t)$ である．よって $f(t)=0$．

\textbf{$f(0)=f(2)=0$．}$R(0)$ が存在するので，$0<x<2$ で $g(x)=\dfrac{g(x)}{x(x-2)}\cdot x(x-2)$ と書いて $x\to+0$ とすると
\[
\lim_{x\to+0}g(x)=R(0)\cdot0=0 .
\]
$g$ は $x=0$ で連続だから $g(0)=0$．$g(0)$ は $f(0)$ または $-f(0)$ なので $f(0)=0$．同様に $R(2)$ の存在から $g(2)=0$，よって $f(2)=0$．

因数定理より $f(x)=x(x-2)(cx+d)$（$c,d$ は実数）と書け，$c$ は $f$ の最高次の係数なので $c>0$．$\beta=-\dfrac{d}{c}$ とおけば $f(x)=cx(x-2)(x-\beta)$．$t$ は $f$ の零点だから $t\in\{0,2,\beta\}$．\hfill$\square$

(2) $\sigma(x)=-1\ (x<t)$，$\sigma(x)=1\ (x\geqq t)$ とおくと，$x\neq0,2$ で
\[
\frac{g(x)}{x(x-2)}=\sigma(x)\,c\,(x-\beta).
\]
$a$ の右側の近く（$a<x<a+\delta$）では，$a\geqq t$ なら $\sigma=1$，$a<t$ なら $\delta$ を小さくとれば $\sigma=-1$．左側の近くでは，$a>t$ なら $\sigma=1$，$a\leqq t$ なら $\sigma=-1$．よって
\[
R(a)=\begin{cases}c(a-\beta)&(a\geqq t)\\-c(a-\beta)&(a<t)\end{cases},\qquad
L(a)=\begin{cases}c(a-\beta)&(a>t)\\-c(a-\beta)&(a\leqq t)\end{cases}
\]
（これらは確かに存在する）．$c>0$ なので，$R(m)<0$ となるのは「$m\geqq t$ かつ $m<\beta$」または「$m<t$ かつ $m>\beta$」のときで，いずれにせよ $m$ は $t$ と $\beta$ を両端とする閉区間に属する．この区間に含まれる整数は有限個なので $P$ は有限集合．$Q$ も同様．

$m\neq t$ なら上の式から $R(m)=L(m)$ なので，$t$ 以外の整数 $m$ については「$m\in P\iff m\in Q$」．$t$ 以外で $P$（したがって $Q$）に属する整数の個数を $k$ とする．
\begin{itemize}
  \item $t$ が整数でないとき，$P,Q$ の要素の個数はともに $k$ で，和は $2k$（偶数）．
  \item $t$ が整数で $t=\beta$ のとき，$R(t)=L(t)=0$ なので $t\notin P$，$t\notin Q$ で，和は $2k$（偶数）．
  \item $t$ が整数で $t\neq\beta$ のとき，$R(t)=c(t-\beta)$，$L(t)=-c(t-\beta)$ の一方だけが負なので，$t$ は $P,Q$ のちょうど一方に属し，和は $2k+1$（奇数）．
\end{itemize}
したがって和が奇数ならば，$t$ は整数で $t\neq\beta$．(1) より $t\in\{0,2,\beta\}$ なので $t=0$ または $t=2$．\hfill$\square$

(3) 和 $5$ は奇数なので (2) より $t\in\{0,2\}$，$t\neq\beta$ で，$2k+1=5$ から $k=2$．(2) の式より，$m>t$ では $R(m)<0\iff m<\beta$，$m<t$ では $R(m)<0\iff m>\beta$ だから，$t$ 以外で $P$ に属する整数は「$t$ と $\beta$ の間に（両端を除いて）ある整数」である．また $t\in P\iff R(t)=c(t-\beta)<0\iff t<\beta$．さらに $3\geqq t$ なので
\[
g(3)=f(3)=3c(3-\beta),\qquad g(1)=\begin{cases}f(1)=c(\beta-1)&(t=0)\\-f(1)=c(1-\beta)&(t=2)\end{cases}.
\]
\begin{itemize}
  \item $t=0,\ \beta<0$：$\beta<m<0$ の整数が2個 $\iff-3\leqq\beta<-2$．$P=\{-2,-1\}$ で総和 $-3$．一方 $g(3)=3c(3-\beta)>0$ なので不適．
  \item $t=0,\ \beta>0$：$0<m<\beta$ の整数が2個 $\iff2<\beta\leqq3$．$0<\beta$ より $0\in P$ で，$P=\{0,1,2\}$，$Q=\{1,2\}$，総和はともに $3$．条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．前者を3で割ると $c(3-\beta)=1$ で，これと後者を辺々加えて $2c=4$，$c=2$，$\beta=\dfrac52$．これは $2<\beta\leqq3$ をみたす．
  \item $t=2,\ \beta>2$：$2<m<\beta$ の整数が2個 $\iff4<\beta\leqq5$．$P=\{2,3,4\}$ で総和 $9>0$，一方 $g(3)=3c(3-\beta)<0$ なので不適．
  \item $t=2,\ \beta<2$：$\beta<m<2$ の整数が2個 $\iff-1\leqq\beta<0$．$P=\{0,1\}$，$Q=\{0,1,2\}$ で，条件は $3c(3-\beta)=1$，$c(1-\beta)=3$．前者から $c(3-\beta)=\dfrac13$，辺々引いて $2c=\dfrac13-3<0$ となり $c>0$ に反する．
\end{itemize}
（$\beta=0$ や $\beta=2$ のときは間にある整数が2個未満なので現れない．）以上より $c=2$，$\beta=\dfrac52$，$t=0$ で
\[
f(x)=2x(x-2)\left(x-\frac52\right)=\boldsymbol{2x^3-9x^2+10x},\qquad \boldsymbol{t=0}.
\]
逆にこのとき $g$ は連続（$f(0)=0$），$R,L$ は存在し，$P=\{0,1,2\}$，$Q=\{1,2\}$，$g(3)=3=0+1+2$，$g(1)=f(1)=3=1+2$ で条件をみたす．$-3<0$ より
\[
g(-3)=-f(-3)=-(-3)(-5)(-11)=\boldsymbol{165}.
\]

## 着想（修正後）

「$x<t$ で $-f$，$x\geqq t$ で $f$」が連続 $\Rightarrow f(t)=0$．分母が $0$ になる点での片側極限の存在 $\Rightarrow$ 分子もそこで $0$．こうして $f(x)=cx(x-2)(x-\beta)$，$t\in\{0,2,\beta\}$ となり，商は $\pm c(x-\beta)$．右側極限と左側極限は $x=t$ でしか食い違わないので，「負になる整数の集合」の右・左での要素数の差は $t$ だけから生じ，その偶奇から $t$ の候補が絞られる．

## 修正前との差分

```diff
--- 修正前 solution main
+++ 修正後 solution main
@@ -35,3 +35,3 @@
   \item $t=0,\ \beta<0$：$\beta<m<0$ の整数が2個 $\iff-3\leqq\beta<-2$．$P=\{-2,-1\}$ で総和 $-3$．一方 $g(3)=3c(3-\beta)>0$ なので不適．
-  \item $t=0,\ \beta>0$：$0<m<\beta$ の整数が2個 $\iff2<\beta\leqq3$．$0<\beta$ より $0\in P$ で，$P=\{0,1,2\}$，$Q=\{1,2\}$，総和はともに $3$．条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．辺々加えて $2c=4$，$c=2$，$\beta=\dfrac52$．これは $2<\beta\leqq3$ をみたす．
+  \item $t=0,\ \beta>0$：$0<m<\beta$ の整数が2個 $\iff2<\beta\leqq3$．$0<\beta$ より $0\in P$ で，$P=\{0,1,2\}$，$Q=\{1,2\}$，総和はともに $3$．条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．前者を3で割ると $c(3-\beta)=1$ で，これと後者を辺々加えて $2c=4$，$c=2$，$\beta=\dfrac52$．これは $2<\beta\leqq3$ をみたす．
   \item $t=2,\ \beta>2$：$2<m<\beta$ の整数が2個 $\iff4<\beta\leqq5$．$P=\{2,3,4\}$ で総和 $9>0$，一方 $g(3)=3c(3-\beta)<0$ なので不適．
```
