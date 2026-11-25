# A-GEO-115

## 監査で指摘された内容

(1)「K は B，C と異なるから P，L とも異なる」は理由になっていない（B）。

## 問題文

円に内接する四角形 ABCD において，半直線 AB と半直線 DC は B，C の先の点 P で交わり，半直線 AD と半直線 BC は D，C の先の点 Q で交わるとする．$\angle\mathrm{APD}$ の二等分線が線分 BC，線分 AD と交わる点をそれぞれ K，L とし，$\angle\mathrm{AQB}$ の二等分線が線分 CD，線分 AB と交わる点をそれぞれ N，M とする．
\begin{enumerate}
  \item 点 K，L が実際にそれぞれ線分 BC，AD の内部にあり，P，K，L がこの順に並ぶことを示せ．また，$\mathrm{QK}=\mathrm{QL}$ であることを示せ．
  \item 四角形 KMLN はひし形であることを示せ．
\end{enumerate}

## 答え（修正後）

(1) 証明　(2) 証明

## 解答・解説（修正後，全文） main

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

## 着想（修正後）

円に内接する四角形では対角の和が $180^\circ$．対辺の延長の交点 P での角の二等分線が他方の組の対辺と交わる2点を K，L とすると，三角形の外角と内角の和の計算から，もう一方の交点 Q について $\angle\mathrm{QKL}=\angle\mathrm{QLK}$ となり，三角形 QKL は二等辺三角形．よって Q での角の二等分線は KL の垂直二等分線になる．原題は2本の二等分線が垂直であることだけを問うが，捻りでは役割を入れかえた2つの二等辺三角形を組み合わせ，4つの交点がひし形をなすことまで示す．

## 修正前との差分

```diff
--- 修正前 solution main
+++ 修正後 solution main
@@ -2,3 +2,3 @@
 
-(1) {\bf K，L の位置．}B は半直線 AB 上で A と P の間に，C は半直線 DC 上で D と P の間にあるから，B，C はそれぞれ三角形 PAD の辺 PA，PD の内部の点である．$\angle\mathrm{APD}$ の二等分線は三角形 PAD の辺 AD の内部の点 L で交わり，線分 PL は三角形 PAD を三角形 PAL と三角形 PLD に分ける．B は辺 PA の内部，C は辺 PD の内部にあるので，B，C は直線 PL の反対側にあり，線分 BC は直線 PL と1点 K で交わる．K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にあり，B，C と異なるから P，L とも異なる．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．
+(1) {\bf K，L の位置．}B は半直線 AB 上で A と P の間に，C は半直線 DC 上で D と P の間にあるから，B，C はそれぞれ三角形 PAD の辺 PA，PD の内部の点である．$\angle\mathrm{APD}$ の二等分線は三角形 PAD の辺 AD の内部の点 L で交わり，線分 PL は三角形 PAD を三角形 PAL と三角形 PLD に分ける．B は辺 PA の内部，C は辺 PD の内部にあるので，B，C は直線 PL の反対側にあり，線分 BC は直線 PL と1点 K で交わる．K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にある．直線 PL は直線 PA，PD と P だけで交わり，B，C は P と異なるので，B，C は直線 PL 上になく K$\neq$B，C．また P は直線 AB 上の B と異なる点で，直線 AB と直線 BC は B だけで交わるので，P は直線 BC 上になく K$\neq$P．さらに直線 BC と直線 AD はただ1点 Q で交わり，Q は線分 BC の外（C の先）にあるので，線分 BC は直線 AD と共有点をもたず K$\neq$L．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．
 
```
