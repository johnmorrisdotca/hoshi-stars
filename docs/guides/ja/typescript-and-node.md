---
title: TypeScriptとNode
section: how-to
order: 13
description: パッケージが持つ型、存在しない図法や見つからない星がどう防がれるか、サーバーで空を描く方法です。
---

[English](../typescript-and-node.md)

どのエントリーポイントにも、専用の`.d.ts`が付いています。`@types`は要りません。型は厳密で、`Projection`は文字列ではなく、7つの名前です。

```ts
import { starByName, starDistanceLightYears, type Star } from "@johnmorrisdotca/hoshi-stars";
import { constellation, type Constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf, type Figure } from "@johnmorrisdotca/hoshi-stars/lines";
import { PROJECTIONS, project, type Projection } from "@johnmorrisdotca/hoshi-stars/projection";

const sirius: Star = starByName("Sirius")!;
const dog: Constellation = constellation("CMa")!;
const figure: Figure = figureOf(dog.abbreviation);
const kind: Projection = "mollweide";
const at = project(kind, sirius, { centre: { rightAscension: 90, declination: 0 }, scale: 100 });
console.log(sirius.name, Math.round(starDistanceLightYears(sirius) ?? 0), figure.segments.length > 0, at !== undefined, PROJECTIONS.length);

export function refused(): void {
  // @ts-expect-error "square" is not a projection
  project("square", sirius, { centre: { rightAscension: 0, declination: 0 } });
}
```

`@ts-expect-error`の行は、存在しない図法をコンパイラーが断ることの確認です。名前で探す関数（`starByName`、`constellation`）は`T | undefined`を返すので、見つからないときの扱いはあなたが決めます。上の`!`は「シリウスは必ずある」という意味です。

## サーバーで

すべて純粋で、DOMも時計もネットワークも使いません。Node 22以降なら、スクリプトで空をファイルに描いたり、位置を計算したりできます。

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

// A server draws the same SVG a browser does: pure, no DOM, no clock. Here the whole sky as an oval, to a file.
const view = { centre: { rightAscension: 180, declination: 0 }, scale: 180 };
const place = (star) => {
  const at = project("hammer", star, view);
  return at && { x: 600 + at.x, y: 320 - at.y };
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" role="img" aria-label="The sky"><rect width="1200" height="640" fill="#0b1020"/>`;
for (const star of stars({ magnitude: 5 })) {
  const at = place(star);
  if (at) svg += `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${Math.max(0.8, 3.6 - star.magnitude * 0.6).toFixed(1)}" fill="${starColour(star)}"/>`;
}
writeFileSync(join(tmpdir(), "hoshi-sky.svg"), svg + "</svg>");
console.log("hoshi-sky.svg", figureOf("UMa").segments.length, "lines in the Great Bear");
```

これは、5等までの星を、全天のハンマー図に描いたものです。ブラウザーで開くか、好きなSVGのツールでPNGにしてください。

## Node 22と`require`

パッケージはESモジュールです。`require("@johnmorrisdotca/hoshi-stars")`は、トップレベルawaitのないESモジュールをrequireできるNode 22.12以降で動きます。それより古いNodeでは`import()`を使ってください。
