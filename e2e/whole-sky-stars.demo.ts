// The whole-sky page's bright stars, plain at every zoom: they grow as the map zooms in (the sky chart's rule), are drawn over the figure lines, boundaries and the Milky Way, and a name never covers one. At 24x on Orion the three
// belt stars are each the largest and brightest mark round them, with nothing over their centre pixel, at any device pixel ratio. The faint layer stays under them. At the whole sky nothing is as it was before.
import { expect, test, type Page } from "@playwright/test";
import { allSkyProject } from "../src/all-sky.ts";
import { starByHr } from "../src/index.ts";

const PAGE = "/hoshi-stars/whole-sky.html";
/** Alnitak, Alnilam and Mintaka: Orion's belt, by Harvard Revised number. */
const BELT = [1903, 1948, 1852];
const OPTIONS = { width: 1000, frame: "equatorial", projection: "mollweide" } as const;

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}?frame=equatorial${query}`);
  await expect(page.locator("#ws-sky a.c")).toHaveCount(88);
  await expect(page.locator("#ws-labels text").first()).toBeVisible();
}

const frames = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** Pick Orion from the strip, zoom to `zoom` about it, and put the middle of its figure in the middle of the map. */
async function zoomInto(page: Page, abbreviation: string, zoom: number): Promise<void> {
  await page.getByTestId("picker-strip").locator(`button[data-abbr='${abbreviation}']`).click();
  await expect(page.getByTestId("ws-card")).toBeVisible();
  await page.evaluate((to) => {
    const bar = document.getElementById("ws-bar") as unknown as { state: { zoom: number; panX: number; panY: number }; set(next: object): void };
    const now = bar.state;
    bar.set({ zoom: to, panX: (now.panX * to) / now.zoom, panY: (now.panY * to) / now.zoom });
  }, zoom);
  await frames(page);
  await page.evaluate((id) => {
    const bar = document.getElementById("ws-bar") as unknown as { state: { zoom: number; panX: number; panY: number }; set(next: object): void };
    const box = document.getElementById("ws-box")!.getBoundingClientRect();
    const r = document.querySelector(`#ws-sky path.fg[data-fig="${id}"]`)!.getBoundingClientRect();
    const now = bar.state;
    bar.set({ zoom: now.zoom, panX: now.panX + (box.x + box.width / 2 - (r.x + r.width / 2)), panY: now.panY + (box.y + box.height / 2 - (r.y + r.height / 2)) });
  }, abbreviation);
  await frames(page);
  await page.waitForTimeout(150);
}

/** The belt stars on the screen, in pixels from the map's top left corner. */
async function beltAt(page: Page): Promise<Array<{ hr: number; x: number; y: number }>> {
  const units = BELT.map((hr) => ({ hr, ...allSkyProject(starByHr(hr)!, OPTIONS) }));
  return page.evaluate((list) => {
    const matrix = (document.getElementById("ws-star-world") as unknown as SVGGElement).getScreenCTM()!;
    const box = document.getElementById("ws-box")!.getBoundingClientRect();
    return list.map((u) => {
      const p = new DOMPoint(u.x, u.y).matrixTransform(matrix);
      return { hr: u.hr, x: p.x - box.x, y: p.y - box.y };
    });
  }, units);
}

