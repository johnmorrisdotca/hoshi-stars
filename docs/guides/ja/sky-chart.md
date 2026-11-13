---
title: 自分のページに星図を置く
section: how-to
order: 13
description: "デモの星図を自分のページに置く方法です。ファミリー共通の操作で動かせる<hoshi-chart>要素と、サーバー、ビルド、印刷向けにSVGの文字列を返すchartSvgがあります。属性、イベント、サイズ、フレームワークでの使い方を説明します。"
---

[English](../sky-chart.md)

デモの星図を公開しました。明るい星（イェール輝星カタログの5,080個）を7つの図法のどれでも描き、天の川、星座線、名前、星座の境界、銀河・星団・星雲、ブラックホール、座標の線を重ねられます。英語でも日本語でも、西洋、日本、中国のどの空でも描けます。使い方は2つあります。

- `<hoshi-chart>`（`@johnmorrisdotca/hoshi-stars/chart/element`、定義は`/chart/define`）：箱いっぱいに描く要素です。手で動かしたり拡大・縮小したりでき、タップしたものを知らせます。
- `chartSvg`（`@johnmorrisdotca/hoshi-stars/chart`）：同じ星図をSVGの文字列で返します。DOMも時計も使わないので、サーバー、ビルド、印刷、スクリプト要素を使わないページに向いています。

## 要素

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart constellation="Ori" layers="milky lines names boundaries" style="max-width: 640px"></hoshi-chart>
    <p id="picked">Tap a star.</p>
    <script type="module">
      document.querySelector("hoshi-chart").addEventListener("hoshi-pick", (event) => {
        const { kind, id } = event.detail;
        document.getElementById("picked").textContent = kind === "none" ? "Nothing there." : `${kind} ${id}`;
      });
    </script>
  </body>
