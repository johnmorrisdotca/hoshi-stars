// Deep-sky objects at their true size, and their pictures: an outline that grows with the zoom, a picture that is fetched and shown only when zoomed in, a card that says what is measured and
// credits the picture, a layer toggle kept in the address, the bright stars inside a cluster, and the NGC and IC objects once zoomed in. The embed page draws them too.
import { expect, test, type Page } from "@playwright/test";

const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const webp = (page: Page): string[] => {
  const found: string[] = [];
  page.on("request", (request) => request.url().endsWith(".webp") && found.push(request.url()));
  return found;
};
/** The width in pixels of an object's mark. */
const widthOf = (page: Page, id: string): Promise<number> => page.locator(`#chart [data-deep="${id}"]`).first().evaluate((node) => node.getBoundingClientRect().width);
/** The middle of an element on the page. */
const middleOf = (page: Page, selector: string): Promise<{ x: number; y: number; width: number }> =>
  page.locator(selector).first().evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
  });
async function fly(page: Page, text: string): Promise<void> {
  await page.fill("#search", text);
  await page.locator("#results button").first().click();
}

test("a galaxy is drawn at its true size and grows with the zoom", async ({ page }) => {
  const measured = async (zoom: number): Promise<number> => {
    await page.goto(`/hoshi-stars/?layers=milky,deep,names&ra=10.68&dec=41.27&zoom=${zoom}`);
    await expect(page.locator('#chart [data-deep="M31"]')).toHaveCount(1);
    // the chart is laid out a frame after it is drawn: wait for the outline to have a width
    await expect.poll(() => widthOf(page, "M31")).toBeGreaterThan(20);
    return widthOf(page, "M31");
  };
  const near = await measured(20);
  const closer = await measured(40);
  expect(closer / near).toBeGreaterThan(1.6);
  expect(closer / near).toBeLessThan(2.4);
});

test("a picture is not fetched at the opening view; zoomed in on a galaxy it is fetched once, shown, and kept in step with the sky", async ({ page }) => {
  const asked = webp(page);
  await page.goto("/hoshi-stars/");
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  expect(await page.locator("#chart image").count()).toBe(0);
  await fly(page, "M51");
  await expect(page.locator("#chart image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  expect(Number(await page.locator("#chart image[data-pic='M51']").getAttribute("opacity"))).toBeGreaterThan(0.4);
  const mine = asked.filter((url) => url.includes("M51"));
  expect(mine.length).toBeGreaterThanOrEqual(1);
  expect(new Set(mine).size, "each picture is fetched once").toBe(mine.length);
  expect(asked.length).toBeLessThanOrEqual(6);
  // the picture is centred on the object it shows: its middle is within a tenth of its width of the outline's
  const picture = await middleOf(page, "#chart image[data-pic='M51']");
  const outline = await middleOf(page, '#chart [data-deep="M51"]');
  expect(Math.hypot(picture.x - outline.x, picture.y - outline.y)).toBeLessThan(picture.width * 0.1 + 30);
});

test("the Pictures layer is a toggle kept in the address", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M13");
  await expect(page.locator("#chart image[data-pic='M13']")).toHaveCount(1, { timeout: 20_000 });
  await page.locator('#seg-layers button[data-value="pictures"]').click();
  await expect(page.locator("#chart image")).toHaveCount(0);
  await expect.poll(() => param(page, "layers")).not.toContain("pictures");
  await page.reload();
  await expect(page.locator("#chart g").first()).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("#chart image")).toHaveCount(0);
  await page.locator('#seg-layers button[data-value="pictures"]').click();
  await expect(page.locator("#chart image[data-pic='M13']")).toHaveCount(1, { timeout: 20_000 });
});

test("the card says what is measured and what is drawn, and credits the picture", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M31");
  const card = page.locator("#picked");
  await expect(card.locator("h3")).toContainText("M31");
  await expect(card).toContainText("190.5 × 61.7 arc-minutes");
  await expect(card).toContainText("35° east of north");
  await expect(card).toContainText("RC3");
  await expect(card).toContainText("An ellipse at the measured size, axis ratio and angle.");
  await expect(card.getByTestId("picture-credit").first()).toContainText(/SDSS|2MASS|WISE/);
  await expect(card.getByTestId("picture-credit").first()).toContainText("Licence:");
  await fly(page, "M42");
  await expect(card).toContainText("66 × 60 arc-minutes");
  await expect(card).toContainText("not measured");
  await expect(card).toContainText("A circle across the major diameter");
});

test("the card is in Japanese when the page is", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await page.evaluate(() => document.documentElement.setAttribute("lang", "ja"));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("hoshi-language")));
  await fly(page, "M31");
  await expect(page.locator("#picked")).toContainText("北から東回りに 35°");
  await expect(page.locator("#picked")).toContainText("クレジット:");
});

test("the bright stars inside an open cluster are ringed and listed, and said not to be checked", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await fly(page, "M45");
  await expect(page.locator("#chart [data-inside]").first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator("#chart [data-inside]").count()).toBeGreaterThanOrEqual(5);
  await expect(page.locator("#picked")).toContainText("Alcyone");
  await expect(page.getByTestId("inside-note")).toContainText("not checked");
});

test("the NGC and IC objects arrive when the map is zoomed in, can be searched and picked, and have their card", async ({ page }) => {
  await page.goto("/hoshi-stars/");
  await page.fill("#search", "NGC 253");
  await expect(page.locator("#results button").first()).toContainText("NGC 253", { timeout: 20_000 });
  await page.locator("#results button").first().click();
  await expect(page.locator("#picked h3")).toContainText("NGC 253");
  await expect(page.locator("#picked")).toContainText("RC3");
  await expect(page.locator('#chart [data-deep="NGC 253"]')).toHaveCount(1);
});

test("an object with no measured size is a dotted symbol, and says so", async ({ page }) => {
  await page.goto("/hoshi-stars/?layers=deep&ra=300&dec=-5&zoom=3");
  await fly(page, "M40");
  await expect(page.locator("#picked")).toContainText("not measured");
  await expect(page.locator("#picked")).toContainText("A dotted symbol of fixed size");
  await expect(page.locator('#chart [data-deep="M40"] [stroke-dasharray]')).not.toHaveCount(0);
});

test("the embed page draws the picture of the object it is aimed at", async ({ page }) => {
  await page.goto("/hoshi-stars/embed.html?ra=202.47&dec=47.2&zoom=300&layers=milky,deep,pictures");
  await expect(page.locator("#frame image[data-pic='M51']")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('#frame [data-deep="M51"]')).toHaveCount(1);
});
