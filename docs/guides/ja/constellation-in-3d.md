---
title: 立体の星座
section: how-to
order: 9
description: 星座の星を視差から空間に置き、誤差の範囲といっしょに横から描いたり、デモの回せる立体表示を埋め込んだりします。
---

[English](../constellation-in-3d.md)

地球から見る星座は平らな模様です。でも星はそれぞれちがう距離にあり、視差のある星はどれも距離がわかります。`@johnmorrisdotca/hoshi-stars/constellation-3d` は星座の図の星を空間に置き、視差の誤差が許す範囲をつけて返します。これで、図を横から描いたり、回したり、どの距離がどれくらいたしかかを読者に伝えたりできます。デモの `constellation-3d.html` はWebGLでそれを行い、埋め込みページ `embed-3d.html` は同じ回せる表示をページに入れます。

## 距離のたしかさ

距離は、イェール大学の三角視差カタログ（地上からの測定）の視差によるもので、誤差が視差と同じくらい大きい星が多くあります。そこで星ごとに「たしかさ」をつけています。`good`（誤差が視差の5%未満）、`fair`（5〜20%）、`rough`（20%より大きい、または誤差が書かれていない視差）、`none`（視差がないので距離もない）です。

- **視差のない星**は、推測した距離に置きません。`position` はなく、地球からの視線（`sight`）だけがあり、デモは「距離は不明」と書いた点線の視線として描きます。オリオンの三つ星の真ん中、アルニラムがそうです。
- **誤差の棒が距離より長い星**（`wide`: 誤差が視差の41%を超える、または視差に届く）も、一つの点には置きません。ありうる範囲のどこにあってもおかしくないので、デモは中央に点を置かない薄い筋として描きます。誤差が視差に届くときは、遠いほうの端が `Infinity` で、近いほうの端より遠ければどこでもありえます。
- 明るい星の多くは、上の二つ目のグループです。88星座の図の星593個のうち、距離が「よい」ものは25個、「まずまず」が108個、「あらい」ものが370個、距離のないものが90個です。いま空間で意味のある形になる星座は、おおぐま座、ケフェウス座、くじら座、おとめ座、おひつじ座などに限られます。`distanceQualityTable()` が全部の一覧を返します。

## 数値

```js
import { constellationIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";

// Orion in space: every star of the figure with the range its parallax error allows. A star with no parallax has no distance and no place; it is never given a guess.
const orion = constellationIn3D("Ori");
for (const { star, lightYears, range, quality } of orion.stars) {
  const far = range === undefined ? "" : Number.isFinite(range[1]) ? `, between ${Math.round(range[0])} and ${Math.round(range[1])}` : `, at least ${Math.round(range[0])}`;
  console.log(`${star.name} (${quality}): ${lightYears === undefined ? "distance unknown" : `${Math.round(lightYears)} ly${far}`}`);
}
console.log(orion.counts);
```

`constellationIn3D(abbreviation)` は図の星と線（`segments`: `stars` の番号の組）を返します。星ごとに `position`（J2000の赤道座標の軸に沿った光年: xは赤経0時のほう、yは赤経6時のほう、zは天の北極のほう。見る場所が原点）、`nearPosition` と `farPosition`（範囲の両端）、`lightYears` と `range`（見る場所から）、`sight`（星がのっている地球からの視線）、`quality`、`relativeError`、`wide` があります。`frame` は図の中心の向きと、それに直角な北の向きです。`centre` の向きに `up` を上にして見ると、星図と同じく東が左になります。地球から見ると、どの星も距離に関係なく星図の位置にあります。デモの最初の画面が星図と同じなのはそのためです。

`{ from }` を渡すと、見る場所がほかの星（名前、星、または `skyFrom` と同じ、パーセク単位の点 `{ x, y, z }`）に移ります。`constellationIn3D("Ori", { from: "Rigil Kentaurus" })` はケンタウルス座α星から見たオリオン座で、地球は `viewpoint.earth` にあります。視差のない星は、その場所から見た位置には置けませんが、地球からの視線は空間の線として残ります。

## 横から見たSVG

WebGLのないページでも、同じ数値で図を横から描けます。左が地球、右が遠いほうで、空の広がりは縦に取り、各範囲は棒で示します。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Great Bear from the side</title>
  </head>
  <body>
    <div id="space"></div>
    <script type="module">
      import { starColour } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { constellationIn3D } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/constellation-3d.js";

      // The Earth on the left, distance to the right (light-years), the sky sideways. A bar is the range the parallax error allows.
      const figure = constellationIn3D("UMa");
      const { centre, up } = figure.frame;
      const side = [centre[1] * up[2] - centre[2] * up[1], centre[2] * up[0] - centre[0] * up[2], centre[0] * up[1] - centre[1] * up[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const placed = figure.stars.filter((star) => star.position);
      const reach = Math.max(...placed.map((star) => dot(star.farPosition ?? star.position, centre)));
      const k = 360 / reach;
      const x = (p) => 20 + dot(p, centre) * k;
      const y = (p) => 100 - dot(p, side) * k;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="The Great Bear from the side"><rect width="400" height="200" fill="#0b1020"/>`;
      for (const [a, b] of figure.segments) {
        const from = figure.stars[a].position;
        const to = figure.stars[b].position;
        if (from && to) svg += `<line x1="${x(from)}" y1="${y(from)}" x2="${x(to)}" y2="${y(to)}" stroke="#6f93e0"/>`;
      }
      for (const star of placed) {
        if (star.nearPosition && star.farPosition) svg += `<line x1="${x(star.nearPosition)}" y1="${y(star.nearPosition)}" x2="${x(star.farPosition)}" y2="${y(star.farPosition)}" stroke="${starColour(star.star)}" stroke-opacity=".6"/>`;
        svg += `<circle cx="${x(star.position)}" cy="${y(star.position)}" r="${Math.max(1.5, 4.5 - star.star.magnitude)}" fill="${starColour(star.star)}"/>`;
      }
      document.querySelector("#space").innerHTML = svg + "</svg>";
    </script>
  </body>
</html>
```

## iframeで立体表示

デモの埋め込みページは、kazoku-uiの共有レンダラー（WebGLコンテキストは一つ、動くときだけ描く、1秒に30コマまで）で図を描き、ファミリー共通の操作に対応します。ドラッグで回し、ピンチやCtrlとホイールで拡大縮小し、ボタンで「90°回す」「地球から」「拡大縮小」ができます。アドレスで何を描くかを指定します。`c`（星座。省くと `Ori`）、`from`（`HR5459` はケンタウルス座α星）、`yaw` と `tilt`（度）、`lang`（`ja`）、`theme`（`light` か `dark`）です。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars in 3D in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed-3d.html?c=UMa&yaw=-90"
      title="The Great Bear in 3D, turned to the side"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

デモのページには、これらの方法それぞれのコードパネルがあり、選んだ星座、見る場所、回した角度が入った状態で表示されます。
