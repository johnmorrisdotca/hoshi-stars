// The star in 3D: drawn from its numbers on the page's one renderer, turning, with Pause, the words that say what is measured and what is generic, the Sun at the same scale, the choice kept in the address, the embed page, and
// the flat portrait where 3D cannot be shown. How much it asks of the machine is in freeze.demo.ts.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(page.getByTestId("star-profile")).toBeVisible();
}
const turnOf = (page: Page) => page.getByTestId("star-3d").evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);

test.describe("turning", () => {
  test.use({ reducedMotion: "no-preference" });

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
    const before = await turnOf(page);
    await expect.poll(() => turnOf(page), { timeout: 20_000 }).toBeGreaterThan(before + 2);
    await expect.poll(() => param(page, "pview")).toBe("3d");
    await page.reload();
    await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
    await page.getByTestId("star-view-portrait").click();
    await expect(page.getByTestId("star-portrait")).toBeVisible();
    await expect.poll(() => param(page, "pview")).toBeNull();
  });

  test("Pause holds the star still and Play starts it again", async ({ page }) => {
    await open(page, "?pick=S:2061&pview=3d");
    await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
    const pause = page.getByTestId("star-3d-pause");
    await expect(pause).toHaveText("Pause");
    await pause.click();
    await expect(pause).toHaveText("Play");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(600);
    const held = await turnOf(page);
    await page.waitForTimeout(1500);
    expect(await turnOf(page)).toBe(held);
    await pause.click();
    await expect.poll(() => turnOf(page), { timeout: 20_000 }).toBeGreaterThan(held + 2);
  });
});

test("reduced motion opens the star still, with Play ready", async ({ page }) => {
  await open(page, "?pick=S:2061&pview=3d");
  await expect(page.getByTestId("star-3d")).toHaveAttribute("data-live", "true", { timeout: 60_000 });
  await expect(page.getByTestId("star-3d-pause")).toHaveText("Play");
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
  await expect(page.getByTestId("star-3d-pause")).toBeVisible();
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
