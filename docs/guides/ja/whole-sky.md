---
title: 全天を1枚の地図に
section: how-to
order: 10
description: 全天を横長 (2対1) の地図に、銀河座標でも赤道座標でも描く方法と、継ぎ目で線をきれいに切る方法、そして88星座すべてをのせて印刷できるデモのページ。
---

[English](../whole-sky.md)

`@johnmorrisdotca/hoshi-stars/all-sky` は、全天を幅が高さの2倍の箱にぴったり収めます。正方形のような無駄な余白ができません。これは計算だけを行う入口で、点の位置を好きな単位で返します。SVG でも canvas でも、好きな方法で描けます。

## 点の位置

```js
import { allSkyProject, allSkyUnproject } from "@johnmorrisdotca/hoshi-stars/all-sky";

const options = { width: 1000 }; // 幅1000、高さ500、銀河座標、モルワイデ図法
const centre = allSkyProject({ rightAscension: 266.4168, declination: -29.0078 }, options); // 銀河系の中心
console.log(Math.round(centre.x), Math.round(centre.y));
console.log(allSkyUnproject({ x: 500, y: 250 }, options)?.declination.toFixed(0));
// 500 250
// -29
```

`x` は右へ、`y` は左上の角から下へ増えます (画面と同じです)。オプションは次のとおりです。

| オプション | 意味 |
|---|---|
| `width` | 絵の幅 (使う単位で指定、必須)。高さはその半分です |
| `frame` | `ALL_SKY_FRAMES` のどれか: `galactic` (初期値: 銀河面が真ん中を通り、銀河系の中心が絵の真ん中) か `equatorial` (天の赤道が真ん中を通り、赤経12時が絵の真ん中) |
| `projection` | `ALL_SKY_PROJECTIONS` のどれか: `mollweide` (初期値) か `hammer` (どちらも面積が正しい楕円)、または長方形の `equirectangular` |
| `centre` | 絵の真ん中に来る経度 (度)。銀河座標は0、赤道座標は180です |
| `mirror` | 初期値は `false`。空を見上げた向きなので、経度は左へ増えます。`true` にすると地図の向き (右へ増える) です |

## 線・縁・格子

継ぎ目 (真ん中から半周の縁) をまたぐ線を、点をそのままつなぐと、絵の端から端まで線が走ってしまいます。`allSkyLine` は大円に沿って進み、`step` 度ごとに点を置いてなめらかにし、継ぎ目で線を切って、同じ高さの縁で終わる2本 (左右に1本ずつ) にします。

```js
import { allSkyLine, allSkyOutline, allSkyGrid } from "@johnmorrisdotca/hoshi-stars/all-sky";
import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";

const options = { width: 1000, frame: "galactic" };
const runs = allSkyLine(boundaryOf("Aur").outlines[0], options);
const d = runs.map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")).join("");
console.log(runs.length >= 1, d.startsWith("M"), allSkyOutline(options).length, allSkyGrid(options).length);
// true true 183 17
```

`allSkyOutline` は楕円 (または長方形) の縁で、背景やクリップに使えます。`allSkyGrid` はその絵の座標系での経線と緯線です。銀河座標の絵では、緯度0の線が銀河面 (天の川の面) です。

## デモのページ

デモの `whole-sky.html` は、88星座すべての星座線・境界線・名前と、真ん中を横切る天の川を、上の選択肢つきで描きます。パッケージがもともと持っているデータだけを使います。輪郭は `boundaries`、星座線は `lines` (星図で選んでいる星座の文化、西洋・日本・中国に合わせます)、天の川の明るさは `milky-way` (ページがブラウザで柔らかい画像にします)、ポインターの下にある星座は `constellationAt` で調べます。

- **タップ (クリック)** すると、その星座で星図が開きます (`./?go=Ori`。西洋以外の文化なら `culture=` もつきます)。マウスを重ねるか、Tab で移動すると名前とともに光り、Enter で開きます。
- **拡大・移動** はファミリー共通の表示コントローラー (バー、ピンチ、Ctrl か Command とホイール、キー) で行います。拡大するほど名前が増えます。名前が星座の中に収まらないときは3文字の略称になり、ほかの名前や明るい星の点とぶつかるときは、横にずらすか3文字の略称にし、それでも入らなければ出さないので、名前どうしが重なることも、名前が明るい星を覆うこともありません。
- **星は拡大とともに大きくなります。** 全天では、ブライトスター・カタログの星は小さな点です (いちばん明るい星で直径3.6ピクセル、それより暗い星で2.2と1.2)。拡大すると、星図と同じ決め方 (1度あたりのピクセル数で大きさが決まります) で大きくなります。幅約1,100ピクセルのデスクトップの地図では、2等星は6.5倍から直径約12ピクセル、4等星は約8ピクセルです。大きさは1度あたりのピクセル数で決まるので、幅の狭い地図 (スマートフォン) では、デスクトップと同じ大きさになるのは、もっと高い倍率のときです。明るい星が暗い星より小さくなることはありません。星は星座線と境界線の上に、さらに暗い星の層の上に描かれます。明るい星には夜空の色の細い縁取りがつくので、線は星の手前で止まります。暗い星の点は、ブライトスター・カタログのいちばん暗い星より小さいままです。
- **選ぶ** には絵の並びか検索を使います。地図がその星座へ拡大され、星図で開くカードが出ます。
- **暗い星** は、拡大するにつれてUCAC4のタイルから加わります。地図の下の1行に、その場所でどの等級まで見えるかが出ます ([暗い星](faint-stars.md#全天の地図で))。層の行のボタンで消せます。
- **印刷** は、地図を1枚 (A4・レター・A3・タブロイド、地図に合う向き)、または60 × 30 cm のポスター (分けて印刷) で、kazoku-ui の印刷レイアウトで出力します。「Space Program X」の見出しと、ページのアドレスの QR コードがつきます。

選んだ設定はすべてアドレスに残ります: `frame=equatorial`、`map=hammer`、`culture=japanese`、`layers=milky,names` (`faint`も層のひとつで、書かなければ入ります)、`c=Ori`、`paper=a4`、`form=poster`。
