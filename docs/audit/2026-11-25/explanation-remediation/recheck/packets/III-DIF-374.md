# III-DIF-374

## 監査で指摘された内容

(2) 解説の「e^{x_2}<bx_2 の両辺の対数をとって x_2>L+log x_2>L+log L」は不等号の向きが逆（D）。着想にも同じ誤り。

## 問題文

$b>e^4$ とし，$f(x)=e^x-bx+e^2$ とする．ただし $e$ は自然対数の底，$\log$ は自然対数を表し，$L=\log b$ とおく．
\begin{enumerate}
  \item $f(x)=0$ はちょうど2つの実数解 $x_1,\ x_2\ (x_1<x_2)$ をもち，$0<x_1<1$，$L<x_2<L+2\log L$ であることを示せ．
  \item $x_2>\dfrac{bL}{e^2+1}\,x_1$ であることを示せ．
  \item $0<c<e^2+1$ をみたす任意の定数 $c$ に対して，ある $b>e^4$ では $x_2<\dfrac{bL}{c}\,x_1$ となることを示せ．
\end{enumerate}

## 答え（修正後）

(1) 証明　(2) 証明　(3) 証明（定数 $e^2+1$ は最良）

## 解答・解説（修正後，全文） main

(1) $f'(x)=e^x-b$ より $f$ は $x\leqq L$ で減少，$x\geqq L$ で増加．$L>4$ に注意する．
\begin{itemize}
  \item $f(0)=1+e^2>0$，$f(1)=e+e^2-b<0$（$b>e^4>e^2+e$），$1<L$．減少区間で符号が変わるので $x\leqq L$ にはちょうど1つの解 $x_1$ があり $0<x_1<1$．
  \item $f(L)=b(1-L)+e^2<-3b+e^2<0$．$x_3=L+2\log L$ とおくと $e^{x_3}=bL^2$ で，$f(x_3)=b(L^2-L-2\log L)+e^2$．$\log L<L$ より $L^2-L-2\log L>L^2-3L=L(L-3)>0$ なので $f(x_3)>0$．増加区間で符号が変わるので $x\geqq L$ にはちょうど1つの解 $x_2$ があり $L<x_2<L+2\log L$．
\end{itemize}
\hfill$\square$

(2) $f(x_1)=0$ より $bx_1=e^2+e^{x_1}$．$x_1<1$ より $bx_1<e^2+e$，すなわち $x_1<\dfrac{e^2+e}b$．また $t>0$ で $e^t-1=\displaystyle\int_0^te^s\,ds\leqq te^t$ なので
\[
e^{x_1}-1\leqq x_1e^{x_1}<ex_1<\frac{e^2(e+1)}b.
\]
次に $x_2$ を下から評価する．$x_4=L+\log L$ とおくと，$L>4$ より $\log L>\log4>1$ なので $x_4>L$ であり，$e^{x_4}=e^L\cdot L=bL$ より
\[
f(x_4)=bL-b(L+\log L)+e^2=e^2-b\log L.
\]
$\log L>1$ と $b>e^4$ より $b\log L>b>e^4>e^2$ なので $f(x_4)<0$．$f$ は $x\geqq L$ で増加し，その範囲の零点は $x_2$ だけだから，$f(x_4)<0=f(x_2)$ より $x_2>x_4=L+\log L$．

示すべき式は $(e^2+1)x_2>bx_1L=(e^2+e^{x_1})L$ である．
\[
(e^2+1)x_2-(e^2+e^{x_1})L>(e^2+1)(L+\log L)-(e^2+e^{x_1})L=(e^2+1)\log L-(e^{x_1}-1)L.
\]
ここで $(e^2+1)\log L>8\log4>8$．一方，$Le^{-L}$ は $L>1$ で減少するので
\[
(e^{x_1}-1)L<e^2(e+1)Le^{-L}<e^2(e+1)\cdot4e^{-4}=\frac{4(e+1)}{e^2}<\frac{4\cdot3.8}{7}<3.
\]
よって右辺は正で，$x_2>\dfrac{bL}{e^2+1}x_1$．\hfill$\square$

(3) $b\to\infty$（$L\to\infty$）とする．$0<x_1<\dfrac{e^2+e}b\to0$ なので $bx_1=e^2+e^{x_1}\to e^2+1$．また (1) より $1<\dfrac{x_2}L<1+\dfrac{2\log L}L$ で $\dfrac{\log L}L\to0$ なので $\dfrac{x_2}L\to1$．よって
\[
\frac{bLx_1}{c\,x_2}=\frac{bx_1}c\cdot\frac L{x_2}\to\frac{e^2+1}c>1.
\]
したがって十分大きい $b\ (>e^4)$ では $\dfrac{bLx_1}{cx_2}>1$，すなわち $x_2<\dfrac{bL}cx_1$．\hfill$\square$

（(2)(3) より，$x_2>\dfrac{bL}{c}x_1$ がすべての $b>e^4$ で成り立つ正の定数 $c$ の最小値は $\boldsymbol{e^2+1}$ である．原題の $2e^2$ はこれより大きい．）

## 着想（修正後）

小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $f(\log b+\log(\log b))=e^2-b\log(\log b)<0$ から $x_2>\log b+\log(\log b)$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．

## 修正前との差分

```diff
--- 修正前 solution main
+++ 修正後 solution main
@@ -11,3 +11,7 @@
 \]
-$f(x_2)=0$ より $e^{x_2}=bx_2-e^2<bx_2$，両辺の対数をとって $x_2>L+\log x_2>L+\log L$（$x_2>L>1$）．
+次に $x_2$ を下から評価する．$x_4=L+\log L$ とおくと，$L>4$ より $\log L>\log4>1$ なので $x_4>L$ であり，$e^{x_4}=e^L\cdot L=bL$ より
+\[
+f(x_4)=bL-b(L+\log L)+e^2=e^2-b\log L.
+\]
+$\log L>1$ と $b>e^4$ より $b\log L>b>e^4>e^2$ なので $f(x_4)<0$．$f$ は $x\geqq L$ で増加し，その範囲の零点は $x_2$ だけだから，$f(x_4)<0=f(x_2)$ より $x_2>x_4=L+\log L$．
 
--- 修正前 idea
+++ 修正後 idea
@@ -1 +1 @@
-小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $e^{x_2}<bx_2$ から $x_2>\log b+\log x_2$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．
+小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $f(\log b+\log(\log b))=e^2-b\log(\log b)<0$ から $x_2>\log b+\log(\log b)$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．
```
