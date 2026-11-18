---
title: 自分のページで星の間を飛ぶ
section: how-to
order: 16
description: "デモの「星の間を飛ぶ」ビューを自分のページに置く方法です。<hoshi-flight>要素のgoTo、lookAt、status、そして moving・arrived・home を知らせる hoshi-flight イベント。属性、埋め込みページ、three.js、フレームワークでの使い方を説明します。"
---

[English](../flight.md)

`<hoshi-flight>`（`@johnmorrisdotca/hoshi-stars/flight/element`、定義は`/flight/define`）は、デモの[飛ぶページ](https://johnmorrisdotca.github.io/hoshi-stars/flight.html)が使っているビューです。箱いっぱいに、カメラのいる場所から見た空を描きます。明るい星と近くの星を、はかった距離から一歩ごとに置きなおし（`skyFrom`）、太陽は遠くからは名前つきの星、近くでは球に見えます。明るい星のそばで止まると、その星も球になります。計算は`/flight`、行き先は`/flight/places`にあります（READMEの「A flight through the stars」を見てください）。

3Dはthree.jsで描きます。パッケージはthree.jsを省略できるピア依存（optional peer）にしているので、パッケージといっしょにインストールするか（`npm install three`）、CDNに持ってきてもらいます。

## 要素

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A flight through the stars from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/flight/define/+esm"></script>
  </head>
  <body>
    <hoshi-flight at="sun" sun-stop="40" style="height: 60vh"></hoshi-flight>
    <button id="vega" type="button">Fly to Vega</button>
    <button id="home" type="button">Back to the Sun</button>
    <p id="where">At the Sun.</p>
    <script type="module">
      const flight = document.querySelector("hoshi-flight");
      flight.addEventListener("hoshi-flight", (event) => {
        const { change, at } = event.detail;
        if (change === "home") document.getElementById("where").textContent = "Home at the Sun.";
        else if (change === "arrived") document.getElementById("where").textContent = `At ${at}.`;
      });
      document.getElementById("vega").addEventListener("click", () => flight.goTo("hr-7001"));
      document.getElementById("home").addEventListener("click", () => flight.goTo("sun"));
    </script>
  </body>
</html>
```

ドラッグで見回し、ピンチ、またはCtrl（MacではCommand）キーを押しながらホイールで、見える範囲をせまく・広くします。`goTo(id)`はその場所へ飛びます。まずその方を向き、ゆっくり出発し、数秒で着く速さで飛んで、そばでゆっくり止まります。動きを減らす設定の人には、一度で着きます。止まっているとき、画面の外にあるとき、タブが見えていないときは何も描かず、描くときも1秒に30回までです。ページの中の`<hoshi-flight>`は、すべて1つのWebGLコンテキストを使います。

| 属性 | 意味 |
|---|---|
| `at` | いる場所。場所のID（`sun`、ベガは`hr-7001`、プロキシマ・ケンタウリは`gctp-3278`、`M31`）か、太陽からのパーセクの点（`pc_1.5_-2_0.25`）。どの書き方でも読み（`HR-7001`）、止まるたびに1つの形で書きもどします。飛んでいるあいだの一歩ごとには書きません。あとから変えると、飛ばずにその場所へ移ります。ないときや読めないときは太陽です。 |
| `lang` | `en`か`ja`。太陽や星の名前と、スクリーンリーダーが読む言葉に使います。ないときは、上にあるいちばん近い`lang`です。 |
| `ra`、`dec` | 最初に向く方向。赤道座標（J2000）の度です。ないときは、いる場所の天体の方を向きます。点にいるときは太陽の方です。 |
| `fov` | Fitのときに見える高さ（度）。10から120で、ふつうは60です。ピンチでそこから8倍までせまくできます。 |
| `sun-stop` | 太陽の中心からどこで止まるか（天文単位）。ふつうは太陽の半径の6倍、約0.028で、太陽が球に見えます。最初はそこにいて、太陽へ帰るときもそこで止まります。太陽にいるときに変えると、新しい距離へ移ります。 |

| プロパティ・メソッド | 内容 |
|---|---|
| `goTo(id)` | IDの場所へ飛びます。そのIDの場所がないときは`false`です。 |
| `lookAt(id)` | 動かずに、その場所の方を向きます。そのIDの場所がないときは`false`です。 |
| `stepSpeed(1)`、`stepSpeed(-1)` | 速さのダイヤルを上げる・下げる。光の速さの1倍から10兆倍まで、10倍ずつです。 |
| `status` | `FlightStatus`：`at`、`place`（止まっている場所）、`target`（飛んでいく場所）、`moving`、`position`（太陽からのパーセク）、`speed`と`dial`（光の速さの何倍か）、`remaining`（止まる所までのパーセク）。 |
| `sunStop` | `sun-stop`を天文単位の数で。 |
| `live`、`stats` | 3Dで描いているあいだ`true`。点で描いた星の数、球で描いた星、レンダラーの数え。 |

## 知らせること

動くあいだと止まったときに`hoshi-flight`を送ります。イベントの`detail`は`FlightChange`で、statusと`change`を持ちます。

| `change` | いつ |
|---|---|
| `moving` | 飛ぶ・向きを変えるあいだの一歩ごと（1秒に30回まで）。 |
| `arrived` | どこかの場所で止まった。 |
| `home` | 太陽の`sun-stop`で止まった。 |
| `rest` | 止まっているときのそれ以外の変化：向きを変えおわった、ダイヤル、`at`に点を入れた。 |

開いたときは何も送りません。`status`を読んでください。場所をアドレスに残すページは、デモのように`arrived`と`home`で`at`を書きます。

惑星のビューを持つサイトは、自分のカメラがいた所から飛び始め、太陽に帰ってきたらビューを取りもどせます。太陽で止まる距離を惑星のビューのいちばん外にし、そのビューが向いていた方向で開きます。

```js no-run
import "@johnmorrisdotca/hoshi-stars/flight/define";

const flight = document.createElement("hoshi-flight");
flight.setAttribute("sun-stop", "50");
flight.setAttribute("ra", "120");
flight.setAttribute("dec", "20");
flight.setAttribute("fov", "45");
flight.addEventListener("hoshi-flight", (event) => {
  if (event.detail.change === "home") flight.remove();
});
document.body.append(flight);
flight.goTo("hr-7001");
```

## three.jsをどこから読むか

何もしなければ、要素は最初に描くときに`import("three")`を読みます。バンドラーはページにインストールした`three`を見つけ、CDNは自分で持ってきます。`/flight/element`の`setThreeLoader(load)`で、その前に別のモジュールを渡せます。飛ぶのに使う部分だけを出すモジュール（デモの`three-subset.ts`）なら、three.js全部ではなく数百キロバイトですみます。

```ts no-run
import { setThreeLoader } from "@johnmorrisdotca/hoshi-stars/flight/element";

setThreeLoader(() => import("three"));
```

## iframeで

デモの埋め込みページ`embed-flight.html`は、枠いっぱいの要素です。自分のスクリプトを動かさないページ向けです。アドレスで要素の属性（`at`、`ra`、`dec`、`fov`、`sun-stop`、`lang`）と、開いたあとに飛ぶ場所`to`を渡せます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A flight through the stars in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed-flight.html?at=sun&to=hr-7001"
      title="A flight from the Sun to Vega"
      width="640"
      height="400"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## バンドラーとフレームワークで

要素はふつうのDOMです。`/flight/define`を一度importして、ほかの要素と同じように`<hoshi-flight>`と書きます。`FLIGHT_TAG`が名前、`HoshiFlightElement`がクラスで、`defineFlight(registry)`は別のレジストリに定義します。定義を2回読んでもエラーにはなりません。

Vite（またはほかのバンドラー）。ページに`<hoshi-flight>`、ボタン、1行の文を置きます。

```ts no-run
import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";

const flight = document.querySelector<HoshiFlightElement>("hoshi-flight")!;
flight.addEventListener("hoshi-flight", (event) => {
  const { change, at } = (event as CustomEvent<FlightChange>).detail;
  if (change !== "moving") document.getElementById("where")!.textContent = at;
});
document.getElementById("go")!.addEventListener("click", () => flight.goTo("hr-7001"));
```

React：

```tsx
import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { createElement, useEffect, useRef, useState } from "react";

export function Flight() {
  const flight = useRef<HoshiFlightElement>(null);
  const [where, setWhere] = useState("sun");
  useEffect(() => {
    const element = flight.current!;
    const onChange = (event: Event) => {
      const { change, at } = (event as CustomEvent<FlightChange>).detail;
      if (change !== "moving") setWhere(at);
    };
    element.addEventListener("hoshi-flight", onChange);
    return () => element.removeEventListener("hoshi-flight", onChange);
  }, []);
  return (
    <>
      {createElement("hoshi-flight", { ref: flight, at: "sun", style: { height: "60vh" } })}
      <button type="button" onClick={() => flight.current!.goTo("hr-7001")}>
        Fly to Vega
      </button>
      <p>{where}</p>
    </>
  );
}
```

Vue。タグをブラウザーにまかせるよう、プラグインのオプションに`isCustomElement`を入れます（`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("hoshi-") } } })`）。

```vue
<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { ref } from "vue";

