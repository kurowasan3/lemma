# 修正前後の記録

- 分岐元（修正前）：`c3193afacdceeece990b9c4ef99046f9b94b0285`（main）。修正は `apply_fixes.py` で適用した。
- **管理表への反映が必要**：`content/` は `Lemma問題管理表.xlsx` から `tools/import_xlsx.py` で作り直される。下の「修正後（全文）」を管理表の該当セル（I 列＝答え，J 列＝解答・解説，K 列＝着想）に入れないと，次の取り込みで修正が消える。

## A-GEO-115（`content/problems/A-06.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -2,3 +2,3 @@
 
-(1) {\bf K，L の位置．}B は半直線 AB 上で A と P の間に，C は半直線 DC 上で D と P の間にあるから，B，C はそれぞれ三角形 PAD の辺 PA，PD の内部の点である．$\angle\mathrm{APD}$ の二等分線は三角形 PAD の辺 AD の内部の点 L で交わり，線分 PL は三角形 PAD を三角形 PAL と三角形 PLD に分ける．B は辺 PA の内部，C は辺 PD の内部にあるので，B，C は直線 PL の反対側にあり，線分 BC は直線 PL と1点 K で交わる．K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にあり，B，C と異なるから P，L とも異なる．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．
+(1) {\bf K，L の位置．}B は半直線 AB 上で A と P の間に，C は半直線 DC 上で D と P の間にあるから，B，C はそれぞれ三角形 PAD の辺 PA，PD の内部の点である．$\angle\mathrm{APD}$ の二等分線は三角形 PAD の辺 AD の内部の点 L で交わり，線分 PL は三角形 PAD を三角形 PAL と三角形 PLD に分ける．B は辺 PA の内部，C は辺 PD の内部にあるので，B，C は直線 PL の反対側にあり，線分 BC は直線 PL と1点 K で交わる．K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にある．直線 PL は直線 PA，PD と P だけで交わり，B，C は P と異なるので，B，C は直線 PL 上になく K$\neq$B，C．また P は直線 AB 上の B と異なる点で，直線 AB と直線 BC は B だけで交わるので，P は直線 BC 上になく K$\neq$P．さらに直線 BC と直線 AD はただ1点 Q で交わり，Q は線分 BC の外（C の先）にあるので，線分 BC は直線 AD と共有点をもたず K$\neq$L．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．
 
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
四角形 ABCD の内角を $\angle\mathrm A$，$\angle\mathrm B$，$\angle\mathrm C$，$\angle\mathrm D$ と書くと，円に内接するので $\angle\mathrm B+\angle\mathrm D=180^\circ$．$\varphi=\dfrac12\angle\mathrm{APD}$ とおく．

(1) {\bf K，L の位置．}B は半直線 AB 上で A と P の間に，C は半直線 DC 上で D と P の間にあるから，B，C はそれぞれ三角形 PAD の辺 PA，PD の内部の点である．$\angle\mathrm{APD}$ の二等分線は三角形 PAD の辺 AD の内部の点 L で交わり，線分 PL は三角形 PAD を三角形 PAL と三角形 PLD に分ける．B は辺 PA の内部，C は辺 PD の内部にあるので，B，C は直線 PL の反対側にあり，線分 BC は直線 PL と1点 K で交わる．K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にある．直線 PL は直線 PA，PD と P だけで交わり，B，C は P と異なるので，B，C は直線 PL 上になく K$\neq$B，C．また P は直線 AB 上の B と異なる点で，直線 AB と直線 BC は B だけで交わるので，P は直線 BC 上になく K$\neq$P．さらに直線 BC と直線 AD はただ1点 Q で交わり，Q は線分 BC の外（C の先）にあるので，線分 BC は直線 AD と共有点をもたず K$\neq$L．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．

{\bf $\mathrm{QK}=\mathrm{QL}$．}K は線分 BC の内部，Q は半直線 BC の C の先にあるので，K から見て C と Q は同じ向きにあり，半直線 KQ $=$ 半直線 KC．また K は P と L の間にあるので，半直線 KL は半直線 KP の反対向き．よって $\angle\mathrm{QKL}$ は $\angle\mathrm{PKB}$ の対頂角で $\angle\mathrm{QKL}=\angle\mathrm{PKB}$．三角形 PBK で $\angle\mathrm{KPB}=\varphi$（半直線 PB $=$ 半直線 PA），B は A と P の間にあるので $\angle\mathrm{PBK}=180^\circ-\angle\mathrm{ABC}=180^\circ-\angle\mathrm B$．よって
\[\angle\mathrm{QKL}=\angle\mathrm{PKB}=180^\circ-\varphi-(180^\circ-\angle\mathrm B)=\angle\mathrm B-\varphi.\]
一方，L は線分 AD の内部，Q は半直線 AD の D の先にあるので半直線 LQ $=$ 半直線 LD，また半直線 LK $=$ 半直線 LP．三角形 PLD で $\angle\mathrm{LPD}=\varphi$，半直線 DP $=$ 半直線 DC，半直線 DL $=$ 半直線 DA より $\angle\mathrm{PDL}=\angle\mathrm{CDA}=\angle\mathrm D$．よって
\[\angle\mathrm{QLK}=\angle\mathrm{DLP}=180^\circ-\varphi-\angle\mathrm D=\angle\mathrm B-\varphi.\]
Q は直線 BC と直線 AD の交点で，直線 PL は直線 BC と K だけで，直線 AD と L だけで交わる．Q は線分 BC の外にあるので Q$\neq$K，よって Q は直線 KL 上になく，QKL は三角形である．$\angle\mathrm{QKL}=\angle\mathrm{QLK}$ より $\mathrm{QK}=\mathrm{QL}$．\hfill$\square$

(2) 四角形の頂点の名前を B と D で入れかえると，「半直線 AB と DC の交点」と「半直線 AD と BC の交点」が入れかわり，仮定の形はそのまま保たれる（P は B，C の先，Q は D，C の先）．このとき P と Q，K と N，L と M の役割が入れかわる．よって (1) と同じ議論により，N は線分 CD の内部，M は線分 AB の内部にあって Q，N，M はこの順に並び，$\mathrm{PN}=\mathrm{PM}$ である．

