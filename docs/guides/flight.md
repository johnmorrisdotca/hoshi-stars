---
title: A flight through the stars in your page
section: how-to
order: 16
description: "The demo's flying view in your own page: <hoshi-flight>, with goTo, lookAt, its status and the hoshi-flight event that says moving, arrived and home; its attributes, the embed page, three.js and the frameworks."
---

[日本語](ja/flight.md)

`<hoshi-flight>` (`@johnmorrisdotca/hoshi-stars/flight/element`, defined by `/flight/define`) is the view the demo's [flight page](https://johnmorrisdotca.github.io/hoshi-stars/flight.html) flies with. It fills its box with the sky seen from where the camera is: the bright and the nearby stars put around it again at each step from their measured distances (`skyFrom`), the Sun a named star from afar and a ball nearby, and a bright star a ball when the flight stops beside it. Its arithmetic is `/flight` and its places are `/flight/places` (see the README, "A flight through the stars").

It draws in 3D with three.js, which the package names as an optional peer: install it beside the package (`npm install three`), or let a CDN bring it.

## The element

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

A drag looks around, and a pinch, or Ctrl (Command) and the wheel, narrows and widens the view. `goTo(id)` flies to a place: it turns to it, leaves slowly, flies at a speed chosen so the leg takes a few seconds, and slows to stop beside it. A reader who asks for reduced motion is put there in one step. Nothing is drawn while it rests, is out of sight or the tab is hidden, and never more than 30 frames a second; every `<hoshi-flight>` on a page shares one WebGL context.

| Attribute | Means |
|---|---|
| `at` | Where it is: a place's id (`sun`, `hr-7001` for Vega, `gctp-3278` for Proxima Centauri, `M31`) or a point in parsecs from the Sun (`pc_1.5_-2_0.25`). Any spelling goes in (`HR-7001`) and the element writes it back in its one form at each stop, not at every step of the way. Set later, it puts the camera there without a flight. Left out, or not understood, it is the Sun. |
| `lang` | `en` or `ja`, for the Sun's name, a star's name and what a screen reader hears; else the nearest `lang` above it. |
| `ra`, `dec` | The direction it opens facing, in degrees on the equatorial axes (J2000). Left out, it faces the place it is at, or the Sun from a point. |
| `fov` | The view's height in degrees at Fit, 10 to 120 (60). A pinch narrows it up to eight times from there. |
| `sun-stop` | How far from the Sun's middle it stops, in astronomical units (six of the Sun's radii, about 0.028, where the Sun is a ball). It opens there, a flight home stops there, and a change moves it there if it is at the Sun. |
| `distance-min`, `distance-max`, `magnitude-limit` | Keep only the stars at least, at most and no fainter than these: light-years from where the camera is now and the apparent magnitude seen from there. The sky is filtered once for a place. See the sky chart guide, "Filter by distance and brightness". |
| `filter-bar` | Shows the distance and brightness bars over the view (folded on a narrow box; `filter-bar="open"` keeps them open). A bar writes the three attributes and sends `hoshi-filter`. |

| Property or method | What it is |
|---|---|
| `goTo(id)` | Fly to a place by its id; `false` where nothing has that id. |
| `lookAt(id)` | Turn to face a place without moving; `false` where nothing has that id. |
| `stepSpeed(1)`, `stepSpeed(-1)` | Step the speed dial up or down: 1 c to 10 million million c in tens. |
| `status` | A `FlightStatus`: `at`, `place` (where it rests), `target` (where it is flying), `moving`, `position` (parsecs from the Sun), `speed` and `dial` (multiples of the speed of light) and `remaining` (parsecs to the stop). |
| `sunStop` | `sun-stop` as a number of astronomical units. |
| `live`, `stats` | True while it draws in 3D; the stars drawn as points, the star drawn as a ball and the renderer's own counts. |

## What it says

It sends `hoshi-flight` as it moves and when it stops. The event's `detail` is a `FlightChange`: the status, and `change`.

| `change` | When |
|---|---|
| `moving` | At each step of a flight or a turn (no more than 30 a second). |
| `arrived` | It stopped at a place. |
| `home` | It stopped at the Sun, at `sun-stop`. |
| `rest` | Anything else at rest: a turn that ended, the dial, a point given as `at`. |

Opening sends nothing: read `status`. A page that keeps the place in its address writes `at` on `arrived` and `home`, as the demo does.

A site with its own view of the planets can open the flight where its camera was and take the view back when the flight comes home. Make the Sun's stop the planets view's outer limit, and open the flight facing the way that view faced:

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

## Where three.js comes from

Left alone, the element loads `import("three")` when it first goes live, so a bundler finds the `three` your page installed and a CDN brings its own. `setThreeLoader(load)`, from `/flight/element`, hands it another module before that: one that re-exports only the parts the flight draws with (the demo's `three-subset.ts`) ships a few hundred kilobytes of three.js instead of all of it.

```ts no-run
import { setThreeLoader } from "@johnmorrisdotca/hoshi-stars/flight/element";

setThreeLoader(() => import("three"));
```

## In an iframe

The demo's embed page, `embed-flight.html`, is the element filling the frame, for a page that runs no script of its own. Its address carries the element's attributes (`at`, `ra`, `dec`, `fov`, `sun-stop`, `lang`) and `to`, a place to fly to once it is open.

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

## In a bundler and in a framework

The element is plain DOM: import `/flight/define` once and write `<hoshi-flight>` like any element. `FLIGHT_TAG` is its name, `HoshiFlightElement` its class, and `defineFlight(registry)` defines it in another registry; a page that loads the definition twice never throws.

Vite (or any bundler), with `<hoshi-flight>`, a button and a line of text in the page:

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

React:

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

Vue, with `isCustomElement` in the plugin's options so Vue leaves the tag to the browser (`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("hoshi-") } } })`):

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

Svelte:

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

Angular, with `CUSTOM_ELEMENTS_SCHEMA`:

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

## What it does not do yet

A nearby star with no radius in the tables stays a point when the flight stops beside it, galaxies and clusters are not drawn (a flight to M31 stops in the dark where it is), and a star with no measured distance is left out of the flying sky. The element brings the bright catalogue and the nearby stars with it, which is most of its size.
