---
title: 星座と星座の線
section: how-to
order: 4
description: 88星座を英語か日本語の名前で引き、点がどの星座にあるかを調べ、境界を描き、星座ごとの線の図を使う方法です。
---

[English](../constellations-and-lines.md)

3つのエントリーポイントがあり、それぞれ別のimportです。使わない星図は小さいままです。`/constellations`（名前、約2 kB）、`/boundaries`（点がどの星座にあるか、輪郭。さらに約7 kB）、`/lines`（星座ごとの線の図、約2 kB）です。

## 88星座

```js
import { constellation, constellations, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";

const dog = constellation("おおいぬ座");
console.log(dog.abbreviation, dog.name, dog.english, dog.japanese, dog.reading);
console.log(constellations().length, starsIn("Canis Major").slice(0, 3).map((star) => star.name));
// CMa Canis Major Great Dog おおいぬ座 おおいぬざ
// 88 [ 'Sirius', 'Adhara', 'Wezen' ]
```

`constellation`は、IAUの略号、ラテン名や属格、英語名、日本語名（座の有無、カタカナでもひらがなでも）、ひらがなの読みのどれでも、大文字小文字を問わず受け付けます。見つからなければ`undefined`です。`starsIn`は、バイエル符号かフラムスティード番号を持つ明るい星を、明るい順に返します。

## この点はどの星座か

`constellationAt`は、星だけでなくJ2000の任意の位置を受け付けます。境界はIAUのもので、ローマンがデルポルトの境界線を表にしたものです。境界線のすぐそばまで正確に答えます。

```js
import { constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";

console.log(constellationAt({ rightAscension: 88.79, declination: 7.41 }).name);
console.log(constellationAt({ rightAscension: 0, declination: 90 }).name);
// Orion
// Ursa Minor
```

`boundaryOf("Ori")`は、輪郭を`{ rightAscension, declination }`の閉じた輪として返します。1度ごとに点があり、投影して直線でつなげば描けます。0時をまたぐ輪は、生の度数では360付近から0付近に飛びます。先に1点ずつ投影し、広い星図では、隣り合う2点が遠く離れたら線を切ってください。

## 星座の線

各星座に、その星座の明るい星を結ぶ線の図が1つあります。この図は自作です。

```js
import { figureOf, figures } from "@johnmorrisdotca/hoshi-stars/lines";

const dipper = figureOf("UMa");
for (const [a, b] of dipper.segments.slice(0, 3)) console.log(a.name, "to", b.name);
console.log(figures().length, "figures;", dipper.stars.length, "stars in the Great Bear's");
// Dubhe to Merak
// Merak to Phecda
// Phecda to Megrez
// 88 figures; 9 stars in the Great Bear's
```

図は`{ constellation, stars, segments }`で、`segments`の1つ1つが、投影して線で結べる2つの星の組です。線の星はどれもその星座の中にあるので、図が隣の星座にはみ出ることはありません。そのため、本で見る形の一部は閉じていません（ペガスス座の大四辺形には、アンドロメダ座にあるアルフェラッツの角がありません）。図は星のデータから描いたもので、本・星図・ほかのプログラムからの写しではありません（[データとライセンス](data-and-licences.md)を見てください）。
