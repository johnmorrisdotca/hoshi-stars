---
title: 星座の絵と豆知識
section: how-to
order: 5
description: 88星座それぞれの絵 (明るい版と暗い版) を SVG・PNG のファイルか関数で使う方法と、一覧やギャラリー用の豆知識の表。
---

[English](../constellation-pictures.md)

88星座ぜんぶの絵を、このパッケージ自身の星・線・境界線から描いています。星座を四角の中に大きく入れ、境界線は点線、星座の線と明るい星ははっきり、となりの星座の境界線と星はうすく描きます。上が北、左が東で、空を見上げたときと同じ向きです。見た目は `dark` (夜空) と `light` (紙にインク) の2種類です。絵には文字がないので、フォントはいらず、どの言語の画面にも使えます。

## ファイル

npm パッケージに絵のファイルが入っているので、コードを動かさなくても画面に出せます。メインの入口の大きさは変わりません。

| パッケージの中の場所 | 中身 |
|---|---|
| `thumbnails/svg/<look>/<abbreviation>.svg` | どんな大きさにもできる絵 (ふつうは480ピクセル) |
| `thumbnails/png/160/<look>/<abbreviation>.png` | 選ぶ画面用の小さな絵 |

`<look>` は `light` か `dark`、`<abbreviation>` は IAU の略称で、大文字小文字もそのまま (`Ori`、`CMa`、`PsA`) です。CDN からは `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/thumbnails/svg/dark/Ori.svg` で使えます。バンドラーでも同じ道すじ `@johnmorrisdotca/hoshi-stars/thumbnails/svg/dark/Ori.svg` を import できます。

デモのサイトには、480ピクセル (カード用) と1200ピクセル (印刷・共有用) の PNG もあります。たとえば `https://johnmorrisdotca.github.io/hoshi-stars/thumbnails/png/1200/light/Ori.png` です。好きな大きさのファイルを作るには、チェックアウトで `pnpm thumbnails <フォルダ> 160,480,1200` を実行します。PNG は SVG から resvg で作るので、ブラウザはいりません。

## 関数で描く

`/thumbnails` は別の入口なので、ファイルを出すだけのページには重さが増えません。

```js
import { constellationThumbnail, THUMBNAIL_UNITS } from "@johnmorrisdotca/hoshi-stars/thumbnails";

const svg = constellationThumbnail("Orion", { theme: "light", size: 160 });
console.log(svg.startsWith("<svg"), svg.includes('width="160"'), THUMBNAIL_UNITS);
// true true 400
```

`constellationThumbnail(text, options)` は `constellation` が受け付ける名前なら何でも使えて、SVG の文字列を返します。オプションは `theme` (ふつうは `dark`)、`size` (ピクセル。省くと入れ物の大きさになります)、`neighbours` (`false` でとなりの境界線と星を省く) です。星座の星は、それぞれ `data-hr` (ブライトスターカタログの番号) がついた `<circle>` なので、ページ側で見つけて印をつけられます。

## ほかの星座の図にも同じ描き方を

`thumbnailSvg(input, options)` は、枠にする輪郭、空の位置どうしを結ぶ線、どの星がその図のものかの判定を渡せば、どんな図でも描けます。日本や中国の伝統的な星座など、別の図も同じ見た目でそろえられます。

```js
import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";
import { thumbnailSvg } from "@johnmorrisdotca/hoshi-stars/thumbnails";

const belt = thumbnailSvg({ title: "The belt", outlines: boundaryOf("Ori").outlines, segments: [], owns: (star) => star.name === "Alnilam" });
console.log(belt.includes('data-hr="1903"'));
// true
```

## ギャラリーや一覧のための豆知識

`/constellation-facts` には星の表にないことが入っています。名前の意味 (英語と日本語)、どちらの半球か、見ごろの月、だれがいつ作った星座か、見つけやすさ、アステリズム、その星座に放射点がある流星群です。