</html>
```

ドラッグで空が動き、2本指のピンチ、またはCtrl（MacではCommand）キーを押しながらホイールで、ポインターを中心に拡大・縮小します。矢印キーで見回し、`+`と`-`で拡大・縮小、Homeか`0`で最初の表示に戻ります。星、銀河・星団・星雲、ブラックホール、星座などの図をタップすると`hoshi-pick`が送られ、タップしたものに印が付きます。要素は何かが変わったときだけ描くので、止まっているあいだはブラウザーに何も求めません。

| 属性 | 意味 |
|---|---|
| `projection` | `stereographic`（既定）、`orthographic`、`gnomonic`、`equidistant`、`equirectangular`、`mollweide`、`hammer`。 |
| `ra`、`dec` | 星図の中心の赤経と赤緯（度）。既定は84と0で、オリオン座です。 |
| `zoom` | 星図独自の拡大率で、ファミリー共通の「1が全体表示（Fit）」とは違います。1は、その図法で空全体（または半球）が短いほうの辺に収まる大きさで、数が大きいほど近づきます。指定がないときは、要素の大きさに応じた、その図法の最初の拡大率になります。空のおよそ90度が横に入る大きさで（幅600ピクセル未満では60度）、640×400のstereographicなら3.86です。Homeと`0`でここに戻ります。 |
| `zoom-min`、`zoom-max` | 同じ単位での拡大率の下限と上限で、0.1から500です。`zoom-max`は8000まで上げられます。8000は銀河・星団・星雲の写真に必要な範囲です（写真は今後の版で入ります）。 |
| `magnitude` | 最初の拡大率で描くいちばん暗い星の等級（5）。望遠鏡と同じように、拡大するともっと暗い星も見えます。 |
| `layers` | `milky lines boundaries names deep holes ecliptic grid`のどれを描くかを、空白で区切って書きます。既定は`milky lines names grid`で、何も書かないと星だけになります。 |
| `constellation` | 明るく表示する図（星座や星の並び）。88星座のどれかなら、その境界も描きます。`Ori`のように書き、日本と中国の空では図のidを書きます。タップのあとに設定すると、ふたたびこちらが優先されます。 |
| `culture` | `western`（既定）、`japanese`、`chinese`。日本と中国の星座は、必要になったときだけ読み込みます。 |
| `picked` | 選んだ印を付ける星（HR番号。シリウスは`2491`）かメシエ天体（`M42`）。タップのあとに設定すると、ふたたびこちらが優先されます。 |
| `lang` | `en`か`ja`。指定がないときは、要素の祖先でいちばん近い`lang`属性に従い、それが変わると追従します。 |
| `theme` | `light`か`dark`で、フォーカスの枠の色を決めます。空はどちらでも夜の色です。 |
| `show-uncertainty` | グレードCの星（距離が粗いか不明。[星の値の確かさ](accuracy.md)を見てください）を暗く描き、確かな星が目立つようにします。既定はオフで、プロパティは`showUncertainty`です。変わるのは星の描き方だけで、静止しているときは何も描きません。 |
| `controls="none"` | 手で動かせない、止まった絵になります。 |
| `bodies` | ページが位置を求めた惑星、月などの天体です。等級に応じて描かれ、月は満ち欠けの形で描かれます（[惑星と月を星図に置く](sky-chart-bodies.md)を見てください）。`ecliptic`の層は太陽の年間の通り道を描きます。 |
| `markers`、`time-from`、`time-to`、`time-fade`、`tracks` | 自分の日付つきの点、表示する日、グループをつなぐ線です（[自分の点を星図に置く](sky-chart-markers.md)を見てください）。 |

| イベント | `detail` |
|---|---|
| `hoshi-pick` | `ChartPick`：`{ kind, id, abbreviation? }`。`kind`は`star`（HR番号。`accuracy`も付き、`{ grade, lightYearsRange, positionResolutionArcsec }`、つまり星のグレードA・B・C、距離の範囲（光年。範囲がなければ`null`）、位置の最後の桁の大きさ（秒角）を持ちます）、`deep`（`M42`）、`hole`（`cygnus-x-1`）、`figure`（図のid。88星座なら`abbreviation`も付きます）、`body`（`bodies`のひとつ。その`id`と`names`が付きます）、`none`のどれかです。 |
| `hoshi-view` | `ChartViewDetail`：`{ projection, ra, dec, zoom, final }`。表示が変わるたびに送られ、手が止まると`final`がtrueになります。 |
| `hoshi-marker` | `ChartMarkerDetail`：`{ marker, id, index, source }`。自分の点（`markers`）をクリック、タップしたとき、またはEnterかSpaceで選んだときに送られます。 |

`element.setView({ ra, dec, zoom })`でコードから動かせ、`element.view`で今の表示がわかります。どちらも型は`View`です。クラスは`HoshiChartElement`、タグは`CHART_TAG`です。`defineChart(registry?)`は一度だけ定義するので、ページが2回読み込んでも、パッケージが2つあっても、例外は起きません。

**手で動かす部分はkazoku-uiです。** ファミリー共通の表示コントローラー（`@johnmorrisdotca/kazoku-ui`）で、このパッケージの唯一の依存関係です。npmでこのパッケージと一緒にインストールされ、jsDelivrの`/+esm`でも自動で読み込まれます。kazoku-uiを読み込むのは`/chart/element`と`/chart/define`だけで、`chartSvg`をはじめ、ほかのエントリーはどれも読み込みません。

## 星の確かさ

星をタップすると、その星がどれだけ確かかが分かります。`hoshi-pick`の`detail`の`accuracy`に、グレード、距離が最も近い場合と最も遠い場合（視差の標準誤差を前後に1つずつ取った値。誤差が視差と同じ大きさなら、遠い側は`Infinity`です）、位置の分解能が入っています。グレードは`/accuracy`のものです（[星の値の確かさ](accuracy.md)を見てください）。`show-uncertainty`属性（`chartSvg`では`showUncertainty`）を付けると、グレードCの星を45%の濃さ（`UNCERTAIN_OPACITY`）で描き、それぞれに`data-uncertain="C"`を付けます。グレードAとBはこれまでどおりです。同じ部品の`pickAccuracy(star)`と`dimsForUncertainty(star)`は純粋な関数で、`/chart`から使えます。

```js
import { writeFileSync } from "node:fs";
import { chartSvg, pickAccuracy } from "@johnmorrisdotca/hoshi-stars/chart";
import { starByName } from "@johnmorrisdotca/hoshi-stars";

// Orion with the stars of grade C (a rough or missing distance) drawn dimmer.
const svg = chartSvg({ width: 640, height: 400, constellation: "Ori", showUncertainty: true });
writeFileSync(new URL("orion-uncertain.svg", import.meta.url), svg);

// What a pick says of Betelgeuse: its grade, the distance range in light-years and the position resolution in arc-seconds.
const { grade, lightYearsRange, positionResolutionArcsec } = pickAccuracy(starByName("Betelgeuse"));
console.log("orion-uncertain.svg", svg.includes('data-uncertain="C"'), grade, lightYearsRange.map(Math.round).join("-"), Math.round(positionResolutionArcsec * 10) / 10);
// orion-uncertain.svg true B 480-640 1.5
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>How well is the star known?</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart ra="88.79" dec="7.41" zoom="12" show-uncertainty style="width: 640px; height: 400px"></hoshi-chart>
    <p id="card">Tap a star.</p>
    <script type="module">
      document.querySelector("hoshi-chart").addEventListener("hoshi-pick", (event) => {
        const { kind, id, accuracy } = event.detail;
        if (kind !== "star") return;
        const [low, high] = accuracy.lightYearsRange ?? [];
        const range = low === undefined ? "no stated range" : `${Math.round(low)} to ${Math.round(high)} light-years`;
        document.getElementById("card").textContent = `HR ${id}: grade ${accuracy.grade}, ${range}, position to ${accuracy.positionResolutionArcsec} arc-seconds`;
      });
    </script>
  </body>
</html>
```

## SVGの文字列として

```js
import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

