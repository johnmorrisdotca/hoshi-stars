---
title: 素のHTMLとCDN
section: how-to
order: 10
description: ビルドなしで、jsDelivrやunpkgから星図を描き、小さなimport1つで星の情報を表示する方法です。
---

[English](../html-and-cdn.md)

バンドラーがないページでも、CDNからパッケージのESモジュールをそのままimportできます。jsDelivrもunpkgも、npmパッケージのファイルをそのまま配信するので、下のアドレスはどれもパッケージの`dist`フォルダーのファイルです。

## jsDelivrから星図

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orion from jsDelivr</title>
  </head>
  <body>
    <div id="sky"></div>
    <script type="module">
      import { starColour, stars } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { figureOf } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/lines.js";
      import { project } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/projection.js";

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
      document.querySelector("#sky").innerHTML = svg + "</svg>";
    </script>
  </body>
</html>
```

部品ごとに別のファイルなので、このページが読み込むのは、明るい星、星座の線、図法だけです。境界やメシエ天体は読み込みません。何を描くかはあなたのコードが決めます。パッケージはページも時計も読みません。

## unpkgから星の情報

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star's facts from unpkg</title>
  </head>
  <body>
    <p id="facts"></p>
    <script type="module">
      import { starByName, starColour, starDistanceLightYears } from "https://unpkg.com/@johnmorrisdotca/hoshi-stars/dist/index.js";

      const sirius = starByName("Sirius");
      document.querySelector("#facts").textContent = `${sirius.name}: magnitude ${sirius.magnitude}, ${starDistanceLightYears(sirius).toFixed(1)} light-years, colour ${starColour(sirius)}`;
    </script>
  </body>
</html>
```

`dist/index.js`だけをimportすれば、ほかの部品はページに届きません。大きいのは明るい星の表で、圧縮して約100 kBです。あとのリリースでページが変わってほしくないときは、アドレスにバージョンを入れます（`.../hoshi-stars@0.1.0/dist/index.js`）。

## ほかの部品

ファイルは`dist/constellations.js`、`dist/lines.js`、`dist/boundaries.js`、`dist/deep-sky.js`、`dist/deep-sky-ngc-ic.js`、`dist/projection.js`、`dist/sky.js`です。ファイルがほかのファイルをimportすることもあり（星座の線は星が必要です）、CDNはそれも配信します。
