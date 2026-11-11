// The sky by distance in 3D: it draws the layers out to the limit round the Earth, the shells are named, the limit steps out and in and is kept in the address, a thing whose distance is uncertain is a streak and never a dot, and the embed does the same.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/layers-3d.html";
const EMBED = "/hoshi-stars/embed-layers.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}${query}`);
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
}
const things = async (page: Page, where = "#sp-stage"): Promise<number> => Number(await page.locator(where).getAttribute("data-things"));

test("it opens at 100 light-years, drawn, with the shells named and the distances to scale", async ({ page }) => {
  await open(page, "?spin=off");
  expect(await things(page)).toBeGreaterThan(500);
  await expect(page.locator("#sp-stage")).toHaveAttribute("data-scale", "linear");
  await expect(page.getByTestId("ly-scale")).toContainText("to scale");
  await expect(page.getByTestId("ly-scale")).toContainText("100 light-years");
  for (const shell of ["10", "50", "100"]) await expect(page.locator(`#sp-labels [data-shell="${shell}"]`)).toHaveCount(1);
  await expect(page.locator('#sp-labels [data-shell="500"]')).toHaveCount(0);
  await expect(page.getByTestId("dist-legend")).toContainText("Distance uncertain");
  await expect(page.getByTestId("dist-seg").getByRole("button", { name: "100", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("stepping the limit out fills the sky shell by shell and is kept in the address; all is compressed and says so", async ({ page }) => {
  await open(page, "?spin=off");
  let before = await things(page);
  await page.getByTestId("dist-farther").click();
  await expect.poll(() => param(page, "dist")).toBe("500");
  await expect.poll(() => things(page)).toBeGreaterThan(before);
  before = await things(page);
  await page.getByTestId("dist-seg").getByRole("button", { name: "All" }).click();
  await expect.poll(() => param(page, "dist")).toBe("all");
  await expect(page.locator("#sp-stage")).toHaveAttribute("data-scale", "log");
  await expect(page.getByTestId("ly-scale")).toContainText("compressed");
  await expect.poll(() => things(page)).toBeGreaterThan(before);
  await page.getByTestId("dist-nearer").click();
  await expect.poll(() => param(page, "dist")).toBe("1000");
  await expect(page.locator("#sp-stage")).toHaveAttribute("data-scale", "linear");
  await page.getByTestId("dist-seg").getByRole("button", { name: "10", exact: true }).click();
  await expect.poll(() => things(page)).toBeLessThan(before);
  await expect.poll(() => param(page, "dist")).toBe("10");
  await page.reload();
  await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
  expect(await things(page)).toBeLessThan(before);
  await expect(page.getByTestId("dist-seg").getByRole("button", { name: "10", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("the summary says how many are in the layers, how many are streaks and how many have no distance and are not drawn", async ({ page }) => {
  await open(page, "?dist=500&spin=off");
  const text = (await page.getByTestId("ly-summary").textContent())!;
  const numbers = (text.match(/[\d,]+/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  expect(numbers[0]).toBe(await things(page));
  expect(numbers[1]).toBeGreaterThan(100);
  expect(numbers[2]).toBeGreaterThan(1000);
  await expect(page.getByTestId("dist-legend").locator('li[data-band="uncertain"] .dist-count')).toHaveText(numbers[1]!.toLocaleString("en"));
});

test("the page is in Japanese on a Japanese address, and the open link goes to the map at the same limit", async ({ page }) => {
  await open(page, "?lang=ja&dist=50&spin=off");
  await expect(page.getByTestId("dist-seg").getByRole("button", { name: "すべて" })).toBeVisible();
  await expect(page.getByTestId("ly-scale")).toContainText("光年");
  await expect(page.locator('#sp-labels [data-shell="50"]')).toContainText("光年");
  await expect(page.getByTestId("ly-open")).toHaveAttribute("href", /dist=50/);
});

test.describe("the embed page", () => {
  async function openEmbed(page: Page, query: string): Promise<void> {
    await page.goto(`${EMBED}?${query}`);
    await page.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
    await expect(page.locator("html[data-ready='true']")).toHaveCount(1);
    await expect(page.getByTestId("sp-fallback"), "a live view says nothing about a browser that cannot draw it").toBeHidden();
  }

  test("it draws what its address says, with a legend, and steps out and in with its buttons", async ({ page }) => {
    await openEmbed(page, "dist=50&spin=off");
    const small = await things(page);
    expect(small).toBeGreaterThan(100);
    await expect(page.getByTestId("dist-legend")).toContainText("Distance uncertain");
    await page.getByTestId("farther").click();
    await expect.poll(() => things(page)).toBeGreaterThan(small);
    await page.getByTestId("nearer").click();
    await page.getByTestId("nearer").click();
    await expect.poll(() => things(page)).toBeLessThan(small);
  });

  test("it holds still with spin=off and says Play", async ({ page }) => {
    await openEmbed(page, "dist=10&spin=off");
    await expect(page.getByTestId("spin")).toHaveText("Play");
    await expect(page.getByTestId("dist-legend")).toBeVisible();
  });
});