```js
import { allConstellationFacts, constellationFacts } from "@johnmorrisdotca/hoshi-stars/constellation-facts";

const orion = constellationFacts("Orion");
console.log(orion.meaning.en, orion.hemisphere, orion.bestMonth, orion.origin, orion.designer.en, orion.difficulty);
console.log(orion.asterisms.map((a) => a.en), orion.meteorShowers.map((s) => `${s.name.en} ${s.peak}`));
console.log(allConstellationFacts().filter((f) => f.difficulty === "easy" && f.hemisphere === "north").map((f) => f.constellation.abbreviation).join(" "));
// Hunter both 1 ancient Ptolemy easy
// [ "Orion's Belt", 'Winter Triangle', 'Winter Hexagon' ] [ 'Orionids 10-21' ]
// And Aur Boo Cas Cyg Dra Gem Peg Per UMa
```

- **半球 (hemisphere)** は `north` (北天)、`south` (南天)、`both` (天の赤道を1度より大きくまたぐ) のどれかで、境界線から計算します。
- **見ごろの月 (bestMonth)** は、夜9時ごろ (太陽の時刻、15日) に空の高いところに来る月 (1〜12) で、星座の図の位置から計算します。
- **由来 (origin)** は `ancient` (プトレマイオスの48星座。47星座とアルゴ座で、アルゴ座はラカイユがりゅうこつ座・とも座・ほ座に分けたので、今の88のうち50)、`voyages` (1590年代のオランダの航海でできた南の12星座)、`early` (1500〜1600年代に加わった12星座)、`modern` (1756年のラカイユの14星座) です。`designer` と `year` で、だれがいつかも分かります。
- **見つけやすさ (difficulty)** は `easy`・`medium`・`hard` で、星座の星の明るさだけで決めます。3番目に明るい星が基準で、とても明るい星があると有利です。星が見えやすいかどうかで、形を覚えやすいかどうかではありません。
- **アステリズム** と **流星群** は、よく知られたことを手で打ち込んだ小さな表で、言葉は自分たちのものです。流星群は IAU の名前と、ふつうの極大の夜 (毎年1日ほどずれます) です。出典は `NOTICE.md` にあります。

型は `ConstellationFacts`、`Words` (`en` と `ja` の文)、`Hemisphere`、`Origin`、`Difficulty`、`MeteorShower`、`ThumbnailInput`、`ThumbnailOptions`、`ThumbnailTheme` です。

## デモでの使われ方

デモのページが絵と豆知識を使っています。2つの入口が何のためかが、見て分かります。

- **ピッカー**: ホームの星空の地図の上に、88星座の絵がならんだ帯と、さがす箱があります (英語・ラテン語・日本語の名前や略号でさがせます)。ひとつ押すと、地図がそこへ飛んで、その星座を選びます。さがす箱で Enter を押すと、最初の1つが選ばれます。ホームのアドレスに `?go=Ori` をつけても同じです。
- **ギャラリー** `constellations.html`: 88星座の絵を1ページ24個ずつ、さがす機能つきで見せます。ひとつ押すと、その星座だけのページが開きます。
- **星座のページ** `constellation.html?c=Ori`: 大きな絵とそのファイル、豆知識、ブラウザの音声で読む名前 (ラテン語と日本語)、明るい星とメシエ天体、となりの星座、「地図で開く」です。
- **一覧表** `constellation-list.html`: IAUの88星座 (西洋の空) の表です。日本や中国の空は地図で見られます。半球・見ごろの月・作られた時代・見つけやすさ・アステリズム・流星群の6つで絞りこめます。パソコンでは、条件ごとに選んだ内容を示す小さなチップ (「半球: すべて」) があり、押すと選択肢のメニューが開きます。スマートフォンでは「絞りこみ」ボタンでシートが開きます。同じ条件の中で2つ以上えらぶと、どれかに合う星座が出て、ちがう条件を重ねるとすべてに合う星座だけになります。残った数がチップの横に出ます。「条件をぜんぶ消す」で最初に戻ります。選んだ条件はアドレスに残ります。

デモは https://johnmorrisdotca.github.io/hoshi-stars/ です。どのページも英語と日本語、明るい色と暗い色に対応し、絵は色の設定に合わせて変わります。
