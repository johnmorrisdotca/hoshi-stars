---
title: 今夜見える星
section: how-to
order: 14
description: "ある場所・ある時刻に見える星を、太陽・空の暗さ・大気の影響まで考えて調べます。visibleStars、薄明、大気路程、星ごとの見やすさ。"
---

[English](../tonight.md)

`@johnmorrisdotca/hoshi-stars/tonight` は「いま、ここから、何が見えるか」に答えます。[自分の空](sky-charts.md)の `horizontal`(高度と方位)を土台に、星が見えるかどうかを決める3つ(太陽、空そのものの明るさ、大気)を加えます。純粋な計算でDOMも時計も読まず(時刻は渡します)、独立したimportなので、使わないページが余計なものを読みこむことはありません。[デモのTonightページ](https://johnmorrisdotca.github.io/hoshi-stars/tonight.html?lang=ja)は、この呼び出しに場所の選択をつけたものです。

```js
import { visibleStars } from "@johnmorrisdotca/hoshi-stars/tonight";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const night = visibleStars({ observer: vancouver, when: new Date("2026-11-08T10:00:00Z"), sky: { limit: "suburb" } });
console.log(`${night.twilight}, limit ${night.limitingMagnitude}: ${night.stars.length} stars, the brightest ${night.stars[0].star.name}`);

const noon = visibleStars({ observer: vancouver, when: new Date("2026-11-08T20:00:00Z") });
console.log(`${noon.twilight}: ${noon.stars.length} stars`);

const polaris = night.stars.find((one) => one.star.name === "Polaris");
console.log(`Polaris ${polaris.altitude.toFixed(0)} degrees up, ${polaris.ease}`);
```

出力は次のとおりです。

```text
night, limit 5: 543 stars, the brightest Sirius
day: 0 stars
Polaris 50 degrees up, easy
```

## 呼び出しが決めること

次のすべてを満たす星がリストに入ります。

1. **地平線の上にあること**(`sky.minAltitude`、既定は0度)。
2. **空が十分に暗いこと。** 太陽の高度から薄明が決まります。`day`(昼)、`civil`(市民薄明、-6度まで)、`nautical`(航海薄明、-12度)、`astronomical`(天文薄明、-18度)、`night`(夜)。それぞれで見える最も暗い等級は、こちらで決めたおおまかな線です(昼は約-5、市民薄明の終わりで1.5、航海薄明の終わりで4.5、-15度ごろに場所そのものの限界)。測定値ではありません。
3. **場所の限界。** `sky.limit` は `"city"`(4)、`"suburb"`(5)、`"rural"`(6、既定)、`"dark"`(6.5)、または数値で、天頂で見える最も暗い星の等級です(ボートル・スケールにならいます)。`sky.moonPenalty` は、月の明るさとして渡した等級ぶんだけ限界を下げます。
4. **大気。** 大気路程はカステンとヤングの式(1989年)で、天頂で1、高度30度で2、地平線で約38です。星は `0.2 x (大気路程 - 1)` 等級ぶん暗くなります(`sky.extinction`。空気の澄んだ低い場所で0.2、もやでは0.3〜0.4。天頂での1の分は、場所の限界にすでに含まれています)。高度3度の星は、頭上にあるときより約3等級暗くなります。

`stars`(明るい順)の各星は、`altitude`、`azimuth`(北から東まわり)、`airmass`、`apparentMagnitude`、そして `ease` をもちます。`"easy"`(限界より1等級以上明るい)、`"needs dark adaptation"`(限界から1等級以内。明かりなしで20分ほど目をならします)、`sky.all: true` のときは `"not tonight"` も入ります。

部品も公開しています。`sunPosition(when)`、`sunAltitude(observer, when)`、`twilightOf(altitude)`、`airmass(altitude)`、`SKY_LIMITS` です。太陽は天文年鑑の低精度の式で、1950〜2050年に0.01度の精度です。

## 確かめた例

北極星は北半球の中緯度ではどの夜も見え、南の遠くからは見えません(赤道では地平線上にあり、大気で消えます)。シリウスは北緯73度より北では昇らず、昼間はどの緯度でもリストに入りません。どちらもパッケージのテストにあります。

## 限界

限界はおおまかな近似で、「オリオン座は見えるか」には向きますが、ぎりぎりの暗い星には向きません。月は計算しないので、`moonPenalty` を渡してください。カタログは6.0等までなので、暗い場所でもリストにある星より多くは見えません([暗い星](faint-stars.md)はもっと深くまで届きます)。惑星はリストに入りません。
