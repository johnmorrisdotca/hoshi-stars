// The constellation in 3D opens turning, on its page and in its embed (John's rule, MODULES-817): with nothing touched the picture changes within two seconds of its first frame. A reader
// who prefers reduced motion gets it still with Play ready, a link with spin=off holds it, and on the page a reader's Pause is kept in the address.
import { expect, test, type Locator, type Page } from "@playwright/test";

const live = (page: Page) => page.locator("#sp-stage[data-state=live]");

/** The renderer's draw count, which the view keeps on its host (#sp-view). */
const draws = (page: Page) => page.locator("#sp-view").evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);

/**
 * With nothing touched it draws again within two seconds of its first frame, and the picture is not the same one. The two seconds start from the first drawn frame: on a slow
 * runner drawing in software the first frame alone can take longer than that (the star's test learned this on CI).
 */
async function turnsUntouched(stage: Locator): Promise<void> {
  const page = stage.page();
  await expect.poll(() => draws(page), { timeout: 30_000 }).toBeGreaterThan(0);
  const first = await stage.screenshot();
  const drawn = await draws(page);
  await expect.poll(() => draws(page), { timeout: 2000, intervals: [100] }).toBeGreaterThan(drawn);
  await expect.poll(async () => !(await stage.screenshot()).equals(first), { timeout: 10_000 }).toBe(true);
}

/**
 * Once the view has eased into its last pose it draws nothing more, and the picture stays the same for a second and a half. The easing is a few frames, which on a slow runner drawing
 * in software can take longer than a second and a half (WebKit on CI did), so the wait is for the draw count to stop rising, not a fixed time.
 */
async function holdsStill(stage: Locator): Promise<void> {
  const page = stage.page();
  let before = -1;
  await expect
    .poll(
      async () => {
        const now = await draws(page);
        const same = now === before;
        before = now;
        return same;
      },
      { timeout: 30_000, intervals: [700] },
    )
    .toBe(true);
  const drawn = await draws(page);
  const first = await stage.screenshot();
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(drawn);
  expect((await stage.screenshot()).equals(first)).toBe(true);
}

test.describe("normal motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the constellation page opens turning; Pause holds it and is kept in the address; Play takes spin=off out again", async ({ page }) => {
    await page.goto("/hoshi-stars/constellation-3d.html?c=Ori");
    await expect(live(page)).toBeVisible({ timeout: 60_000 });
    const play = page.getByTestId("sp-controls").locator('[data-b="play"]');
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await turnsUntouched(page.locator("#sp-stage"));
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => new URL(page.url()).searchParams.get("spin")).toBe("off");
    await holdsStill(page.locator("#sp-stage"));
    await page.reload();
    await expect(live(page)).toBeVisible({ timeout: 60_000 });
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await play.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("spin")).toBeNull();
  });

  test("the embed opens turning, its Pause holds it, and spin=off in its address holds it from the start", async ({ page }) => {
    await page.goto("/hoshi-stars/embed-3d.html?c=Ori");
    await expect(live(page)).toBeVisible({ timeout: 60_000 });
    const spin = page.getByTestId("spin");
    await expect(spin).toHaveText("Pause");
    await expect(spin).toHaveAttribute("aria-pressed", "true");
    await turnsUntouched(page.locator("#sp-stage"));
    await spin.click();
    await expect(spin).toHaveText("Play");
    await holdsStill(page.locator("#sp-stage"));
    await page.goto("/hoshi-stars/embed-3d.html?c=Ori&spin=off&lang=ja");
    await expect(live(page)).toBeVisible({ timeout: 60_000 });
    await expect(spin).toHaveText("動かす");
    await holdsStill(page.locator("#sp-stage"));
  });
});

test("with reduced motion the page and the embed open still, with Play ready", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/hoshi-stars/constellation-3d.html?c=Ori");
  await expect(live(page)).toBeVisible({ timeout: 60_000 });
  const play = page.getByTestId("sp-controls").locator('[data-b="play"]');
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(play).toBeEnabled();
  await holdsStill(page.locator("#sp-stage"));
  await page.goto("/hoshi-stars/embed-3d.html?c=Ori");
  await expect(live(page)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("spin")).toHaveText("Play");
  await holdsStill(page.locator("#sp-stage"));
});