const svg = chartSvg({ width: 800, height: 500, ra: 56.9, dec: 24.1, zoom: 8, culture: japanese, lang: "ja", constellation: "subaru" });
writeFileSync(new URL("subaru.svg", import.meta.url), svg);
console.log("subaru.svg", svg.length > 10000, svg.includes('aria-label="星図"'));
// subaru.svg true true
```

`chartSvg(options)`には、`width`と`height`のほか、要素の属性と同じ`projection`、`ra`、`dec`、`zoom`、`magnitude`、`layers`（`CHART_LAYERS`の値の配列）、`lang`、`culture`、`constellation`、`picked`、`showUncertainty`、`bodies`（惑星と月です。[惑星と月を星図に置く](sky-chart-bodies.md)を見てください）、`markers`、`timeRange`、`tracks`（自分の点です。[自分の点を星図に置く](sky-chart-markers.md)を見てください）、`label`（読み上げられる名前で、既定は「Star chart」か「星図」）を渡せます。`culture`には文化そのものを、`@johnmorrisdotca/hoshi-stars/cultures/japanese`か`/chinese`から読み込んで渡すので、ページは描く文化の分だけ読み込みます。返すのは、大きさどおりの`viewBox`と夜の背景を持つ`<svg>`です。時計を読まず、何も取りに行きません。

名前の置き場所は、文字の幅で決めます。documentがあればcanvasで測り、なければ組み込みの表で測るので、ブラウザーとサーバーでは名前の位置が1、2ピクセルずれることがあります。どこでも同じSVGにしたいときは、`measure: (text, font) => width`（フォントの寸法や、1文字あたりの決まった幅）を渡してください。型は`ChartSvgOptions`と`ChartLayer`です。

## バンドラーとフレームワークで

要素はふつうのDOMです。`/chart/define`を一度読み込めば、`<hoshi-chart>`をほかの要素と同じように書けます。

Vite（ほかのバンドラーでも同じ）で、ページに`<hoshi-chart>`を置く場合：

```ts no-run
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  document.getElementById("picked")!.textContent = `${kind} ${id ?? ""}`;
});
```

React：

```tsx
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { createElement, useEffect, useRef, useState } from "react";

export function SkyChart() {
  const chart = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState("Tap a star.");
  useEffect(() => {
    const element = chart.current!;
    const onPick = (event: Event) => {
      const { kind, id } = (event as CustomEvent<ChartPick>).detail;
      setPicked(`${kind} ${id ?? ""}`);
    };
    element.addEventListener("hoshi-pick", onPick);
    return () => element.removeEventListener("hoshi-pick", onPick);
  }, []);
  return (
    <>
      {createElement("hoshi-chart", { ref: chart, constellation: "Cyg", layers: "milky lines names" })}
      <p>{picked}</p>
    </>
  );
}
```

Vue。Vueがタグをブラウザーに任せるよう、プラグインの設定に`isCustomElement`を入れます（`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("hoshi-") } } })`）：

```vue
<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { ref } from "vue";

const picked = ref("Tap a star.");
const onPick = (event: Event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  picked.value = `${kind} ${id ?? ""}`;
};
</script>

<template>
  <hoshi-chart constellation="Lyr" layers="milky lines names" @hoshi-pick="onPick"></hoshi-chart>
  <p>{{ picked }}</p>
</template>
```

Svelte：

```svelte
<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart/define";
  import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

  let picked = $state("Tap a star.");
  const onPick = (event: Event) => {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    picked = `${kind} ${id ?? ""}`;
  };
</script>

<hoshi-chart constellation="Sco" layers="milky lines names" onhoshi-pick={onPick}></hoshi-chart>
<p>{picked}</p>
```

Angular。`CUSTOM_ELEMENTS_SCHEMA`を使います：

```ts no-run
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";

@Component({
  selector: "app-sky-chart",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart constellation="Cas" layers="milky lines names" (hoshi-pick)="onPick($event)"></hoshi-chart><p>{{ picked() }}</p>`,
})
export class SkyChartComponent {
  readonly picked = signal("Tap a star.");
  onPick(event: Event): void {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    this.picked.set(`${kind} ${id ?? ""}`);
  }
}
```

## サイズ

| エントリー | 圧縮後（minifyとgzip） |
|---|---|
| `@johnmorrisdotca/hoshi-stars/chart` | 198.0 kB |
| `@johnmorrisdotca/hoshi-stars/chart/element` | 217.6 kB |
| `@johnmorrisdotca/hoshi-stars/chart/define` | 217.7 kB |

ほとんどは明るい星のカタログ（パッケージのメインのエントリーは126.0 kB）と、各レイヤーが描く星座の境界、星座線、天の川、ブラックホールです。NGCとICの天体、近くの星、暗い星は含みません。日本と中国の星座は、星図が必要としたときだけ読み込みます（それぞれ約8 kB）。数値は`docs/bundle-size.json`の測り方によります。