/** What the picture shows round each point (in CSS pixels of the box): the centre pixel, the brightest pixel within 20 px, and the near-white blob on the point against every other near-white blob within 20 px. */
async function marksAt(page: Page, points: Array<{ x: number; y: number }>): Promise<Array<{ centre: number[]; brightest: number; star: number; other: number; scale: number }>> {
  const boxWidth = (await page.getByTestId("ws-box").boundingBox())!.width;
  const png = (await page.getByTestId("ws-box").screenshot()).toString("base64");
  const blank = await page.context().newPage();
  await blank.goto("about:blank");
  const found = await blank.evaluate(
    async ([data, spots, width]) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      // a screen of more pixels to the CSS pixel gives a picture wider than the box
      const scale = image.width / (width as number);
      const reach = Math.round(20 * scale);
      return (spots as Array<{ x: number; y: number }>).map((p) => {
        const cx = Math.round(p.x * scale);
        const cy = Math.round(p.y * scale);
        const side = 2 * reach + 1;
        const data2 = context.getImageData(cx - reach, cy - reach, side, side).data;
        const at = (x: number, y: number): number[] => [data2[(y * side + x) * 4]!, data2[(y * side + x) * 4 + 1]!, data2[(y * side + x) * 4 + 2]!];
        const white = (x: number, y: number): boolean => Math.min(...at(x, y)) >= 200;
        let brightest = 0;
        for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) brightest = Math.max(brightest, at(x, y).reduce((a, b) => a + b, 0) / 3);
        // the near-white blobs of the window, by flood fill
        const label = new Int32Array(side * side);
        const areas: number[] = [];
        for (let y = 0; y < side; y++) {
          for (let x = 0; x < side; x++) {
            if (label[y * side + x] !== 0 || !white(x, y)) continue;
            const id = areas.length + 1;
            let area = 0;
            const todo = [[x, y]] as Array<[number, number]>;
            label[y * side + x] = id;
            while (todo.length > 0) {
              const [px, py] = todo.pop()!;
              area++;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                const nx = px + dx;
                const ny = py + dy;
                if (nx < 0 || ny < 0 || nx >= side || ny >= side || label[ny * side + nx] !== 0 || !white(nx, ny)) continue;
                label[ny * side + nx] = id;
                todo.push([nx, ny]);
              }
            }
            areas.push(area);
          }
        }
        // the blob on the point: the near-white pixel nearest the middle, within 4 CSS pixels
        let near = 0;
        let best = Infinity;
        for (let y = 0; y < side; y++) {
          for (let x = 0; x < side; x++) {
            const l = label[y * side + x]!;
            const d = Math.hypot(x - reach, y - reach);
            if (l !== 0 && d < best && d <= 4 * scale) {
              best = d;
              near = l;
            }
          }
        }
        const star = near === 0 ? 0 : areas[near - 1]!;
        const other = Math.max(0, ...areas.filter((_, i) => i + 1 !== near));
        return { centre: at(reach, reach), brightest, star, other, scale };
      });
    },
    [png, points, boxWidth] as const,
  );
  await blank.close();
  return found;
}

for (const ratio of [1, 1.5, 2, 3]) {
  test.describe(`at ${ratio} device pixels to the CSS pixel`, () => {
    test.use({ deviceScaleFactor: ratio });

    test("at 24x on Orion the three belt stars are each the largest and brightest mark round them, and nothing covers their centre", async ({ page }) => {
      await open(page);
      await zoomInto(page, "Ori", 24);
      const belt = await beltAt(page);
      const box = (await page.getByTestId("ws-box").boundingBox())!;
      for (const star of belt) {
        expect(star.x, `star ${star.hr} on the map`).toBeGreaterThan(24);
        expect(star.x).toBeLessThan(box.width - 24);
        expect(star.y).toBeGreaterThan(24);
        expect(star.y).toBeLessThan(box.height - 24);
      }
      const marks = await marksAt(page, belt);
      marks.forEach((m, i) => {
        const hr = belt[i]!.hr;
        // the centre pixel is the star's own colour: no line, name or ring over it
        expect(Math.min(...m.centre), `the centre of ${hr} is near white: ${m.centre.join(",")}`).toBeGreaterThanOrEqual(235);
        // and nothing within 20 px is brighter
        expect(m.brightest, `nothing round ${hr} is brighter`).toBeLessThanOrEqual(m.centre.reduce((a, b) => a + b, 0) / 3 + 1);
        // the star is a dot at least 8 CSS pixels across, and no other near-white mark round it is bigger
        const eight = Math.PI * (4 * m.scale) ** 2;
        expect(m.star, `the dot of ${hr} is at least 8 px across (${m.star} of ${Math.round(eight)} device pixels)`).toBeGreaterThanOrEqual(eight * 0.8);
        expect(m.star, `the dot of ${hr} is the largest mark within 20 px (another is ${m.other})`).toBeGreaterThanOrEqual(m.other);
      });
    });
  });
}

