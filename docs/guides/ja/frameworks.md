---
title: フレームワーク
section: how-to
order: 12
description: React、Vue、Svelte、Angularで星図を描きます。パッケージが作るSVGを書き出す小さなコンポーネント1つで済みます。
---

[English](../frameworks.md)

パッケージには専用のコンポーネントがありません。数値を返すので、星図はSVGの文字列です。どのフレームワークにも、こうした文字列をそのまま入れる方法があります。この文字列は、あなた自身のコードがパッケージの数値から描いたものだけなので、ここでは信用して大丈夫です。ユーザーの入力から作ることは、決してしないでください。

## React

```tsx
import { starColour, stars, type Star } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

function place(star: Star): { x: number; y: number } | undefined {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
}

function orionSvg(): string {
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
  return svg + "</svg>";
}

export function Orion() {
  return <div dangerouslySetInnerHTML={{ __html: orionSvg() }} />;
}
```

`dangerouslySetInnerHTML`は、ReactがHTMLをそのまま入れる方法です。サーバーで描く（`renderToString`）と、星図は最初のHTMLに入ります。

## Vue

```vue
<script setup lang="ts">
import { starColour, stars, type Star } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

function place(star: Star): { x: number; y: number } | undefined {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
}

function orionSvg(): string {
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
  return svg + "</svg>";
}

const svg = orionSvg();
</script>

<template><div v-html="svg" /></template>
```

```ts no-check
import { createApp } from "vue";
import Orion from "./Orion.vue";

createApp(Orion).mount("#app");
```

## Svelte

```svelte
<script lang="ts">
  import { starColour, stars, type Star } from "@johnmorrisdotca/hoshi-stars";
  import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
  import { project } from "@johnmorrisdotca/hoshi-stars/projection";

  const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

  function place(star: Star): { x: number; y: number } | undefined {
    const at = project("stereographic", star, view);
    return at && { x: 200 + at.x, y: 200 - at.y };
  }

  function orionSvg(): string {
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
    return svg + "</svg>";
  }

  const svg = orionSvg();
</script>

<div>{@html svg}</div>
```

## Angular

```ts no-check
import { Component, inject } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { starColour, stars, type Star } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

function place(star: Star): { x: number; y: number } | undefined {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
}

function orionSvg(): string {
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
  return svg + "</svg>";
}

@Component({ selector: "app-orion", standalone: true, template: `<div [innerHTML]="svg"></div>` })
export class OrionComponent {
  // The string holds only what this file drew, so it is trusted. Never build it from user input.
  svg = inject(DomSanitizer).bypassSecurityTrustHtml(orionSvg());
}
```

Angularは信用できないマークアップを取り除くので、この文字列は信用できる、とコンポーネントではっきり伝えています（`bypassSecurityTrustHtml`）。

## 変わる星図

ここで見せたのは固定の星図です。選択に合わせて変わる星図にするには、`orionSvg`が選択（中心、縮尺、等級）を受け取るようにして、変わるたびに呼び直します。この関数は純粋で、1,600個の星の星図でも数ミリ秒です。デモの`demo/chart.ts`は、ドラッグのたびにそうしています。