{\bf Q の二等分線と KL．}K は線分 BC の内部で Q は半直線 BC の C の先にあるから K は半直線 QB 上，L は線分 AD の内部で Q は半直線 AD の D の先にあるから L は半直線 QA 上にある．したがって $\angle\mathrm{KQL}=\angle\mathrm{BQA}$ で，その二等分線は直線 QM である．二等辺三角形 QKL（$\mathrm{QK}=\mathrm{QL}$）の頂角の二等分線は底辺 KL の垂直二等分線だから，直線 QM は線分 KL の中点を通り KL に垂直である．

同様に，三角形 PMN は $\mathrm{PM}=\mathrm{PN}$ の二等辺三角形で，M は半直線 PA 上，N は半直線 PD 上にあるから $\angle\mathrm{MPN}=\angle\mathrm{APD}$ で，その二等分線は直線 PK である．よって直線 PK は線分 MN の中点を通り MN に垂直である．

{\bf ひし形．}直線 QM は直線 KL（$=$ 直線 PK）に垂直だから，2直線はただ1点 X で交わる．直線 QM は KL の中点を通り，その中点は直線 KL 上にあるので，X は線分 KL の中点である．同様に，直線 PK は MN の中点を通り，その中点は直線 MN（$=$ 直線 QM）上にあるので，X は線分 MN の中点でもある．

よって四角形 KMLN の2本の対角線 KL，MN は互いに他を2等分し（中点 X を共有），しかも垂直である．対角線が互いに他を2等分する四角形は平行四辺形で，さらに対角線が垂直なので $\mathrm{XK}=\mathrm{XL}$，$\mathrm{XM}=\mathrm{XN}$ と三平方の定理から
\[\mathrm{KM}^2=\mathrm{XK}^2+\mathrm{XM}^2=\mathrm{ML}^2=\mathrm{LN}^2=\mathrm{NK}^2\]
となり4辺が等しい．したがって四角形 KMLN はひし形である．\hfill$\square$
```

</details>

## B-SEQ-342（`content/problems/B-13.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -6,18 +6,18 @@
 \]
