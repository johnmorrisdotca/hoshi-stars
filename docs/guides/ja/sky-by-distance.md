---
title: 距離で見る空
section: how-to
order: 13
description: 10・50・100・500・1,000光年までの星と銀河を、距離の帯ごとに色分けして、星空の図と立体で見る方法です。距離がはっきりしないものは別にし、推測で置くことはしません。
---

[English](../sky-by-distance.md)

`@johnmorrisdotca/hoshi-stars/distance`は、「X光年までの空に何があるか」に答えます。ページがすでに読み込んだ星、近くの星、銀河を受け取るので、使う表の分だけ読み込めば足ります。上限より近いものを、距離の帯ごとに分けて返します。デモは2か所で使っています。星空の図（**距離**を選ぶ行、帯ごとの色、各帯の数を出す凡例）と、立体の図（`layers-3d.html`。真ん中が地球で、10・50・100・500・1,000光年の輪があり、上限を1つずつ広げられます）です。

## 層に入るもの、入らないもの

- **帯**は、0から10光年、10から50、50から100、100から500、500から1,000、それより遠く、の6つです（`bandOf`。境目は`DISTANCE_LIMITS`にあります）。ちょうど境目の距離は、近いほうの帯に入ります。
- **距離がよくわかっているもの**（視差の誤差が20%以下。5%未満が`good`、5%から20%が`fair`。`certaintyOf`と`CERTAINTY_LIMITS`にあり、立体の星座図と同じ基準です）は、いちばん確かな距離の場所に、その帯の色で出ます。
- **距離がはっきりしないもの**（`rough`。誤差が視差の20%を超える、誤差が書かれていない、銀河の出典の値が1.2倍より大きくばらつく、のどれか）は、どの帯にも入りません。**はっきりしないもの**として別にして、誤差から考えられるいちばん近い距離と遠い距離をつけ、数も別に数えます。星空の図では、空の上の場所に輪で描きます。立体では、視線に沿って、その範囲の長さの線で描き、点は描きません。正確な場所がわからないからです。上限をつけたときは、誤差から考えられるいちばん近い距離が上限の中にあれば、残します。
- **距離がないもの**は、数だけ数えて（`unknown`）、まったく描きません。推測で置くことはありません。

## 使い方

`starInput`（明るい星）、`nearbyInput`（`/nearby`の星）、`deepSkyInput`（`galaxyDistance`の距離をつけたディープスカイ天体。距離がなければ`null`）が、持っているものを`layersByDistance`に渡せる`DistanceInput`にします（どれだったかは`LayerKind`が示します）。結果は`DistanceLayers`です。上限の中にある`LayeredThing`を近い順に並べたもの（それぞれに、帯、範囲、はっきりしないかどうかがあります）、各帯の数、はっきりしないものの数、距離がないものの数が入っています。

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { galaxyDistance, messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyInput, layersByDistance, nearbyInput, starInput, stepLimit } from "@johnmorrisdotca/hoshi-stars/distance";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

// Everything that has a place on the sky: the bright stars, the nearby stars and the Messier objects, each with the distance its table gives (or none).
const everything = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((object) => deepSkyInput(object, galaxyDistance(object)))];

// Step the limit out, 10 light-years at a time to start with, and see the sky fill shell by shell.
let limit = 10;
for (let step = 0; step < 6; step += 1) {
  const layers = layersByDistance(everything, { limit });
  console.log(`${limit}: ${layers.things.length} things; bands ${layers.counts.join(" ")}; ${layers.uncertain} uncertain; ${layers.unknown} with no distance`);
  limit = stepLimit(limit, 1);
}

// A star whose distance is uncertain is in no band: it is kept apart, with the range its error allows.
const rigel = layersByDistance(everything, { limit: 700 }).things.find((thing) => thing.name === "Rigel");
console.log(rigel.uncertain, Math.round(rigel.low), Math.round(rigel.high));

// 10: 9 things; bands 9 0 0 0 0 0; 0 uncertain; 3083 with no distance
// 50: 897 things; bands 9 665 0 0 0 0; 223 uncertain; 3083 with no distance
// 100: 4130 things; bands 9 665 870 0 0 0; 2586 uncertain; 3083 with no distance
// 500: 7497 things; bands 9 665 870 329 0 0; 5624 uncertain; 3083 with no distance
// 1000: 7568 things; bands 9 665 870 329 11 0; 5684 uncertain; 3083 with no distance
// Infinity: 7672 things; bands 9 665 870 329 11 37; 5751 uncertain; 3083 with no distance
// true 593 1483
```

`stepLimit(limit, 1)`は、10、50、100、500、1,000、そしてすべて（`Infinity`）と進みます。`-1`で戻ります。自由に動かせるスライダーには、`limitAtSlider(position)`と`sliderOfLimit(limit)`を使います。`SLIDER_RANGE`（4光年から300万光年）の対数の目もりで、いちばん端が「すべて」です。上限はアドレスの`dist`に残ります（`limitFromText`が読みます。光年の数か`all`です。ないとき、`off`のとき、数でないときは、層なしです。`limitText`が書きます）。属性として使うページでは、`distance-limit`という名前です（`DISTANCE_ATTRIBUTE`）。最初はオフで、使うときに指定します。

## 星空の図では

デモの図には**距離**の行があります。なし、10、50、100、500、1,000、すべて、1つずつ進める「もっと近く」「もっと遠く」と、自分で決めるスライダーです。選ぶと、その距離の中にあるものだけを、帯の色で描きます（近い順に、金、オレンジ、サンゴ色、赤紫、紫、青）。銀河はひし形、はっきりしないものは輪です。凡例には、各帯の数と、距離がなくて描かないものの数が出ます。距離を選んでいる間は、いちばん暗い星の設定と暗い星の層は使いません。近くの星には暗い星が多いからです。選んだ値はアドレスの`dist=`に入り、埋め込みページ（`embed.html?dist=100`）とコピーするコードも、それに従います。

## 立体では

`layers-3d.html`が、同じ層を地球のまわりに描きます。1,000光年までは距離が実際の比率で、ページにもそう書いてあります。それより遠くは、輪が外へ行くごとに10倍の距離になります（縮めてあり、ページにもそう書いてあります）。ドラッグで回せます。上限を広げると、空が層ごとに埋まります。共通の表示操作も使えます。開くと回っています。「一時停止」で止まり（`spin=off`）、動きを減らす設定の人には、止まった状態で「再生」ボタンが出ます。WebGLコンテキストは1つだけで、1秒に30コマまでです。止まっているときと画面の外では、何も描きません。埋め込みページ（`embed-layers.html?dist=100`）も、同じ立体図で、「もっと近く」「もっと遠く」のボタンと凡例があります。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars by distance</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?dist=100&proj=hammer&ra=180&dec=0&zoom=1&layers=milky"
      title="The sky out to 100 light-years, each distance band in its own colour"
      width="480"
      height="240"
      loading="lazy"
      style="border: 0"
    ></iframe>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed-layers.html?dist=100"
      title="The sky out to 100 light-years in 3D"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## 距離の出どころ

星の距離は、3,261.56を視差（ミリ秒角）で割った値です。イェール輝星カタログ（`starInput`）とイェール三角視差カタログ（`nearbyInput`）から、視差の誤差といっしょに取ります。銀河の距離は、Wikidataにある距離の中央値と、そのばらつきです（`deepSkyInput`）。このために足したデータはありません。出典とライセンスは`NOTICE.md`にあります。
