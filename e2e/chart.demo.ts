// The <hoshi-chart> element on its own: it draws, its attributes change the chart, it carries its own hands (and `controls="none"` takes them off), it says where it was moved and what was tapped,
// and the plain wheel at the opening view is left to the page. The embed page is the bare element; the demo page has it inside a long page.
import { expect, test, type Page } from "@playwright/test";

const EMBED = "/hoshi-stars/embed.html";
const NEAR = "#5fe0c4";

interface Chart {
  view: { projection: string; ra: number; dec: number; zoom: number };
  size: { width: number; height: number };
  hits: Array<{ x: number; y: number; kind: string; key: string }>;
}
const view = (page: Page, selector = "#frame"): Promise<Chart["view"]> => page.locator(selector).evaluate((el) => (el as unknown as Chart).view);
const inShadow = (page: Page, selector: string, inside = "#frame"): Promise<number> => page.locator(inside).evaluate((el, css) => el.shadowRoot!.querySelectorAll(css).length, selector);
const svg = (page: Page, inside = "#frame"): Promise<string> => page.locator(inside).evaluate((el) => el.shadowRoot!.querySelector("svg")!.outerHTML);
const set = (page: Page, name: string, value: string | null): Promise<void> => page.locator("#frame").evaluate((el, [n, v]) => (v === null ? el.removeAttribute(n!) : el.setAttribute(n!, v)), [name, value] as const);
const drawn = (page: Page): Promise<void> => page.waitForFunction(() => document.querySelector("#frame")?.getAttribute("data-state") === "drawn").then(() => undefined);
const settle = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

