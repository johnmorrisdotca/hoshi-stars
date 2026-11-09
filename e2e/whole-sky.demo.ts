// The whole-sky page: all 88 constellations on one 2:1 map, galactic or equatorial, with the Milky Way across the middle; hover, Tab and tap open a constellation on the sky map; the family's
// gestures and bar zoom and move it; names never overlap; the strip and search choose; the map prints as a page or a poster. Nothing is drawn at rest.
import { expect, test, type Page } from "@playwright/test";
import { checkGestures } from "@johnmorrisdotca/kazoku-ui/testing";

const PAGE = "/hoshi-stars/whole-sky.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const links = (page: Page) => page.locator("#ws-sky a.c");
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}${query}`);
  await expect(links(page)).toHaveCount(88);
  await expect(page.locator("#ws-labels text").first()).toBeVisible();
}
/** The middle of a constellation's figure on the screen. */
async function figureAt(page: Page, id: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(`#ws-sky path.fg[data-fig="${id}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  return box;
}
const transformOf = (page: Page): Promise<string> => page.locator("#ws-world").getAttribute("transform").then((t) => t ?? "");
const scaleOf = async (page: Page): Promise<number> => Number(/scale\(([\d.]+)\)/.exec(await transformOf(page))![1]);

test("the map holds all 88 constellations, the Milky Way, and fits the page", async ({ page }) => {
  await open(page);
  await expect(page.locator("#ws-sky image[data-layer='milky']")).toHaveCount(1);
  await expect(page.locator("#ws-sky path.fg")).toHaveCount(105);
  const box = (await page.getByTestId("ws-box").boundingBox())!;
  expect(Math.abs(box.width / box.height - 2)).toBeLessThan(0.02);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.locator("#ws-labels text", { hasText: /^Orion$/ })).toHaveCount(1);
  // the Galaxy's centre (Sagittarius) is in the middle of the galactic map
  const sgr = await figureAt(page, "Sgr");
  expect(Math.abs(sgr.x - (box.x + box.width / 2))).toBeLessThan(box.width * 0.1);
});

test("no two names overlap, at any zoom, in either language", async ({ page }) => {
  for (const lang of ["", "?lang=ja"]) {
    await open(page, lang);
    for (const times of [0, 1, 3]) {
      for (let i = 0; i < times; i += 1) await page.getByRole("button", { name: /zoom in|拡大/i }).first().click();
      await page.waitForTimeout(150);
      const boxes = await page.locator("#ws-labels text").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent ?? "", x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; }));
      expect(boxes.length).toBeGreaterThan(times === 3 ? 4 : 20);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlap = a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
          expect(overlap, `${a.t} and ${b.t} overlap (${lang || "en"}, zoom steps ${times})`).toBe(false);
        }
      }
    }
  }
});

test("every constellation has a name on the map at a wide width", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, "a phone's map is too small for all 88 names; zooming shows them");
  await open(page);
  const ids = await page.locator("#ws-labels text").evaluateAll((els) => new Set(els.map((el) => el.getAttribute("data-id"))).size);
  expect(ids).toBeGreaterThanOrEqual(88);
});

test("hovering lights a constellation and says its name; leaving puts it out", async ({ page, isMobile }) => {
  test.skip(isMobile, "there is no hover on a touch screen");
  await open(page);
  const at = await figureAt(page, "Ori");
  await page.mouse.move(at.x, at.y);
  await expect(page.getByTestId("ws-under")).toContainText("Orion");
  await expect(page.locator("#ws-sky a.c.on")).toHaveAttribute("data-abbr", "Ori");
  await page.mouse.move(at.x, 2);
  await page.mouse.move(5, 5);
  await expect(page.locator("#ws-sky a.c.on")).toHaveCount(0);
});

test("a click on a constellation opens it on the sky map", async ({ page, isMobile }) => {
  await open(page);
  const at = await figureAt(page, "Cyg");
  if (isMobile) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/hoshi-stars/");
  await expect.poll(() => param(page, "pick")).toBe("C:Cyg");
  expect(Number(param(page, "dec"))).toBeGreaterThan(30);
});

test("the keyboard reaches each constellation: Tab lights it, Enter opens it", async ({ page }) => {
  await open(page);
  const link = page.locator("#ws-sky a.c[data-abbr='Cru']");
  await link.focus();
  await expect(link).toHaveClass(/on/);
  await expect(page.getByTestId("ws-under")).toContainText("Crux");
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("C:Cru");
});

