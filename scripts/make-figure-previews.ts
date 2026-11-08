// Draws each figure over the real stars as SVG pictures, one a figure and one of all of them: node scripts/make-figure-previews.ts OUT_DIR
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { boundaryOf } from "../src/boundaries.ts";
import { figures, figurePath, type Figure } from "../src/figures.ts";
import { project } from "../src/projection.ts";
import { starByName, starColour, stars } from "../src/stars.ts";

const SIZE = 900;
const views: Record<string, { ra: number; dec: number; scale: number; labels: number; rotation?: number }> = {
  UMa: { ra: 167, dec: 52, scale: 15.5, labels: 2.5 },
  Cas: { ra: 12, dec: 60, scale: 34, labels: 3.5, rotation: 180 },
  Ori: { ra: 84, dec: 3, scale: 22, labels: 2.5 },
  M45: { ra: 56.75, dec: 24.1, scale: 520, labels: 6 },
};

function panel(art: Figure, x: number, y: number): string {
  const v = views[art.id]!;
  const options = { centre: { rightAscension: v.ra, declination: v.dec }, scale: v.scale * (180 / Math.PI), rotation: v.rotation ?? 0 };
  const at = (p: { rightAscension: number; declination: number }): { x: number; y: number } | undefined => {
    const m = project("stereographic", p, options);
    return m === undefined ? undefined : { x: SIZE / 2 + m.x, y: SIZE / 2 - m.y };
  };
  let dots = "";
  let names = "";
  for (const s of stars()) {
    const p = at(s);
    if (p === undefined || p.x < -20 || p.y < -20 || p.x > SIZE + 20 || p.y > SIZE + 20) continue;
    const r = Math.max(0.6, 0.8 + (6.1 - s.magnitude) * 0.62) * (art.id === "M45" ? 1.6 : 1);
    if (s.magnitude < 2.6) dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(r * 2.4).toFixed(1)}" fill="${starColour(s)}" opacity="0.14"/>`;
    dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${starColour(s)}"/>`;
    const label = s.name ?? "";
    if (label !== "" && s.magnitude <= v.labels) names += `<text x="${(p.x + r + 5).toFixed(1)}" y="${(p.y + 4).toFixed(1)}">${label}</text>`;
  }
  const boundary = boundaryOf(art.constellation, { step: 0.5 })
    .outlines.map((o) => {
      let d = "";
      let drawing = false;
      for (const point of o) {
        const p = at(point);
        if (p === undefined) drawing = false;
        else {
          d += `${drawing ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          drawing = true;
        }
      }
      return d;
    })
    .join("");
  const dipper =
    art.id === "UMa"
      ? ["Alkaid", "Mizar", "Alioth", "Megrez", "Phecda", "Merak", "Dubhe", "Megrez"].map((n) => at(starByName(n)!)!).map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")
      : "";
  const note = art.id === "UMa" ? `<text x="36" y="48" font-size="18" fill="#8fa3d8" font-family="'Hiragino Sans',Helvetica,Arial,sans-serif">The Big Dipper (北斗七星, Hokuto-shichisei) dotted: all seven stars inside the bear</text>` : "";
  const line = figurePath(art, "stereographic", { ...options, step: 0.4 });
  const title = art.id === "M45" ? "M45" : art.constellation;
  return `<svg x="${x}" y="${y}" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<rect width="${SIZE}" height="${SIZE}" fill="url(#sky)"/>
<path d="${boundary}" fill="none" stroke="#5a6aa0" stroke-width="1" stroke-dasharray="5 6" opacity="0.55"/>
${dots}
<g font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#9fb0d8" opacity="0.8">${names}</g>
<path d="${dipper}" fill="none" stroke="#9fb0e8" stroke-width="1.2" stroke-dasharray="1.5 5" stroke-linecap="round" opacity="0.7"/>
${note}
<g transform="translate(${SIZE / 2} ${SIZE / 2})"><path d="${line}" fill="none" stroke="#f0cf86" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/></g>
<g font-family="'Hiragino Mincho ProN','Hiragino Sans','Noto Serif JP',Georgia,serif" fill="#e9eefc">
<text x="36" y="${SIZE - 62}" font-size="34" letter-spacing="0.5">${art.english}</text>
<text x="36" y="${SIZE - 24}" font-size="28" fill="#c7d2f0">${art.japanese}</text>
<text x="${SIZE - 36}" y="${SIZE - 26}" font-size="20" fill="#7d8cc0" text-anchor="end" font-family="Helvetica, Arial, sans-serif">${title}</text>
</g>
</svg>`;
}

const defs = `<defs><radialGradient id="sky" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#101936"/><stop offset="1" stop-color="#060a18"/></radialGradient></defs>`;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: node scripts/make-figure-previews.ts OUT_DIR");
mkdirSync(out, { recursive: true });
const order = ["UMa", "Cas", "M45", "Ori"];
const all = order.map((id) => figures().find((f) => f.id === id)).filter((f): f is Figure => f !== undefined);
for (const art of all) writeFileSync(join(out, `${art.id}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${defs}${panel(art, 0, 0)}</svg>\n`);
const gap = 12;
const width = SIZE * 2 + gap * 3;
const height = SIZE * 2 + gap * 3;
const cells = all.map((art, i) => panel(art, gap + (i % 2) * (SIZE + gap), gap + Math.floor(i / 2) * (SIZE + gap))).join("\n");
writeFileSync(join(out, "all.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}<rect width="${width}" height="${height}" fill="#03050d"/>\n${cells}\n</svg>\n`);
console.log(`wrote ${all.length} figures to ${out}`);