-$\beta$ は $t>0$ で増加するので，2つの正の数 $T,T'$ について $T=T'\iff\beta(T)=\beta(T')$．よって $b_n=\beta(a_n)$ とおくと，$(*)$ は
+$\beta$ は $t>0$ で増加するので，2つの正の数 $T,T'$ について $T=T'\iff\beta(T)=\beta(T')$．よって $d_n=\beta(a_n)$ とおくと，$(*)$ は
 \[
-m+n=p+q\ \text{ならば}\ b_mb_n=b_pb_q\qquad(**)
+m+n=p+q\ \text{ならば}\ d_md_n=d_pd_q\qquad(**)
 \]
-と同値である．すなわち「$(*)$ をみたす正の数の数列 $\{a_n\}$」と「$(**)$ をみたし，すべての項が $-1<b_n<1$ である数列 $\{b_n\}$」は $a_n=\dfrac{1+b_n}{1-b_n}$ で1対1に対応する．
+と同値である．すなわち「$(*)$ をみたす正の数の数列 $\{a_n\}$」と「$(**)$ をみたし，すべての項が $-1<d_n<1$ である数列 $\{d_n\}$」は $a_n=\dfrac{1+d_n}{1-d_n}$ で1対1に対応する．
 
-{\bf $(**)$ をみたす数列の形．}$(**)$ で $(m,n,p,q)=(n+1,1,n,2)$ とおくと $b_{n+1}b_1=b_nb_2$（$n\geqq1$）．
+{\bf $(**)$ をみたす数列の形．}$(**)$ で $(m,n,p,q)=(n+1,1,n,2)$ とおくと $d_{n+1}d_1=d_nd_2$（$n\geqq1$）．
 \begin{itemize}
-  \item $b_1\neq0$ のとき：$r=\dfrac{b_2}{b_1}$ とおくと $b_{n+1}=rb_n$ で，$b_n=b_1r^{n-1}$．
-  \item $b_1=0$ のとき：$(2,2,1,3)$ とおくと $b_2^{\,2}=b_1b_3=0$ より $b_2=0$．さらに任意の $n$ で $(n,n,1,2n-1)$ とおくと $b_n^{\,2}=b_1b_{2n-1}=0$ より $b_n=0$．
+  \item $d_1\neq0$ のとき：$r=\dfrac{d_2}{d_1}$ とおくと $d_{n+1}=rd_n$ で，$d_n=d_1r^{n-1}$．
+  \item $d_1=0$ のとき：$(2,2,1,3)$ とおくと $d_2^{\,2}=d_1d_3=0$ より $d_2=0$．さらに任意の $n$ で $(n,n,1,2n-1)$ とおくと $d_n^{\,2}=d_1d_{2n-1}=0$ より $d_n=0$．
 \end{itemize}
-逆に $b_n=b_1r^{n-1}$ の形なら $b_mb_n=b_1^{\,2}r^{m+n-2}$ は $m+n$ だけで決まり，$b_n=0$（すべての $n$）も $(**)$ をみたす．
+逆に $d_n=d_1r^{n-1}$ の形なら $d_md_n=d_1^{\,2}r^{m+n-2}$ は $m+n$ だけで決まり，$d_n=0$（すべての $n$）も $(**)$ をみたす．
 
-(1) $b_1=\beta(3)=\dfrac12$，$b_2=\beta(2)=\dfrac13$，$r=\dfrac23$ だから $b_n=\dfrac12\left(\dfrac23\right)^{n-1}$．これはすべて $-1<b_n<1$ をみたすので，上の対応により $(*)$ をみたす数列はこれに対応するものただ1つで
+(1) $d_1=\beta(3)=\dfrac12$，$d_2=\beta(2)=\dfrac13$，$r=\dfrac23$ だから $d_n=\dfrac12\left(\dfrac23\right)^{n-1}$．これはすべて $-1<d_n<1$ をみたすので，上の対応により $(*)$ をみたす数列はこれに対応するものただ1つで
 \[
-a_n=\frac{1+b_n}{1-b_n}=\frac{2\cdot3^{n-1}+2^{n-1}}{2\cdot3^{n-1}-2^{n-1}}.
+a_n=\frac{1+d_n}{1-d_n}=\frac{2\cdot3^{n-1}+2^{n-1}}{2\cdot3^{n-1}-2^{n-1}}.
 \]
@@ -27,8 +27,8 @@
 
-$a=1$（$\beta_1=0$）のとき：上より $b_2=0$ が必要で，$b=1$．逆に $a=b=1$ なら $a_n=1$（すべての $n$）が $(*)$ をみたす．
+$a=1$（$\beta_1=0$）のとき：上より $d_2=0$ が必要で，$b=1$．逆に $a=b=1$ なら $a_n=1$（すべての $n$）が $(*)$ をみたす．
 
-$a\neq1$（$\beta_1\neq0$）のとき：$r=\dfrac{\beta_2}{\beta_1}$ として $b_n=\beta_1r^{n-1}$ でなければならない．
+$a\neq1$（$\beta_1\neq0$）のとき：$r=\dfrac{\beta_2}{\beta_1}$ として $d_n=\beta_1r^{n-1}$ でなければならない．
 \begin{itemize}
-  \item $|r|\leqq1$ なら $|b_n|\leqq|\beta_1|<1$ だから，すべての $n$ で $-1<b_n<1$ となり，対応する正の数の数列が存在する．
-  \item $|r|>1$ なら $|r|=1+h$（$h>0$）とおくと，二項定理より $|r|^{n-1}\geqq1+(n-1)h$．$n-1\geqq\dfrac1h\left(\dfrac1{|\beta_1|}-1\right)$ となる $n$ では $|b_n|\geqq|\beta_1|\{1+(n-1)h\}\geqq1$ となり不適．
+  \item $|r|\leqq1$ なら $|d_n|\leqq|\beta_1|<1$ だから，すべての $n$ で $-1<d_n<1$ となり，対応する正の数の数列が存在する．
+  \item $|r|>1$ なら $|r|=1+h$（$h>0$）とおくと，二項定理より $|r|^{n-1}\geqq1+(n-1)h$．$n-1\geqq\dfrac1h\left(\dfrac1{|\beta_1|}-1\right)$ となる $n$ では $|d_n|\geqq|\beta_1|\{1+(n-1)h\}\geqq1$ となり不適．
 \end{itemize}
@@ -48,5 +48,5 @@
 \begin{itemize}
-  \item $(a-b)(ab-1)>0$ のとき：$\beta_1^{\,2}>\beta_2^{\,2}$ で $|r|<1$．$|b_n|=|\beta_1||r|^{n-1}\to0$ だから $a_n=\dfrac{1+b_n}{1-b_n}\to1$．
-  \item $b=a$ のとき：$r=1$ で $b_n=\beta_1$，$a_n=a$（定数）だから極限 $a$．
-  \item $b=\dfrac1a$ のとき：$\beta\left(\dfrac1a\right)=\dfrac{1-a}{1+a}=-\beta_1$ で $r=-1$．$b_n=(-1)^{n-1}\beta_1$ で $a_n$ は $a,\dfrac1a,a,\dfrac1a,\cdots$ をくり返し，$a\neq\dfrac1a$ なので収束しない．
+  \item $(a-b)(ab-1)>0$ のとき：$\beta_1^{\,2}>\beta_2^{\,2}$ で $|r|<1$．$|d_n|=|\beta_1||r|^{n-1}\to0$ だから $a_n=\dfrac{1+d_n}{1-d_n}\to1$．
+  \item $b=a$ のとき：$r=1$ で $d_n=\beta_1$，$a_n=a$（定数）だから極限 $a$．
+  \item $b=\dfrac1a$ のとき：$\beta\left(\dfrac1a\right)=\dfrac{1-a}{1+a}=-\beta_1$ で $r=-1$．$d_n=(-1)^{n-1}\beta_1$ で $a_n$ は $a,\dfrac1a,a,\dfrac1a,\cdots$ をくり返し，$a\neq\dfrac1a$ なので収束しない．
 \end{itemize}
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
{\bf 準備．}正の数 $x$ に対し $\beta(x)=\dfrac{x-1}{x+1}=1-\dfrac2{x+1}$ とおく．$x>0$ のとき $-1<\beta(x)<1$ であり，$\beta(x)$ は $x>0$ で増加する．また $-1<c<1$ である $c$ に対し $\beta(x)=c$ となる正の数は $x=\dfrac{1+c}{1-c}$ ただ1つである．

正の数 $x,y$ に対し $T=\dfrac{1+xy}{x+y}\ (>0)$ とおくと
\[
\beta(T)=\frac{T-1}{T+1}=\frac{1+xy-x-y}{1+xy+x+y}=\frac{(x-1)(y-1)}{(x+1)(y+1)}=\beta(x)\beta(y).
\]
$\beta$ は $t>0$ で増加するので，2つの正の数 $T,T'$ について $T=T'\iff\beta(T)=\beta(T')$．よって $d_n=\beta(a_n)$ とおくと，$(*)$ は
\[
m+n=p+q\ \text{ならば}\ d_md_n=d_pd_q\qquad(**)
\]
と同値である．すなわち「$(*)$ をみたす正の数の数列 $\{a_n\}$」と「$(**)$ をみたし，すべての項が $-1<d_n<1$ である数列 $\{d_n\}$」は $a_n=\dfrac{1+d_n}{1-d_n}$ で1対1に対応する．

{\bf $(**)$ をみたす数列の形．}$(**)$ で $(m,n,p,q)=(n+1,1,n,2)$ とおくと $d_{n+1}d_1=d_nd_2$（$n\geqq1$）．
\begin{itemize}
  \item $d_1\neq0$ のとき：$r=\dfrac{d_2}{d_1}$ とおくと $d_{n+1}=rd_n$ で，$d_n=d_1r^{n-1}$．
  \item $d_1=0$ のとき：$(2,2,1,3)$ とおくと $d_2^{\,2}=d_1d_3=0$ より $d_2=0$．さらに任意の $n$ で $(n,n,1,2n-1)$ とおくと $d_n^{\,2}=d_1d_{2n-1}=0$ より $d_n=0$．
\end{itemize}
逆に $d_n=d_1r^{n-1}$ の形なら $d_md_n=d_1^{\,2}r^{m+n-2}$ は $m+n$ だけで決まり，$d_n=0$（すべての $n$）も $(**)$ をみたす．

(1) $d_1=\beta(3)=\dfrac12$，$d_2=\beta(2)=\dfrac13$，$r=\dfrac23$ だから $d_n=\dfrac12\left(\dfrac23\right)^{n-1}$．これはすべて $-1<d_n<1$ をみたすので，上の対応により $(*)$ をみたす数列はこれに対応するものただ1つで
\[
a_n=\frac{1+d_n}{1-d_n}=\frac{2\cdot3^{n-1}+2^{n-1}}{2\cdot3^{n-1}-2^{n-1}}.
\]
（$n=1,2$ で3，2となることも確かめられる．）よって $\boldsymbol{a_n=\dfrac{2\cdot3^{n-1}+2^{n-1}}{2\cdot3^{n-1}-2^{n-1}}}$．

(2) $\beta_1=\beta(a)$，$\beta_2=\beta(b)$ とおく（ともに $-1$ より大きく1より小さい）．

$a=1$（$\beta_1=0$）のとき：上より $d_2=0$ が必要で，$b=1$．逆に $a=b=1$ なら $a_n=1$（すべての $n$）が $(*)$ をみたす．

$a\neq1$（$\beta_1\neq0$）のとき：$r=\dfrac{\beta_2}{\beta_1}$ として $d_n=\beta_1r^{n-1}$ でなければならない．
\begin{itemize}
  \item $|r|\leqq1$ なら $|d_n|\leqq|\beta_1|<1$ だから，すべての $n$ で $-1<d_n<1$ となり，対応する正の数の数列が存在する．
  \item $|r|>1$ なら $|r|=1+h$（$h>0$）とおくと，二項定理より $|r|^{n-1}\geqq1+(n-1)h$．$n-1\geqq\dfrac1h\left(\dfrac1{|\beta_1|}-1\right)$ となる $n$ では $|d_n|\geqq|\beta_1|\{1+(n-1)h\}\geqq1$ となり不適．
\end{itemize}
よって存在条件は $|\beta_2|\leqq|\beta_1|$，すなわち $\beta_1^{\,2}-\beta_2^{\,2}\geqq0$．ここで
\[
\beta_1^{\,2}-\beta_2^{\,2}=\frac{(a-1)^2(b+1)^2-(b-1)^2(a+1)^2}{(a+1)^2(b+1)^2}
\]
の分子は
\[
\{(a-1)(b+1)-(b-1)(a+1)\}\{(a-1)(b+1)+(b-1)(a+1)\}=(2a-2b)(2ab-2)=4(a-b)(ab-1)
\]
だから，条件は $(a-b)(ab-1)\geqq0$．$a=1$ のときこの式は $-(1-b)^2\geqq0$ すなわち $b=1$ となり，上の結果と一致する．

以上より，求める条件は $\boldsymbol{(a-b)(ab-1)\geqq0}$，すなわち $b$ が $a$ と $\dfrac1a$ の間にある（両端を含む）ことである．

(3) $a=1$ のとき $a_n=1$ で極限1．以下 $a\neq1$ とし，$|r|\leqq1$ である．
\begin{itemize}
  \item $(a-b)(ab-1)>0$ のとき：$\beta_1^{\,2}>\beta_2^{\,2}$ で $|r|<1$．$|d_n|=|\beta_1||r|^{n-1}\to0$ だから $a_n=\dfrac{1+d_n}{1-d_n}\to1$．
  \item $b=a$ のとき：$r=1$ で $d_n=\beta_1$，$a_n=a$（定数）だから極限 $a$．
  \item $b=\dfrac1a$ のとき：$\beta\left(\dfrac1a\right)=\dfrac{1-a}{1+a}=-\beta_1$ で $r=-1$．$d_n=(-1)^{n-1}\beta_1$ で $a_n$ は $a,\dfrac1a,a,\dfrac1a,\cdots$ をくり返し，$a\neq\dfrac1a$ なので収束しない．
\end{itemize}
$(a-b)(ab-1)=0$ は $b=a$ または $b=\dfrac1a$ のことだから，これで全ての場合をつくしている．

以上より，$\boldsymbol{(a-b)(ab-1)>0}$ または $\boldsymbol{a=b=1}$ のとき極限 $\boldsymbol{1}$，$\boldsymbol{b=a}$ のとき極限 $\boldsymbol a$，$\boldsymbol{b=\dfrac1a}$ かつ $\boldsymbol{a\neq1}$ のとき収束しない．
```

</details>

### 着想（K 列）：差分

```diff
--- 修正前
+++ 修正後
@@ -1 +1 @@
-正の数 $x,y$ に対し $T=\dfrac{1+xy}{x+y}$ とおくと $\dfrac{T-1}{T+1}=\dfrac{x-1}{x+1}\cdot\dfrac{y-1}{y+1}$ となり，$t\to\dfrac{t-1}{t+1}$ は $t>0$ で増加するので，「$T$ が添字の和 $m+n$ だけで決まる」は「$b_n=\dfrac{a_n-1}{a_n+1}$ の積 $b_mb_n$ が $m+n$ だけで決まる」と同値になり，$b_{n+1}b_1=b_nb_2$ から $\{b_n\}$ は等比数列．原題は分数式 $\dfrac{a_m+a_n}{(1+a_m)(1+a_n)}$ で一般項と有界性を問うが，捻りでは別の分数式で，$b_n$ が区間 $-1<b_n<1$ にとどまる条件（公比の絶対値が1以下）から，そのような正の数列が存在する初項・第2項の範囲 $(a-b)(ab-1)\geqq0$ を決め，収束・発散も分類する．
+正の数 $x,y$ に対し $T=\dfrac{1+xy}{x+y}$ とおくと $\dfrac{T-1}{T+1}=\dfrac{x-1}{x+1}\cdot\dfrac{y-1}{y+1}$ となり，$t\to\dfrac{t-1}{t+1}$ は $t>0$ で増加するので，「$T$ が添字の和 $m+n$ だけで決まる」は「$d_n=\dfrac{a_n-1}{a_n+1}$ の積 $d_md_n$ が $m+n$ だけで決まる」と同値になり，$d_{n+1}d_1=d_nd_2$ から $\{d_n\}$ は等比数列．原題は分数式 $\dfrac{a_m+a_n}{(1+a_m)(1+a_n)}$ で一般項と有界性を問うが，捻りでは別の分数式で，$d_n$ が区間 $-1<d_n<1$ にとどまる条件（公比の絶対値が1以下）から，そのような正の数列が存在する初項・第2項の範囲 $(a-b)(ab-1)\geqq0$ を決め，収束・発散も分類する．
```

<details><summary>着想（K 列）：修正後（全文，管理表に貼る内容）</summary>

```latex
正の数 $x,y$ に対し $T=\dfrac{1+xy}{x+y}$ とおくと $\dfrac{T-1}{T+1}=\dfrac{x-1}{x+1}\cdot\dfrac{y-1}{y+1}$ となり，$t\to\dfrac{t-1}{t+1}$ は $t>0$ で増加するので，「$T$ が添字の和 $m+n$ だけで決まる」は「$d_n=\dfrac{a_n-1}{a_n+1}$ の積 $d_md_n$ が $m+n$ だけで決まる」と同値になり，$d_{n+1}d_1=d_nd_2$ から $\{d_n\}$ は等比数列．原題は分数式 $\dfrac{a_m+a_n}{(1+a_m)(1+a_n)}$ で一般項と有界性を問うが，捻りでは別の分数式で，$d_n$ が区間 $-1<d_n<1$ にとどまる条件（公比の絶対値が1以下）から，そのような正の数列が存在する初項・第2項の範囲 $(a-b)(ab-1)\geqq0$ を決め，収束・発散も分類する．
```

</details>

## C-CUR-459（`content/problems/C-19.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -6,3 +6,3 @@
 \]
-と表せる．
+と表せる．ここで $\alpha=\beta$（円）は含めない．楕円の2つの焦点は相異なる2点であり，円はそのような2つの焦点をもたないからである．焦点が $x$ 軸上にあるので長軸は $x$ 軸方向で，$\alpha>\beta$ である．
 
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
A$(s,t_0)$，$t_0=2\sqrt s>0$，$\mathrm H(-1,t_0)$ とおく．

(1) \textbf{楕円の形．}2つの焦点が $x$ 軸上にある楕円は，長軸が $x$ 軸上にあり中心 $(m,0)$ も $x$ 軸上にあるので
\[
E:\ \frac{(x-m)^2}{\alpha^2}+\frac{y^2}{\beta^2}=1\quad(\alpha>\beta>0)
\]
と表せる．ここで $\alpha=\beta$（円）は含めない．楕円の2つの焦点は相異なる2点であり，円はそのような2つの焦点をもたないからである．焦点が $x$ 軸上にあるので長軸は $x$ 軸方向で，$\alpha>\beta$ である．

\textbf{必要条件．}F$(1,0)$ を通るから $(1-m)^2=\alpha^2$，すなわち F は長軸の端点．A，H を通るので $\dfrac{(s-m)^2}{\alpha^2}=\dfrac{(-1-m)^2}{\alpha^2}=1-\dfrac{t_0^2}{\beta^2}$．$(s-m)^2=(1+m)^2$ で $s\neq-1$ だから $s-m=-(-1-m)=1+m$，すなわち $m=\dfrac{s-1}{2}$．よって $\alpha=|1-m|=\dfrac{|3-s|}{2}$，$s-m=\dfrac{s+1}{2}$．
$\dfrac{t_0^2}{\beta^2}=1-\dfrac{(s+1)^2}{(3-s)^2}>0$ が必要で，$s>0$ のもとでこれは $s+1<|3-s|$，すなわち $s<1$ と同値（$s\geqq3$ では $s+1>s-3$ で不成立）．このとき
\[
\beta^2=\frac{4s(3-s)^2}{(3-s)^2-(s+1)^2}=\frac{4s(3-s)^2}{8(1-s)}=\frac{s(3-s)^2}{2(1-s)} .
\]
さらに $\alpha>\beta$ が必要で，$\alpha^2>\beta^2\iff\dfrac{(3-s)^2}{4}>\dfrac{s(3-s)^2}{2(1-s)}\iff1-s>2s\iff s<\dfrac13$．

\textbf{十分性と一意性．}$0<s<\dfrac13$ のとき，$m=\dfrac{s-1}2$，$\alpha=\dfrac{3-s}2$，$\beta^2=\dfrac{s(3-s)^2}{2(1-s)}$ とおけば $\alpha>\beta>0$ で，上の計算を逆にたどって F，A，H はこの楕円上にある．必要条件の過程で $m,\alpha,\beta$ は一通りに決まったので $E$ はただ1つ．
よって条件は $\boldsymbol{0<s<\dfrac13}$．\hfill$\square$

(2) $\gamma=\sqrt{\alpha^2-\beta^2}$ とおくと焦点は $\mathrm B(m+\gamma,0)$，$\mathrm B'(m-\gamma,0)$．直線 $x=m$ に関する対称移動 $(x,y)\to(2m-x,y)$ で，$2m-s=-1$ より A と H が入れかわり，B と $\mathrm B'$ も入れかわる．対称移動は距離を保つので $\mathrm{HB}=\mathrm{AB}'$．楕円の定義より $\mathrm{AB}+\mathrm{AB}'=2\alpha=3-s$．また $\mathrm{AH}=s+1$．B は $x$ 軸上，直線 AH は $y=t_0\ (\neq0)$ なので三角形 AHB は確かに存在し，その周は
\[
\mathrm{AH}+\mathrm{HB}+\mathrm{BA}=(s+1)+(\mathrm{AB}'+\mathrm{AB})=(s+1)+(3-s)=\boldsymbol{4}
\]
で，$s$ によらない．\hfill$\square$

(3) $\gamma^2=\alpha^2-\beta^2=\dfrac{(3-s)^2}{4}-\dfrac{s(3-s)^2}{2(1-s)}=\dfrac{(3-s)^2(1-3s)}{4(1-s)}$．
$0<s<\dfrac13$ で $\dfrac{1-3s}{1-s}>0$ だから $w=\sqrt{\dfrac{1-3s}{1-s}}\ (>0)$ とおくと，$3-s>0$ より $\gamma=\dfrac{(3-s)w}{2}$．

\textbf{$s$ と $w$ の対応．}$w^2=\dfrac{1-3s}{1-s}=3-\dfrac{2}{1-s}$ は $0<s<\dfrac13$ で連続かつ単調に減少し，$s\to+0$ で $1$，$s\to\dfrac13-0$ で $0$ に近づく．よって $w$ は $0<w<1$ の値をとり，$s$ と $w$ は1対1に対応する．$w^2(1-s)=1-3s$ を $s$ について解くと $s=\dfrac{1-w^2}{3-w^2}$ で，
\[
s-1=-\frac{2}{3-w^2},\qquad 3-s=\frac{8-2w^2}{3-w^2}.
\]

\textbf{B の $x$ 座標．}B の $x$ 座標は
\[
m+\gamma=\frac{s-1}{2}+\frac{(3-s)w}{2}=\frac{-2+(8-2w^2)w}{2(3-w^2)}=\frac{-1+4w-w^3}{3-w^2}=:X(w)
\]
である．
\[
X'(w)=\frac{(4-3w^2)(3-w^2)+2w(-1+4w-w^3)}{(3-w^2)^2}=\frac{w^4-5w^2-2w+12}{(3-w^2)^2}
\]
で，$0<w<1$ では $w^4-5w^2-2w+12>0-5-2+12=5>0$ だから $X'(w)>0$．$X(w)$ は $0\leqq w\leqq1$ で連続で，$0<w<1$ で単調に増加し，$X(0)=-\dfrac13$，$X(1)=\dfrac{-1+4-1}{2}=1$．したがって中間値の定理より，$w$ が $0<w<1$ を動くとき $X(w)$ は $-\dfrac13$ と $1$ の間のすべての値をとり，端の値はとらない．

以上より，B の $x$ 座標のとりうる値の範囲は $\boldsymbol{-\dfrac13<x<1}$．
```

</details>

## C-CUR-484（`content/problems/C-19.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -32,2 +32,3 @@
 \]
-$k_1+k_2=0$ のときは $12u+6v=0$，すなわち $v=-2u$ で，$u=0$ なら $uX+vY=0\neq1$ となるので $u\neq0$．直線 EF は $u(X-2Y)=1$，すなわち $Y=\dfrac12X-\dfrac1{2u}$ で，傾き $\dfrac12$．これは直線 $y=\dfrac12x-2$ と平行である．\hfill$\square$
+（各 $\lambda\neq0$ について条件をみたす E，F は実際に存在するので，$\mathrm P_\lambda$ は確かに定まる．A における $C$ の接線の傾きは $-\dfrac12$ なので，$k_1\neq k_2$，$k_1+k_2=\lambda$，$k_1\neq-\dfrac12$，$k_2\neq-\dfrac12$ をみたす $k_1,k_2$ をとると，A を通り傾き $k_1,k_2$ の直線は $C$ と A 以外の点 E，F でそれぞれ交わり，傾きが異なるので E$\neq$F である．）
+$k_1+k_2=0$ のときは $12u+6v=0$，すなわち $v=-2u$ で，$u=0$ なら $uX+vY=0\neq1$ となるので $u\neq0$．直線 EF は $u(X-2Y)=1$，すなわち $Y=\dfrac12X-\dfrac1{2u}$ で，傾き $\dfrac12$．これは直線 $y=\dfrac12x-2$ と平行である．なお，直線 EF が直線 $y=\dfrac12x-2$ と一致することはない．一致するのは $Y=\dfrac12X-3$，すなわち $u=\dfrac16$ のときで，この直線 $x-2y=4$ を $C$ の式に代入すると $(2y+3)^2=0$ となり，$C$ と点 $\left(1,-\dfrac32\right)$ で接するだけなので，異なる2点 E，F を通らないからである．\hfill$\square$
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
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
```

</details>

## II-CAL-312（`content/problems/II-12.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -35,3 +35,3 @@
   \item $t=0,\ \beta<0$：$\beta<m<0$ の整数が2個 $\iff-3\leqq\beta<-2$．$P=\{-2,-1\}$ で総和 $-3$．一方 $g(3)=3c(3-\beta)>0$ なので不適．
-  \item $t=0,\ \beta>0$：$0<m<\beta$ の整数が2個 $\iff2<\beta\leqq3$．$0<\beta$ より $0\in P$ で，$P=\{0,1,2\}$，$Q=\{1,2\}$，総和はともに $3$．条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．辺々加えて $2c=4$，$c=2$，$\beta=\dfrac52$．これは $2<\beta\leqq3$ をみたす．
+  \item $t=0,\ \beta>0$：$0<m<\beta$ の整数が2個 $\iff2<\beta\leqq3$．$0<\beta$ より $0\in P$ で，$P=\{0,1,2\}$，$Q=\{1,2\}$，総和はともに $3$．条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．前者を3で割ると $c(3-\beta)=1$ で，これと後者を辺々加えて $2c=4$，$c=2$，$\beta=\dfrac52$．これは $2<\beta\leqq3$ をみたす．
   \item $t=2,\ \beta>2$：$2<m<\beta$ の整数が2個 $\iff4<\beta\leqq5$．$P=\{2,3,4\}$ で総和 $9>0$，一方 $g(3)=3c(3-\beta)<0$ なので不適．
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
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
```

</details>

## II-GEO-300（`content/problems/II-09.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -19,3 +19,3 @@
 \]
-直線 $y=m$（方程式 $y-m=0$）について，2点の $\eta$ は $(y_1-m)(y_2-m)$ である．したがって $y=m$ が分割線であるための必要十分条件は
+直線 $y=m$ について，2点の $\eta$ の符号は $(y_1-m)(y_2-m)$ の符号と同じである．実際，この直線の方程式を $qy+r=0$（$q\neq0$，$m=-\dfrac rq$）と書くと $\eta=(qy_1+r)(qy_2+r)=q^2(y_1-m)(y_2-m)$ で，$q^2>0$ だから，符号は方程式の書き方によらない．したがって $y=m$ が分割線であるための必要十分条件は
 \begin{center}
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
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
```

</details>

## III-DIF-359（`content/problems/III-16.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -15,3 +15,3 @@
 
-\textbf{$x=-1$．}$k$ が奇数の項は $\varphi_k(-1)=e^{-1}-e\neq0$ で微分可能．$k$ が偶数の項は，$x<-1$ で $x^k>1$ より $\varphi_k>0$，$-1<x<0$ で $0<x^k<1$ より $\varphi_k<0$．$\varphi_k'(-1)=k(-1)^{k-1}e=-ke$ だから，右側の微分係数は $-\varphi_k'(-1)=ke$，左側は $\varphi_k'(-1)=-ke$．よって $g$ の右側・左側の微分係数は $\pm e\,E$（$E$ は偶数 $k$ についての $c_kk$ の和）で，$g$ が $x=-1$ で微分可能 $\iff E=0$．
+\textbf{$x=-1$．}$k$ が奇数の項は $\varphi_k(-1)=e^{-1}-e\neq0$ で微分可能．$k$ が偶数の項は，$x<-1$ で $x^k>1$ より $\varphi_k>0$，$-1<x<0$ で $0<x^k<1$ より $\varphi_k<0$．$\varphi_k'(-1)=k(-1)^{k-1}e=-ke$ だから，右側の微分係数は $-\varphi_k'(-1)=ke$，左側は $\varphi_k'(-1)=-ke$．奇数 $k$ の項は $x=-1$ の近くで $\varphi_k<0$ なので $|\varphi_k|=-\varphi_k$ で，その微分係数は $-\varphi_k'(-1)=-ke^{-1}$ である（$k$ が奇数なので $\varphi_k'(-1)=ke^{-1}$）．$D=-e^{-1}\sum_{k\text{ が奇数}}c_kk$，$E=\sum_{k\text{ が偶数}}c_kk$ とおくと，$g$ の $x=-1$ での右側・左側の微分係数はそれぞれ $D+eE$，$D-eE$ である．よって $g$ が $x=-1$ で微分可能 $\iff D+eE=D-eE\iff E=0$．
 
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
$\varphi_k(x)=e^{x^k}-e$ とおくと，$g(x)=\sum_{k=1}^n c_k|\varphi_k(x)|$，$\varphi_k'(x)=kx^{k-1}e^{x^k}$ である．

(1) \textbf{$\varphi_k$ の零点．}$\varphi_k(x)=0\iff x^k=1$．$k$ が奇数なら $x^k$ は単調に増加するので $x=1$ のみ，$k$ が偶数なら $x^k=|x|^k$ より $x=\pm1$ のみである．

\textbf{零点以外の点．}$\varphi_k(a)\neq0$ なら，$\varphi_k$ の連続性から $a$ の近くで $\varphi_k$ の符号は一定で，$|\varphi_k|$ はその近くで $\varphi_k$ または $-\varphi_k$ に一致するから，$x=a$ で微分可能である．したがって $g$ は $x\neq\pm1$ で微分可能．

\textbf{零点での片側の微分係数．}$\varphi(a)=0$ で，$a$ の右側の近くで $\varphi>0$，左側の近くで $\varphi<0$ ならば
\[
\lim_{h\to+0}\frac{|\varphi(a+h)|-|\varphi(a)|}{h}=\lim_{h\to+0}\frac{\varphi(a+h)-\varphi(a)}{h}=\varphi'(a),\quad
\lim_{h\to-0}\frac{|\varphi(a+h)|-|\varphi(a)|}{h}=-\varphi'(a)
\]
である．符号が逆なら右・左の値はそれぞれ $-\varphi'(a)$，$\varphi'(a)$ になる．

\textbf{$x=1$．}すべての $k$ で，$x>1$ なら $x^k>1$ より $\varphi_k(x)>0$，$0<x<1$ なら $\varphi_k(x)<0$．$\varphi_k'(1)=ke$ なので，$|\varphi_k|$ の $x=1$ での右側・左側の微分係数は $ke$，$-ke$．よって $g$ の右側・左側の微分係数はそれぞれ $e\sum_{k=1}^n c_kk$，$-e\sum_{k=1}^n c_kk$ で，$g$ が $x=1$ で微分可能 $\iff\sum_{k=1}^nc_kk=0$．

\textbf{$x=-1$．}$k$ が奇数の項は $\varphi_k(-1)=e^{-1}-e\neq0$ で微分可能．$k$ が偶数の項は，$x<-1$ で $x^k>1$ より $\varphi_k>0$，$-1<x<0$ で $0<x^k<1$ より $\varphi_k<0$．$\varphi_k'(-1)=k(-1)^{k-1}e=-ke$ だから，右側の微分係数は $-\varphi_k'(-1)=ke$，左側は $\varphi_k'(-1)=-ke$．奇数 $k$ の項は $x=-1$ の近くで $\varphi_k<0$ なので $|\varphi_k|=-\varphi_k$ で，その微分係数は $-\varphi_k'(-1)=-ke^{-1}$ である（$k$ が奇数なので $\varphi_k'(-1)=ke^{-1}$）．$D=-e^{-1}\sum_{k\text{ が奇数}}c_kk$，$E=\sum_{k\text{ が偶数}}c_kk$ とおくと，$g$ の $x=-1$ での右側・左側の微分係数はそれぞれ $D+eE$，$D-eE$ である．よって $g$ が $x=-1$ で微分可能 $\iff D+eE=D-eE\iff E=0$．

以上より示された．\hfill$\square$

(2) (1) の条件は「奇数 $k$ についての $c_kk$ の和 $=0$」かつ「偶数 $k$ についての $c_kk$ の和 $=0$」と同値である．
$n=8$ のとき，奇数側は $\{1,3,5,7\}$（和 $16$）のうち $c_k=1$ とするものの和が $8$ になる選び方である．1個では最大 $7$，3個以上では最小 $1+3+5=9$ なので2個に限り，$\{1,7\},\{3,5\}$ の2通り．偶数側は $\{2,4,6,8\}$（和 $20$）のうち和が $10$ になる選び方で，1個では最大 $8$，3個以上では最小 $12$ なので2個に限り，$\{2,8\},\{4,6\}$ の2通り．
よって $N(8)=2\times2=\boldsymbol{4}$．

(3) $n$ 以下の奇数の個数を $m$，偶数の個数を $m'$ とする．

\textbf{必要条件．}$c_kk$ は $k$ が奇数なら奇数なので，奇数側の和は $m$ 個の奇数の和で，$m$ と偶奇が一致する．これが $0$ なので $m$ は偶数．
偶数側は $k=2j$ $(1\leqq j\leqq m')$ とすると和は $2\sum_{j=1}^{m'}c_{2j}\,j$ で，$c_{2j}j$ と $j$ は偶奇が一致するから $\sum_{j=1}^{m'}c_{2j}j$ は $\sum_{j=1}^{m'}j=\dfrac{m'(m'+1)}2$ と偶奇が一致する．よって $\dfrac{m'(m'+1)}2$ は偶数で，$m'$ を4で割った余りは $0$ または $3$（余り $0,1,2,3$ に対し $\frac{m'(m'+1)}2$ の偶奇を調べればよい）．
\begin{itemize}
  \item $n=2t$ のとき $m=m'=t$．$t$ は偶数かつ4で割った余りが $0$ か $3$ なので $t$ は4の倍数，$n$ は8の倍数．
  \item $n=2t+1$ $(t\geqq0)$ のとき $m=t+1$，$m'=t$．$t$ は奇数かつ4で割った余りが $0$ か $3$ なので余り $3$，$n=8s+7$ $(s\geqq0)$．
\end{itemize}

\textbf{十分条件．}等差数列の連続する4項 $a,\,a+d,\,a+2d,\,a+3d$ について $a-(a+d)-(a+2d)+(a+3d)=0$ である．
$n=8s$ $(s\geqq1)$ のとき，奇数 $1,3,\dots,8s-1$ と偶数 $2,4,\dots,8s$ はともに $4s$ 個で，前から4個ずつ区切って符号 $+,-,-,+$ を与えれば両方の和が $0$．
$n=8s+7$ $(s\geqq0)$ のとき，奇数 $1,\dots,8s+7$ は $4s+4$ 個で同様にできる．偶数 $2,4,\dots,8s+6$ は $4s+3$ 個で，$2+4-6=0$ とし，残りの $8,10,\dots,8s+6$（$4s$ 個）を4個ずつ $+,-,-,+$ とすればよい．

よって $N(n)\geqq1$ となるのは $\boldsymbol{n\text{ を }8\text{ で割った余りが }0\text{ または }7}$ である正の整数 $n$ である．
```

</details>

## III-DIF-374（`content/problems/III-16.json`）

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -11,3 +11,7 @@
 \]
-$f(x_2)=0$ より $e^{x_2}=bx_2-e^2<bx_2$，両辺の対数をとって $x_2>L+\log x_2>L+\log L$（$x_2>L>1$）．
+次に $x_2$ を下から評価する．$x_4=L+\log L$ とおくと，$L>4$ より $\log L>\log4>1$ なので $x_4>L$ であり，$e^{x_4}=e^L\cdot L=bL$ より
+\[
+f(x_4)=bL-b(L+\log L)+e^2=e^2-b\log L.
+\]
+$\log L>1$ と $b>e^4$ より $b\log L>b>e^4>e^2$ なので $f(x_4)<0$．$f$ は $x\geqq L$ で増加し，その範囲の零点は $x_2$ だけだから，$f(x_4)<0=f(x_2)$ より $x_2>x_4=L+\log L$．
 
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
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
```

</details>

### 着想（K 列）：差分

```diff
--- 修正前
+++ 修正後
@@ -1 +1 @@
-小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $e^{x_2}<bx_2$ から $x_2>\log b+\log x_2$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．
+小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $f(\log b+\log(\log b))=e^2-b\log(\log b)<0$ から $x_2>\log b+\log(\log b)$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．
```

<details><summary>着想（K 列）：修正後（全文，管理表に貼る内容）</summary>

```latex
小さい方の零点は $bx_1=e^2+e^{x_1}$ から $bx_1$ が $e^2+1$ に近く，大きい方の零点は $f(\log b+\log(\log b))=e^2-b\log(\log b)<0$ から $x_2>\log b+\log(\log b)$ で，$\log b$ より $\log(\log b)$ 程度大きい．この差 $\log(\log b)$ が $e^{x_1}-1$ による誤差 $\frac{(\log b)\cdot(\text{定数})}b$ に勝つので $x_2>\frac{b\log b}{e^2+1}x_1$ が出る．逆に $b\to\infty$ で $\frac{x_2}{\log b}\to1$，$bx_1\to e^2+1$ となるので定数 $e^2+1$ は小さくできない．原題は粗い定数 $2e^2$ で示したが，捻りでは最良の定数を求める．
```

</details>

## III-DIF-380（`content/problems/III-16.json`）

### 答え（I 列）：差分

```diff
--- 修正前
+++ 修正後
@@ -1 +1 @@
-(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；$\gamma>0\iff ab<e$
+(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；解がちょうど2個のとき $\gamma>0\iff ab<e$（$a,b$ だけの条件で書くと「$a>1$ または $b>1$」かつ $ab<e$）
```

<details><summary>答え（I 列）：修正後（全文，管理表に貼る内容）</summary>

```latex
(1) 「$0<a\leqq1$ かつ $0<b\leqq1$」または「$ab=e$」　(2) 証明；解がちょうど2個のとき $\gamma>0\iff ab<e$（$a,b$ だけの条件で書くと「$a>1$ または $b>1$」かつ $ab<e$）
```

</details>

### 解答・解説（J 列）main：差分

```diff
--- 修正前
+++ 修正後
@@ -27,2 +27,4 @@
 $ab<e$ なら $f'(0)<0$ で $m>0$，よって $0<m<\gamma$；$ab>e$ なら $m<0$ で $\gamma<m<0$．
-したがって $\boldsymbol{\gamma>0\iff ab<e}$．
+したがって，解がちょうど2個のとき $\boldsymbol{\gamma>0\iff ab<e}$．
+
+ここで「解がちょうど2個」は「$a>1$ または $b>1$」かつ「$ab\neq e$」と同値なので，$a,b$ だけの条件として書くと，$\gamma>0$ となるのは「$a>1$ または $b>1$」かつ「$ab<e$」のときである（$a\leqq1$ かつ $b\leqq1$ のときも $ab<e$ だが，そのときは解が $x=0$ の1個だけで $\gamma$ は存在しない）．
```

<details><summary>解答・解説（J 列）main：修正後（全文，管理表に貼る内容）</summary>

```latex
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
```

</details>

