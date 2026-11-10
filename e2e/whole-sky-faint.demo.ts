// The faint stars on the whole-sky page: UCAC4's stars come in as the map is zoomed in (the sky chart's depth rule, the 6,000-dot cap), in each projection and orientation and at the poles, a layer button turns them off and the address keeps it,
// the line under the map says how deep they go here, and nothing is drawn or fetched at rest, before the zoom reaches them, or twice for the same tile. The tiles are read from the site's own faint-tiles/.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/whole-sky.html";
const dots = (page: Page): Promise<number> =>
  page.evaluate(() => [...document.querySelectorAll('#ws-faint [data-layer="faint"] path')].reduce((sum, path) => sum + (path.getAttribute("d")?.match(/M/g) ?? []).length, 0));
const note = (page: Page) => page.getByTestId("faint-note");
const depthOf = async (page: Page): Promise<number> => Number(/magnitude (\d+(?:\.\d)?)/.exec((await note(page).textContent()) ?? "")?.[1] ?? "NaN");

/** The tile files asked for, as they are. */
function watchTiles(page: Page): string[] {
  const tiles: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/faint-tiles/")) tiles.push(new URL(request.url()).pathname.replace(/^.*\/faint-tiles\//, ""));
  });
  return tiles;
}

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}${query}`);
  await expect(page.locator("#ws-sky a.c")).toHaveCount(88);
  await expect(page.locator("#ws-labels text").first()).toBeVisible();
}

/** Pick a constellation from the strip (the map moves to it), then zoom to `zoom` about the same sky. */
async function zoomInto(page: Page, abbreviation: string, zoom: number): Promise<void> {
  await page.getByTestId("picker-strip").locator(`button[data-abbr='${abbreviation}']`).click();
  await expect(page.getByTestId("ws-card")).toBeVisible();
  const frame = (): Promise<void> => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await page.evaluate((to) => {
    const bar = document.getElementById("ws-bar") as unknown as { state: { zoom: number; panX: number; panY: number }; set(next: object): void };
    const now = bar.state;
    // the pan is in pixels from the middle at Fit: it grows with the zoom, so that the same sky stays in the middle
    bar.set({ zoom: to, panX: (now.panX * to) / now.zoom, panY: (now.panY * to) / now.zoom });
  }, zoom);
  await frame();
  // and the middle of the figure is put in the middle of the map, whatever the bar did with the pan
  await page.evaluate((id) => {
    const bar = document.getElementById("ws-bar") as unknown as { state: { zoom: number; panX: number; panY: number }; set(next: object): void };
    const box = document.getElementById("ws-box")!.getBoundingClientRect();
    const r = document.querySelector(`#ws-sky path.fg[data-fig="${id}"]`)!.getBoundingClientRect();
    const now = bar.state;
    bar.set({ zoom: now.zoom, panX: now.panX + (box.x + box.width / 2 - (r.x + r.width / 2)), panY: now.panY + (box.y + box.height / 2 - (r.y + r.height / 2)) });
  }, abbreviation);
  await frame();
}
const zoomAt = (page: Page, zoom: number): Promise<void> =>
  page.evaluate((to) => (document.getElementById("ws-bar") as unknown as { set(next: object): void }).set({ zoom: to, panX: 0, panY: 0 }), zoom);

test("zoomed out the layer draws nothing and fetches nothing, and the line says how to get the stars", async ({ page }) => {
  const tiles = watchTiles(page);
  await open(page);
  await expect(note(page)).toContainText("Zoom in to add fainter stars");
  expect(await dots(page)).toBe(0);
  // 1.5x is shallower than the layer's start (past magnitude 7), 4x is deep enough but the whole of that field would be more tiles than a page asks for at once
  for (const zoom of [1.5, 4]) {
    await zoomAt(page, zoom);
    await page.waitForTimeout(400);
    expect(await dots(page), `${zoom}x`).toBe(0);
    await expect(note(page)).toContainText("Zoom in to add fainter stars");
  }
  expect(tiles).toEqual([]);
});

