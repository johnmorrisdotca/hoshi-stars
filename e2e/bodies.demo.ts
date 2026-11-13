// Planets and the Moon on the chart demo: the Planets and Moon control shows a fixed, labelled sample (the Moon and the bright planets for one stated moment, not live), each drawn by its magnitude and named, the Moon with
// its phase shape, in English and in Japanese; a tap on one says what it is; the Ecliptic layer's switch draws and removes the Sun's yearly path; the embed page takes the same sample; the address keeps both.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const bodies = (page: Page) => page.locator("#chart g[data-body]");
const names = (page: Page) => page.locator("#chart text").allTextContents();

test("the control shows the labelled sample: six bodies by magnitude, named, the Moon with its phase", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  await expect(bodies(page)).toHaveCount(0);
  const button = page.getByTestId("bodies");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toContainText("sample");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(bodies(page)).toHaveCount(6);
  // the note says, in words on the page, that it is a fixed sample for a date and not live
  const note = page.getByTestId("bodies-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("not live");
  await expect(note).toContainText("12 November 2026");
  const shown = await names(page);
  for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Moon"]) expect(shown).toContain(name);
  // the Moon is a disc with a lit part (a crescent, 7% lit); the planets are dots
  const moon = page.locator('#chart g[data-body="moon"]');
  await expect(moon).toHaveAttribute("data-shape", "disc");
  await expect(moon.locator("path[data-lit]")).toHaveCount(1);
  await expect(page.locator('#chart g[data-body="venus"]')).toHaveAttribute("data-shape", "dot");
  const radius = async (id: string) => Number(await page.locator(`#chart g[data-body="${id}"] circle`).first().getAttribute("r"));
  expect(await radius("venus")).toBeGreaterThan(await radius("mars"));
  expect(await radius("jupiter")).toBeGreaterThan(await radius("mars"));
  await expect.poll(() => param(page, "bodies")).toBe("sample");
  await button.click();
  await expect(bodies(page)).toHaveCount(0);
  await expect(note).toBeHidden();
  await expect.poll(() => param(page, "bodies")).toBeNull();
});

test("an address with bodies=sample opens with them, named in Japanese when the page is", async ({ page }) => {
  await page.goto(`${HOME}?bodies=sample&proj=equirectangular&ra=180&dec=-5&zoom=1&lang=ja`);
  await expect(bodies(page)).toHaveCount(6);
  const shown = await names(page);
  for (const name of ["金星", "木星", "月"]) expect(shown).toContain(name);
  await expect(page.getByTestId("bodies-note")).toContainText("固定の見本");
});

test("a tap on a body says what it is, and the sample note stays a sample", async ({ page }) => {
  await page.goto(`${HOME}?bodies=sample&proj=equirectangular&ra=180&dec=-5&zoom=1`);
  await expect(bodies(page)).toHaveCount(6);
  const box = (await page.locator('#chart g[data-body="venus"] circle').first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("bodies-note")).toContainText("Venus: magnitude -4.5");
  await expect(page.getByTestId("bodies-note")).toContainText("not live");
});

test("the Ecliptic layer's switch draws the Sun's yearly path and takes it away", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#chart circle").first()).toBeVisible();
  const line = page.locator('#chart path[data-layer="ecliptic"]');
  const toggle = page.getByTestId("layers").locator('button[data-value="ecliptic"]');
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(line).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(line).toHaveCount(1);
  await expect.poll(() => param(page, "layers")).toContain("ecliptic");
  await toggle.click();
  await expect(line).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("the embed page draws the sample and the ecliptic its address asks for", async ({ page }) => {
  await page.goto(`${HOME}embed.html?bodies=sample&layers=names,ecliptic&proj=equirectangular&ra=180&dec=-5&zoom=1`);
  await expect(page.locator("#sky g[data-body]")).toHaveCount(6);
  await expect(page.locator('#sky path[data-layer="ecliptic"]')).toHaveCount(1);
  await page.goto(`${HOME}embed.html?proj=equirectangular&ra=180&dec=-5&zoom=1`);
  await expect(page.locator("#sky circle").first()).toBeVisible();
  await expect(page.locator("#sky g[data-body]")).toHaveCount(0);
});
