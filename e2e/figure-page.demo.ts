// A figure's own page serves all three skies (MODULES-828): a Western constellation, a figure of the Japanese sky and a mansion or asterism of the Chinese sky, each with its names, its stars, the same patch of sky in the other two cultures, and the sky kept in the address.
import { expect, test, type Page } from "@playwright/test";

const SITE = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const open = async (page: Page, query: string): Promise<void> => {
  await page.goto(`${SITE}constellation.html?${query}`);
  await expect(page.getByTestId("cp-name")).toBeVisible();
};
const overflows = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const loaded = (page: Page, selector: string) => expect.poll(() => page.locator(selector).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

test("a Japanese figure opens with its name in kanji and kana, its story and the Western stars it uses", async ({ page }) => {
  await open(page, "c=hokuto-shichisei&culture=japanese");
  await expect(page.getByTestId("cp-name")).toHaveText("北斗七星");
  await expect(page.getByTestId("cp-sub")).toContainText("ほくとしちせい");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const facts = page.getByTestId("cp-facts");
  await expect(facts).toContainText("北斗七星 (ほくとしちせい)");
  await expect(facts).toContainText("Hokuto Shichisei");
  await expect(facts).toContainText("the Big Dipper");
  await expect(facts).toContainText("七つ星");
  await expect(facts).toContainText("Ursa Major");
  const stars = page.getByTestId("cp-stars").locator("a");
  await expect(stars).toHaveCount(7);
  await expect(page.getByTestId("cp-stars")).toContainText("Dubhe · UMa");
  await expect(page.getByTestId("cp-stars")).toContainText("Alkaid · UMa");
  await expect(page.getByTestId("cp-stars")).toContainText("Mizar");
  await expect(page.locator("#cp-stars-title")).toHaveText("The Western stars it uses");
  await loaded(page, "#cp-image");
  await expect(page.getByTestId("cp-map")).toHaveAttribute("href", "./?culture=japanese&go=hokuto-shichisei");
  await expect(page.getByTestId("cp-space")).toBeHidden();
  await open(page, "c=hokuto-shichisei&culture=japanese&lang=ja");
  await expect(page.getByTestId("cp-name")).toHaveText("北斗七星");
  await expect(page.getByTestId("cp-facts")).toContainText("おおぐま座の北斗七星");
  await expect(page.getByTestId("cp-facts")).toContainText("ほかの呼び名");
  await expect(page.locator("#cp-stars-title")).toHaveText("使っている西洋の星");
});

test("a Chinese mansion opens with its characters, pinyin, English, quarter and the Western stars it uses", async ({ page }) => {
  await open(page, "c=jiao3-xiu4&culture=chinese");
  await expect(page.getByTestId("cp-name")).toHaveText("角宿");
  await expect(page.getByTestId("cp-name")).toHaveAttribute("lang", "zh-Hant");
  await expect(page.getByTestId("cp-sub")).toContainText("jiǎo xiù");
  await expect(page.getByTestId("cp-sub")).toContainText("Horn");
  const facts = page.getByTestId("cp-facts");
  await expect(facts).toContainText("角宿 (jiǎo xiù)");
  await expect(facts).toContainText("Horn");
  await expect(facts).toContainText("Azure Dragon (east)");
  await expect(facts).toContainText("Mansion 1 of 28");
  await expect(facts).not.toContainText("cp_");
  await expect(facts).toContainText("Virgo");
  await expect(page.getByTestId("cp-stars")).toContainText("Spica · Vir");
  await expect(page.getByTestId("cp-stars").locator("a")).toHaveCount(2);
  await loaded(page, "#cp-image");
  await open(page, "c=jiao3-xiu4&culture=chinese&lang=ja");
  await expect(page.getByTestId("cp-name")).toHaveText("角宿");
  await expect(page.getByTestId("cp-facts")).toContainText("青龍 (せいりゅう・東)");
  await expect(page.getByTestId("cp-facts")).toContainText("二十八宿の1番目");
});

test("a Chinese asterism opens with its names, says what its sky does not record, and uses the Western stars of the Dipper", async ({ page }) => {
  await open(page, "c=bei3-dou3&culture=chinese");
  await expect(page.getByTestId("cp-name")).toHaveText("北斗");
  const facts = page.getByTestId("cp-facts");
  await expect(facts).toContainText("北斗 (běi dǒu)");
  await expect(facts).toContainText("Asterism");
  await expect(facts).toContainText("no English name in our data");
  await expect(facts).toContainText("Enclosure or mansion");
  await expect(facts).toContainText("not in our data");
  await expect(page.getByTestId("cp-stars").locator("a")).toHaveCount(7);
  await expect(page.getByTestId("cp-stars")).toContainText("Dubhe · UMa");
  await open(page, "c=hua2-gai4&culture=chinese");
  await expect(facts).toContainText("Canopy of the Emperor");
  await expect(facts).toContainText("Purple Forbidden Enclosure (紫微垣)");
});

test("a Western constellation opens as it always has, with no culture in its address", async ({ page }) => {
  await open(page, "c=Ori");
  await expect(page.getByTestId("cp-name")).toHaveText("Orion");
  await expect(page.getByTestId("cp-facts")).toContainText("Hunter");
  await expect(page.getByTestId("cp-stars")).toContainText("Rigel");
  await expect(page.getByTestId("cp-messier")).toContainText("M42");
  await expect(page.getByTestId("cp-space")).toBeVisible();
  expect(param(page, "culture")).toBeNull();
  await expect(page.locator("#cp-stars-title")).toHaveText("Its bright stars");
});

test("the Japanese sky holds the constellations under their Japanese names, with the Chinese name beside them", async ({ page }) => {
  await open(page, "c=Ori&culture=japanese");
  await expect(page.getByTestId("cp-name")).toHaveText("オリオン座");
  await expect(page.getByTestId("cp-facts")).toContainText("Orion (Orionis)");
  await expect(page.getByTestId("cp-facts")).toContainText("獵戶");
  await expect(page.getByTestId("cp-space")).toBeVisible();
});

test("the same sky in the other two cultures is side by side, each card a link to the matching figure", async ({ page }) => {
  await open(page, "c=bei3-dou3&culture=chinese");
  const compare = page.getByTestId("cp-compare");
  const columns = compare.locator(".cp-column");
  await expect(columns).toHaveCount(2);
  await expect(columns.nth(0).locator("h3")).toHaveText("In the Western sky");
  await expect(columns.nth(1).locator("h3")).toHaveText("In the Japanese sky");
  const western = columns.nth(0).locator("a.pick-tile");
  const japanese = columns.nth(1).locator("a.pick-tile");
  await expect(western).toHaveCount(1);
  await expect(western.first()).toHaveAttribute("href", "constellation.html?c=UMa");
  await expect(japanese.first()).toHaveAttribute("href", "constellation.html?c=hokuto-shichisei&culture=japanese");
  await expect(japanese.first()).toHaveAttribute("title", /7 of the same stars/);
  await expect(japanese.nth(1)).toHaveAttribute("href", "constellation.html?c=UMa&culture=japanese");
  await expect(japanese.first().locator("span").first()).toHaveText("北斗七星");
  await japanese.first().scrollIntoViewIfNeeded();
  await loaded(page, "#cp-compare .cp-column:nth-child(2) img");
  // a desk puts the two columns beside each other, a phone one under the other
  const [one, two] = await Promise.all([columns.nth(0).boundingBox(), columns.nth(1).boundingBox()]);
  if ((page.viewportSize()?.width ?? 0) < 900) expect(two!.y).toBeGreaterThan(one!.y + one!.height - 1);
  else {
    expect(Math.abs(two!.y - one!.y)).toBeLessThan(4);
    expect(two!.x).toBeGreaterThan(one!.x + one!.width - 1);
  }
  await japanese.first().click();
  await expect(page).toHaveURL(/constellation\.html\?c=hokuto-shichisei&culture=japanese$/);
  await expect(page.getByTestId("cp-name")).toHaveText("北斗七星");
  // and back: the Chinese column of the Japanese figure leads to the Chinese Dipper
  await page.getByTestId("cp-compare").locator("a.pick-tile[href*='culture=chinese']").first().click();
  await expect(page).toHaveURL(/constellation\.html\?c=bei3-dou3&culture=chinese$/);
  await expect(page.getByTestId("cp-name")).toHaveText("北斗");
});

test("the sky is chosen on the page and kept in the address, through a reload and a shared link", async ({ page }) => {
  await open(page, "c=Ori");
  const choice = page.getByTestId("cp-cultures");
  await expect(choice.locator("a")).toHaveText(["Western", "Japanese", "Chinese"]);
  await expect(choice.locator("a[aria-current='page']")).toHaveText("Western");
  await choice.getByRole("link", { name: "Japanese" }).click();
  await expect.poll(() => param(page, "culture")).toBe("japanese");
  expect(param(page, "c")).toBe("Ori");
  await expect(page.getByTestId("cp-name")).toHaveText("オリオン座");
  await expect(choice.locator("a[aria-current='page']")).toHaveText("Japanese");
  await choice.getByRole("link", { name: "Chinese" }).click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  expect(param(page, "c")).toBe("shen1-xiu4");
  await expect(page.getByTestId("cp-name")).toHaveText("參宿");
  await page.reload();
  await expect(page.getByTestId("cp-name")).toHaveText("參宿");
  await expect(choice.locator("a[aria-current='page']")).toHaveText("Chinese");
  await choice.getByRole("link", { name: "Western" }).click();
  await expect(page.getByTestId("cp-name")).toHaveText("Orion");
  await expect.poll(() => param(page, "culture")).toBeNull();
  await page.goBack();
  await expect(page.getByTestId("cp-name")).toHaveText("參宿");
  // a sky whose figures hold none of the stars opens that sky's gallery instead
  await open(page, "c=Ant");
  const none = choice.getByRole("link", { name: "Chinese" });
  await expect(none).toHaveAttribute("href", "constellations.html?culture=chinese");
  await expect(page.locator(".cp-column[data-culture='chinese']")).toContainText("No figure of the Chinese sky has any of these stars.");
});

test("an address that names the wrong sky for a figure is made right and keeps the rest of it", async ({ page }) => {
  await open(page, "c=Ori&culture=chinese&lang=ja");
  await expect(page.getByTestId("cp-name")).toHaveText("參宿");
  await expect.poll(() => param(page, "c")).toBe("shen1-xiu4");
  expect(param(page, "culture")).toBe("chinese");
  expect(param(page, "lang")).toBe("ja");
  await open(page, "c=subaru");
  await expect(page.getByTestId("cp-name")).toHaveText("昴");
  await expect.poll(() => param(page, "culture")).toBe("japanese");
  await page.goto(`${SITE}constellation.html?c=Zzz&culture=chinese`);
  await expect(page.locator("#cp-missing")).toBeVisible();
});

test("the neighbours are the cards of the figure's own sky, in its own writing, and lead to their pages", async ({ page }) => {
  await open(page, "c=bei3-dou3&culture=chinese");
  const cards = page.getByTestId("cp-neighbours").locator("a.pick-tile");
  await expect(cards).toHaveCount(6);
  await expect(page.locator("#cp-neighbours-title")).toHaveText("Nearest figures in this sky");
  for (let at = 0; at < 6; at++) {
    await expect(cards.nth(at)).toHaveAttribute("href", /^constellation\.html\?c=[a-z0-9-]+&culture=chinese$/);
    await expect(cards.nth(at).locator("img")).toHaveAttribute("src", /thumbnails\/chinese\/png\/160\/(light|dark)\/[a-z0-9-]+\.png$/);
  }
  await cards.first().scrollIntoViewIfNeeded();
  await loaded(page, "#cp-neighbours img");
  const first = await cards.first().getAttribute("href");
  await cards.first().click();
  await expect(page).toHaveURL(new RegExp(`${first!.replace("?", "\\?")}$`));
  await open(page, "c=subaru&culture=japanese");
  await expect(page.getByTestId("cp-neighbours").locator("a.pick-tile").first()).toHaveAttribute("href", "constellation.html?c=Tau&culture=japanese");
  await expect(page.getByTestId("cp-neighbours").locator("a.pick-tile").first().locator("span").first()).toHaveText("おうし座");
});

test("the limits that apply are said: our own joins, the faint stars missing, and Wikidata for the Chinese names", async ({ page }) => {
  await open(page, "c=wei4-xiu4&culture=chinese");
  const limits = page.getByTestId("cp-limits");
  await expect(limits).toContainText("our own joins");
  await expect(limits).toContainText("Wikidata (CC0)");
  await open(page, "c=yu3-lin2-jun1&culture=chinese");
  await expect(page.getByTestId("cp-limits")).toContainText(/At least \d+ of its stars are fainter than magnitude 6\.0/);
  await open(page, "c=Ori");
  await expect(page.getByTestId("cp-limits")).toContainText("our own joins");
  await expect(page.getByTestId("cp-limits")).not.toContainText("Wikidata");
  await open(page, "c=subaru&culture=japanese");
  await expect(page.getByTestId("cp-limits")).toContainText("a published list");
  await open(page, "c=bei3-dou3&culture=chinese&lang=ja");
  await expect(page.getByTestId("cp-limits")).toContainText("Wikidata (CC0)");
  await expect(page.getByTestId("cp-limits")).toContainText("線は私たちが星をつないだもの");
});

test("nothing overflows at 390 wide, in either language, for a figure of each sky", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const query of ["c=Ori", "c=hokuto-shichisei&culture=japanese", "c=yu3-lin2-jun1&culture=chinese", "c=bei3-dou3&culture=chinese", "c=UMa&culture=japanese"]) {
    for (const lang of ["", "&lang=ja"]) {
      await open(page, query + lang);
      await expect(page.getByTestId("cp-compare").locator(".cp-column")).toHaveCount(2);
      expect(await overflows(page), query + lang).toBe(false);
      // every card in the page is whole inside the width
      const outside = await page.evaluate(() => [...document.querySelectorAll("a.pick-tile, .culture-row a, .fam-button")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
      expect(outside, query + lang).toBe(0);
    }
  }
});
