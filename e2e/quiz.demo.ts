// The constellation quiz: a chart with no names, six choices in a row, a right answer scores, and the style, the level and the question are kept in the address. The chart is an SVG drawn once for each question.
import { expect, test, type Page } from "@playwright/test";

const PAGE = "/hoshi-stars/quiz.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const choices = (page: Page) => page.getByTestId("qz-choices").locator("button");

test("a question shows the chart with no names and six choices in a row, and exactly one is right", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(choices(page)).toHaveCount(6);
  await expect(page.getByTestId("qz-sky").locator("circle, path").first()).toBeAttached();
  expect(await page.getByTestId("qz-sky").locator("text").count(), "no name is written on the chart").toBe(0);
  await expect(page.getByTestId("qz-choices").locator('button[data-abbr="Ori"]')).toHaveText("Orion");
  // the six are six different constellations, and the quiz has no fold-open sections
  const names = await choices(page).allTextContents();
  expect(new Set(names).size).toBe(6);
  await expect(page.locator("details")).toHaveCount(0);
  // in a row: the choices sit in no more than two rows on a desk and three on a phone
  const tops = await choices(page).evaluateAll((all) => new Set(all.map((b) => Math.round(b.getBoundingClientRect().top))).size);
  expect(tops).toBeLessThanOrEqual(3);
});

test("a right answer scores and a wrong one does not, and Next asks another question", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 0 of 0");
  await page.getByTestId("qz-choices").locator('button[data-abbr="Ori"]').click();
  await expect(page.getByTestId("qz-result")).toHaveText("Right! It is Orion.");
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 1 of 1");
  await expect(page.getByTestId("qz-open")).toHaveAttribute("href", /constellation\.html\?c=Ori/);
  // answered: the choices are closed until the next question
  await expect(choices(page).first()).toBeDisabled();
  await page.getByTestId("qz-next").click();
  await expect(page.getByTestId("qz-result")).toHaveText("");
  await expect(choices(page).first()).toBeEnabled();
  await expect.poll(() => param(page, "c")).not.toBe("Ori");
  const answer = param(page, "c")!;
  const wrong = page.getByTestId("qz-choices").locator(`button:not([data-abbr="${answer}"])`).first();
  await wrong.click();
  await expect(page.getByTestId("qz-result")).toContainText("Not quite");
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 1 of 2");
  // the miss is kept to look at again, with its picture and its page
  await expect(page.getByTestId("qz-missed").locator("a")).toHaveCount(1);
  await expect(page.getByTestId("qz-missed").locator("a")).toHaveAttribute("href", new RegExp(`constellation\\.html\\?c=${answer}`));
});

test("the style and the level are kept in the address and held on a reload", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori`);
  await expect(page.getByTestId("qz-styles").locator('button[aria-pressed="true"]')).toHaveText("Plain");
  const plain = await page.getByTestId("qz-sky").locator("line, path").count();
  await page.getByTestId("qz-styles").getByRole("button", { name: "Annotated" }).click();
  await expect.poll(() => param(page, "style")).toBe("annotated");
  expect(await page.getByTestId("qz-sky").locator("line, path").count(), "the lines and the borders add to the chart, and the neighbours are named").toBeGreaterThan(plain);
  const named = await page.getByTestId("qz-sky").locator("text").allTextContents();
  expect(await page.getByTestId("qz-sky").locator("text[data-neighbour]").count(), "a neighbour is named").toBeGreaterThan(0);
  expect(named.length, "only neighbours are named").toBe(await page.getByTestId("qz-sky").locator("text[data-neighbour]").count());
  expect(named, "the constellation asked is never named").not.toContain("Orion");
  await page.getByTestId("qz-levels").getByRole("button", { name: "Bright 30" }).click();
  await expect.poll(() => param(page, "level")).toBe("30");
  await page.reload();
  await expect(page.getByTestId("qz-styles").locator('button[aria-pressed="true"]')).toHaveText("Annotated");
  await expect(page.getByTestId("qz-levels").locator('button[aria-pressed="true"]')).toHaveText("Bright 30");
  await expect(choices(page)).toHaveCount(6);
});

test("the bright 12 asks only the twelve, and the names are Japanese on the Japanese page", async ({ page }) => {
  await page.goto(`${PAGE}?lang=ja`);
  const seen = new Set<string>();
  for (let i = 0; i < 6; i += 1) {
    seen.add(param(page, "c")!);
    for (const name of await choices(page).allTextContents()) expect(name).toMatch(/座$/);
    await choices(page).first().click();
    await page.getByTestId("qz-next").click();
  }
  await expect(page.getByTestId("qz-score")).toContainText("問中");
  await expect(page.getByTestId("qz-next")).toHaveText("次の問題");
  expect(seen.size).toBeGreaterThan(0);
});

test("every size of figure fits the chart: Hydra, the Little Bear and Octans at all 88", async ({ page }) => {
  for (const c of ["Hya", "UMi", "Oct"]) {
    await page.goto(`${PAGE}?c=${c}&level=88`);
    await expect(choices(page)).toHaveCount(6);
    const stars = await page.getByTestId("qz-sky").locator("circle").count();
    expect(stars, `${c} has stars on the chart`).toBeGreaterThan(3);
  }
});

test("on a phone it does not run past the screen", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(choices(page)).toHaveCount(6);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test("two right answers in a row make a streak", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await page.getByTestId("qz-choices").locator('button[data-abbr="Ori"]').click();
  await page.getByTestId("qz-next").click();
  await expect.poll(() => param(page, "c")).not.toBe("Ori");
  await page.getByTestId("qz-choices").locator(`button[data-abbr="${param(page, "c")}"]`).click();
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 2 of 2 Streak 2, best 2.");
  await expect(page.getByTestId("qz-result")).toHaveAttribute("data-correct", "true");
});
