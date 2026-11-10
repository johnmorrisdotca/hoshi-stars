// The sky map's names keep off its bright stars (MODULES-802): in a spread of views, zooms, sizes and projections, no name's box touches the dot of a star drawn 3 pixels in radius or more.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart } from "../demo/chart.ts";
import { textSize } from "../demo/labels.ts";

test("no name on the sky map covers a bright star's dot", () => {
  const views = [[84, 0], [310, 42], [0, 89], [100, -60], [84.05, -1.2], [200, 30]] as const;
  let names = 0;
  for (const [ra, dec] of views) {
    for (const width of [1280, 390]) {
      for (const zoom of [1, 2, 4, 10, 30, 100]) {
        for (const projection of ["stereographic", "mollweide"] as const) {
          const made = chart({ projection, ra, dec, zoom, width, height: width === 1280 ? 700 : 600, magnitude: 6, layers: new Set(["lines", "names"]), lang: "en" });
          const dots = [...made.svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="#[0-9a-fA-F]+"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) })).filter((d) => d.r >= 3);
          for (const m of made.svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)) {
            const [x, y, size, text] = [Number(m[1]), Number(m[2]), Number(m[4]), m[5]!];
            const { w } = textSize(text, size);
            const x0 = m[3] === "middle" ? x - w / 2 : m[3] === "end" ? x - w : x;
            names++;
            for (const d of dots) {
              const covers = x0 < d.x + d.r && x0 + w > d.x - d.r && y - size * 0.85 < d.y + d.r && y + size * 0.3 > d.y - d.r;
              assert.equal(covers, false, `"${text}" covers a star ${d.r} px in radius (${projection}, ${width} wide, ${zoom}x, at ${ra}, ${dec})`);
            }
          }
        }
      }
    }
  }
  assert.ok(names > 1000, `names looked at: ${names}`);
});