const flight = ref<HoshiFlightElement>();
const where = ref("sun");
const onChange = (event: Event) => {
  const { change, at } = (event as CustomEvent<FlightChange>).detail;
  if (change !== "moving") where.value = at;
};
const fly = () => flight.value?.goTo("hr-7001");
</script>

<template>
  <hoshi-flight ref="flight" at="sun" style="height: 60vh" @hoshi-flight="onChange"></hoshi-flight>
  <button type="button" @click="fly">Fly to Vega</button>
  <p>{{ where }}</p>
</template>
```

Svelte：

```svelte
<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/flight/define";
  import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";

  let flight: HoshiFlightElement;
  let where = $state("sun");
  const onChange = (event: Event) => {
    const { change, at } = (event as CustomEvent<FlightChange>).detail;
    if (change !== "moving") where = at;
  };
</script>

<hoshi-flight bind:this={flight} at="sun" style="height: 60vh" onhoshi-flight={onChange}></hoshi-flight>
<button type="button" onclick={() => flight.goTo("hr-7001")}>Fly to Vega</button>
<p>{where}</p>
```

Angular。`CUSTOM_ELEMENTS_SCHEMA`を使います。

```ts no-run
import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";

@Component({
  selector: "app-flight",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-flight #flight at="sun" style="height: 60vh" (hoshi-flight)="onChange($event)"></hoshi-flight><button type="button" (click)="flight.goTo('hr-7001')">Fly to Vega</button><p>{{ where() }}</p>`,
})
export class FlightComponent {
  readonly where = signal("sun");
  onChange(event: Event): void {
    const { change, at } = (event as CustomEvent<FlightChange>).detail;
    if (change !== "moving") this.where.set(at);
  }
}
```

## まだできないこと

表に半径がない近くの星は、そばで止まっても点のままです。銀河や星団はまだ描かないので、M31へ飛ぶと暗い所で止まります。はかった距離がない星は、飛ぶ空から外しています。要素は明るい星のカタログと近くの星をいっしょに持ってくるので、大きさのほとんどはそれです。