test("the orientation, the map and the sky culture change the drawing and the address", async ({ page }) => {
  await open(page);
  const before = await figureAt(page, "Ori");
  await page.getByTestId("ws-frame").getByRole("button", { name: "Equatorial" }).click();
  await expect.poll(() => param(page, "frame")).toBe("equatorial");
  await expect(links(page)).toHaveCount(88);
  const after = await figureAt(page, "Ori");
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(50);
  await page.getByTestId("ws-map").getByRole("button", { name: "Hammer" }).click();
  await expect.poll(() => param(page, "map")).toBe("hammer");
  await page.getByTestId("ws-culture").getByRole("button", { name: "Chinese" }).click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  await expect(page.locator("#ws-sky path.fg")).toHaveCount(238);
  await expect(page.locator("#ws-labels text", { hasText: "參宿" })).toHaveCount(1);
  await page.getByTestId("ws-layers").getByRole("button", { name: "Milky Way" }).click();
  await expect(page.locator("#ws-sky image[data-layer='milky']")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("ws-frame").getByRole("button", { name: "Equatorial" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ws-sky path.fg")).toHaveCount(238);
});

test("in Japanese the names are Japanese and the words follow", async ({ page }) => {
  await open(page, "?lang=ja");
  if ((page.viewportSize()?.width ?? 0) >= 900) await expect(page.locator("#ws-labels text", { hasText: /^オリオン座$/ })).toHaveCount(1);
  else await expect(page.locator("#ws-labels text", { hasText: /座$/ }).first()).toBeVisible();
  await expect(links(page).filter({ has: page.locator("path") }).first()).toHaveAttribute("aria-label", /座/);
  await expect(page.getByTestId("ws-frame").getByRole("button", { name: "銀河座標" })).toBeVisible();
});

test("the zoom bar zooms the map and more names appear; Home puts it back", async ({ page }) => {
  await open(page);
  const names = (): Promise<number> => page.locator("#ws-labels text").count();
  const before = await scaleOf(page);
  const fewer = await names();
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: /zoom in|拡大/i }).first().click();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(before * 2);
  await page.getByTestId("ws-box").focus();
  await page.keyboard.press("Home");
  await expect.poll(() => scaleOf(page)).toBeCloseTo(before, 3);
  expect(await names()).toBe(fewer);
});

test("choosing from the strip shows the constellation on this map with a card that opens the sky map", async ({ page }) => {
  await open(page);
  const before = await scaleOf(page);
  await page.getByTestId("picker-strip").locator("button[data-abbr='Sco']").click();
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(before * 1.5);
  await expect(page.getByTestId("ws-card")).toContainText("Scorpius");
  await expect(page.getByTestId("ws-open")).toHaveAttribute("href", "./?go=Sco");
  await expect.poll(() => param(page, "c")).toBe("Sco");
  await page.getByTestId("picker-search").fill("Lyra");
  await page.getByTestId("picker-search").press("Enter");
  await expect(page.getByTestId("ws-card")).toContainText("Lyra");
});

test("it prints on one page or as a poster in tiles, with the Space Program X header", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => undefined; });
  await open(page);
  await page.getByTestId("ws-paper").getByRole("button", { name: "A4" }).click();
  await page.getByTestId("ws-print-go").click();
  const root = page.locator(".kazoku-print-root, [data-kazoku-print]").first();
  await expect(page.locator(".kazoku-page")).toHaveCount(1);
  await expect(page.locator(".kazoku-page svg text").first()).toBeAttached();
  await expect(page.locator("body")).toContainText("Space Program X");
  void root;
  await page.reload();
  await page.getByTestId("ws-paper").getByRole("button", { name: "A4" }).click();
  await page.getByTestId("ws-form").getByRole("button", { name: /Poster/ }).click();
  await expect(page.getByTestId("ws-info")).toContainText("6 pages");
  await page.getByTestId("ws-print-go").click();
  await expect(page.locator(".kazoku-page")).toHaveCount(6);
});

test("nothing is drawn at rest", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number };
    w.frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.frames += 1; cb(t); });
  });
  await open(page);
  const frames = (): Promise<number> => page.evaluate(() => (window as unknown as { frames: number }).frames);
  // the page comes to rest once its first draws are done (fonts, the first size, a late resize may draw once more): within 10 s there is
  // a whole 1.2 s with no frame at all. A drawing loop never gives one.
  await expect
    .poll(async () => {
      const before = await frames();
      await page.waitForTimeout(1200);
      return (await frames()) - before;
    }, { timeout: 10_000, intervals: [0], message: "the map comes to rest: 1.2 s with no frame drawn" })
    .toBe(0);
});

test("the family's gestures move the map", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  // every Chromium project draws in software now (SOFTWARE_GL_ARGS), which makes the map's pictures slower to take: 14 s of work took over a minute
  test.setTimeout(180_000);
  await open(page);
  await checkGestures(page, "#ws-box", {
    controls: "kazoku-view-controls",
    lacks: {
      turn: "a flat map has no angle to turn",
      roll: "a flat map has no roll",
      "key-turn": "a flat map has no angle to turn; the arrow keys move it once zoomed",
    },
  });
});

test("the boundaries are dashed, the same as on the sky map", async ({ page }) => {
  await page.goto("/hoshi-stars/?layers=boundaries");
  const mapDash = await page.locator("#chart path[stroke-dasharray]").first().getAttribute("stroke-dasharray");
  expect(mapDash).toBeTruthy();
  await open(page);
  const boundaries = page.locator('[data-layer="boundaries"] path.bd');
  expect(await boundaries.count()).toBeGreaterThan(80);
  const dashes = await boundaries.evaluateAll((all) => [...new Set(all.map((p) => p.getAttribute("stroke-dasharray")))]);
  expect(dashes, "every boundary is dashed, with one pattern").toHaveLength(1);
  const ratio = (d: string): number => { const [a, b] = d.trim().split(/\s+/).map(Number); return a! / b!; };
  expect(ratio(dashes[0]!)).toBeCloseTo(ratio(mapDash!), 2);
});
