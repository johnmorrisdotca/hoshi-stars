---
title: 星のデータ
section: how-to
order: 2
description: イェール輝星カタログの5,080個の星を、名前・番号・明るさで探す方法と、各項目の意味、星の動きについて説明します。
---

[English](../stars.md)

メインのエントリーポイントは明るい星です。イェール輝星カタログの6.0等以上の星すべてで、暗い場所なら望遠鏡なしで見える星のほとんどです。表は圧縮して約100 kBで、必要なとき以外は、ほかの部品がこの表を読み込むことはありません。

## 何個あるか

等級は数字が小さいほど明るい星です。`stars({ magnitude })`は、その等級かそれより明るい星を、明るい順に返します。

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";

const counts = [1, 2, 3, 4, 5, 6].map((magnitude) => stars({ magnitude }).length);
console.log(counts.join(" "));
// 15 50 174 518 1630 5080
```

1等までで15個、2等までで50個、3等までで174個、4等までで518個、5等までで1,630個、6等までで5,080個です。オプションなしなら5,080個すべてです。

## 1つ探す

```js
import { starByHr, starByName } from "@johnmorrisdotca/hoshi-stars";

console.log(starByName("betelgeuse")?.designation);
console.log(starByName("α Lyr")?.name);
console.log(starByHr(2491)?.name);
console.log(starByName("Atlantis"));
// α Ori
// Vega
// Sirius
// undefined
```

`starByName`には、星の名前（136個の星にあり、つづりはIAUの恒星名ワーキンググループに従います）か符号を、大文字小文字を問わず渡せます。`starByHr`には、変わることのないカタログ番号を渡します。どちらも、見つからなければエラーではなく`undefined`を返します。

## 星が持っている項目

| 項目 | 意味 |
|---|---|
| `hr` | カタログ番号 |
| `nameJa` | 名前のある星のカタカナ名（`シリウス`）。`starByName` でも探せます。 |
| `name`, `designation` | `Sirius`、`α CMa`。符号は、バイエル符号かフラムスティード番号に星座名を付けたものです。暗い星にはどちらもありません。 |
| `constellation` | 符号がある星の、IAUの3文字略号（`CMa`）。どの星でも[`constellationAt`](constellations-and-lines.md)で分かります。 |
| `rightAscension`, `declination` | J2000の赤経・赤緯（度） |
| `magnitude` | 実視等級 |
| `colourIndex`, `spectralClass` | B-V色指数とスペクトル型。[色と距離](colour-and-distance.md)を見てください。 |
| `properMotionRaMas`, `properMotionDecMas` | 星の動き（1年あたりのミリ秒角） |
| `parallaxMas` | 年周視差。カタログにないときは0です。 |

星はすべて凍結されていて、共有の表を間違って書き換えることはありません。

## いまの位置

位置は2000年のものです。星は毎年ほんの少し動くので、`starPosition(star, when)`で、ある時刻までの位置にできます。`when`は`Date`か1970年からのミリ秒です。パッケージは時計を読まないからです。

```js
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";

const arcturus = starByName("Arcturus");
const later = starPosition(arcturus, Date.UTC(2100, 0, 1));
console.log((later.declination - arcturus.declination).toFixed(3), "degrees in 100 years");
// -0.055 degrees in 100 years
```

結果はJ2000の座標系のままで、歳差は含みません。場所と時刻から空を求めるときは`/sky`が歳差を扱います（[星図](sky-charts.md)を見てください）。