test("the stars grow as the map zooms in: a magnitude-2 star is the biggest mark at the end of a line at 4x, 10x and 24x, and the whole sky is as it was", async ({ page }) => {
  await open(page);
  const widths = (): Promise<Record<string, number>> =>
    page.evaluate(() => {
      const out: Record<string, number> = {};
      for (const p of document.querySelectorAll<SVGPathElement>('#ws-stars path:not(.halo)')) out[p.dataset.bin!] = Number(p.getAttribute("stroke-width"));
      return out;
    });
  // the whole sky: the page's three sizes (the bright class 3.6 px, the middle 2.2, the faint 1.2)
  let w = await widths();
  expect([w["0"], w["1"], w["2"], w["3"], w["6"], w["7"], w["9"]]).toEqual([3.6, 3.6, 3.6, 2.2, 2.2, 1.2, 1.2]);
  const line = await page.evaluate(() => Number(document.querySelector("#ws-sky path.fg")!.getAttribute("stroke-width")));
  let before = 3.6;
  for (const zoom of [4, 10, 24]) {
    await zoomInto(page, "Ori", zoom);
    w = await widths();
    expect(w["2"], `a magnitude-2 star at ${zoom}x`).toBeGreaterThanOrEqual(8);
    expect(w["2"]!, `against the line's ${line}`).toBeGreaterThan(line * 4);
    expect(w["2"]!).toBeGreaterThanOrEqual(before);
    expect(w["2"]!, "bigger than a star of magnitude 4").toBeGreaterThan(w["6"]!);
    for (let bin = 1; bin < 10; bin++) expect(w[String(bin - 1)]!, `bin ${bin - 1} against ${bin} at ${zoom}x`).toBeGreaterThanOrEqual(w[String(bin)]!);
    before = w["2"]!;
  }
  // and home again, everything as it was
  await page.getByTestId("ws-bar").evaluate((el) => (el as unknown as { fit(): void }).fit());
  await frames(page);
  w = await widths();
  expect([w["0"], w["2"], w["3"], w["9"]]).toEqual([3.6, 3.6, 2.2, 1.2]);
});

test("the stars are drawn over the figure lines, boundaries and faint stars, and under the names", async ({ page }) => {
  await open(page);
  await zoomInto(page, "Ori", 24);
  const order = await page.evaluate(() => {
    const layer = (name: string): number => [...document.querySelectorAll("#ws-sky [data-layer]")].findIndex((el) => el.getAttribute("data-layer") === name);
    const [sky, faint, stars, labels] = ["ws-sky", "ws-faint", "ws-stars", "ws-labels"].map((id) => document.getElementById(id)!);
    const after = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return { lines: layer("lines"), boundaries: layer("boundaries"), onTheMap: layer("stars"), layers: after(sky!, faint!) && after(faint!, stars!) && after(stars!, labels!) };
  });
  expect(order.lines).toBeGreaterThanOrEqual(0);
  expect(order.boundaries).toBeGreaterThanOrEqual(0);
  // the stars are a layer of their own: over the lines and boundaries (the map), over the faint stars, under the names
  expect(order.onTheMap).toBe(-1);
  expect(order.layers).toBe(true);
  // the faint layer's dots are always smaller than the faintest of the Bright Star Catalogue's
  await expect.poll(() => page.locator('#ws-faint [data-layer="faint"] path').count()).toBeGreaterThan(0);
  const sizes = await page.evaluate(() => ({
    faint: Math.max(...[...document.querySelectorAll('#ws-faint [data-layer="faint"] path')].map((p) => Number(p.getAttribute("stroke-width")))),
    catalogue: Math.min(...[...document.querySelectorAll<SVGPathElement>('#ws-stars path:not(.halo)')].map((p) => Number(p.getAttribute("stroke-width")))),
  }));
  expect(sizes.faint).toBeLessThan(sizes.catalogue);
});

test("no name covers a belt star, at 4x, 10x and 24x, in English and Japanese", async ({ page }) => {
  for (const lang of ["en", "ja"]) {
    await open(page, `&lang=${lang}`);
    for (const zoom of [4, 10, 24]) {
      await zoomInto(page, "Ori", zoom);
      const belt = await beltAt(page);
      const names = await page.locator("#ws-labels text").evaluateAll((els) => {
        const box = document.getElementById("ws-box")!.getBoundingClientRect();
        return els.map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent ?? "", x0: r.left - box.x, x1: r.right - box.x, y0: r.top - box.y, y1: r.bottom - box.y }; });
      });
      for (const star of belt) {
        for (const n of names) {
          const covers = star.x > n.x0 && star.x < n.x1 && star.y > n.y0 && star.y < n.y1;
          expect(covers, `"${n.t}" covers star ${star.hr} at ${zoom}x (${lang})`).toBe(false);
        }
      }
    }
  }
});
