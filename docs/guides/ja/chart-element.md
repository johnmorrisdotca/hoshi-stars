---
title: チャート要素
section: how-to
order: 9
description: <hoshi-chart> タグ1つで、描画も拡大も回転もする星図をページに置きます。要素なしで同じ星図をSVG文字列として得る方法、CDN、Vite、React、Vue、Svelte、Angular、Nodeでの使い方もあります。
---

[English](../chart-element.md)

`@johnmorrisdotca/hoshi-stars/chart`は、デモの星図をそのままimportできるようにしたものです。2つの部品があります。`<hoshi-chart>`要素は、属性に書かれたとおりに描き、ドラッグ、ピンチ、ホイール、キー操作も自分で受け持ちます。`chartSvg`は、要素を動かさないページ（サーバー、印刷、メールなど）のために、同じ星図をSVGの文字列で返す関数です。デモと[埋め込みページ](embed-in-an-iframe.md)も、この要素でできています。

## ページにタグを置く

ビルドのないページには、モジュールと、操作のもとになるパッケージ（kazoku-ui）1つのためのimport mapが必要です。あとはタグを置くだけです。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart from jsDelivr</title>
    <script type="importmap">
      { "imports": { "@johnmorrisdotca/kazoku-ui/view-controls": "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/kazoku-ui/dist/view-controls/index.js" } }
    </script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/chart.js"></script>
  </head>
  <body>
    <hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" style="width: 100%; max-width: 640px"></hoshi-chart>
  </body>
</html>
```

要素の幅はページが決めた幅で、高さを決めなければ4対3になります。子要素は星図の上に重なるので、自分のボタンを隅に置けます（`keepClear`で名前がボタンに重ならないようにできます）。

## 属性

| 属性 | |
|---|---|
| `projection` | `stereographic`（既定）、`orthographic`、`gnomonic`、`equidistant`、`equirectangular`、`mollweide`、`hammer`。 |
| `ra`, `dec` | 中心の位置（度）。赤経は0から360（既定84）、赤緯は-90から90（既定0）で、オリオン座のあたりです。 |
| `zoom` | 0.1から500。1で、全天（または半球）が短い辺におさまります。省略すると、デスクトップで約90度、スマホで約60度の幅でオリオン座を開く表示になり、サイズが変わってもその表示を保ちます。 |
| `magnitude` | 描く一番暗い星の等級。2から6（既定5）。 |
| `layers` | `milky-way`、`lines`、`names`、`boundaries`、`deep-sky`（メシエ天体）、`grid`をカンマで並べたもの、または`none`。省略すると`milky-way,lines,names,grid`。 |
| `constellation` | 明るく描く星座1つ（`Ori`）。境界線もいっしょに描きます。 |
| `lang` | `en`または`ja`。星座と星の名前の言語。省略するとページの`lang`に従います。 |
| `theme` | `dark`（夜空、既定）または`light`（紙にインクのような見た目）。 |
| `near`, `by` | `near`は、星（`S:2491`、ブライトスター星表の番号）、メシエ天体（`D:M31`）、星座（`C:Ori`）のどれか。それを選んだ状態にして、近くにあるものを丸で囲みます。`by="space"`にすると、星の近さを空の上の角度ではなく光年で測ります。 |
| `controls` | `none`にすると操作をはずし、星図は絵になります。 |
| `hover` | マウスが重なっている星座を、`hoshi-hover`でページに知らせます。 |

属性は表示を決めます。ドラッグしたあとの表示は`chart.view`（`{ projection, ra, dec, zoom }`）と`hoshi-viewchange`イベントで分かります。`chart.view`に値を入れると星図が動きますが、イベントは出ません。`chart.zoomBy(1.6)`と`chart.reset()`はページ自身のボタン用、`chart.size`は描画のピクセル数、`chart.hits`はタップできるものの一覧（型は`Hit`）です。イベントは、`hoshi-viewchange`（`detail.view`と`detail.final`、型は`ViewChangeDetail`）、`hoshi-pick`（タップ。`detail.key`は`S:2491`、`D:M31`、`C:Ori`または`null`、型は`PickDetail`）、`hoshi-hover`、`hoshi-resize`、`hoshi-draw`です。`toScreen`と`fromScreen`は、空の点と星図のピクセルを行き来させる関数で、`defaultZoom`は開くときのズーム、`ZOOM_MIN`と`ZOOM_MAX`は限度です。表示の型は`View`です。

## 操作

ドラッグで空が回り（ズームしていれば動き）、2本の指でピンチ、移動、ひねりができ、ダブルタップで拡大と元に戻す操作ができます。開いた状態では、ホイールだけの操作はページをスクロールするので、星図がスクロールの邪魔になることはありません。Ctrl、Command、Altを押しながらのホイールはポインターのあたりを拡大し、ズームしたあとはホイールだけで空が動きます。星図にフォーカスがあるとき（`tabindex="0"`が付きます）、矢印キーで回り、+と-でズーム、0またはHomeで元に戻ります。これはkazoku-uiの`carryControls`で、ファミリーのほかの要素と同じ操作です。ボタンがほしいページは、デモのように自分で置いてください。`controls="none"`にすると操作がすべてなくなり、操作のコードも読み込まれません。

## Viteで

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart with Vite</title>
  </head>
  <body>
    <hoshi-chart id="chart" projection="hammer" ra="84" dec="0" zoom="1" layers="milky-way,lines,names" style="width: 100%; max-width: 640px"></hoshi-chart>
    <p><button id="orion" type="button">Orion</button> <button id="plain" type="button" data-testid="plain">Without the controls</button></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-check
import { chartSvg, type HoshiChart, type PickDetail } from "@johnmorrisdotca/hoshi-stars/chart";

const chart = document.querySelector<HoshiChart>("#chart")!;

chart.addEventListener("hoshi-pick", (event) => {
  console.log((event as CustomEvent<PickDetail>).detail.key);
});
document.querySelector("#orion")!.addEventListener("click", () => {
  chart.setAttribute("projection", "stereographic");
  chart.setAttribute("ra", "84");
  chart.setAttribute("dec", "0");
  chart.setAttribute("zoom", "2");
  chart.setAttribute("constellation", "Ori");
});
document.querySelector("#plain")!.addEventListener("click", () => chart.setAttribute("controls", "none"));

// The same chart as a string, for a page that runs no element.
const svg = chartSvg({ width: 320, height: 240, layers: ["lines", "names"] });
document.body.insertAdjacentHTML("beforeend", `<div data-testid="string">${svg}</div>`);
```