test("zooming into Orion draws faint stars, never more than 6,000, and says how deep the map is here", async ({ page }) => {
  const tiles = watchTiles(page);
  await open(page);
  await zoomInto(page, "Ori", 12);
  await expect(note(page)).toContainText("Stars to magnitude");
  const shallow = { dots: await dots(page), depth: await depthOf(page) };
  expect(shallow.dots).toBeGreaterThan(20);
  expect(shallow.depth).toBeGreaterThanOrEqual(8.5);
  await page.evaluate(() => {
    const bar = document.getElementById("ws-bar") as unknown as { state: { zoom: number; panX: number; panY: number }; set(next: object): void };
    const now = bar.state;
    bar.set({ zoom: 24, panX: now.panX * 2, panY: now.panY * 2 });
  });
  await expect.poll(() => depthOf(page)).toBeGreaterThan(shallow.depth);
  // a closer look is deeper over a smaller patch: fewer dots can be on the screen, but there are some
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  expect(await dots(page)).toBeLessThanOrEqual(6000);
  // one path a size and colour, never a node a star
  expect(await page.locator('#ws-faint [data-layer="faint"] path').count()).toBeLessThanOrEqual(24);
  expect(await page.locator("#ws-faint circle").count()).toBe(0);
  // only the first level (stars to magnitude 10) is asked for, and each tile once
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.every((tile) => tile.startsWith("L0/"))).toBe(true);
  expect(new Set(tiles).size).toBe(tiles.length);
});

test("the faint stars lie inside the map", async ({ page }) => {
  await open(page);
  await zoomInto(page, "Ori", 24);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  const box = (await page.getByTestId("ws-box").boundingBox())!;
  const outside = await page.evaluate(
    ({ w, h }) => {
      let out = 0;
      for (const path of document.querySelectorAll('#ws-faint [data-layer="faint"] path')) {
        for (const m of (path.getAttribute("d") ?? "").matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)) {
          const x = Number(m[1]);
          const y = Number(m[2]);
          if (x < -2 || x > w + 2 || y < -2 || y > h + 2) out++;
        }
      }
      return out;
    },
    { w: box.width, h: box.height },
  );
  expect(outside).toBe(0);
});

for (const [frame, map, abbreviation, what] of [
  ["equatorial", "mollweide", "UMi", "the north celestial pole"],
  ["equatorial", "equirectangular", "UMi", "the north celestial pole"],
  ["equatorial", "hammer", "Oct", "the south celestial pole"],
  ["galactic", "mollweide", "Com", "the north galactic pole"],
  ["galactic", "hammer", "Scl", "the south galactic pole"],
  ["galactic", "equirectangular", "Sgr", "the centre of the Galaxy"],
] as const) {
  test(`${frame} ${map}: near ${what} (${abbreviation}) the faint stars come in, from the tiles of that sky`, async ({ page }) => {
    const tiles = watchTiles(page);
    await open(page, `?frame=${frame}&map=${map}`);
    await zoomInto(page, abbreviation, 24);
    await expect(note(page)).toContainText("Stars to magnitude");
    await expect.poll(() => dots(page)).toBeGreaterThan(20);
    expect(await dots(page)).toBeLessThanOrEqual(6000);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(48);
    // near a celestial pole in the equatorial frame the tiles are the polar bands' (level 0 has 18 bands from the south pole)
    if (frame === "equatorial" && what.includes("north")) expect(tiles.every((t) => Number(/L0\/(\d+)-/.exec(t)?.[1]) >= 13)).toBe(true);
    if (frame === "equatorial" && what.includes("south")) expect(tiles.every((t) => Number(/L0\/(\d+)-/.exec(t)?.[1]) <= 4)).toBe(true);
  });
}

test("the Faint stars button turns them off and on, and the address keeps it", async ({ page }) => {
  await open(page);
  await zoomInto(page, "Ori", 12);
  await expect(note(page)).toContainText("Stars to magnitude");
  const button = page.getByTestId("ws-layers").getByRole("button", { name: "Faint stars" });
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => dots(page)).toBe(0);
  await expect(note(page)).toHaveText("");
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBe("milky,boundaries,lines,names");
  // off, and zoomed in on arrival, nothing is fetched
  const tiles = watchTiles(page);
  await page.reload();
  await expect(page.locator("#ws-sky a.c")).toHaveCount(88);
  await expect(page.getByTestId("ws-layers").getByRole("button", { name: "Faint stars" })).toHaveAttribute("aria-pressed", "false");
  await zoomInto(page, "Ori", 12);
  await page.waitForTimeout(500);
  expect(await dots(page)).toBe(0);
  expect(tiles).toEqual([]);
  await page.getByTestId("ws-layers").getByRole("button", { name: "Faint stars" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBeNull();
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
});

test("the faint stars are in Japanese too", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(note(page)).toContainText("拡大するほど");
  await zoomInto(page, "Ori", 12);
  await expect(note(page)).toContainText("ここでは");
  await expect(page.getByTestId("ws-layers").getByRole("button", { name: "暗い星" })).toBeVisible();
});

