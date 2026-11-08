---
title: TypeScript and Node
section: how-to
order: 13
description: The types the package ships, how a wrong projection or a missing star is caught, and drawing the sky on a server.
---

[日本語](ja/typescript-and-node.md)

Every entry point ships its own `.d.ts`. Nothing needs `@types`, and the types are strict: `Projection` is the seven names, not a string.

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

The `@ts-expect-error` line is the check that the compiler refuses a projection that does not exist. A name looked up (`starByName`, `constellation`) gives `T | undefined`, so you decide what a missing one means; the `!` above says "I know Sirius is there".

## On a server

Everything is pure: no DOM, no clock, no network. A script can draw the sky to a file, or compute positions, in Node 22 or later:

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

That is a Hammer oval of the whole sky, with the stars as bright as magnitude 5. Open the file in a browser, or turn it into a PNG with any SVG tool.

## Node 22 and `require`

The package is ES modules. `require("@johnmorrisdotca/hoshi-stars")` works on Node 22.12 and later, which can require an ES module that has no top-level await; on an older Node, use `import()`.
