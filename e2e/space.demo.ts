// The constellation in 3D page: Orion opens as seen from the Earth (the sky chart's view) and says which distances are unknown; Turn 90° turns it to see the distances side by side; every one of the 88 draws; labels never overlap
// each other or leave the view at a desk's width, a laptop's and a phone's; a viewpoint star, Japanese, light and dark, the picker and the address work; and the embed page draws what its address says. WebGL, in software.
import { constellationIn3D, DISTANCE_QUALITIES } from "../src/constellation-3d.ts";
import { constellations } from "../src/constellations.ts";
import { drainGpu } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/constellation-3d.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const live = (page: Page) => page.locator("#sp-stage[data-state=live]");
const shown = (page: Page) => page.locator("#sp-labels .sp-label:not([hidden])");
const across = async (page: Page): Promise<number> => Number(await page.locator("#sp-stage").getAttribute("data-across"));

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}${query}`);
  await expect(live(page)).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => shown(page).count(), { timeout: 20_000 }).toBeGreaterThan(2);
  await page.waitForTimeout(300);
}

/** Every shown label and the view, in page coordinates. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const box = document.getElementById("sp-stage")!.getBoundingClientRect();
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const labels = [...document.querySelectorAll<HTMLElement>("#sp-labels .sp-label:not([hidden])")].map((el) => ({ key: el.dataset["key"]!, text: el.textContent!, ...rect(el) }));
    const bar = document.getElementById("sp-controls")!.getBoundingClientRect();
    return { stage: { x: box.left, y: box.top, w: box.width, h: box.height }, labels, bar: { x: bar.left, y: bar.top, w: bar.width, h: bar.height } };
  });
}

async function noOverlap(page: Page, what: string): Promise<number> {
  const { stage, labels } = await layout(page);
  for (const a of labels) {
    expect(a.x, `${what}: ${a.text} inside on the left`).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect(a.y, `${what}: ${a.text} inside at the top`).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect(a.x + a.w, `${what}: ${a.text} inside on the right`).toBeLessThanOrEqual(stage.x + stage.w + 0.5);
    expect(a.y + a.h, `${what}: ${a.text} inside at the bottom`).toBeLessThanOrEqual(stage.y + stage.h + 0.5);
    for (const b of labels) {
      if (a.key >= b.key) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${what}: "${a.text}" overlaps "${b.text}"`).toBe(false);
    }
  }
  return labels.length;
}

test("Orion opens as seen from the Earth, lines and names on, and says which distances are unknown", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("sp-heading")).toContainText("Orion");
  expect(await across(page)).toBeLessThan(0.05);
  await expect(page.getByTestId("sp-note")).toContainText("As seen from the Earth");
  const text = await shown(page).allTextContents();
  expect(text.some((t) => t.includes("Betelgeuse")) && text.some((t) => t.includes("Rigel"))).toBe(true);
  // Alnilam has no parallax: a line of sight, labelled, never a guessed distance
  await expect(page.locator('.sp-label[data-star="hr-1903"]')).toContainText("distance unknown");
  await expect(page.locator('.sp-label[data-star="hr-1903"]')).toContainText("Alnilam");
  const key = page.getByTestId("sp-key");
  await expect(key.locator('[data-quality="rough"]')).toContainText("6");
  await expect(key.locator('[data-quality="none"]')).toContainText("1");
  await expect(key.locator('[data-quality="fair"]')).toContainText("1");
  await expect(key.locator('[data-quality="good"]')).toContainText("0");
  await expect(page.getByTestId("sp-summary")).toHaveText("Of 8 stars in the figure: 0 good, 1 fair, 6 rough, 1 with none.");
  await expect(page.getByTestId("sp-poor")).toBeVisible();
});

test("the table lists every star of the figure with its distance and the range it could be in", async ({ page }) => {
  await open(page);
  const rows = page.getByTestId("sp-table").locator("tbody tr");
  await expect(rows).toHaveCount(8);
  const row = (hr: number) => page.getByTestId("sp-table").locator(`tr[data-star="hr-${hr}"]`);
  await expect(row(1713)).toContainText("Rigel");
  await expect(row(1713)).toContainText("847 ly");
  await expect(row(1713)).toContainText("593–1,483 ly");
  await expect(row(2061)).toContainText("548 ly");
  await expect(row(2004)).toContainText("at least 116 ly");
  await expect(row(1903)).toContainText("distance unknown");
  await expect(row(1713).locator("a")).toHaveAttribute("href", /\?pick=S:1713/);
});

