---
title: ディープスカイ天体の大きさと写真
section: how-to
order: 7
description: 銀河・星団・星雲の空での大きさと向き、その輪郭、明るい天体の写真を実際の位置と大きさで重ねる方法、そして測定した部分と描いただけの部分の見分け方。
---

[English](../deep-sky-pictures.md)

このパッケージが持つディープスカイ天体は、すべて空での実際の大きさで描けます。明るいものには写真もあります。このページでは、数値が何か、どう描くか、どの部分が測定でどの部分が描いただけかを説明します。

## 形とは

`deepSkyShape(object)` は、カタログが測った3つの値を返します。値は数か `undefined` のどちらかです。

| 部分 | 意味 |
|---|---|
| `majorArcmin` | いちばん長い方の直径 (分角) |
| `minorArcmin` | いちばん短い方の直径 (測定があるとき) |
| `positionAngle` | 長軸の位置角。北から東回りに0度以上180度未満 (測定があるとき) |
| `source` | 数値の出どころ: `RC3`、`NED`、`Catalogue row` |

推測はしません。銀河の数値は、RC3 (明るい銀河の参照カタログ第3版。25等級の等光度線での直径、軸の比、角度) のものか、RC3 にないときは NASA/IPAC NED の直径の表 (ESO-Uppsala と UGC の各カタログにある同じ等光度線の直径、それもなければ 2MASS の全体の直径) のものです。銀河10,282個のうち9,719個に形があり、RC3 から7,013個、NED から2,706個です。ほかの天体 (星団、星雲、どちらにもない銀河) の大きさは、その天体の行にある直径ひとつだけ (`Catalogue row`) で、軸の比も角度もありません。銀河以外に角度のある天体はありません。全体では、11,898個のうち9,795個に大きさが、7,293個に角度があります。残りは、大きさ固定の点線の記号で描きます。`measuredParts(shape)` は、どの部分があるかを返します。短軸か角度がない天体は、長い方の直径の円で描き、だれも測っていない楕円は描きません。

RC3 の利用条件は確認中なので (`NOTICE.md`)、形は RC3 なしでも作れます。`python3 -I scripts/make-deep-sky-shapes.py --no-rc3` が NED だけの版です (銀河9,572個、うち8,439個に角度)。NGC 2000.0 とスカイカタログは使いません。

import は2つに分けてあり、使うものだけを読み込めます。`@johnmorrisdotca/hoshi-stars/deep-sky/shape` はメシエ天体の形 (gzip で約3 kB)、`.../deep-sky/ngc-ic-shape` は全天体の形 (約52 kB) です。

## 輪郭

`deepSkyOutline(centre, shape, points)` は、天体のまわりを囲む空の点の輪です。長軸・短軸・角度どおりの楕円を、天体の位置で天球に接する平面 (接平面。天体写真を撮る面) で見たものです。点は空の座標なので、7つの図法のどれでも描け、どの図法でも楕円は正しい大きさと向きのままです。`offsetOnSky(centre, east, north)` は、その手順だけを取り出したものです。

## 写真

`deepSkyPicture("M31")` は、天体のいちばん広い写真がどこにあるかを返します。ファイル名 (`pictures/M31.webp`)、幅と高さ、中心の空の点、1ピクセルあたりの秒角、回転、クレジット、出典です。`deepSkyPicturesOf("M51")` は、その天体の写真を広いものから順にすべて返します。天体の一部をより細かく写した写真もあり、広い写真の上に重ねます。`deepSkyPictures()` はすべての写真を返します。`pictureCorners(picture)` は空での4つの角を返します。地図はそのうち3つの角で写真を留めます (下の「ページで」の例)。写真は透明部分のある WebP なので、暗い空に重ねると光だけが加わり、四角い枠は出ません。

広い写真は、NASA の SkyView が画像を作った日に、各天体を中心として切り出したサーベイ画像です。位置は正確です。画像の依頼そのものが位置の指定になっていて、目で合わせたものはありません。サーベイは3つあり、どれもクレジットを付け、ファイル・アドレス・ライセンス・取得した日をリポジトリの `NOTICE.md` に記録しています。

- **SDSS g, r, i**: スローン・デジタル・スカイ・サーベイが観測した範囲の可視光 (クリエイティブ・コモンズ表示ライセンス)。
- **2MASS J, H, K**: 全天の近赤外線 (米国政府の著作物)。
- **WISE 3.4, 4.6, 12 ミクロン**: 星雲に向いた中間赤外線 (パブリックドメイン)。

赤外線の画像は疑似カラーです。観測データを目で見えるようにしたもので、だれかが撮った写真ではありません。デモのカードにもそう書いてあります。

