// The constellation quiz: a chart with no names, six choices in a row, a right answer scores, and the style, the level and the question are kept in the address. The chart is an SVG drawn once for each question.
import { expect, test, type Page } from "@playwright/test";
import { seenIn } from "../demo/quiz-sky.ts";
import { constellations } from "../src/constellations.ts";

const PAGE = "/hoshi-stars/quiz.html";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
/** The question asked, from its place in the address (q, 1 to 88): the address never has the constellation's name. */
const answerOf = (page: Page): string | undefined => {
  const place = Number(param(page, "q"));
  return place >= 1 ? constellations()[place - 1]?.abbreviation : undefined;
};
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
  await expect.poll(() => answerOf(page)).not.toBe("Ori");
  const answer = answerOf(page)!;
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
  const asked = new Set<string>();
  const offered = new Set<string>();
  for (let i = 0; i < 8; i += 1) {
    await expect(choices(page)).toHaveCount(6);
    asked.add(answerOf(page)!);
    for (const name of await choices(page).allTextContents()) expect(name).toMatch(/座$/);
    for (const abbreviation of await choices(page).evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset["abbr"]!))) offered.add(abbreviation);
    await choices(page).first().click();
    await page.getByTestId("qz-next").click();
  }
  expect(offered.size, "the six names of every question come from the same twelve").toBeLessThanOrEqual(12);
  for (const one of asked) expect(offered.has(one)).toBe(true);
  await expect(page.getByTestId("qz-score")).toContainText("問中");
  await expect(page.getByTestId("qz-next")).toHaveText("次の問題");
});