async function open(page: Page, query = ""): Promise<{ x: number; y: number }> {
  await page.goto(`${EMBED}${query}`);
  await drawn(page);
  await expect.poll(() => inShadow(page, "svg circle")).toBeGreaterThan(30);
  // The hands arrive a moment after the first drawing (their module is read when they are on).
  await expect.poll(() => page.locator("#frame").getAttribute("tabindex")).toBe("0");
  await page.waitForFunction(() => document.querySelector("#frame")!.getAttribute("style")?.includes("touch-action") ?? false);
  const box = (await page.locator("#frame").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("the element", () => {
  test("it draws a chart of the sky with its label, a size and the stars in its own shadow", async ({ page }) => {
    await open(page);
    const frame = page.locator("#frame");
    await expect(frame).toHaveAttribute("role", "img");
    await expect(frame).toHaveAttribute("aria-label", "A chart of the sky");
    expect(await inShadow(page, "svg")).toBe(1);
    expect(await inShadow(page, "svg path[stroke-opacity]")).toBeGreaterThan(0);
    expect(await inShadow(page, '[data-layer="milky"]')).toBe(1);
    const { width, height } = await frame.evaluate((el) => (el as unknown as Chart).size);
    expect(width).toBeGreaterThan(300);
    expect(height).toBeGreaterThan(200);
    expect(await svg(page)).toContain(`viewBox="0 0 ${width} ${height}"`);
    const hits = await frame.evaluate((el) => (el as unknown as Chart).hits.length);
    expect(hits).toBeGreaterThan(100);
  });

  test("the attributes change the chart", async ({ page }) => {
    await open(page);
    const stars = () => inShadow(page, "svg circle[r]");
    const before = await stars();

    await set(page, "magnitude", "3");
    await expect.poll(stars).toBeLessThan(before);
    await set(page, "magnitude", "5");
    await expect.poll(stars).toBe(before);

    await set(page, "layers", "none");
    await expect.poll(() => inShadow(page, "svg path[stroke-opacity]")).toBe(0);
    expect(await inShadow(page, '[data-layer="milky"]')).toBe(0);
    await set(page, "layers", "milky-way,grid");
    await expect.poll(() => inShadow(page, '[data-layer="milky"]')).toBe(1);
    await set(page, "layers", "lines,names,boundaries");
    await expect.poll(() => inShadow(page, 'svg path[stroke="#46578c"]')).toBe(1);

    const flat = await svg(page);
    await set(page, "projection", "hammer");
    await set(page, "zoom", "1");
    await expect.poll(async () => (await svg(page)) !== flat).toBe(true);
    expect((await view(page)).projection).toBe("hammer");
    expect((await view(page)).zoom).toBe(1);

    await set(page, "ra", "200");
    await set(page, "dec", "-30");
    await expect.poll(async () => (await view(page)).ra).toBe(200);
    expect((await view(page)).dec).toBe(-30);

    await set(page, "lang", "ja");
    await expect.poll(async () => await svg(page)).toContain("座</text>");
    await expect(page.locator("#frame")).toHaveAttribute("aria-label", "星空の図");
    await set(page, "lang", "en");

    await set(page, "theme", "light");
    await expect.poll(async () => await svg(page)).toContain("#f8f6ef");
    await set(page, "theme", null);
    await expect.poll(async () => await svg(page)).toContain("#0b1020");

    await set(page, "constellation", "Ori");
    await set(page, "layers", "lines");
    await expect.poll(() => inShadow(page, 'svg path[stroke="#ffd86b"]')).toBeGreaterThan(0);
    await set(page, "ra", "101");
    await set(page, "dec", "-16");
    await set(page, "constellation", null);
    await set(page, "zoom", "1");
    await set(page, "near", "S:2491");
    await expect.poll(() => inShadow(page, `svg circle[stroke="${NEAR}"]`)).toBeGreaterThanOrEqual(5);
    await set(page, "by", "space");
    await expect.poll(() => inShadow(page, `svg circle[stroke="${NEAR}"]`)).toBeGreaterThanOrEqual(5);
  });

  test("an address with no zoom opens on Orion and keeps the opening view as the box changes", async ({ page }) => {
    await open(page);
    const wide = (await view(page)).zoom;
    await page.setViewportSize({ width: 420, height: 700 });
    await expect.poll(async () => (await view(page)).zoom).not.toBe(wide);
    await set(page, "zoom", "7");
    await page.setViewportSize({ width: 900, height: 700 });
    await settle(page);
    expect((await view(page)).zoom).toBe(7);
  });

  test("the zoom stays within 0.1 and 500, whatever the attribute says", async ({ page }) => {
    await open(page);
    await set(page, "zoom", "100000");
    await expect.poll(async () => (await view(page)).zoom).toBe(500);
    await set(page, "zoom", "0.0001");
    await expect.poll(async () => (await view(page)).zoom).toBe(0.1);
    expect(await inShadow(page, "svg circle")).toBeGreaterThan(30);
  });
});

test.describe("the hands", () => {
  test.beforeEach(({ isMobile, browserName }) => {
    test.skip(isMobile && browserName !== "chromium", "the pointer is a mouse here");
  });

  test("a drag turns the sky and says so, once with `final` when the hand lets go", async ({ page, isMobile }) => {
    test.skip(isMobile, "a drag by finger is in zoom.demo.ts");
    const at = await open(page);
    await page.locator("#frame").evaluate((el) => {
      (window as unknown as { moves: Array<{ final: boolean; reason: string }> }).moves = [];
      el.addEventListener("hoshi-viewchange", (event) => (window as unknown as { moves: Array<{ final: boolean; reason: string }> }).moves.push((event as CustomEvent).detail));
    });
    const before = await view(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 160, at.y + 30, { steps: 6 });
    await page.mouse.up();
    const after = await view(page);
    expect(after.ra).toBeGreaterThan(before.ra);
    expect(after.zoom).toBe(before.zoom);
    const moves = await page.evaluate(() => (window as unknown as { moves: Array<{ final: boolean; reason: string }> }).moves);
    expect(moves.length).toBeGreaterThan(1);
    expect(moves.every((move) => move.reason === "hands")).toBe(true);
    expect(moves.at(-1)!.final).toBe(true);
  });

  test("Ctrl and the wheel zoom about the pointer, and the keys and the buttons work", async ({ page, isMobile }) => {
    test.skip(isMobile, "a wheel and keys are the desk's");
    const at = await open(page);
    await page.mouse.move(at.x, at.y);
    const before = (await view(page)).zoom;
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(before);
    const zoomed = (await view(page)).zoom;
    await page.getByTestId("zoom-out").click();
    await expect.poll(async () => (await view(page)).zoom).toBeLessThan(zoomed);
    await page.locator("#frame").focus();
    await page.keyboard.press("0");
    await expect.poll(async () => (await view(page)).zoom).toBeCloseTo(before, 1);
  });

  test("the plain wheel at the opening view is left to the page", async ({ page, isMobile }) => {
    test.skip(isMobile, "a wheel is the desk's");
    await page.goto("/hoshi-stars/");
    await expect(page.locator("#chart circle").first()).toBeVisible();
    await expect.poll(() => page.locator("#chart").getAttribute("tabindex")).toBe("0");
    await page.evaluate(() => {
      (window as unknown as { wheels: boolean[] }).wheels = [];
      addEventListener("wheel", (event) => (window as unknown as { wheels: boolean[] }).wheels.push(event.defaultPrevented));
    });
    const before = await view(page, "#chart");
    const box = (await page.locator("#chart").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as unknown as { wheels: boolean[] }).wheels)).toEqual([false]);
    expect((await view(page, "#chart")).zoom).toBe(before.zoom);
  });

  test('controls="none" takes the hands off, and on again puts them back', async ({ page, isMobile }) => {
    test.skip(isMobile, "the pointer is a mouse here");
    const at = await open(page, "?zoom=2");
    await set(page, "controls", "none");
    await settle(page);
    const before = await view(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 160, at.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await settle(page);
    expect(await view(page)).toEqual(before);
    await set(page, "controls", null);
    await expect.poll(() => page.locator("#frame").evaluate((el) => (el as HTMLElement).style.touchAction)).not.toBe("");
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 160, at.y, { steps: 6 });
    await page.mouse.up();
    expect((await view(page)).ra).toBeGreaterThan(before.ra);
  });

  test("a tap on a star says which, and the view set from outside sends no event", async ({ page, isMobile }) => {
    test.skip(isMobile, "a click is the desk's");
    await open(page, "?proj=stereographic&ra=101&dec=-16&zoom=3&mag=5");
    await page.locator("#frame").evaluate((el) => {
      const seen: Array<{ key: string | null }> = [];
      (window as unknown as { picks: typeof seen; changes: number }).picks = seen;
      (window as unknown as { changes: number }).changes = 0;
      el.addEventListener("hoshi-pick", (event) => seen.push((event as CustomEvent).detail));
      el.addEventListener("hoshi-viewchange", () => ((window as unknown as { changes: number }).changes += 1));
    });
    const sirius = await page.locator("#frame").evaluate((el) => (el as unknown as Chart).hits.find((hit) => hit.kind === "star" && hit.key === "2491"));
    expect(sirius).toBeDefined();
    const box = (await page.locator("#frame").boundingBox())!;
    await page.mouse.click(box.x + sirius!.x, box.y + sirius!.y);
    await expect.poll(() => page.evaluate(() => (window as unknown as { picks: Array<{ key: string }> }).picks.map((p) => p.key))).toEqual(["S:2491"]);
    await page.evaluate(() => ((window as unknown as { changes: number }).changes = 0));
    await page.locator("#frame").evaluate((el) => {
      (el as unknown as Chart).view = { projection: "hammer", ra: 10, dec: 20, zoom: 1 };
    });
    await expect.poll(async () => (await view(page)).projection).toBe("hammer");
    await settle(page);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(0);
  });
});
