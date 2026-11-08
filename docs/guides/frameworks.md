---
title: Frameworks
section: how-to
order: 12
description: Draw a chart in React, Vue, Svelte and Angular, each as one small component that writes the package's SVG.
---

[日本語](ja/frameworks.md)

The package has no component of its own: it gives you numbers, and a chart is a string of SVG. Every framework puts such a string in with its own "raw HTML" way. The string holds only what your own code drew, from the package's numbers, so it is safe to trust here; never build it from user input.

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

`dangerouslySetInnerHTML` is React's raw-HTML way. Drawn on a server (`renderToString`), the chart is in the first HTML.

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

Angular strips markup it does not trust, so the component says plainly that this string is trusted (`bypassSecurityTrustHtml`).

## One chart that changes

These show a fixed chart. For one that follows a choice, make `orionSvg` take the choices (a centre, a scale, a magnitude) and call it again when they change: it is pure, and a chart of 1,600 stars is a few milliseconds of work. The demo's `demo/chart.ts` does this on every drag.