test("before it is answered the address, the title and the page do not give the answer away", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88&style=annotated`);
  await expect(choices(page)).toHaveCount(6);
  // the question is kept as a place in the list, never as the constellation's name
  await expect.poll(() => param(page, "q")).toBe(String(constellations().findIndex((c) => c.abbreviation === "Ori") + 1));
  expect(param(page, "c")).toBeNull();
  expect(page.url()).not.toMatch(/Ori/i);
  expect(await page.title()).not.toMatch(/Orion/);
  // the link that names the answer is empty and hidden until then; the chart has no title, label or alt that names it
  await expect(page.getByTestId("qz-open")).toBeHidden();
  expect(await page.getByTestId("qz-open").evaluate((a) => `${a.getAttribute("href") ?? ""}${a.textContent}`)).toBe("");
  const chart = await page.getByTestId("qz-sky").evaluate((svg) => svg.outerHTML);
  expect(chart).not.toMatch(/Orion|オリオン|>Ori</);
  // no choice carries anything that tells the right one from the rest
  const marks = await choices(page).evaluateAll((all) => all.map((b) => `${b.getAttribute("data-state")}|${b.getAttribute("title")}|${b.getAttribute("aria-label")}|${b.getAttribute("class")}`));
  expect(new Set(marks).size).toBe(1);
});

test("1 to 6 answer from the keyboard, and the focus lands on Next and then on the first choice", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(choices(page)).toHaveCount(6);
  const at = (await choices(page).evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset["abbr"]))).indexOf("Ori");
  await page.keyboard.press(String(at + 1));
  await expect(page.getByTestId("qz-result")).toHaveText("Right! It is Orion.");
  await expect(page.getByTestId("qz-next")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("qz-result")).toHaveText("");
  await expect(choices(page).first()).toBeFocused();
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
  await expect.poll(() => answerOf(page)).not.toBe("Ori");
  await page.getByTestId("qz-choices").locator(`button[data-abbr="${answerOf(page)}"]`).click();
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 2 of 2 Streak 2, best 2.");
  await expect(page.getByTestId("qz-result")).toHaveAttribute("data-correct", "true");
});

/** The text of the page outside the six choices: what a reader (or a screen reader) is told before the answer, which must not name it. */
const outsideChoices = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement;
    copy.querySelector("#qz-choices")?.remove();
    return `${document.title}|${location.href}|${copy.innerHTML}`;
  });

test("kid mode: big buttons, simpler words, kept in the address, and it gives nothing away", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(choices(page)).toHaveCount(6);
  const plain = await choices(page).first().evaluate((b) => b.getBoundingClientRect().height);
  await expect(page.getByTestId("qz-kid")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("qz-kid").click();
  await expect.poll(() => param(page, "kid")).toBe("1");
  await expect(page.getByTestId("qz-kid")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#qz-heading")).toHaveText("Which star picture is this?");
  await expect(page.getByTestId("qz-levels").getByRole("button", { name: "Easy (12)" })).toBeVisible();
  // big targets: every choice and every control is at least 56 px tall, and the choices are taller than in the plain mode
  const sizes = await page.locator(".quiz button, .quiz a.fam-button").evaluateAll((all) => all.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(Math.min(...sizes), "every button is big").toBeGreaterThanOrEqual(56);
  expect(await choices(page).first().evaluate((b) => b.getBoundingClientRect().height)).toBeGreaterThan(plain + 10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "no sideways scroll").toBeLessThanOrEqual(0);
  // nothing names the answer before it is answered: not the address, the title, the labels or the link
  expect(await outsideChoices(page)).not.toMatch(/Orion|オリオン|\bOri\b|c=Ori/);
  await page.getByTestId("qz-choices").locator('button[data-abbr="Ori"]').click();
  await expect(page.getByTestId("qz-result")).toHaveText("Yes! It is Orion!");
  await expect(page.getByTestId("qz-score")).toHaveText("You got 1 of 1");
  await expect(page.getByTestId("qz-next")).toHaveText("Next one");
  await page.reload();
  await expect(page.getByTestId("qz-kid")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("qz-kid").click();
  await expect.poll(() => param(page, "kid")).toBeNull();
  await expect(page.locator("#qz-heading")).toHaveText("Which constellation is this?");
});

test("kid mode in Japanese uses the simple words", async ({ page }) => {
  await page.goto(`${PAGE}?kid=1&lang=ja&level=88`);
  await expect(choices(page)).toHaveCount(6);
  await expect(page.locator("#qz-heading")).toHaveText("これは なにざ?");
  await expect(page.getByTestId("qz-next")).toHaveText("つぎの もんだい");
});

test("the arrow keys move across the six choices, left and right by one and up and down by a row", async ({ page }) => {
  await page.goto(`${PAGE}?c=Ori&level=88`);
  await expect(choices(page)).toHaveCount(6);
  const row = await choices(page).evaluateAll((all) => all.filter((b) => Math.abs(b.getBoundingClientRect().top - all[0]!.getBoundingClientRect().top) < 2).length);
  await choices(page).first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(choices(page).nth(1)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(choices(page).nth(2)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(choices(page).nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(choices(page).nth(1 + row)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(choices(page).nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(choices(page).nth(5)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(choices(page).first()).toBeFocused();
  // the arrows only move: nothing was answered
  await expect(page.getByTestId("qz-score")).toHaveText("Score: 0 of 0");
});

test("at all 88 the wrong names are the ones easy to mix up: most are Orion's neighbours", async ({ page }) => {
  const near = new Set(["Eri", "Gem", "Lep", "Mon", "Tau"]);
  for (let i = 0; i < 3; i += 1) {
    await page.goto(`${PAGE}?q=${constellations().findIndex((c) => c.abbreviation === "Ori") + 1}&level=88`);
    await expect(choices(page)).toHaveCount(6);
    const abbreviations = await choices(page).evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset["abbr"]!));
    expect(abbreviations.filter((one) => near.has(one)).length).toBeGreaterThanOrEqual(3);
  }
});

const abbreviationsOf = (page: Page): Promise<string[]> => choices(page).evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset["abbr"]!));
const placeOf = (abbreviation: string): number => constellations().findIndex((c) => c.abbreviation === abbreviation) + 1;

test("by hemisphere and month: only what a reader there can see that evening is asked, and the six names come from it too", async ({ page }) => {
  const january = new Set(seenIn("north", 1));
  expect(january.has("Ori") && !january.has("Cru"), "Orion is up on a January evening in the north and the Southern Cross never is").toBe(true);
  // the Southern Cross is not in a northern sky, so a hand-written question for it is not asked
  await page.goto(`${PAGE}?q=${placeOf("Cru")}&level=88&hemisphere=north&month=1`);
  await expect(choices(page)).toHaveCount(6);
  await expect.poll(() => param(page, "q")).not.toBe(String(placeOf("Cru")));
  expect(answerOf(page)).toBeDefined();
  for (let i = 0; i < 5; i += 1) {
    for (const one of await abbreviationsOf(page)) expect(january.has(one), `${one} is in the January sky of the north`).toBe(true);
    expect(january.has(answerOf(page)!)).toBe(true);
    await choices(page).first().click();
    await page.getByTestId("qz-next").click();
  }
  // from the south in May it is
  await page.goto(`${PAGE}?q=${placeOf("Cru")}&level=88&hemisphere=south&month=5`);
  await expect(choices(page)).toHaveCount(6);
  expect(answerOf(page)).toBe("Cru");
  const may = new Set(seenIn("south", 5));
  for (const one of await abbreviationsOf(page)) expect(may.has(one)).toBe(true);
  // bright 12: the twelve brightest of that sky, so every name offered is one of 12
  await page.goto(`${PAGE}?hemisphere=north&month=1`);
  const offered = new Set<string>();
  for (let i = 0; i < 6; i += 1) {
    for (const one of await abbreviationsOf(page)) offered.add(one);
    await choices(page).first().click();
    await page.getByTestId("qz-next").click();
  }
  expect(offered.size).toBeLessThanOrEqual(12);
  for (const one of offered) expect(january.has(one)).toBe(true);
});

test("the sky buttons and the month are kept in the address, the month waits for a hemisphere, and the note says how it is worked out", async ({ page }) => {
  await page.goto(`${PAGE}?level=88`);
  await expect(page.getByTestId("qz-hemis").locator('button[aria-pressed="true"]')).toHaveText("Whole sky");
  await expect(page.getByTestId("qz-month")).toBeDisabled();
  await expect(page.getByTestId("qz-skynote")).toBeHidden();
  await page.getByTestId("qz-hemis").getByRole("button", { name: "South" }).click();
  await expect.poll(() => param(page, "hemisphere")).toBe("south");
  await expect(page.getByTestId("qz-month")).toBeEnabled();
  await expect(page.getByTestId("qz-skynote")).toContainText("40 degrees south");
  await page.getByTestId("qz-month").selectOption("5");
  await expect.poll(() => param(page, "month")).toBe("5");
  await expect(page.getByTestId("qz-skynote")).toContainText("21:00 on the 15th");
  await page.reload();
  await expect(page.getByTestId("qz-hemis").locator('button[aria-pressed="true"]')).toHaveText("South");
  await expect(page.getByTestId("qz-month")).toHaveValue("5");
  await page.getByTestId("qz-hemis").getByRole("button", { name: "Whole sky" }).click();
  await expect.poll(() => param(page, "hemisphere")).toBeNull();
  await expect.poll(() => param(page, "month")).toBeNull();
  // any month in the north: the Southern Cross is never asked, and a page of the Japanese words has the month in Japanese
  await page.goto(`${PAGE}?level=88&hemisphere=north&lang=ja`);
  await expect(page.getByTestId("qz-hemis").locator('button[aria-pressed="true"]')).toHaveText("北半球");
  await expect(page.getByTestId("qz-month").locator("option").nth(1)).toHaveText("1月");
  for (let i = 0; i < 6; i += 1) {
    expect(await abbreviationsOf(page)).not.toContain("Cru");
    await choices(page).first().click();
    await page.getByTestId("qz-next").click();
  }
});

test("the sky choices and kid mode give nothing away: the address and the page do not name the answer", async ({ page }) => {
  await page.goto(`${PAGE}?q=${placeOf("Ori")}&level=88&hemisphere=north&month=1&kid=1`);
  await expect(choices(page)).toHaveCount(6);
  await expect.poll(() => param(page, "q")).toBe(String(placeOf("Ori")));
  expect(await outsideChoices(page)).not.toMatch(/Orion|オリオン|\bOri\b|c=Ori/);
  await expect(page.getByTestId("qz-month")).toBeVisible();
  expect(await page.getByTestId("qz-month").evaluate((s) => (s as HTMLSelectElement).offsetHeight), "the month is a big target in kid mode").toBeGreaterThanOrEqual(56);
});
