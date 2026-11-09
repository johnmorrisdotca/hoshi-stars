// Makes the family's thumbnail, dark thumbnail and icon (docs/images/thumbnail.png, thumbnail-dark.png, icon.png; scripts/family-thumbnail.mjs): a sky chart of Orion
// with its constellation lines and the Milky Way, drawn by the demo's own chart function. `pnpm images`. Needs Chromium; it opens one headless browser and no server.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { chart, defaultZoom, DEFAULT_VIEW } from "../src/chart/draw.ts";
import { loadChartData } from "../src/chart/data.ts";
import { captureDrawing, composeThumbnails } from "./family-thumbnail.mjs";

await loadChartData({ layers: ["milky"] });
mkdirSync(new URL("../docs/images/", import.meta.url).pathname, { recursive: true });

const sky = (width: number, height: number, zoom: number) =>
  chart({ ...DEFAULT_VIEW, zoom, width, height, magnitude: 5.5, layers: new Set(["milky", "lines"] as const), lang: "en" }).svg;

const browser = await chromium.launch();
try {
  const take = async (scheme: "light" | "dark", width: number, height: number, zoom: number) => {
    const page = await browser.newPage({ viewport: { width: width + 300, height: height + 300 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
    const edge = scheme === "dark" ? "box-shadow:0 0 0 1px rgba(255,255,255,.18)" : "box-shadow:0 0 0 1px rgba(20,24,40,.2)";
    await page.setContent(`<body style="margin:0"><div id="thumbnail-stage" style="width:${width}px;height:${height}px;margin:100px;border-radius:28px;overflow:hidden;${edge}"><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">${sky(width, height, zoom)}</svg></div></body>`);
    return { page, drawing: await captureDrawing(page, "#thumbnail-stage", { margin: 72 }) };
  };
  const wide = defaultZoom("stereographic", 1000, 440) * 1.7;
  const light = await take("light", 1000, 440, wide);
  const dark = await take("dark", 1000, 440, wide);
  const icon = await take("light", 460, 460, defaultZoom("stereographic", 460, 460) * 1.3);
  for (const picture of await composeThumbnails({ page: icon.page, root: new URL("..", import.meta.url).pathname, light: light.drawing, dark: dark.drawing, icon: icon.drawing, label: "Hoshi Stars 星" })) console.log(picture.file, `${Math.round(picture.bytes / 1024)} KB`);
  for (const one of [light, dark, icon]) await one.page.close();
} finally {
  await browser.close();
}
