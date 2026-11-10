// The sky chart's hands, on the demo and on the embed page, at a desk's width and a phone's: a drag turns the sky, two fingers pinch, the plain wheel scrolls the page at the opening view,
// Ctrl and the wheel zoom, once zoomed in the wheel moves the sky, the keys work, and the zoom stops at 0.1 and 8000 with the sky still drawn.
import { expect, test, type CDPSession, type Page } from "@playwright/test";

const PAGES = [
  { name: "demo", path: "/hoshi-stars/", target: "#chart", box: "#chart-box" },
  { name: "embed", path: "/hoshi-stars/embed.html", target: "#frame", box: "#frame" },
] as const;

const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const sessions = new WeakMap<Page, CDPSession>();
const number = (page: Page, name: string): number => Number(param(page, name));

for (const where of PAGES) {
  test.describe(where.name, () => {
    async function open(page: Page, query = ""): Promise<{ x: number; y: number }> {
      await page.goto(`${where.path}${query}`);
      await expect(page.locator(`${where.target} circle`).first()).toBeVisible();
      await page.evaluate(() => {
        (window as unknown as { wheels: boolean[] }).wheels = [];
        addEventListener("wheel", (event) => (window as unknown as { wheels: boolean[] }).wheels.push(event.defaultPrevented));
      });
      let box = (await page.locator(where.box).boundingBox())!;
      if (box.y + Math.min(box.height / 2, 300) > page.viewportSize()!.height - 20) {
        await page.locator(where.box).scrollIntoViewIfNeeded();
        box = (await page.locator(where.box).boundingBox())!;
      }
      return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 300) };
    }
    const wheels = (page: Page): Promise<boolean[]> => page.evaluate(() => (window as unknown as { wheels: boolean[] }).wheels);
    const circles = (page: Page): Promise<number> => page.locator(`${where.target} circle[r]`).count();
    const touch = async (page: Page, type: "touchStart" | "touchMove" | "touchEnd", points: Array<{ x: number; y: number }>): Promise<void> => {
      let client = sessions.get(page);
      if (client === undefined) sessions.set(page, (client = await page.context().newCDPSession(page)));
      await client.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ ...p, id })) });
    };

    test("a drag turns the sky and the address follows", async ({ page, isMobile, browserName }) => {
      test.skip(isMobile && browserName !== "chromium", "touch points are Chromium's to send");
      const at = await open(page);
      if (isMobile) {
        // A finger drags sideways at the opening view; the page keeps the up and down for scrolling.
        await touch(page, "touchStart", [{ x: at.x, y: at.y }]);
        for (const dx of [20, 60, 100, 140]) await touch(page, "touchMove", [{ x: at.x + dx, y: at.y }]);
        await touch(page, "touchEnd", []);
      } else {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x + 150, at.y + 40, { steps: 6 });
        await page.mouse.up();
      }
      await expect.poll(() => param(page, "ra")).not.toBeNull();
      expect(number(page, "ra")).toBeGreaterThan(84);
    });

    test("two fingers pinch the sky in and out", async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "two touch points are Chromium's to send");
      const at = await open(page);
      const pair = (a: number, b: number) => [{ x: at.x - a, y: at.y }, { x: at.x + b, y: at.y }];
      await touch(page, "touchStart", pair(20, 20));
      await touch(page, "touchMove", pair(40, 40));
      await touch(page, "touchMove", pair(80, 80));
      await touch(page, "touchEnd", []);
      await expect.poll(() => number(page, "zoom")).toBeGreaterThan(5);
      const zoomed = number(page, "zoom");
      await touch(page, "touchStart", pair(80, 80));
      await touch(page, "touchMove", pair(40, 40));
      await touch(page, "touchMove", pair(20, 20));
      await touch(page, "touchEnd", []);
      await expect.poll(() => number(page, "zoom")).toBeLessThan(zoomed);
    });

    test("the plain wheel at the opening view scrolls the page and leaves the sky alone", async ({ page, isMobile }) => {
      test.skip(isMobile, "a phone has no wheel");
      const at = await open(page);
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, 240);
      await expect.poll(async () => (await wheels(page)).length).toBeGreaterThan(0);
      expect(await wheels(page)).not.toContain(true);
      expect(param(page, "zoom")).toBeNull();
      if (where.name === "demo") await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    });

    test("Ctrl and the wheel zoom about the pointer, and the page keeps still", async ({ page, isMobile }) => {
      test.skip(isMobile || page.viewportSize()!.width < 600, "a phone has no wheel");
      const at = await open(page);
      // open() scrolls the map into view when it starts low on the page; the wheel must not scroll it from there
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(at.x, at.y);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -400);
      await page.keyboard.up("Control");
      await expect.poll(() => number(page, "zoom")).toBeGreaterThan(3);
      expect(await wheels(page)).toContain(true);
      expect(await page.evaluate(() => scrollY)).toBe(before);
    });

    test("zoomed in, the wheel moves the sky", async ({ page, isMobile }) => {
      test.skip(isMobile, "a phone has no wheel");
      const at = await open(page, "?zoom=8");
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, 200);
      await expect.poll(() => param(page, "dec")).not.toBeNull();
      expect(number(page, "dec")).not.toBe(0);
      expect(await wheels(page)).toContain(true);
      expect(number(page, "zoom")).toBe(8);
    });

    test("the keys zoom, move and go home", async ({ page }) => {
      await open(page);
      await page.locator(where.target).focus();
      await page.keyboard.press("+");
      await expect.poll(() => number(page, "zoom")).toBeGreaterThan(1);
      const zoom = number(page, "zoom");
      await page.keyboard.press("-");
      await page.keyboard.press("-");
      await expect.poll(() => number(page, "zoom")).toBeLessThan(zoom);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => number(page, "ra")).toBeLessThan(84);
      await page.keyboard.press("ArrowUp");
      await expect.poll(() => number(page, "dec")).toBeGreaterThan(0);
      await page.keyboard.press("0");
      // The demo leaves what is the opening view out of its address; the embed page writes it.
      await expect.poll(() => Number(param(page, "ra") ?? 84)).toBeCloseTo(84, 1);
      await expect.poll(() => Number(param(page, "dec") ?? 0)).toBeCloseTo(0, 1);
    });

    test("the zoom stops at 0.1 and at 8000, and the sky draws at both ends", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await open(page);
      for (let i = 0; i < 12; i += 1) await page.getByTestId("zoom-out").click();
      await expect.poll(() => number(page, "zoom")).toBe(0.1);
      expect(await circles(page)).toBeGreaterThan(500);
      // Mizar and Alcor, 12 arc-minutes apart, are both on the chart and well apart at the top of the old range.
      await open(page, "?ra=200.98&dec=54.92&zoom=400");
      expect(await circles(page)).toBeGreaterThanOrEqual(2);
      const dots = await page.locator(`${where.target} circle[r]`).evaluateAll((all) => all.map((c) => ({ x: Number(c.getAttribute("cx")), y: Number(c.getAttribute("cy")) })));
      const apart = Math.max(...dots.flatMap((a) => dots.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
      expect(apart).toBeGreaterThan(60);
      // and the top of the range is 16 times further in, with no picture there to stop it sooner
      await open(page, "?ra=200.98&dec=54.92&zoom=6000");
      for (let i = 0; i < 3; i += 1) await page.getByTestId("zoom-in").click();
      await expect.poll(() => number(page, "zoom")).toBe(8000);
      await page.getByTestId("zoom-in").click();
      await page.waitForTimeout(300);
      expect(number(page, "zoom")).toBe(8000);
      // Mizar is in the middle of a view 3 arc-minutes across
      expect(await circles(page)).toBeGreaterThanOrEqual(1);
      expect(errors).toEqual([]);
    });
  });
}
