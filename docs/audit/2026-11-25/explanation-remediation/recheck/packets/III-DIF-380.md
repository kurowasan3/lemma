# III-DIF-380

## 監査で指摘された内容

(2) 結論 γ>0⟺ab<e は「解がちょうど2個」という前提の下でのみ正しく，a,b の条件としての完全な形が答えに書かれていない（B）。

## 問題文

$a,b$ を正の実数とし，$f(x)=a^x+b^x-x-2$ とする．
\begin{enumerate}
  \item 方程式 $f(x)=0$ の実数解がちょうど1個であるような $(a,b)$ の条件を求めよ．
  \item 方程式 $f(x)=0$ の実数解がちょうど2個であるとき，それは $0$ と $0$ でない数 $\gamma$ であることを示し，$\gamma>0$ となるための $a,b$ の条件を求めよ．
\end{enumerate}

## 答え（修正後）

(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；解がちょうど2個のとき $\gamma>0\iff ab<e$（$a,b$ だけの条件で書くと「$a>1$ または $b>1$」かつ $ab<e$）

## 答え（修正前）

(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；$\gamma>0\iff ab<e$

## 解答・解説（修正後，全文） main

$f(0)=1+1-0-2=0$ で，$x=0$ はつねに解である．
\[
f'(x)=a^x\log a+b^x\log b-1,\qquad f''(x)=a^x(\log a)^2+b^x(\log b)^2\geqq0 .
\]

\textbf{場合1：$a\leqq1$ かつ $b\leqq1$．}$\log a\leqq0$，$\log b\leqq0$ より $f'(x)\leqq-1<0$．$f$ は単調減少で，解は $x=0$ のただ1個．

\textbf{場合2：$a>1$ または $b>1$．}$a,b$ について対称なので $a>1$ とする．$f''(x)\geqq a^x(\log a)^2>0$ より $f'$ は単調増加．
\begin{itemize}
  \item $x\geqq0$ のとき：$b\geqq1$ なら $b^x\log b\geqq0$，$b<1$ なら $0<b^x\leqq1$ と $\log b<0$ から $b^x\log b\geqq\log b$．いずれの場合も $b^x\log b\geqq-|\log b|$ なので $f'(x)\geqq a^x\log a-|\log b|-1$ で，右辺は $x\to\infty$ で $\infty$ に発散する．したがって $f'(x_2)>0$ となる $x_2$ がある．
  \item $x\to-\infty$ のとき：$a^x\log a\to0$．また $b>1$ なら $b^x\log b\to0$，$b\leqq1$ なら $b^x\log b\leqq0$．よって $x$ を十分小さくとれば $a^x\log a+b^x\log b<\frac12$ となり，$f'(x_1)<-\frac12<0$ となる $x_1$ がある．
\end{itemize}
$f'$ は連続で単調増加だから，$f'(m)=0$ となる $m$ がただ1つ存在し，$f$ は $x\leqq m$ で減少，$x\geqq m$ で増加する（ともに狭義）．さらに $x<x_1$ では $f'(s)\leqq f'(x_1)$（$x\leqq s\leqq x_1$）より
\[
f(x)=f(x_1)-\int_x^{x_1}f'(s)\,ds\geqq f(x_1)-f'(x_1)(x_1-x)\to\infty\quad(x\to-\infty),
\]
同様に $x>x_2$ で $f(x)\geqq f(x_2)+f'(x_2)(x-x_2)\to\infty$ $(x\to\infty)$．よって $f$ は $m$ の左右それぞれで正の値をとる．
\begin{itemize}
  \item $m=0$ のとき：$f(0)=0$ が最小値で，$x\neq0$ では狭義の単調性から $f(x)>0$．解は1個．
  \item $m\neq0$ のとき：$0$ と $m$ の間で $f$ は狭義単調なので $f(m)<f(0)=0$．$x\leqq m$ と $x\geqq m$ の各範囲で $f$ は狭義単調で，$f(m)<0$ と正の値の両方をとるから，中間値の定理により各範囲にちょうど1個ずつ解がある．解はちょうど2個．
\end{itemize}
$m=0\iff f'(0)=0\iff\log a+\log b=1\iff ab=e$．

(1) 以上より，解がちょうど1個 $\iff$ $\boldsymbol{\text{「}0<a\leqq1\text{ かつ }0<b\leqq1\text{」または「}ab=e\text{」}}$．（$ab=e$ のとき $a,b$ の少なくとも一方は $1$ より大きく，場合2に入る．）

(2) 解がちょうど2個になるのは場合2で $ab\neq e$ のときに限り，解の一方は $0$，他方 $\gamma$ は $m$ に関して $0$ と反対側にある．$f'(0)=\log(ab)-1$ で $f'$ は増加だから，
$ab<e$ なら $f'(0)<0$ で $m>0$，よって $0<m<\gamma$；$ab>e$ なら $m<0$ で $\gamma<m<0$．
したがって，解がちょうど2個のとき $\boldsymbol{\gamma>0\iff ab<e}$．

ここで「解がちょうど2個」は「$a>1$ または $b>1$」かつ「$ab\neq e$」と同値なので，$a,b$ だけの条件として書くと，$\gamma>0$ となるのは「$a>1$ または $b>1$」かつ「$ab<e$」のときである（$a\leqq1$ かつ $b\leqq1$ のときも $ab<e$ だが，そのときは解が $x=0$ の1個だけで $\gamma$ は存在しない）．

## 着想（修正後）

$x=0$ はつねに零点．$f''\geqq0$ で $f'$ は増加し，$f$ は両側で正の大きな値をとるので，零点がただ1つになるのは「既知の零点 $0$ が最小点そのもの」すなわち $f'(0)=0$ のときに限る（底がともに1以下で $f$ が単調減少になる場合は別）．もう一方の零点の符号は $f'(0)$ の符号で決まる．

## 修正前との差分

```diff
--- 修正前 answer
+++ 修正後 answer
@@ -1 +1 @@
-(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；$\gamma>0\iff ab<e$
+(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；解がちょうど2個のとき $\gamma>0\iff ab<e$（$a,b$ だけの条件で書くと「$a>1$ または $b>1$」かつ $ab<e$）
--- 修正前 solution main
+++ 修正後 solution main
@@ -27,2 +27,4 @@
 $ab<e$ なら $f'(0)<0$ で $m>0$，よって $0<m<\gamma$；$ab>e$ なら $m<0$ で $\gamma<m<0$．
-したがって $\boldsymbol{\gamma>0\iff ab<e}$．
+したがって，解がちょうど2個のとき $\boldsymbol{\gamma>0\iff ab<e}$．
+
+ここで「解がちょうど2個」は「$a>1$ または $b>1$」かつ「$ab\neq e$」と同値なので，$a,b$ だけの条件として書くと，$\gamma>0$ となるのは「$a>1$ または $b>1$」かつ「$ab<e$」のときである（$a\leqq1$ かつ $b\leqq1$ のときも $ab<e$ だが，そのときは解が $x=0$ の1個だけで $\gamma$ は存在しない）．
```