test("Turn 90° turns it side-on: the distances lie side by side, the scale appears, and four turns come back to the Earth's view", async ({ page }) => {
  await open(page);
  await page.getByTestId("sp-turn").click();
  await expect.poll(() => across(page), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await expect(page.getByTestId("sp-note")).toContainText("Seen from the side");
  await expect.poll(async () => (await shown(page).allTextContents()).some((t) => /^\d[\d,]* ly$/.test(t.trim()))).toBe(true);
  await noOverlap(page, "Orion turned");
  for (let i = 0; i < 3; i += 1) await page.getByTestId("sp-turn").click();
  await expect.poll(() => across(page), { timeout: 10_000 }).toBeLessThan(0.05);
  await expect(page.getByTestId("sp-note")).toContainText("As seen from the Earth");
  // From the Earth brings it back
  await page.getByTestId("sp-turn").click();
  await expect.poll(() => across(page)).toBeGreaterThan(0.95);
  await page.getByTestId("sp-front").click();
  await expect.poll(() => across(page)).toBeLessThan(0.05);
});

test("a drag turns it, and the turn is kept in the address", async ({ page, isMobile }) => {
  test.skip(isMobile || (page.viewportSize()?.width ?? 1280) < 500, "a phone's drag is a finger's, and the gesture check drives it; a mouse in a phone-sized WebKit is not one");
  await open(page);
  // the view's middle can sit just below the window (it did by a pixel in a font with taller lines), and a pointer there touches nothing
  await page.locator("#sp-view").scrollIntoViewIfNeeded();
  const box = (await page.locator("#sp-view").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // a third of the view's width, so the pointer stays inside it on a phone's width too
  await page.mouse.move(box.x + box.width / 2 - box.width / 3, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => across(page)).toBeGreaterThan(0.5);
  await expect.poll(() => param(page, "yaw")).not.toBeNull();
  await drainGpu(page);
});

for (const abbreviation of ["Ori", "UMa", "Hya", "Cru"]) {
  test(`${abbreviation}: no label overlaps another or leaves the view, from the Earth and turned`, async ({ page }) => {
    await open(page, `?c=${abbreviation}`);
    const front = await noOverlap(page, `${abbreviation} front`);
    expect(front).toBeGreaterThan(2);
    await page.getByTestId("sp-turn").click();
    await expect.poll(() => across(page), { timeout: 10_000 }).toBeGreaterThan(0.95);
    await page.waitForTimeout(300);
    const turned = await noOverlap(page, `${abbreviation} turned`);
    expect(turned).toBeGreaterThan(2);
  });
}

test("the picker chooses another constellation: the heading, the table, the counts and the address follow", async ({ page }) => {
  await open(page);
  await page.getByTestId("picker-strip").locator("button").filter({ hasText: "Ursa Major" }).first().click();
  await expect(page.getByTestId("sp-heading")).toContainText("Ursa Major");
  await expect.poll(() => param(page, "c")).toBe("UMa");
  const figure = constellationIn3D("UMa");
  await expect(page.getByTestId("sp-table").locator("tbody tr")).toHaveCount(figure.stars.length);
  await expect(page.getByTestId("sp-key").locator('[data-quality="fair"]')).toContainText(String(figure.counts.fair));
  await expect(page.getByTestId("picker-strip").locator("button[aria-pressed='true']")).toHaveAttribute("data-abbr", "UMa");
  await expect(live(page)).toBeVisible();
});

test("a constellation page opens it in 3D", async ({ page }) => {
  await page.goto("/hoshi-stars/constellation.html?c=Cru");
  await page.getByRole("link", { name: "See it in 3D" }).click();
  await expect(live(page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sp-heading")).toContainText("Crux");
  expect(param(page, "c")).toBe("Cru");
});

test("seen from another star the Earth is a star called Sun, and the note says how far", async ({ page }) => {
  await open(page);
  await page.getByTestId("sp-from").selectOption("HR5459");
  await expect.poll(() => param(page, "from")).toBe("HR5459");
  await expect(page.getByTestId("sp-from-note")).toContainText("Alpha Centauri");
  await expect(page.getByTestId("sp-from-note")).toContainText("4.3 light-years");
  await expect(page.getByTestId("sp-note")).toContainText("As seen from Alpha Centauri");
  await expect(live(page)).toBeVisible();
  await page.getByTestId("sp-turn").click();
  await expect.poll(() => across(page), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await expect(page.locator("#sp-labels .sp-place").first()).toBeAttached();
  await page.getByTestId("sp-from").selectOption("");
  await expect.poll(() => param(page, "from")).toBeNull();
});

test("Proxima Centauri is offered as a viewpoint: the choice, the note, the address, a reload and the embed page", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("sp-from").locator("option[value=GCTP3278]")).toHaveText("Proxima Centauri");
  await page.getByTestId("sp-from").selectOption("GCTP3278");
  await expect.poll(() => param(page, "from")).toBe("GCTP3278");
  await expect(page.getByTestId("sp-note")).toContainText("As seen from Proxima Centauri");
  await expect(page.getByTestId("sp-from-note")).toContainText("4.2 light-years");
  await expect(live(page)).toBeVisible();
  await page.getByTestId("sp-turn").click();
  await expect.poll(() => across(page), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await expect(page.locator("#sp-labels .sp-place").first()).toBeAttached();
  // a link kept in the address opens from there, with the choice shown
  await open(page, "?c=Cas&from=GCTP3278");
  await expect(page.getByTestId("sp-from")).toHaveValue("GCTP3278");
  await expect(page.getByTestId("sp-note")).toContainText("As seen from Proxima Centauri");
  // the copied code reads the nearby entry
  await expect(page.getByTestId("embed-panel")).toBeAttached();
  await page.goto("/hoshi-stars/embed-3d.html?c=Cas&from=GCTP3278&lang=ja");
  await expect(page.locator("#sp-stage[data-state=live]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#sp-labels .sp-place").first()).toBeAttached();
});

test("Wide is theatre mode on the page: the view takes the page's column, the panel goes under it, the T key and the address agree, and no name is under the button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const normal = (await page.locator("#sp-stage").boundingBox())!;
  const main = (await page.locator("main").boundingBox())!;
  await expect(page.getByTestId("wide-toggle")).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.locator("html")).toHaveAttribute("data-wide", "on");
  await expect.poll(() => param(page, "wide")).toBe("on");
  await expect.poll(async () => (await page.locator("#sp-stage").boundingBox())!.width).toBeGreaterThan(normal.width + 150);
  const stage = (await page.locator("#sp-stage").boundingBox())!;
  const side = (await page.locator(".sp-side").boundingBox())!;
  expect((await page.locator("main").boundingBox())!.width, "the page keeps its width").toBeCloseTo(main.width, 0);
  expect(stage.height).toBeLessThanOrEqual(900 * 0.8 + 1);
  expect(side.y, "the panel is under the view").toBeGreaterThanOrEqual(stage.y + stage.height);
  expect(stage.width, "the view fills the column").toBeGreaterThan(main.width - 80);
  await expect.poll(async () => shown(page).count(), { timeout: 20_000 }).toBeGreaterThan(2);
  await page.waitForTimeout(400);
  await noOverlap(page, "wide");
  const button = (await page.getByTestId("wide-toggle").boundingBox())!;
  for (const label of (await layout(page)).labels) {
    const clear = label.x + label.w <= button.x || button.x + button.width <= label.x || label.y + label.h <= button.y || button.y + button.height <= label.y;
    expect(clear, `"${label.text}" is under the Wide button`).toBe(true);
  }
  await page.keyboard.press("t");
  await expect(page.locator("html")).not.toHaveAttribute("data-wide", "on");
  await expect.poll(() => param(page, "wide")).toBeNull();
  await expect.poll(async () => (await page.locator("#sp-stage").boundingBox())!.width).toBeLessThan(normal.width + 5);
  // a link with wide=on opens wide
  await open(page, "?wide=on");
  await expect(page.locator("html")).toHaveAttribute("data-wide", "on");
});

test("Japanese: the heading, the labels, the table and the buttons are in Japanese", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(page.getByTestId("sp-heading")).toContainText("立体の星座");
  await expect(page.getByTestId("sp-heading")).toContainText("オリオン");
  await expect(page.getByTestId("sp-turn")).toHaveText("90°回す");
  await expect(page.locator('.sp-label[data-star="hr-1903"]')).toContainText("距離は不明");
  await expect(page.locator('.sp-label[data-star="hr-2061"] .sp-n')).toHaveText("ベテルギウス");
  await expect(page.getByTestId("sp-table").locator('tr[data-star="hr-1713"]')).toContainText("847光年");
});

test("light and dark: the stage takes the device's look and the theme switch's, and the labels stay readable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await expect(page.getByTestId("sp-stage")).toHaveAttribute("data-look", "dark");
  const night = await page.locator("#sp-labels .sp-n").first().evaluate((el) => getComputedStyle(el).color);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await expect(page.getByTestId("sp-stage")).toHaveAttribute("data-look", "light");
  const day = await page.locator("#sp-labels .sp-n").first().evaluate((el) => getComputedStyle(el).color);
  expect(day).not.toBe(night);
  await noOverlap(page, "light");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(page.getByTestId("sp-stage")).toHaveAttribute("data-look", "dark");
});

