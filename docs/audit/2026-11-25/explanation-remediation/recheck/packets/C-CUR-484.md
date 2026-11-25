# C-CUR-484

## 監査で指摘された内容

(2) 各 λ≠0 で E,F が実在すること，k1+k2=0 のとき EF が直線 y=x/2-2 と一致しないことを示していない（B）。

## 問題文

楕円 $C:\dfrac{x^2}4+\dfrac{y^2}3=1$ 上の点 A$\left(1,\dfrac32\right)$ を考える．$C$ 上の2点 E，F は A と異なり，E $\neq$ F で，直線 AE，AF はどちらも $y$ 軸に平行でないとする．直線 AE，AF の傾きをそれぞれ $k_1,k_2$ とする．
\begin{enumerate}
  \item $\lambda$ を0でない定数とする．$k_1+k_2=\lambda$ をみたすような E，F をどのようにとっても，直線 EF はある定点 $\mathrm P_\lambda$ を通ることを示し，$\mathrm P_\lambda$ の座標を $\lambda$ で表せ．
  \item $\lambda$ が0以外の実数全体を動くとき，点 $\mathrm P_\lambda$ 全体の集合を求めよ．また，$k_1+k_2=0$ のとき，直線 EF はつねにその集合を含む直線と平行であることを示せ．
\end{enumerate}

## 答え（修正後）

(1) $\mathrm P_\lambda\left(1-\dfrac3\lambda,\ -\dfrac32-\dfrac3{2\lambda}\right)$　(2) 直線 $y=\dfrac12x-2$ から点 $\left(1,-\dfrac32\right)$ を除いた部分；$k_1+k_2=0$ のとき EF の傾きは $\dfrac12$（証明）

## 解答・解説（修正後，全文） main

$X=x-1$，$Y=y-\dfrac32$ と平行移動する（A が原点になる）．$C$ の式 $3x^2+4y^2=12$ は
\[
3(X+1)^2+4\left(Y+\frac32\right)^2=12\iff3X^2+4Y^2+6X+12Y=0
\]
となる．直線の傾きは平行移動で変わらない．

{\bf 傾きの方程式．}E，F は A と異なる $C$ 上の異なる2点である．直線と $C$ の共有点は高々2個なので，直線 EF は A を通らない．よって直線 EF は $uX+vY=1$（$u,v$ は実数）と表せる．E$(X_{\mathrm E},Y_{\mathrm E})$ は $C$ と EF の両方の上にあるから
\[
3X_{\mathrm E}^{\,2}+4Y_{\mathrm E}^{\,2}+(6X_{\mathrm E}+12Y_{\mathrm E})(uX_{\mathrm E}+vY_{\mathrm E})=0.
\]
AE は $y$ 軸に平行でないので $X_{\mathrm E}\neq0$ で，$k_1=\dfrac{Y_{\mathrm E}}{X_{\mathrm E}}$．$X_{\mathrm E}^{\,2}$ で割ると
\[
\varphi(k_1)=0,\qquad \varphi(k)=(4+12v)k^2+(12u+6v)k+(3+6u).
\]
同様に $\varphi(k_2)=0$．ここで $k_1\neq k_2$ である（$k_1=k_2$ なら直線 AE と AF が一致し，その直線が $C$ と3点 A，E，F を共有して矛盾）．もし $4+12v=0$ なら $\varphi$ は1次以下の式で，異なる2つの解をもつには $12u+6v=0$，$3+6u=0$ でなければならないが，$v=-\dfrac13$，$u=-\dfrac12$ では $12u+6v=-8\neq0$ となり矛盾．よって $4+12v\neq0$ で，$k_1,k_2$ は2次方程式 $\varphi(k)=0$ の2解であり
\[
k_1+k_2=-\frac{12u+6v}{4+12v}.
\]

(1) $k_1+k_2=\lambda$ とすると $-(12u+6v)=\lambda(4+12v)$，すなわち $12u+(6+12\lambda)v=-4\lambda$．$\lambda\neq0$ なので両辺を $-4\lambda$ で割ると
\[
u\cdot\left(-\frac3\lambda\right)+v\cdot\left(-\frac{3+6\lambda}{2\lambda}\right)=1.
\]
これは点 $(X,Y)=\left(-\dfrac3\lambda,\ -\dfrac{3+6\lambda}{2\lambda}\right)$ が直線 $uX+vY=1$ 上にあることを示す．この点は $u,v$ によらないから，直線 EF は E，F のとり方によらず定点を通る．$xy$ 座標に戻すと $x=1-\dfrac3\lambda$，$y=\dfrac32-\dfrac3{2\lambda}-3=-\dfrac32-\dfrac3{2\lambda}$．よって
\[
\boldsymbol{\mathrm P_\lambda\left(1-\frac3\lambda,\ -\frac32-\frac3{2\lambda}\right)}.
\]

