---
title: ほかの星から見た空
section: how-to
order: 8
description: ケンタウルス座α星やシリウス、宇宙のどこかの点から見たときの星の位置を計算します。太陽も星のひとつとして入り、いつもの星図でそのまま描けます。
---

[English](../sky-from-another-star.md)

ふだん見ている空は、地球という1つの場所から見た空です。視差(しさ)のある星には距離があるので、星を3次元の中に置いて、ほかの場所から眺めることができます。`@johnmorrisdotca/hoshi-stars/sky-from`がそれをします。見る場所を渡すと、そこから見たときの赤経・赤緯、距離、明るさを星ごとに返します。太陽も星のひとつです。

## ケンタウルス座α星から見た太陽

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Rigil Kentaurus");
const sun = sky.find((star) => star.id === "sun");
console.log(`${(sun.rightAscension / 15).toFixed(2)} h ${sun.declination.toFixed(1)} ${sun.magnitude.toFixed(2)} ${sun.lightYears.toFixed(2)}`); // 2.66 h 60.8 0.45 4.35
```

ケンタウルス座α星の明るいほう(リギル・ケンタウルス)から見ると、太陽は0.45等の星で、赤経2時40分、赤緯+60.8度、カシオペヤ座にあります。地球の空でのα星の反対側です。太陽の絶対等級は4.83、色指数は0.65です。見る場所から見た星の明るさは`m' = M + 5 log10(d' / 10パーセク)`で、`M`は、太陽からの距離と等級から出した星の絶対等級です。

見る場所には、星(オブジェクト、または`starByName`が見つける名前)か、J2000の赤道座標の軸で、太陽を原点にしたパーセク単位の点`{ x, y, z }`を渡します。答えの方向は地球の空と同じ軸なので、図法も星座の線も、地球の空とまったく同じように使えます。

## 何が変わるか

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Rigil Kentaurus");
const sirius = sky.find((star) => star.name === "Sirius");
console.log(sirius.lightYears.toFixed(1), sirius.magnitude.toFixed(2)); // 9.5 -1.23
const home = skyFrom({ x: 0, y: 0, z: 0 });
console.log(home.length, home.find((star) => star.name === "Sirius").magnitude.toFixed(2)); // 2563 -1.46
```

- **近い星は大きく動き、遠い星はほとんど動きません。** シリウスは太陽から8.5光年、ケンタウルス座α星から9.5光年で、空の中で27度動きます。350光年はなれたリゲルは1度も動きません。
- **明るさが変わります。** シリウスは地球からは-1.46等、そこからは-1.23等です。
- **見る場所の星そのものは、その空には入りません。** 見る場所の距離の誤差より近い星も除きます。ケンタウルス座αのもう1つの星は、星表の位置では0.00004光年しかはなれていませんが、距離の精度は0.03光年なので、そこからどこに見えるかはわかりません。
- **太陽と同じ場所から見ると、いつもの空です。** `{ x: 0, y: 0, z: 0 }`は、距離のある星について`stars()`と同じ位置と等級を返します(太陽は入りません)。

## 距離のない星は除きます

動かせるのは距離のある星だけです。明るい星5,080個のうち2,517個は、星表に視差がありません(デネブやアルニラムなど)。これらは答えに入りません。`skipped`が数を返します(見る場所に近すぎて除いた星も数えます)。星座の線が、入っていない星につながっているときは、その線もそこからは描けません。

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Sirius", { magnitude: 0 });
console.log(sky.map((star) => `${star.name} ${star.magnitude.toFixed(2)}`)); // [ 'Procyon -1.31', 'Canopus -0.80', 'Capella -0.07' ]
console.log(sky.skipped > 2500);
```

表にある星だけが対象なので、地球からは暗すぎて表にない星は、ほかのどの空にも入りません。その星が明るく見える場所でも同じです。オプションは`magnitude`(見る場所から見ていちばん暗い等級)と`among`(5,080個の代わりに動かすリスト)です。答えは明るい順の`SeenStar`のリストで、`id`(`hr-2491`、`gctp-3278`、または`sun`)、`name`、`designation`、`rightAscension`、`declination`、`lightYears`、`parsecs`、`magnitude`、`absoluteMagnitude`、`colourIndex`、星表の星そのものの`star`が入っています。リストは`SeenSky`です。

距離には誤差があり、遠い星ほど大きくなります。ベテルギウスの視差は9.8ミリ秒角で、誤差は4.7です。そこから見た空も同じくらいあいまいです。`starDistance(star)`が誤差と範囲を返します。見る場所の精度は、その距離の精度までです。

## 近くの星も入れる

`/nearby`の5,565個も動かせます。小さいままにするため、別のimportです。`skyFromWithNearby`は同じ引数を取り、プロキシマ・ケンタウリ、バーナード星、赤色矮星(せきしょくわいせい)を動かす星に足し、近くの星の名前も見る場所として見つけます。

```js
import { skyFromWithNearby } from "@johnmorrisdotca/hoshi-stars/sky-from/nearby";

const sky = skyFromWithNearby("Proxima Centauri", { magnitude: 0 });
console.log(sky.map((star) => star.name ?? star.designation)); // [ 'Rigil Kentaurus', 'Toliman', 'Sirius', 'Canopus', 'Arcturus' ]
console.log(sky.length, sky.skipped); // 5 3018
```

V等級のない近くの星は明るさを決められないので、距離のない星といっしょに`skipped`に数えます。近くの星の表は圧縮して約240 kBです。`/sky-from`だけなら、明るい星の表しか読み込みません。

## デモでは

デモには**見る場所**(ミルばしょ / View from)の選択があります。太陽(地球の空)、ケンタウルス座α星、シリウス、ベガなど、そして選んだ星に距離があればその星です。図、星座の線、星の情報、「近くにあるもの」のパネルが、その場所から見たものになり、選択の下に、どこから見ているかと表示していないものを書いた説明が出ます。選択はアドレスに`from=HR5459`(ブライトスター星表の番号)として残り、埋め込みのページも同じものを受け付けます。星座の境界線と天の川は地球から見た方向なので、ほかの星から見ているときは境界線を表示しません。

## astropyでの確認

`scripts/check-sky-from.py`は、明るい星すべてを3つの見る場所(ケンタウルス座α星、シリウス、ベガ)へ、視差と位置からastropyでもう一度動かして比べます。1000分の1秒角、100万分の1等級まで一致し、星もどちらも同じです。PythonとastropyがいるのでCIでは動かさず、手で動かします。やり方はスクリプトの最初の行にあります。
