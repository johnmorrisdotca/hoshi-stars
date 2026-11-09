// The list of the IAU's 88 with filters that combine, a count and Clear all. On a desk each filter is a chip that opens a menu; on a phone one Filters button opens a sheet. Every test that
// chooses something goes through whichever one the page shows, so the same test plays on both.
import { expect, test, type Page } from "@playwright/test";

const LIST = "/hoshi-stars/constellation-list.html";
const PHONE_WIDTH = 720;
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const rows = (page: Page) => page.getByTestId("list-table").locator("tbody tr");
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1280) <= PHONE_WIDTH;
const count = (page: Page) => page.getByTestId("list-count");
const shownNumber = async (page: Page): Promise<number> => Number((await count(page).innerText()).split(" ")[0]);

/** Opens a filter's choices (its chip's menu on a desk, the sheet on a phone) and says where they are. */
async function openGroup(page: Page, group: string) {
  if (isPhone(page)) {
    if (!(await page.getByTestId("list-sheet").evaluate((sheet: HTMLDialogElement) => sheet.open))) await page.getByTestId("list-sheet-open").click();
    return { choices: page.locator(`[data-sheet-group="${group}"]`), item: "button", on: '[aria-pressed="true"]' };
  }
  const chip = page.getByTestId(`chip-${group}`);
  if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
  return { choices: page.locator(`[data-group="${group}"] [role="menu"]`), item: '[role="menuitemcheckbox"]', on: '[aria-checked="true"]' };
}

/** Closes the menu or the sheet. */
const close = (page: Page) => page.keyboard.press("Escape");

async function choose(page: Page, group: string, label: string | RegExp): Promise<void> {
  const open = await openGroup(page, group);
  await open.choices.locator(open.item).filter({ hasText: label }).click();
  await close(page);
}

/** The words of a filter's chosen choices. */
async function chosen(page: Page, group: string): Promise<string[]> {
  const open = await openGroup(page, group);
  const texts = await open.choices.locator(`${open.item}${open.on}`).allInnerTexts();
  await close(page);
  return texts;
}

test("the table holds the IAU's 88 and says so, with their pictures, and Clear all waits until a filter is on", async ({ page }) => {
  await page.goto(LIST);
  await expect(page.locator("#ls-heading")).toHaveText(/IAU.*88.*Western sky/);
  await expect(page.locator("#ls-lede")).toContainText("The table is the Western sky");
  await expect(page.locator("#ls-lede a")).toHaveAttribute("href", "./");
  await expect(rows(page)).toHaveCount(88);
  await expect(count(page)).toHaveText("88 of 88 shown");
  await expect(page.getByTestId("list-clear")).toBeDisabled();
  await expect(rows(page).first().locator("img")).toHaveAttribute("src", /thumbnails\/png\/160\/(light|dark)\/And\.png$/);
  await expect.poll(() => rows(page).first().locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);
});

test("choices in one filter add up, filters narrow each other, and the count and the address follow", async ({ page }) => {
  await page.goto(LIST);
  await choose(page, "hemi", "Northern sky");
  await expect(count(page)).toHaveText("29 of 88 shown");
  await choose(page, "hemi", "Crosses the equator");
  await expect(count(page)).toHaveText("42 of 88 shown");
  await choose(page, "hemi", "Crosses the equator");
  await choose(page, "easy", "Easy");
  await expect(count(page)).toHaveText("10 of 88 shown");
  await choose(page, "shower", "Has some");
  await expect(count(page)).toHaveText("4 of 88 shown");
  await expect(rows(page).locator(".ls-name")).toHaveText(["Boötes", "Draco", "Gemini", "Perseus"]);
  await expect.poll(() => param(page, "hemi")).toBe("north");
  await expect.poll(() => param(page, "easy")).toBe("easy");
  await expect.poll(() => param(page, "shower")).toBe("yes");
  expect(await chosen(page, "easy")).toEqual(["Easy"]);
});

test("the month, made, asterism and meteor shower filters each narrow the table, and a combination with nothing in it says so", async ({ page }) => {
  await page.goto(LIST);
  await choose(page, "origin", /Lacaille/);
  await expect(count(page)).toHaveText("14 of 88 shown");
  await choose(page, "origin", /Lacaille/);
  await choose(page, "ast", "Has some");
  await expect(count(page)).toHaveText("28 of 88 shown");
  await choose(page, "ast", "Has some");
  await choose(page, "ast", "None");
  await expect(count(page)).toHaveText("60 of 88 shown");
  await choose(page, "ast", "None");
  await choose(page, "month", "Jan");
  await expect.poll(() => param(page, "month")).toBe("1");
  const january = await shownNumber(page);
  expect(january).toBeGreaterThan(0);
  expect(january).toBeLessThan(15);
  await choose(page, "month", "Jan");
  await choose(page, "shower", "Has some");
  expect(await shownNumber(page)).toBeGreaterThan(5);
  await choose(page, "shower", "Has some");
  await choose(page, "origin", /Southern voyages/);
  await choose(page, "easy", "Easy");
  await choose(page, "hemi", "Northern sky");
  await expect(count(page)).toHaveText("0 of 88 shown");
  await expect(page.locator("#ls-empty")).toBeVisible();
});