test("the credit line under the map names the sources of what is drawn, with their licences, in English and Japanese (MODULES-831)", async ({ page }) => {
  const credit = page.getByTestId("faint-credit");
  await open(page);
  await expect(credit).toContainText("Yale Bright Star Catalogue");
  await expect(credit).not.toContainText("UCAC4");
  await zoomInto(page, "Ori", 12);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  await expect(credit).toContainText("UCAC4");
  await expect(credit).toContainText("UCAC4 terms of use");
  await expect(credit).toContainText("Public domain");
  // the faint layer off: its source is no longer credited
  await page.getByTestId("ws-layers").getByRole("button", { name: "Faint stars" }).click();
  await expect.poll(() => dots(page)).toBe(0);
  await expect(credit).not.toContainText("UCAC4");
  await expect(credit).toContainText("Yale Bright Star Catalogue");
});

test("the credit line is in Japanese in Japanese", async ({ page }) => {
  const credit = page.getByTestId("faint-credit");
  await open(page, "?lang=ja");
  await expect(credit).toContainText("イェール輝星カタログ");
  await expect(credit).toContainText("パブリックドメイン");
  await zoomInto(page, "Ori", 12);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  await expect(credit).toContainText("暗い星：UCAC4");
});

test("panning the zoomed-in map asks for each tile once, only for what is in view, and then comes to rest", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "the drag is a Chromium mouse drag");
  const tiles = watchTiles(page);
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number };
    w.frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.frames += 1; cb(t); });
  });
  await open(page);
  await zoomInto(page, "Cyg", 24);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  const box = (await page.getByTestId("ws-box").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(x + Math.sin(i / 8) * box.width * 0.35, y + Math.cos(i / 8) * box.height * 0.3);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  expect(tiles.length, "tile requests while panning a screen's width round").toBeLessThanOrEqual(30);
  expect(new Set(tiles).size, "no tile is asked for twice").toBe(tiles.length);
  // and then rest: 1.2 s with no frame drawn and no tile asked for
  const frames = (): Promise<number> => page.evaluate(() => (window as unknown as { frames: number }).frames);
  await expect
    .poll(async () => {
      const before = await frames();
      const asked = tiles.length;
      await page.waitForTimeout(1200);
      return (await frames()) - before + (tiles.length - asked);
    }, { timeout: 10_000, intervals: [0], message: "the map comes to rest: 1.2 s with no frame drawn and no tile asked for" })
    .toBe(0);
});

test("the Bright Star Catalogue's stars are painted at the closest zoom, where the faint ones come in around them", async ({ page }) => {
  await open(page);
  await zoomInto(page, "Ori", 24);
  await expect.poll(() => dots(page)).toBeGreaterThan(20);
  // the bright stars on the screen, where they are in the page
  const at = await page.evaluate(() => {
    const matrix = (document.getElementById("ws-star-world") as unknown as SVGGElement).getScreenCTM()!;
    const box = document.getElementById("ws-box")!.getBoundingClientRect();
    return [...document.querySelectorAll("#ws-stars path.bright:not(.halo)")]
      .flatMap((path) => [...(path.getAttribute("d") ?? "").matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)])
      .map((m) => { const p = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(matrix); return { x: p.x - box.x, y: p.y - box.y }; })
      .filter((p) => p.x > 8 && p.x < box.width - 8 && p.y > 8 && p.y < box.height - 8);
  });
  // Orion's belt: three stars, one of them under the name "Orion's Belt"
  expect(at.length).toBeGreaterThanOrEqual(3);
  const boxWidth = (await page.getByTestId("ws-box").boundingBox())!.width;
  const png = (await page.getByTestId("ws-box").screenshot()).toString("base64");
  const blank = await page.context().newPage();
  await blank.goto("about:blank");
  const painted = await blank.evaluate(async ([data, points, width]) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    // a screen of twice the pixels (WebKit's) gives a picture twice as wide as the box
    const scale = image.width / (width as number);
    return (points as Array<{ x: number; y: number }>).map((p) => {
      const pixels = context.getImageData(Math.round(p.x * scale) - 3, Math.round(p.y * scale) - 3, 7, 7).data;
      let white = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 200 && pixels[i + 1]! > 200 && pixels[i + 2]! > 200) white++;
      return white;
    });
  }, [png, at, boxWidth] as const);
  await blank.close();
  expect(painted.filter((n) => n >= 2).length, `near-white pixels round each bright star: ${painted.join(",")}`).toBeGreaterThanOrEqual(2);
});