test("all 88 constellations draw, each with the stars of its figure in the table and its counts", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "chromium-desk", "one run of the 88 is enough");
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await open(page);
  for (const c of constellations()) {
    await page.goto(`${PAGE}?c=${c.abbreviation}`);
    await expect(live(page)).toBeVisible({ timeout: 30_000 });
    const figure = constellationIn3D(c.abbreviation);
    await expect(page.getByTestId("sp-table").locator("tbody tr")).toHaveCount(figure.stars.length);
    for (const q of DISTANCE_QUALITIES) await expect(page.getByTestId("sp-key").locator(`[data-quality="${q}"]`)).toContainText(String(figure.counts[q]));
    await expect.poll(async () => shown(page).count(), { message: c.abbreviation }).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test("the embed page draws what its address says and turns on its button", async ({ page }) => {
  await page.goto("/hoshi-stars/embed-3d.html?c=UMa");
  await expect(page.locator("#sp-stage[data-state=live]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sp-fallback"), "a live view says nothing about a browser that cannot draw it").toBeHidden();
  await expect.poll(async () => page.locator("#sp-labels .sp-label:not([hidden])").count()).toBeGreaterThan(2);
  await expect(page.locator("#sp-view")).toHaveAttribute("aria-label", /Ursa Major/);
  await page.getByTestId("turn").click();
  await expect.poll(async () => Number(await page.locator("#sp-stage").getAttribute("data-across")), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await page.getByTestId("front").click();
  await expect.poll(async () => Number(await page.locator("#sp-stage").getAttribute("data-across")), { timeout: 10_000 }).toBeLessThan(0.05);
});

test("the embed page starts turned when its address says so, falls back to Orion for a name it does not know, and speaks Japanese", async ({ page }) => {
  await page.goto("/hoshi-stars/embed-3d.html?c=Nowhere&yaw=-90&lang=ja&from=HR5459");
  await expect(page.locator("#sp-stage[data-state=live]")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => Number(await page.locator("#sp-stage").getAttribute("data-across")), { timeout: 10_000 }).toBeGreaterThan(0.95);
  await expect(page.locator("#sp-view")).toHaveAttribute("aria-label", /オリオン/);
  await expect(page.getByTestId("turn")).toHaveText("90°回す");
});

test("the code to copy: the iframe names the 3D embed page, and the module draws the figure from the side", async ({ page }) => {
  await open(page, "?c=CMa");
  const panel = page.getByTestId("embed-panel");
  await panel.getByRole("tab", { name: /iframe/i }).click();
  await expect(panel.locator("pre, textarea, code").first()).toContainText("embed-3d.html?c=CMa");
  await panel.getByRole("tab", { name: /module/i }).click();
  await expect(panel.locator("pre, textarea, code").first()).toContainText("constellationIn3D");
});

/** Zoom to `zoom` with the star in the middle of the view: where the star is at Fit, times the zoom, is where the pan must undo. */
async function zoomTo(page: Page, key: string, zoom: number): Promise<void> {
  await page.evaluate(
    ({ key, zoom }) => {
      const stage = document.getElementById("sp-stage")!.getBoundingClientRect();
      const at = (Reflect.get(document.getElementById("sp-view")!, "starAt") as (key: string) => { x: number; y: number })(key);
      const dx = at.x - stage.width / 2;
      const dy = at.y - stage.height / 2;
      const controls = document.getElementById("sp-controls") as unknown as { controller: { set(to: Record<string, number>, snap: boolean, reason: string): void } };
      controls.controller.set({ zoom, panX: -dx * zoom, panY: -dy * zoom }, true, "test");
    },
    { key, zoom },
  );
}

/** Back to Fit: zoom 1 with no pan. */
async function zoomOut(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controls = document.getElementById("sp-controls") as unknown as { controller: { set(to: Record<string, number>, snap: boolean, reason: string): void } };
    controls.controller.set({ zoom: 1, panX: 0, panY: 0 }, true, "test");
  });
}

test("zoomed close to Betelgeuse it is drawn with the star look, and zooming out lets it go", async ({ page }) => {
  await open(page, "?spin=off");
  const view = page.locator("#sp-view");
  await expect(view).not.toHaveAttribute("data-close", /.+/);
  await zoomTo(page, "s:hr-2061", 10);
  await expect(view).toHaveAttribute("data-close", "s:hr-2061", { timeout: 20_000 });
  // it is on the screen, drawn by the one shared renderer
  const draws = await view.evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);
  expect(draws).toBeGreaterThan(0);
  // the suite asks for reduced motion: the look has no surface animation, so once drawn it rests
  await expect.poll(() => view.evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws), { timeout: 10_000 }).toBe(await view.evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws));
  await zoomOut(page);
  await expect(view).not.toHaveAttribute("data-close", /.+/, { timeout: 20_000 });
  await drainGpu(page);
});
