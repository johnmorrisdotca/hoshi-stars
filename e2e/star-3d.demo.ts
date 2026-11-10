// The star in 3D: drawn from its numbers on the page's one renderer, turning by the family's view controls (Auto-turn is its spin; a drag turns it), with a guide, the words that say what is measured and what is generic, the Sun at the same scale, the choice kept in the address, the embed page, and
// the flat portrait where 3D cannot be shown. How much it asks of the machine is in freeze.demo.ts.
import { checkGestures, drainGpu } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(page.getByTestId("star-profile")).toBeVisible();
}
/** The view controls' Auto-turn, which is the star's spin. */
const play = (page: Page) => page.getByTestId("star-3d-controls").locator('[data-b="play"]');
const turnOf = (page: Page) => page.getByTestId("star-3d").evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);

test.describe("turning", () => {
  test.use({ reducedMotion: "no-preference" });

  test("it opens visibly turning: with nothing touched the picture changes within two seconds, for a smooth star and a star with cells", async ({ page }) => {
    for (const hr of [4554, 2061]) {
      await open(page, `?pick=S:${hr}&pview=3d`);
      const stage = page.getByTestId("star-3d");
      await expect(stage).toHaveAttribute("data-live", "true", { timeout: 60_000 });
      await expect(play(page)).toHaveAttribute("aria-pressed", "true");
      const first = await stage.screenshot();
      const began = Date.now();
      await expect.poll(async () => !(await stage.screenshot()).equals(first), { timeout: 2000, intervals: [250] }).toBe(true);
      expect(Date.now() - began).toBeLessThanOrEqual(2500);
    }
  });

  test("3D shows the picked star live and turning, says the cells are generic, puts the Sun beside it to scale, and keeps the choice in the address", async ({ page }) => {
    await open(page, "?pick=S:2061");
    await page.getByTestId("star-view-3d").click();
    const stage = page.getByTestId("star-3d");
    await expect(stage).toHaveAttribute("data-live", "true", { timeout: 60_000 });
    await expect(stage).toHaveAttribute("aria-label", "Betelgeuse in 3D, drawn from its numbers");
    await expect(page.getByTestId("star-3d-caption")).toHaveText("Drawn in 3D from its numbers. The cells are a generic look, not this star's surface.");
    await expect(page.getByTestId("star-3d-scale")).toContainText("The dot is the Sun at the same scale.");
    await expect(page.getByTestId("star-3d-scale")).toContainText(" to ");
    await expect(page.getByTestId("star-3d-sun")).toHaveCount(1);
    // the star only turns while it is on the screen: bring it there, whatever the cards above the map weigh
    await stage.scrollIntoViewIfNeeded();
    const before = await turnOf(page);
    await expect.poll(() => turnOf(page), { timeout: 20_000 }).toBeGreaterThan(before + 2);
    await expect.poll(() => param(page, "pview")).toBe("3d");
    await page.reload();
    await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
    await page.getByTestId("star-view-portrait").click();
    await expect(page.getByTestId("star-portrait")).toBeVisible();
    await expect.poll(() => param(page, "pview")).toBeNull();
  });

  test("the view controls' Auto-turn is the spin: it opens turning, stops it and starts it again, and a drag turns it by hand", async ({ page }) => {
    await open(page, "?pick=S:2061&pview=3d");
    await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
    const button = play(page);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(600);
    const held = await turnOf(page);
    await page.waitForTimeout(1500);
    expect(await turnOf(page)).toBe(held);
    const yaw = () => page.getByTestId("star-3d-controls").evaluate((el) => (el as unknown as { state: { yaw: number } }).state.yaw);
    const before = await yaw();
    const box = (await page.getByTestId("star-3d").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(yaw).not.toBe(before);
    await expect.poll(() => turnOf(page)).toBeGreaterThan(held);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const after = await turnOf(page);
    await expect.poll(() => turnOf(page), { timeout: 20_000 }).toBeGreaterThan(after + 2);
  });
});

test("reduced motion opens the star still, with Play ready", async ({ page }) => {
  await open(page, "?pick=S:2061&pview=3d");
  await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
  await expect(play(page)).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(800);
  const held = await turnOf(page);
  await page.waitForTimeout(1500);
  expect(await turnOf(page)).toBe(held);
});

test("Altair says its flattened shape and tilt are measured; Sirius says its surface is not shown and is too small for the Sun's dot", async ({ page }) => {
  await open(page, "?pick=S:7557&pview=3d");
  await expect(page.getByTestId("star-3d-caption")).toHaveText("Drawn in 3D from its numbers. Its flattened shape and the tilt of its axis are measured.");
  await open(page, "?pick=S:2491&pview=3d");
  await expect(page.getByTestId("star-3d-caption")).toHaveText("Drawn in 3D from its numbers. Its surface is not shown.");
  await expect(page.getByTestId("star-3d-sun")).toHaveCount(0);
  await expect(page.getByTestId("star-3d-scale")).toContainText("The star's radius is");
});

test("the words are in Japanese on the Japanese page", async ({ page }) => {
  await open(page, "?pick=S:2061&pview=3d&lang=ja");
  await expect(page.getByTestId("star-view-3d")).toHaveText("立体");
  await expect(page.getByTestId("star-3d-caption")).toContainText("この星の本当の表面ではありません");
  await expect(page.getByTestId("star-3d-scale")).toContainText("太陽の");
});

test("the embed page draws the star in 3D from its address", async ({ page }) => {
  await page.goto(`${HOME}star.html?star=7557&view=3d`);
  await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
  await expect(page.getByTestId("star-3d-caption")).toContainText("measured");
  await expect(play(page)).toBeVisible();
});

test("where 3D cannot be shown, the flat portrait stands in and says so", async ({ page }) => {
  await page.addInitScript(() => {
    const plain = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind.startsWith("webgl") ? null : (plain as (...args: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof plain;
  });
  await open(page, "?pick=S:2061&pview=3d");
  const still = page.getByTestId("star-3d-still");
  await expect(still.locator("svg")).toHaveAttribute("aria-label", "Betelgeuse, drawn from its numbers", { timeout: 60_000 });
  await expect(still).toContainText("3D cannot be shown here, so this is the flat portrait.");
});

test("a smooth star shows a turning guide, says how fast it spins, and the guide can be turned off", async ({ page }) => {
  await open(page, "?pick=S:4554&pview=3d");
  const stage = page.getByTestId("star-3d");
  await expect(stage).toHaveAttribute("data-live", "true", { timeout: 60_000 });
  const guide = page.getByTestId("star-3d-guide");
  await expect(guide).toHaveText("Grid and axis");
  await expect(guide).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveAttribute("data-guide", "true");
  await expect(page.getByTestId("star-3d-guide-note")).toHaveText("The grid and the axis are a guide that turns with the star; they are not on the star.");
  await expect(page.getByTestId("star-3d-spin")).toHaveText("Its equator moves at least 168 km/s (v sin i, Bright Star Catalogue). Here it turns once in 40 seconds.");
  await guide.click();
  await expect(guide).toHaveAttribute("aria-pressed", "false");
  await expect(stage).toHaveAttribute("data-guide", "false");
  await expect(page.getByTestId("star-3d-guide-note")).toBeHidden();
});

test("Vega says its measured period and how much faster it is shown; Betelgeuse has cells, no guide at first and no measured speed", async ({ page }) => {
  await open(page, "?pick=S:7001&pview=3d");
  await expect(page.getByTestId("star-3d-spin")).toHaveText("It turns once in 0.71 days; source: Monnier et al. 2012, ApJ 761, L3 (CHARA/MIRC). Here it turns 1,530 times faster.");
  await open(page, "?pick=S:2061&pview=3d");
  await expect(page.getByTestId("star-3d-guide")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("star-3d-guide-note")).toBeHidden();
  await expect(page.getByTestId("star-3d-spin")).toHaveText("No spin speed is measured for it. Here it turns once in 40 seconds.");
});

test("the guide and the spin are in Japanese on the Japanese page", async ({ page }) => {
  await open(page, "?pick=S:4554&pview=3d&lang=ja");
  await expect(page.getByTestId("star-3d-guide")).toHaveText("経線・緯線と軸");
  await expect(page.getByTestId("star-3d-spin")).toHaveText("赤道の速さは秒速168 km以上です（v sin i、輝星星表）。この絵では40秒で1回転します。");
});

test("the family's gestures all answer on the star in 3D", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "the check drives a mouse and two pointers in Chromium");
  test.setTimeout(180_000);
  await open(page, "?pick=S:4554&pview=3d");
  await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
  // still, so the picture moves only by the hands (this project opens it still, with reduced motion)
  await expect(play(page)).toHaveAttribute("aria-pressed", "false");
  const report = await checkGestures(page, '[data-testid="star-3d"]', { controls: '[data-testid="star-3d-controls"]' });
  expect(report.filter((r) => r.result === "lacks")).toEqual([]);
  expect(report.length).toBeGreaterThan(10);
  await drainGpu(page);
});