test("the choices come back from the address and survive a reload, and a chip says its choice", async ({ page }) => {
  await page.goto(`${LIST}?hemi=south&easy=easy,medium&month=3`);
  expect(await chosen(page, "hemi")).toEqual(["Southern sky"]);
  expect((await chosen(page, "easy")).sort()).toEqual(["Easy", "Medium"]);
  expect(await chosen(page, "month")).toEqual(["Mar"]);
  const before = await shownNumber(page);
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThan(40);
  await page.reload();
  expect(await chosen(page, "hemi")).toEqual(["Southern sky"]);
  expect(await shownNumber(page)).toBe(before);
  if (!isPhone(page)) {
    await expect(page.getByTestId("chip-hemi")).toHaveText("Hemisphere: Southern sky");
    await expect(page.getByTestId("chip-easy")).toHaveText("How easy: 2 chosen");
    await expect(page.getByTestId("chip-ast")).toHaveText("Asterisms: any");
    await expect(page.getByTestId("chip-month")).toHaveText("Month: Mar");
    await expect(page.getByTestId("chip-shower")).toHaveText("Showers: any");
  }
});

test("Clear all removes every filter and its words from the address", async ({ page }) => {
  await page.goto(`${LIST}?hemi=south&easy=easy,medium`);
  await expect(page.getByTestId("list-clear")).toBeEnabled();
  const n = await shownNumber(page);
  expect(n).toBeGreaterThan(5);
  expect(n).toBeLessThan(40);
  await page.getByTestId("list-clear").click();
  await expect(count(page)).toHaveText("88 of 88 shown");
  expect(await chosen(page, "hemi")).toEqual([]);
  expect(await chosen(page, "easy")).toEqual([]);
  await expect.poll(() => param(page, "hemi")).toBeNull();
  await expect.poll(() => param(page, "easy")).toBeNull();
  await expect(page.getByTestId("list-clear")).toBeDisabled();
});

test("a row's name opens its page and its Map button opens the sky map on it", async ({ page }) => {
  await page.goto(`${LIST}?hemi=south&easy=easy&month=5`);
  await expect(rows(page).locator(".ls-name")).toHaveText(["Corvus", "Crux"]);
  await rows(page).filter({ hasText: "Crux" }).getByRole("link", { name: "Map" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:Cru");
  await expect(page.getByTestId("picked").locator("h3")).toHaveText("Crux");
  await page.goto(`${LIST}?hemi=south&easy=easy&month=5`);
  await rows(page).locator(".ls-name a", { hasText: "Crux" }).click();
  await expect(page).toHaveURL(/constellation\.html\?c=Cru$/);
});

test("in Japanese the filters, the sheet and the table are in Japanese", async ({ page }) => {
  await page.goto(`${LIST}?lang=ja`);
  await expect(count(page)).toHaveText("88個 / 88");
  await expect(page.locator("#ls-heading")).toHaveText(/IAU.*88星座.*西洋の空/);
  if (isPhone(page)) {
    await expect(page.getByTestId("list-sheet-open")).toHaveText("絞りこみ");
    await page.getByTestId("list-sheet-open").click();
    await expect(page.getByTestId("list-sheet").getByRole("heading")).toHaveText("絞りこみ");
    await expect(page.locator('[data-sheet-group="hemi"]').getByRole("button", { name: "北の空" })).toBeVisible();
    await close(page);
  } else {
    await expect(page.getByTestId("chip-hemi")).toHaveText("半球: すべて");
    await page.getByTestId("chip-hemi").click();
    await expect(page.getByRole("menuitemcheckbox", { name: "北の空" })).toBeVisible();
    await close(page);
  }
  await choose(page, "hemi", "北の空");
  await expect(count(page)).toHaveText("29個 / 88");
  if (!isPhone(page)) await expect(page.getByTestId("chip-hemi")).toHaveText("半球: 北の空");
  await expect(rows(page).first().locator(".ls-name")).toHaveText(/座|アンドロメダ/);
});

test.describe("a desk's chips", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) <= PHONE_WIDTH, "chips are for a desk; a phone has the sheet");

  test("a chip's menu opens with the arrow keys, ticks with Space, moves with the arrows, and Escape closes it with the focus back on the chip", async ({ page }) => {
    await page.goto(LIST);
    const chip = page.getByTestId("chip-easy");
    await expect(chip).toHaveAttribute("aria-haspopup", "menu");
    await expect(chip).toHaveAttribute("aria-expanded", "false");
    await chip.focus();
    await page.keyboard.press("ArrowDown");
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu", { name: "How easy" });
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitemcheckbox");
    await expect(items).toHaveText(["Easy", "Medium", "Hard"]);
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Space");
    await expect(items.first()).toHaveAttribute("aria-checked", "true");
    await expect(chip).toHaveText("How easy: Easy");
    await expect(menu).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(items.first()).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(chip).toHaveAttribute("aria-expanded", "false");
    await expect(chip).toBeFocused();
  });

  test("a click outside closes the menu, opening another chip closes the first, and Tab leaves it", async ({ page }) => {
    await page.goto(LIST);
    await page.getByTestId("chip-hemi").click();
    await expect(page.getByRole("menu", { name: "Hemisphere" })).toBeVisible();
    await page.getByTestId("chip-month").click();
    await expect(page.getByRole("menu", { name: "Hemisphere" })).toBeHidden();
    await expect(page.getByRole("menu", { name: "Best month" }).getByRole("menuitemcheckbox")).toHaveCount(12);
    await page.locator("#ls-heading").click();
    await expect(page.getByRole("menu", { name: "Best month" })).toBeHidden();
    await page.getByTestId("chip-origin").click();
    await page.getByTestId("chip-origin").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu", { name: "Made" })).toBeHidden();
  });

  test("every menu stays on the page at 1024 wide", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(LIST);
    for (const group of ["hemi", "month", "origin", "easy", "ast", "shower"]) {
      await page.getByTestId(`chip-${group}`).click();
      const box = await page.locator(`[data-group="${group}"] [role="menu"]`).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
      await page.keyboard.press("Escape");
    }
  });

  test("the first row of the table is above the fold at 1440 by 900, in English and in Japanese", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const query of ["", "?lang=ja"]) {
      await page.goto(`${LIST}${query}`);
      await expect(rows(page).first()).toBeVisible();
      const first = await rows(page).first().boundingBox();
      expect(first!.y + first!.height, `the first row ends at ${first!.y + first!.height}px`).toBeLessThanOrEqual(900);
      // the chips, the count and Clear all are one line
      const chip = await page.getByTestId("chip-hemi").boundingBox();
      const tally = await count(page).boundingBox();
      const clear = await page.getByTestId("list-clear").boundingBox();
      expect(Math.abs(chip!.y + chip!.height / 2 - (tally!.y + tally!.height / 2))).toBeLessThan(12);
      expect(Math.abs(chip!.y + chip!.height / 2 - (clear!.y + clear!.height / 2))).toBeLessThan(12);
    }
  });
});