(2) $w=\dfrac1\lambda$ とおくと，$\lambda$ が0以外の実数全体を動くとき $w$ も0以外の実数全体を動き，$\mathrm P_\lambda$ は $x=1-3w$，$y=-\dfrac32-\dfrac32w$．$w=\dfrac{1-x}3$ を代入すると $y=-\dfrac32-\dfrac{1-x}2=\dfrac12x-2$．$w\neq0$ は $x\neq1$ に対応し，$x$ は1以外の実数全体を動く．よって $\mathrm P_\lambda$ 全体の集合は
\[
\boldsymbol{\text{直線 }y=\frac12x-2\text{ から点 }\left(1,-\frac32\right)\text{ を除いた部分}}.
\]
（各 $\lambda\neq0$ について条件をみたす E，F は実際に存在するので，$\mathrm P_\lambda$ は確かに定まる．A における $C$ の接線の傾きは $-\dfrac12$ なので，$k_1\neq k_2$，$k_1+k_2=\lambda$，$k_1\neq-\dfrac12$，$k_2\neq-\dfrac12$ をみたす $k_1,k_2$ をとると，A を通り傾き $k_1,k_2$ の直線は $C$ と A 以外の点 E，F でそれぞれ交わり，傾きが異なるので E$\neq$F である．）
$k_1+k_2=0$ のときは $12u+6v=0$，すなわち $v=-2u$ で，$u=0$ なら $uX+vY=0\neq1$ となるので $u\neq0$．直線 EF は $u(X-2Y)=1$，すなわち $Y=\dfrac12X-\dfrac1{2u}$ で，傾き $\dfrac12$．これは直線 $y=\dfrac12x-2$ と平行である．なお，直線 EF が直線 $y=\dfrac12x-2$ と一致することはない．一致するのは $Y=\dfrac12X-3$，すなわち $u=\dfrac16$ のときで，この直線 $x-2y=4$ を $C$ の式に代入すると $(2y+3)^2=0$ となり，$C$ と点 $\left(1,-\dfrac32\right)$ で接するだけなので，異なる2点 E，F を通らないからである．\hfill$\square$

## 着想（修正後）

楕円上の定点 A を原点に平行移動し，A を通らない直線 EF を $uX+vY=1$ と書いて楕円の式の1次の部分に掛けると，同次2次式 $=0$ が得られ，$X^2$ で割ると AE，AF の傾き $k_1,k_2$ を2解とする2次方程式になる．原題は $k_1+k_2=0$ のとき EF の傾きが一定になることを示すだけだが，捻りでは $k_1+k_2=\lambda\neq0$ のとき $u,v$ が1次の関係をみたすことから EF が定点 $\mathrm P_\lambda$ を通ることを導き，$\lambda$ を動かしたときの $\mathrm P_\lambda$ の集合と，$\lambda=0$ の場合（傾き一定）との関係を見る．

## 修正前との差分

```diff
--- 修正前 solution main
+++ 修正後 solution main
@@ -32,2 +32,3 @@
 \]
-$k_1+k_2=0$ のときは $12u+6v=0$，すなわち $v=-2u$ で，$u=0$ なら $uX+vY=0\neq1$ となるので $u\neq0$．直線 EF は $u(X-2Y)=1$，すなわち $Y=\dfrac12X-\dfrac1{2u}$ で，傾き $\dfrac12$．これは直線 $y=\dfrac12x-2$ と平行である．\hfill$\square$
+（各 $\lambda\neq0$ について条件をみたす E，F は実際に存在するので，$\mathrm P_\lambda$ は確かに定まる．A における $C$ の接線の傾きは $-\dfrac12$ なので，$k_1\neq k_2$，$k_1+k_2=\lambda$，$k_1\neq-\dfrac12$，$k_2\neq-\dfrac12$ をみたす $k_1,k_2$ をとると，A を通り傾き $k_1,k_2$ の直線は $C$ と A 以外の点 E，F でそれぞれ交わり，傾きが異なるので E$\neq$F である．）
+$k_1+k_2=0$ のときは $12u+6v=0$，すなわち $v=-2u$ で，$u=0$ なら $uX+vY=0\neq1$ となるので $u\neq0$．直線 EF は $u(X-2Y)=1$，すなわち $Y=\dfrac12X-\dfrac1{2u}$ で，傾き $\dfrac12$．これは直線 $y=\dfrac12x-2$ と平行である．なお，直線 EF が直線 $y=\dfrac12x-2$ と一致することはない．一致するのは $Y=\dfrac12X-3$，すなわち $u=\dfrac16$ のときで，この直線 $x-2y=4$ を $C$ の式に代入すると $(2y+3)^2=0$ となり，$C$ と点 $\left(1,-\dfrac32\right)$ で接するだけなので，異なる2点 E，F を通らないからである．\hfill$\square$
```
