// View from: the sky seen from another star. The choice is kept in the address, the chart, the lines and the Nearby panel are redrawn from there, and the note says where we are and what is hidden.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const lines = (page: Page): Promise<string> => page.locator("#chart path[stroke='#6f93e0']").first().getAttribute("d").then((d) => d ?? "");
const rows = (page: Page) => page.getByTestId("nearby-list").locator("button");

test("the demo starts in the Earth's sky, with no note, and View from offers the Sun's sky first and the famous stars", async ({ page }) => {
  await open(page, "");
  const select = page.getByTestId("from");
  await expect(select).toHaveValue("");
  await expect(select.locator("option").first()).toHaveText("The Sun (the Earth's sky)");
  await expect(select.locator("option", { hasText: "Alpha Centauri" })).toHaveCount(1);
  await expect(select.locator("option", { hasText: "Sirius" })).toHaveCount(1);
  await expect(page.getByTestId("from-note")).toBeHidden();
});

test("choosing Alpha Centauri redraws the sky from there, says so, and writes from= in the address", async ({ page }) => {
  await open(page, "?ra=40&dec=61&zoom=6");
  const sky = await page.locator("#chart").innerHTML();
  await page.getByTestId("from").selectOption({ label: "Alpha Centauri" });
  await expect.poll(() => param(page, "from")).toBe("HR5459");
  await expect(page.getByTestId("from-note")).toContainText("Seen from Alpha Centauri, 4.3 light-years away. Stars without a measured distance are hidden.");
  await expect.poll(() => page.locator("#chart").innerHTML()).not.toBe(sky);
  // the Sun is a star there: search for it and look at it
  await page.getByTestId("search").fill("Sun");
  await page.getByTestId("results").locator("button").first().click();
  await expect.poll(() => param(page, "pick")).toBe("S:sun");
  await expect(page.getByTestId("picked")).toContainText("Sun");
  await expect(page.getByTestId("picked")).toContainText(/0\.4\d mag/);
  await expect(page.getByTestId("picked")).toContainText("4.35 light-years");
  await page.getByTestId("from").selectOption({ label: "The Sun (the Earth's sky)" });
  await expect.poll(() => param(page, "from")).toBeNull();
  await expect(page.getByTestId("from-note")).toBeHidden();
  await expect(page.getByTestId("from")).toHaveValue("");
});

test("an address with from= opens there: the select, the note, the lines and the Sun's place", async ({ page }) => {
  await open(page, "?ra=84&dec=0&zoom=2");
  const earth = await lines(page);
  await open(page, "?ra=84&dec=0&zoom=2&from=HR5459&pick=S:sun");
  await expect(page.getByTestId("from")).toHaveValue("HR5459");
  await expect(page.getByTestId("from-note")).toContainText("Alpha Centauri");
  expect(await lines(page)).not.toBe(earth);
  await open(page, "?ra=40&dec=61&zoom=12&from=HR5459&pick=S:sun");
  await expect(page.locator("#chart circle[stroke='#ff7a59']")).toHaveCount(1);
});

test("a name or number that is no star with a distance is the Earth's sky", async ({ page }) => {
  await open(page, "?from=HR1149");
  await expect(page.getByTestId("from")).toHaveValue("");
  await expect(page.getByTestId("from-note")).toBeHidden();
  await open(page, "?from=nonsense");
  await expect(page.getByTestId("from")).toHaveValue("");
});

test("the star picked is offered as a place to look from", async ({ page }) => {
  await open(page, "?pick=S:2491");
  await expect(page.getByTestId("from").locator("option", { hasText: "Sirius" })).toHaveCount(1);
  await open(page, "?pick=S:1708");
  const option = page.getByTestId("from").locator("option[value='HR1708']");
  await expect(option).toHaveCount(1);
  await expect(option).toContainText("picked star");
  await page.getByTestId("from").selectOption("HR1708");
  await expect.poll(() => param(page, "from")).toBe("HR1708");
  await expect(page.getByTestId("from-note")).toContainText("light-years away");
});

test("the Nearby panel lists what is near a pick in the sky seen from there, the Sun among the stars", async ({ page }) => {
  await open(page, "?pick=S:2491&from=HR5459");
  await expect(rows(page)).toHaveCount(10);
  const there = await rows(page).allTextContents();
  await open(page, "?pick=S:2491");
  const here = await rows(page).allTextContents();
  expect(there).not.toEqual(here);
  await open(page, "?pick=S:sun&from=HR5459&by=space");
  await expect(rows(page).first()).toContainText("Sirius");
  await expect(rows(page).first()).toContainText("light-years");
  await expect(page.getByTestId("nearby-note")).toContainText("have no distance");
});

test("the embed page and the code to copy carry the viewpoint", async ({ page }) => {
  await page.goto(`${HOME}embed.html?ra=40&dec=61&zoom=4&mag=6&from=HR5459`);
  await expect(page.locator("svg circle").first()).toBeVisible();
  const there = await page.locator("svg").first().innerHTML();
  await page.goto(`${HOME}embed.html?ra=40&dec=61&zoom=4&mag=6`);
  await expect(page.locator("svg circle").first()).toBeVisible();
  expect(await page.locator("svg").first().innerHTML()).not.toBe(there);
  await open(page, "?from=HR5459");
  await page.locator("kazoku-embed-panel").scrollIntoViewIfNeeded();
  const frame = new URL(await page.locator("kazoku-embed-panel").evaluate((el) => (el as unknown as { openHref: string }).openHref), page.url());
  expect(frame.searchParams.get("from")).toBe("HR5459");
});

test("in Japanese the choice and the note are in Japanese", async ({ page }) => {
  await open(page, "?lang=ja&from=HR5459");
  await expect(page.getByTestId("from")).toHaveValue("HR5459");
  await expect(page.getByTestId("from-note")).toContainText("ケンタウルス座α星から見た空です");
  await expect(page.getByTestId("from").locator("option").first()).toContainText("太陽");
});
