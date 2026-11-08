---
title: 星図
section: how-to
order: 5
description: 7種類の図法で、星、星座の線、境界を平らな図に置き、図の上の点を空の位置に戻す方法です。
---

[English](../sky-charts.md)

パッケージが返すのは星図の数値と計算で、描くのはあなたです（SVG、キャンバス、印刷など）。[デモ](https://johnmorrisdotca.github.io/hoshi-stars/)がその一例で、ソースはリポジトリの`demo/chart.ts`です。

## 7種類の図法

`/projection`には、`stereographic`、`orthographic`、`gnomonic`、`equidistant`、`equirectangular`、`mollweide`、`hammer`があります。`project(kind, point, { centre, scale })`は空の点の図上の位置を返し、`unproject`はその逆です。

```js
import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";

const options = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const betelgeuse = { rightAscension: 88.79, declination: 7.41 };
const at = project("stereographic", betelgeuse, options);
console.log(at.x < 0, at.y > 0);
console.log(unproject("stereographic", at, options).declination.toFixed(2));
// true true
// 7.41
```

星図は、空を見上げた姿です。北が上で、東が左なので、赤経が大きいほど`x`は小さくなります。`y`は図の上向きなので、画面に描くときは上下を逆にします（`200 - at.y`）。見えない側の点は`undefined`になります。`orthographic`と`gnomonic`の裏側の半球と、`stereographic`の対蹠点です。`mirror: true`にすると、東が右の地図の向きになり、`rotation`で図を回せます。

## SVGの星図

```js
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const place = (star) => {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Orion"><rect width="400" height="400" fill="#0b1020"/>`;
for (const [a, b] of figureOf("Ori").segments) {
  const from = place(a);
  const to = place(b);
  if (from && to) svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#6f93e0"/>`;
}
for (const star of stars({ magnitude: 4 })) {
  const at = place(star);
  if (at) svg += `<circle cx="${at.x}" cy="${at.y}" r="${Math.max(1, 4.2 - star.magnitude * 0.7)}" fill="${starColour(star)}"/>`;
}
console.log((svg + "</svg>").length > 1000);
// true
```

これで全部です。[HTMLとCDN](html-and-cdn.md)、[バンドラー](bundlers.md)、[フレームワーク](frameworks.md)が、同じ絵をページに入れます。

## 決めておくこと

- **広い星図。** `equirectangular`、`mollweide`、`hammer`の星図には、赤経が折り返す継ぎ目があります。反対側の2つの星を結ぶ線は、図全体を横切ってしまいます。両端が図の半分より離れた線は描かないでください。
- **拡大と縮尺。** `scale`は、空の半径をあなたの単位で表したものです。指の下の空が動くドラッグにするには、`unproject`でポインターの位置の空を聞き、新しい位置との差を使います（デモはそうしています）。
- **どの星を描くか。** `stars({ magnitude })`で、いちばん暗い星を決めます。図が小さいときは少なく、拡大したら多く描きます。デモのスライダーは2〜6です。
- **今夜の空。** `/sky`は、場所と時刻から高度と方位を返します（屈折の補正も選べます）。頭上の空の星図には`horizontal`、ほかの惑星には`horizontalFrom`を使います。
- **タップした星座。** タップを`unproject`して、`constellationAt`に聞きます。