細かい写真は ESA/Hubble の画像です (クリエイティブ・コモンズ表示4.0。https://esahubble.org/copyright/ に書かれています)。M1、M16、M31、M33、M42、M51、M57、M81、M82、M83、M104、球状星団のきょしちょう座47 (NGC 104) など、よく知られた天体の18枚です。どの画像も、画像に付いた Astronomy Visualization Metadata の位置と回転で空に置き、サーベイ画像の上に重ねます。大きさを変え、縁の黒い部分は透明にし、発表資料のクレジットはカードと `NOTICE.md` に残します。デジタイズド・スカイ・サーベイ、Stellarium のテクスチャー、ライセンスが書かれていない画像は使いません。

110個のメシエ天体のうち82個に写真があります。サーベイに写る銀河・球状星団・星雲のすべてと、プレアデスです。残りは、天の川の濃い星野の中にある散開星団 (サーベイでは薄暗い星が一面に写るだけなので、代わりにデモの地図で明るい星を丸く囲みます)、星野の M24、アステリズムの M40 と M73、そして M31 の写真の中にある M32 です。全部で113個の天体の写真が130枚あります。天体の内訳は、82個のメシエ天体と、明るい NGC・IC 天体31個です。写真の内訳は、サーベイの写真112枚と、細かい ESA/Hubble の写真18枚です (タランチュラ星雲 NGC 2070 は、ハッブルの写真だけです)。**写真のファイルは npm パッケージに入っていません** (約9 MB で、入れると、インストールするすべての人にその分が加わってしまうためです)。パッケージにあるのはコードと上の索引だけで、ファイルは、暗い星のタイルと同じように、デモのサイトから配信します。写真を自動で読み込むことはありません。写真が必要なページが `pictureUrl(picture)` でそのアドレスを求めます。アドレスは `PICTURES_BASE`、つまり `https://johnmorrisdotca.github.io/hoshi-stars/` の下です。自分のサーバーから配信したいときは、リポジトリの `pictures/` フォルダーをそのサーバーにコピーし、`pictureUrl(picture, base)` に、その親フォルダーのアドレスを渡してください。

ファイルは1枚90 kB 以下です。デモは、写真の視野が画面上で幅90ピクセル以上になったときだけ写真を読み込み、130ピクセルから表示し (360ピクセルで完全に表示)、同時に読み込むのは6枚までです。そのため、1つの画面で読み込む写真は多くても約500 kB、ふつうは1〜2枚 (50〜150 kB) です。NGC・IC 天体 (スクリプト約190 kB) は、ディープスカイの層をオンにして地図を拡大したときだけ読み込みます。

デモは、写真をその写真自身のピクセルより大きく描くことはありません。拡大の中心にある空に写真が重なっているときは、そこにある最も細かい写真の1ピクセルが地図の1ピクセルになるところで拡大が止まります。環状星雲 (M57) のハッブルの写真 (1ピクセルが0.16秒角) なら上限の8000まで拡大でき、1分角の輪が地図の短いほうの辺の半分より大きくなります。サーベイの写真 (1ピクセルが1〜3秒角) は手前で止まります (M91は約600〜1,000、M31は約300、M51は約2,000で、地図の大きさによります)。縮小は、止まったところから始まります。検索や天体名を押したときの移動も、それより近づきません。アドレスでもっと大きな値 (M91の上で`zoom=8000`) を指定すると、指定した値のまま表示され、写真は引き伸ばされ、薄くなって描かれます (4倍で元の濃さの0.6倍に、16倍で0.35倍になります。ピクセルがブロックに見えてしまうためです。120倍を超えて引き伸ばされる写真は描きません)。何もない空ではなく、天体のぼんやりした姿が見えます。ホイール、ボタン、検索での移動は、拡大が止まるところで止まります。

デモが描くのは、130枚の写真のうち117枚 (113天体のうち102天体) です。写真は1枚ずつ、地図の上で、見え始める拡大と拡大の上限で確かめ、13枚を外しました。11枚はサーベイの写真で、境目がくっきり見える、タイルのつなぎ目が見える、ノイズの四角が見える、サーベイにデータがなく穴があいている、のどれかです (M8、M16、M17、M20、M33、M110、NGC 1316、NGC 2403、NGC 3242、NGC 5139、NGC 7009)。残る2枚は、空にぽつんと残ってしまう、天体の小さな一部を写したハッブルの写真です (M33の一部と、NGC 2070)。より細かい写真は、広い写真の上に重ねて描きます。細かい写真だけを単独で描くのは、天体の大部分を写している場合に限ります (M16の「創造の柱」)。外した写真の一覧と理由は、`demo/picture-quality.ts`の`LEFT_OUT`にあります。写真のファイルとパッケージの索引は変えていません。これはデモの選択なので、写真を自分で描くページでは、どれを描くかも自由に決められます。

## 星団の輪郭の中の星

`starsInside(object, shape)` (`@johnmorrisdotca/hoshi-stars/deep-sky/members`) は、天体の長い方の直径でできる円の中にある、明るい星カタログの星 (6等まで) を、明るい順に返します。わかるのは星の位置だけで、どの天体に属するかではありません。カタログには星団までの距離がないので、星団の手前の星や、ずっと奥の星も入ります。「輪郭の中の星」として描いてください。星団の仲間と確かめた星ではありません。

```ts
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
import { starsInside } from "@johnmorrisdotca/hoshi-stars/deep-sky/members";

const pleiades = deepSkyObject("M45")!;
console.log(starsInside(pleiades, deepSkyShape(pleiades)).slice(0, 3).map((star) => star.name));   // [ 'Alcyone', 'Atlas', 'Electra' ]
```

## サーバーで

上のものはすべて純粋な関数なので、Node 22 以上のスクリプトで、輪郭と写真の枠をファイルに描けます。

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyOutline, deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
import { deepSkyPicture, pictureCorners } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

// Andromeda at its measured size and angle, and the frame of its picture, on a map 4 degrees across (north up, east on the left).
const m31 = deepSkyObject("M31");
const shape = deepSkyShape(m31);
const picture = deepSkyPicture("M31");
const view = { centre: m31, scale: (800 / 4) * (180 / Math.PI) };
const path = (ring) =>
  ring
    .map((point, i) => {
      const at = project("gnomonic", point, view);
      return `${i === 0 ? "M" : "L"}${(400 + at.x).toFixed(1)} ${(400 - at.y).toFixed(1)}`;
    })
    .join("") + "Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Andromeda"><rect width="800" height="800" fill="#0b1020"/><path d="${path(pictureCorners(picture))}" fill="none" stroke="#6f93e0"/><path d="${path(deepSkyOutline(m31, shape))}" fill="none" stroke="#e0a458"/></svg>`;
writeFileSync(join(tmpdir(), "hoshi-m31.svg"), svg);
console.log("M31", shape.majorArcmin, shape.minorArcmin, shape.positionAngle, picture.file);
```

## ページで

写真は4つの角のうち3つで空に留め、その上に輪郭を重ねます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Andromeda and its picture</title>
  </head>
  <body>
    <div id="sky"></div>
    <script type="module">
      import { deepSkyObject } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky.js";
      import { deepSkyOutline, deepSkyShape } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky-shape.js";
      import { deepSkyPicture, pictureCorners, pictureUrl } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky-pictures.js";
      import { project } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/projection.js";

      const m31 = deepSkyObject("M31");
      const picture = deepSkyPicture("M31");
      const view = { centre: m31, scale: (400 / 4) * (180 / Math.PI) };
      const place = (point) => {
        const at = project("gnomonic", point, view);
        return { x: 200 + at.x, y: 200 - at.y };
      };

      // The picture is pinned to the sky by three of its corners: its pixels (0, 0), (width, 0) and (0, height).
      const [topLeft, topRight, , bottomLeft] = pictureCorners(picture).map(place);
      const matrix = [(topRight.x - topLeft.x) / picture.width, (topRight.y - topLeft.y) / picture.width, (bottomLeft.x - topLeft.x) / picture.height, (bottomLeft.y - topLeft.y) / picture.height, topLeft.x, topLeft.y];
      const ring = deepSkyOutline(m31, deepSkyShape(m31)).map((point, i) => `${i === 0 ? "M" : "L"}${place(point).x.toFixed(1)} ${place(point).y.toFixed(1)}`).join("");

      document.querySelector("#sky").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Andromeda"><rect width="400" height="400" fill="#0b1020"/><image href="${pictureUrl(picture)}" width="${picture.width}" height="${picture.height}" transform="matrix(${matrix.join(" ")})"/><path d="${ring}Z" fill="none" stroke="#e0a458"/></svg>`;
    </script>
  </body>
</html>
```

## デモで

**ディープスカイ**の層は、すべての天体を実際の大きさで描き、**写真**の層は写真を重ねます。どちらの設定もアドレスに残ります (`layers=…,deep,pictures`)。天体をタップするとカードが開き、測定したもの (大きさ・角度・測定元)、描いたもの、写真のクレジットとライセンス、散開星団ならその輪郭の中にあるカタログの明るい星 (地図で丸く囲みます) がわかります。その星はカタログの位置にあるだけで、星団の仲間かどうかは確かめていません。カタログに星団までの距離がないためです。

記号の読み方:

- 銀河は、測定した大きさ・軸の比・角度の楕円です。軸の比か角度がないときは、長い方の直径の点線の円です。
- 球状星団は十字つきの円、散開星団は破線の円、惑星状星雲は2本の短い線つきの輪、超新星残骸は内側にもう1つ輪のある破線の輪、そのほかの星雲は破線の輪郭です。
- 明るい天体ほど濃く描きます (等級に応じて変えます)。
- 薄い色の点線で描いた大きさ固定の記号は、大きさが測定されていない天体です。
- 実際の大きさで見えるほど拡大するまでは、最小の大きさの記号で描きます。
