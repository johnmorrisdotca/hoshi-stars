// The black-hole layer played by hand: a button in the Show row (off to begin with, kept in the address), a symbol of each kind on the sky, a search by name, a tap that picks one, and the
// card with the mass, the distance, the companion, how it was found and the papers, in English and in Japanese.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const holes = (page: Page, kind = "") => page.locator(`#chart g[data-hole]${kind === "" ? "" : `[data-kind="${kind}"]`}`);

test("a Black holes button sits in the Show row, off to begin with; turning it on draws a symbol for each kind and the address keeps it", async ({ page }) => {
  await open(page, "?proj=mollweide&zoom=1&ra=180&dec=0");
  const button = page.locator('#seg-layers button[data-value="holes"]');
  await expect(button).toHaveText("Black holes");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(holes(page)).toHaveCount(0);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => holes(page).count()).toBeGreaterThan(280);
  for (const kind of ["stellar", "quiet", "supermassive"]) expect(await holes(page, kind).count()).toBeGreaterThan(0);
  await expect.poll(() => param(page, "layers")).toBe("milky,lines,names,holes,faint,grid");
  await open(page, "?layers=holes&proj=hammer&zoom=1&ra=180&dec=0");
  await expect(page.locator('#seg-layers button[data-value="holes"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => holes(page).count()).toBeGreaterThan(280);
  await page.locator('#seg-layers button[data-value="holes"]').click();
  await expect(holes(page)).toHaveCount(0);
});

test("searching a black hole by name picks it and shows its card with the facts and the papers, each paper a link", async ({ page }) => {
  await open(page);
  await page.getByTestId("search").fill("Cygnus X-1");
  await expect(page.getByTestId("results")).toContainText(/black hole/i);
  await page.getByTestId("search").press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("B:cygnus-x-1");
  const card = page.getByTestId("picked");
  await expect(card).toContainText("Cygnus X-1");
  await expect(card).toContainText("Confirmed");
  await expect(card).toContainText("21.2 (19–23.4) Suns");
  await expect(card).toContainText("7,200 (6,700–7,800) light-years");
  await expect(card).toContainText("HDE 226868");
  await expect(card).toContainText("X-rays");
  await expect(card).toContainText("1964");
  await expect(card).toContainText("What is measured");
  const papers = page.getByTestId("papers").locator("a");
  expect(await papers.count()).toBeGreaterThanOrEqual(2);
  await expect(papers.first()).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator("#chart g[data-hole='cygnus-x-1']")).toHaveCount(1);
  for (const [text, id] of [["Sgr A*", "sagittarius-a"], ["M87", "m87"], ["V404 Cyg", "v404-cygni"], ["Gaia BH3", "gaia-bh3"]] as const) {
    await page.getByTestId("search").fill(text);
    // "M87" is a Messier object too, and comes first: the black hole is the second result.
    await page.getByTestId("results").locator(`button[data-key="B:${id}"]`).click();
    await expect.poll(() => param(page, "pick")).toBe(`B:${id}`);
  }
});

test("a tap on a black hole's symbol picks it, and a pick in the address is drawn even with the layer off", async ({ page }) => {
  await open(page, "?layers=holes&ra=299.59&dec=35.2&zoom=8");
  const symbol = page.locator("#chart g[data-hole='cygnus-x-1']");
  await expect(symbol).toHaveCount(1);
  await page.locator("#chart").scrollIntoViewIfNeeded();
  const box = (await symbol.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => param(page, "pick")).toBe("B:cygnus-x-1");
  await expect(page.getByTestId("picked")).toContainText("Stellar-mass black hole");
  await open(page, "?pick=B:m87&ra=187.7&dec=12.4&zoom=6");
  await expect(page.locator("#chart g[data-hole='m87']")).toHaveCount(1);
  await expect(holes(page)).toHaveCount(1);
  await expect(page.getByTestId("picked")).toContainText("M87*");
  await expect(page.getByTestId("picked")).toContainText("Event Horizon Telescope");
  await open(page, "?pick=B:nothing-here");
  await expect(page.getByTestId("picked")).toContainText("Tap the chart");
});

test("in Japanese the card, the button and the note are Japanese", async ({ page }) => {
  await open(page, "?lang=ja&pick=B:gaia-bh1&layers=holes&ra=262.17&dec=-0.58&zoom=6");
  await expect(page.locator('#seg-layers button[data-value="holes"]')).toHaveText("ブラックホール");
  const card = page.getByTestId("picked");
  await expect(card).toContainText("休眠ブラックホール");
  await expect(card).toContainText("質量");
  await expect(card).toContainText("9.62 (9.44–9.8)太陽質量");
  await expect(card).toContainText("伴星の軌道");
  await expect(card).toContainText("太陽にいちばん近い");
  await expect(card).toContainText("出典");
});