ページが星図を動かすには、属性を変えます。要素はひとりでに、1フレームに1回までの頻度で描き直します。

## React、Vue、Svelte、Angular

要素はふつうのカスタム要素なので、各フレームワークでは通すだけで足ります。React 19では、カスタム要素はpropsを属性として受け取ります。`createElement`なら宣言はいりません（JSXで`<hoshi-chart>`と書くには、TypeScript用に`JSX.IntrinsicElements`へタグを足します）。

```tsx
import { createElement } from "react";
import "@johnmorrisdotca/hoshi-stars/chart";

export function Chart({ constellation }: { constellation?: string }) {
  return createElement("hoshi-chart", { projection: "stereographic", ra: 84, dec: 0, layers: "milky-way,lines,names", constellation, style: { width: "100%", maxWidth: 640 } });
}
```

Vueでは、`hoshi-chart`がカスタム要素だと伝えます（`vite.config.ts`で`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "hoshi-chart" } } })`）。そのうえで次のようにします。

```vue
<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart";

defineProps<{ constellation?: string }>();
</script>

<template>
  <hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" :constellation="constellation" style="width: 100%; max-width: 640px" />
</template>
```

Svelteは何もいりません。

```svelte
<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart";

  let { constellation }: { constellation?: string } = $props();
</script>

<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" {constellation} style="width: 100%; max-width: 640px"></hoshi-chart>
```

Angularは、コンポーネントに`CUSTOM_ELEMENTS_SCHEMA`が必要です。

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import "@johnmorrisdotca/hoshi-stars/chart";

@Component({
  selector: "app-chart",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" constellation="Ori" style="width: 100%; max-width: 640px"></hoshi-chart>`,
})
export class ChartComponent {}
```

## 要素なしで、文字列として

`chartSvg(options)`は、属性と同じオプション（`projection`、`ra`、`dec`、`zoom`、`magnitude`、`layers`、`constellation`、`lang`、`theme`、`near`、`by`、`width`、`height`）を受け取り、要素が描くのと同じSVGを文字列で返します。純粋な関数なので、同じオプションなら必ず同じ文字列です。星、星座の線と名前、グリッドはそのまま使えます。`milky-way`、`boundaries`、`deep-sky`、`constellation`、`near`を使う星図は、先に`await loadChartData(options)`でそのデータを1回読み込む必要があります。読み込んでいないと、`chartSvg`は足りないものを示して例外を投げます。要素は、これを自分でします。

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chartSvg, loadChartData } from "@johnmorrisdotca/hoshi-stars/chart";

// A server draws the same chart a browser does: read the data of the layers once, then the string is pure.
const options = { width: 640, height: 480, projection: "mollweide", zoom: 1, layers: ["milky-way", "lines", "names"], lang: "ja" };
await loadChartData(options);
const svg = chartSvg(options);
writeFileSync(join(tmpdir(), "hoshi-chart.svg"), svg);
console.log("hoshi-chart.svg", svg.includes("オリオン座"));
```

## かかるサイズ

ページが払うのは、描く層の分だけです。星図のentry自体は、明るい星のテーブル、星座の名前と線、描画のコードで、gzipで**127 kB**です（星が114 kB、描画が13 kB）。操作はさらに6 kBで、操作がオンのときだけ読み込まれます。各層は別のファイルで、星図が最初に必要としたときに読み込まれます。

| 層 | 増える分（gzip） |
|---|---|
| `milky-way` | 8 kB |
| `boundaries`（と`constellation`） | 8 kB |
| `deep-sky`（メシエ天体） | 4 kB |
| `near`（最も近いものの層。境界とメシエ天体のデータを共有します） | 13 kB。その2つと合わせると2 kB増 |

すべての層と操作を合わせると、160 kBです。NGC・ICの深宇宙天体のカタログと、近くの星は、星図はまったく読み込みません。
