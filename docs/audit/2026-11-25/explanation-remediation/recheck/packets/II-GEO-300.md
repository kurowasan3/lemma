# II-GEO-300

## 監査で指摘された内容

(2) η を y-m=0 という書き方でだけ計算しており，一般の表示 qy+r=0 でも符号が変わらないことの説明がない（B）。

## 問題文

直線 $l:\ px+qy+r=0$ と2点 $\mathrm P_1(x_1,y_1)$，$\mathrm P_2(x_2,y_2)$ に対し $\eta=(px_1+qy_1+r)(px_2+qy_2+r)$ とおき，$\eta<0$ のとき「$\mathrm P_1,\mathrm P_2$ は $l$ で隔てられる」という．曲線 $K$ と直線 $l$ が共有点をもたず，かつ $K$ 上に $l$ で隔てられる2点が存在するとき，$l$ を $K$ の\textbf{分割線}とよぶ．

$c$ を正の定数とし，点 $\mathrm Q(0,2)$ をとる．点 P から Q までの距離と，P から $x$ 軸までの距離の積が $c$ に等しいような点 P の軌跡を $E$ とする．
\begin{enumerate}
  \item $E$ の方程式を求めよ．また，$x$ 軸に平行でないどんな直線も $E$ と共有点をもつことを示せ．
  \item $E$ の分割線をすべて求めよ（$c$ の値で場合分けして答えよ）．
\end{enumerate}

## 答え（修正後）

(1) $(x^2+(y-2)^2)y^2=c^2$，証明　(2) $c\geqq1$ のとき直線 $y=0$ のみ；$0<c<1$ のとき直線 $y=0$ と，直線 $y=m$（$1-\sqrt{1-c}<m<1+\sqrt{1-c}$）

## 解答・解説（修正後，全文） main

(1) P$(x,y)$ について $\mathrm{PQ}=\sqrt{x^2+(y-2)^2}$，P と $x$ 軸の距離は $|y|$ である．条件 $\mathrm{PQ}\cdot|y|=c$ は，両辺が0以上なので2乗した
\[
\boldsymbol{\bigl(x^2+(y-2)^2\bigr)y^2=c^2}
\]
と同値であり，これが $E$ の方程式である．$G(x,y)=\bigl(x^2+(y-2)^2\bigr)y^2-c^2$ とおく．

$x$ 軸に平行でない直線 $l$ は，$y$ 座標が $0$ である点 $\mathrm A$ と，$y$ 座標が $c+2$ である点 $\mathrm B$ をもつ．
A では $G=-c^2<0$．B$(x_{\mathrm B},c+2)$ では
\[
G\geqq(c+2-2)^2(c+2)^2-c^2=c^2\bigl\{(c+2)^2-1\bigr\}>0 .
\]
線分 AB 上の点を $\mathrm A+s(\mathrm B-\mathrm A)$ $(0\leqq s\leqq1)$ と表すと，$G$ の値は $s$ の多項式で連続だから，中間値の定理により $G=0$ となる $s$ が $0<s<1$ に存在する．その点は $l$ と $E$ の共有点である．\hfill$\square$

(2) (1) より，$x$ 軸に平行でない直線は $E$ と共有点をもつので分割線ではない．分割線は $y=m$ の形に限られる．

$E$ 上の点の $y$ 座標のとりうる値の集合を $Y$ とする．$y=0$ をみたす点は $G=-c^2\neq0$ なので $E$ 上にない．$y\neq0$ のとき，$G(x,y)=0\iff x^2=\dfrac{c^2}{y^2}-(y-2)^2$ だから，そのような $x$ が存在する条件は $\dfrac{c^2}{y^2}\geqq(y-2)^2$，すなわち $|y(y-2)|\leqq c$．よって
\[
Y=\{\,y\mid y\neq0,\ -c\leqq y^2-2y\leqq c\,\}=\{\,y\mid y\neq0,\ 1-c\leqq(y-1)^2\leqq1+c\,\}.
\]
直線 $y=m$ について，2点の $\eta$ の符号は $(y_1-m)(y_2-m)$ の符号と同じである．実際，この直線の方程式を $qy+r=0$（$q\neq0$，$m=-\dfrac rq$）と書くと $\eta=(qy_1+r)(qy_2+r)=q^2(y_1-m)(y_2-m)$ で，$q^2>0$ だから，符号は方程式の書き方によらない．したがって $y=m$ が分割線であるための必要十分条件は
\begin{center}
「$m\notin Y$（共有点がない）かつ，$y_1<m<y_2$ となる $y_1,y_2\in Y$ が存在する」
\end{center}
である．$\alpha=1-\sqrt{1+c}$，$\beta=1+\sqrt{1+c}$ とおくと $\alpha<0<\beta$ で，$Y$ の要素はすべて $\alpha$ 以上 $\beta$ 以下であり，$\alpha,\beta\in Y$．よって条件は「$\alpha<m<\beta$ かつ $m\notin Y$」と同値である．

(i) $c\geqq1$ のとき：$1-c\leqq0$ なので $Y=\{y\mid\alpha\leqq y\leqq\beta,\ y\neq0\}$．$\alpha<m<\beta$ で $m\notin Y$ となるのは $m=0$ のみ．

(ii) $0<c<1$ のとき：$\gamma_1=1-\sqrt{1-c}$，$\gamma_2=1+\sqrt{1-c}$ とおくと $0<\gamma_1<1<\gamma_2$ で，
$Y=\{y\mid\alpha\leqq y\leqq\gamma_1\ \text{または}\ \gamma_2\leqq y\leqq\beta\}$ から $0$ を除いた集合．$\alpha<m<\beta$ で $m\notin Y$ となるのは $m=0$ または $\gamma_1<m<\gamma_2$．

以上より，分割線は次の通り．
\begin{itemize}
  \item $c\geqq1$ のとき：$\boldsymbol{\text{直線 } y=0 \text{ のみ}}$．
  \item $0<c<1$ のとき：$\boldsymbol{\text{直線 } y=0}$ と $\boldsymbol{\text{直線 } y=m\ \bigl(1-\sqrt{1-c}<m<1+\sqrt{1-c}\bigr)}$．
\end{itemize}

## 着想（修正後）

曲線の方程式 $F(x,y)=0$ に直線上の点を代入した1変数関数が，直線上の2点で異符号になれば中間値の定理で共有点がある．$x$ 軸上の点と $y$ 座標が十分大きい点を選ぶと，水平でない直線はすべて曲線と交わり，分割線の候補は水平線に限られる．水平線 $y=m$ については，曲線上の点の $y$ 座標のとりうる値の集合を求め，$m$ がその「すき間」にあるかどうかで決まる．

## 修正前との差分

```diff
--- 修正前 solution main
+++ 修正後 solution main
@@ -19,3 +19,3 @@
 \]
-直線 $y=m$（方程式 $y-m=0$）について，2点の $\eta$ は $(y_1-m)(y_2-m)$ である．したがって $y=m$ が分割線であるための必要十分条件は
+直線 $y=m$ について，2点の $\eta$ の符号は $(y_1-m)(y_2-m)$ の符号と同じである．実際，この直線の方程式を $qy+r=0$（$q\neq0$，$m=-\dfrac rq$）と書くと $\eta=(qy_1+r)(qy_2+r)=q^2(y_1-m)(y_2-m)$ で，$q^2>0$ だから，符号は方程式の書き方によらない．したがって $y=m$ が分割線であるための必要十分条件は
 \begin{center}
```