test.describe("a phone's sheet", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > PHONE_WIDTH, "the sheet is for a phone; a desk has the chips");

  test("the Filters button opens a sheet with every filter in a row of buttons, a badge counts the filters on, and Show closes it", async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByTestId("chip-hemi")).toBeHidden();
    const sheet = page.getByTestId("list-sheet");
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("list-active")).toHaveCount(0);
    await page.getByTestId("list-sheet-open").click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading")).toHaveText("Filters");
    await expect(sheet.locator("[data-sheet-group]")).toHaveCount(6);
    await expect(sheet.locator('[data-sheet-group="month"] button')).toHaveCount(12);
    await sheet.locator('[data-sheet-group="easy"]').getByRole("button", { name: "Easy" }).click();
    await expect(sheet.locator('[data-sheet-group="easy"] [aria-pressed="true"]')).toHaveText("Easy");
    await expect(page.getByTestId("list-sheet-show")).toHaveText(/^Show \d+$/);
    const shown = Number((await page.getByTestId("list-sheet-show").innerText()).split(" ")[1]);
    expect(shown).toBeLessThan(88);
    await expect(count(page)).toHaveText(`${shown} of 88 shown`);
    await page.getByTestId("list-sheet-show").click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("list-active")).toHaveText("1");
    await expect(rows(page)).toHaveCount(shown);
  });

  test("the sheet closes with Escape and its Close button, and its Clear all clears every filter", async ({ page }) => {
    await page.goto(`${LIST}?hemi=north&month=1,2`);
    await expect(page.getByTestId("list-active")).toHaveText("2");
    await page.getByTestId("list-sheet-open").click();
    await expect(page.getByTestId("list-sheet-clear")).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("list-sheet")).toBeHidden();
    await page.getByTestId("list-sheet-open").click();
    await page.getByTestId("list-sheet-close").click();
    await expect(page.getByTestId("list-sheet")).toBeHidden();
    await page.getByTestId("list-sheet-open").click();
    await page.getByTestId("list-sheet-clear").click();
    await expect(count(page)).toHaveText("88 of 88 shown");
    await expect(page.getByTestId("list-sheet-clear")).toBeDisabled();
    await expect.poll(() => param(page, "hemi")).toBeNull();
    await expect.poll(() => param(page, "month")).toBeNull();
  });

  test("the bar is one line: the Filters button, the count and Clear all", async ({ page }) => {
    await page.goto(LIST);
    const open = await page.getByTestId("list-sheet-open").boundingBox();
    const tally = await count(page).boundingBox();
    const clear = await page.getByTestId("list-clear").boundingBox();
    expect(Math.abs(open!.y - clear!.y)).toBeLessThan(8);
    expect(Math.abs(tally!.y + tally!.height / 2 - (clear!.y + clear!.height / 2))).toBeLessThan(10);
    expect(clear!.x + clear!.width).toBeLessThanOrEqual(390);
  });
});
