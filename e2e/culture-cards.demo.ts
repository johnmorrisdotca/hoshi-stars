// The picture cards follow the sky culture: the picker's strip above the map, the gallery and the list show the Western 88, the Japanese sky or the Chinese sky, with the culture kept in the address; a card opens its figure on the map; search finds
// a figure by its Chinese, pinyin, Japanese, kana or English name; nothing is fetched at rest but the pictures in view; and nothing overflows at 390.
import { expect, test, type Page } from "@playwright/test";

const HOME = "/hoshi-stars/";
const param = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);
const strip = (page: Page) => page.getByTestId("picker-strip").locator("button:not([hidden])");
const cultureButton = (page: Page, label: string) => page.getByTestId("cultures").getByRole("button", { name: label, exact: true });
async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${HOME}${query}`);
  await expect(page.locator("#chart circle").first()).toBeVisible();
}
const loaded = (image: ReturnType<Page["locator"]>) => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth);
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("choosing a culture changes the strip: 88 Western, 106 Japanese (the traditional figures first), 238 Chinese (the mansions first), and the culture is in the address", async ({ page }) => {
  await open(page);
  await expect(strip(page)).toHaveCount(88);
  await cultureButton(page, "Chinese").click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  await expect(strip(page)).toHaveCount(238);
  const first = strip(page).first();
  await expect(first).toHaveAttribute("data-abbr", "jiao3-xiu4");
  await expect(first.locator("span").first()).toHaveText("角宿");
  await expect(first).toContainText("jiǎo xiù · Horn");
  await expect(first.locator("img")).toHaveAttribute("src", /thumbnails\/chinese\/png\/160\/(light|dark)\/jiao3-xiu4\.png$/);
  await expect.poll(() => loaded(first.locator("img"))).toBe(160);
  await expect(page.getByTestId("picker-search")).toHaveAttribute("placeholder", /北斗/);
  await expect(page.locator("[data-pick-all]")).toHaveText("All 238 as a gallery");
  await expect(page.locator("[data-pick-all]")).toHaveAttribute("href", "constellations.html?culture=chinese");
  await cultureButton(page, "Japanese").click();
  await expect.poll(() => param(page, "culture")).toBe("japanese");
  await expect(strip(page)).toHaveCount(106);
  await expect(strip(page).first()).toHaveAttribute("data-abbr", "subaru");
  await expect(strip(page).first()).toContainText("すばる · the Pleiades");
  await expect(page.locator("button[data-abbr='Ori']")).toContainText("オリオン座");
  await expect(page.locator("button[data-abbr='Ori'] img")).toHaveAttribute("src", /thumbnails\/png\/160\/(light|dark)\/Ori\.png$/);
  await expect(page.locator("[data-pick-all]")).toHaveText("All 106 as a gallery");
  await cultureButton(page, "Western").click();
  await expect.poll(() => param(page, "culture")).toBeNull();
  await expect(strip(page)).toHaveCount(88);
  await expect(page.locator("[data-pick-all]")).toHaveText("All 88 as a gallery");
});

test("a card opens its figure on the map with the culture kept in the address, and the pressed card follows", async ({ page }) => {
  await open(page, "?culture=chinese");
  await strip(page).filter({ hasText: "北斗" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:bei3-dou3");
  expect(param(page, "culture")).toBe("chinese");
  await expect(page.getByTestId("picked").locator("h3")).toContainText("北斗");
  await expect(page.getByTestId("picker-strip").locator("button[aria-pressed='true']")).toHaveAttribute("data-abbr", "bei3-dou3");
  await cultureButton(page, "Japanese").click();
  await strip(page).filter({ hasText: "昴" }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:subaru");
  expect(param(page, "culture")).toBe("japanese");
});

// Clicking all 344 cards took three minutes on WebKit (the run of 0.22.0 ended with "C:guan4-suo3" read where "C:che1-fu3" was clicked, the test's own time out), so a fixed sample is clicked: the first, the last and every 25th card of each sky.
// The address is written a moment after a choice (kazoku-ui's address state, 250 ms), so each click waits, by polling, for its own figure to be in it and pressed before the next.
test("a sample of the cards of the Chinese and Japanese strips (the first, the last and every 25th) each open their own figure", async ({ page }) => {
  test.setTimeout(120_000);
  for (const culture of ["japanese", "chinese"]) {
    await open(page, `?culture=${culture}`);
    const ids = await page.getByTestId("picker-strip").locator("button").evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.abbr!));
    expect(ids.length).toBe(culture === "chinese" ? 238 : 106);
    for (const id of ids.filter((_, at) => at === 0 || at === ids.length - 1 || at % 25 === 0)) {
      await page.getByTestId("picker-strip").locator(`button[data-abbr='${id}']`).dispatchEvent("click");
      await expect.poll(() => param(page, "pick"), { message: `${culture} ${id}`, timeout: 10_000 }).toBe(`C:${id}`);
      await expect(page.getByTestId("picker-strip").locator("button[aria-pressed='true']")).toHaveAttribute("data-abbr", id);
    }
  }
});

test("search finds a figure by Chinese, pinyin, Japanese, kana, katakana and English, and Enter opens the first", async ({ page }) => {
  await open(page, "?culture=chinese");
  const search = page.getByTestId("picker-search");
  for (const [text, id] of [["北斗", "bei3-dou3"], ["beidou", "bei3-dou3"], ["běi dǒu", "bei3-dou3"], ["虚宿", "xu1-xiu4"], ["Horn", "jiao3-xiu4"]] as const) {
    await search.fill(text);
    await expect(strip(page).filter({ has: page.locator(`[data-abbr='${id}']`) }).or(page.locator(`[data-abbr='${id}']:not([hidden])`)).first()).toBeVisible();
  }
  await search.fill("Horn");
  await expect(strip(page)).toHaveCount(1);
  await search.press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("C:jiao3-xiu4");
  await search.fill("zzzz");
  await expect(strip(page)).toHaveCount(0);
  await expect(page.locator("[data-pick-none]")).toBeVisible();
  await cultureButton(page, "Japanese").click();
  await search.fill("スバル");
  await expect(strip(page).first()).toHaveAttribute("data-abbr", "subaru");
  await search.fill("Pleiades");
  await expect(strip(page)).toHaveCount(1);
  await search.fill("おおぐま");
  await expect(strip(page).first()).toHaveAttribute("data-abbr", "UMa");
  await search.fill("hokuto");
  await expect(strip(page).first()).toHaveAttribute("data-abbr", "hokuto-shichisei");
});

test("a card's name for a screen reader is the name, reading, English and the missing stars; the keyboard reaches cards and Enter opens one", async ({ page, browserName }) => {
  await open(page, "?culture=chinese");
  await expect(strip(page).first()).toHaveAccessibleName("角宿, jiǎo xiù, Horn");
  await expect(page.locator("button[data-abbr='di1-xiu4']")).toHaveAccessibleName("氐宿, dī xiù, Root, 1 star in our data, no lines, 3+ stars not in our data");
  await expect(page.locator("button[data-abbr='di1-xiu4']")).toHaveAttribute("title", "氐宿, dī xiù, Root, 1 star in our data, no lines, 3+ stars not in our data");
  await expect(page.locator("button[data-abbr='di1-xiu4'] .pick-sub")).toHaveText("dī xiù · 1 star in our data, no lines");
  await open(page, "?culture=chinese&lang=ja");
  await expect(page.locator("button[data-abbr='di1-xiu4']")).toHaveAccessibleName("氐宿、dī xiù、Root、データにある星は1個、線なし、データにない星が3個以上");
  await strip(page).nth(1).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => param(page, "pick")).toBe("C:kang4-xiu4");
  // WebKit on macOS skips buttons on Tab unless a system setting is on, so the Tab order is checked on Chromium, and WebKit focuses the card directly
  if (browserName === "webkit") await page.locator("button[data-abbr='di1-xiu4']").focus();
  else await page.keyboard.press("Tab");
  await expect(page.locator("button[data-abbr='di1-xiu4']")).toBeFocused();
});

test("nothing is fetched at rest but the pictures in view: a handful of lazy 160-pixel cards, none of the 480-pixel ones", async ({ page }) => {
  const pictures: string[] = [];
  page.on("request", (request) => {
    if (/thumbnails\//.test(request.url())) pictures.push(request.url());
  });
  await open(page, "?culture=chinese");
  await page.waitForTimeout(1200);
  const strips = pictures.filter((url) => /thumbnails\/chinese\/png\/160\//.test(url));
  expect(strips.length).toBeGreaterThan(0);
  expect(strips.length).toBeLessThan(40);
  expect(pictures.filter((url) => /\/480\//.test(url))).toEqual([]);
  const before = pictures.length;
  await page.waitForTimeout(1500);
  expect(pictures.length).toBe(before);
});

test("the gallery: three culture buttons kept in the address, a title that says which sky, the count, 24 pictures a page, and a tile opens the figure on the map", async ({ page }) => {
  await page.goto(`${HOME}constellations.html`);
  await expect(page.getByTestId("cultures").getByRole("button")).toHaveText(["Western", "Japanese", "Chinese"]);
  await expect(page.getByTestId("gallery-heading")).toHaveText("The 88 constellations");
  await expect(page.getByTestId("gallery-mix")).toBeHidden();
  await cultureButton(page, "Chinese").click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  await expect(page.getByTestId("gallery-heading")).toHaveText("The Chinese sky: 238 figures");
  await expect(page).toHaveTitle(/Chinese sky/);
  await expect(page.getByTestId("gallery-count")).toHaveText("238 of 238");
  await expect(page.getByTestId("gallery-mix")).toHaveText("28 mansions and 210 asterisms");
  const tiles = page.getByTestId("gallery-grid").locator("a");
  await expect(tiles).toHaveCount(24);
  await expect(tiles.first()).toHaveAttribute("data-abbr", "jiao3-xiu4");
  await expect(tiles.first().locator("img")).toHaveAttribute("src", /thumbnails\/chinese\/png\/480\/(light|dark)\/jiao3-xiu4\.png$/);
  await expect.poll(() => loaded(tiles.first().locator("img"))).toBe(480);
  await expect(tiles.first()).toContainText("角宿");
  await expect(tiles.first()).toContainText("jiǎo xiù · Horn");
  await expect(page.getByTestId("gallery-pager").locator("button")).toHaveCount(12);
  await page.getByTestId("gallery-search").fill("beidou");
  await expect(tiles).toHaveCount(1);
  await expect(page.getByTestId("gallery-count")).toHaveText("1 of 238");
  await expect.poll(() => param(page, "q")).toBe("beidou");
  await tiles.first().click();
  await expect.poll(() => param(page, "pick")).toBe("C:bei3-dou3");
  expect(param(page, "culture")).toBe("chinese");
  expect(param(page, "go")).toBeNull();
  await expect(page.getByTestId("picked").locator("h3")).toContainText("北斗");
});

test("the gallery of the Japanese sky holds 106 figures, finds them by kana and English, and a Western tile still opens the constellation's page", async ({ page }) => {
  await page.goto(`${HOME}constellations.html?culture=japanese`);
  await expect(page.getByTestId("gallery-heading")).toHaveText("The Japanese sky: 106 figures");
  await expect(page.getByTestId("gallery-mix")).toHaveText("88 constellations and 18 traditional figures");
  const tiles = page.getByTestId("gallery-grid").locator("a");
  await expect(tiles.first()).toHaveAttribute("data-abbr", "subaru");
  await page.getByTestId("gallery-search").fill("しちせい");
  await expect(tiles).toHaveCount(1);
  await page.getByTestId("gallery-search").fill("Orion's belt");
  await expect(tiles).toHaveCount(1);
  await tiles.first().click();
  await expect.poll(() => param(page, "pick")).toBe("C:mitsuboshi");
  expect(param(page, "culture")).toBe("japanese");
  await page.goto(`${HOME}constellations.html?culture=japanese&q=ursa+major`);
  await expect(tiles).toHaveCount(1);
  await page.getByTestId("cultures").getByRole("button", { name: "Western", exact: true }).click();
  await expect.poll(() => param(page, "culture")).toBeNull();
  await expect(tiles.first()).toHaveAttribute("href", /constellation\.html\?c=/);
  await page.goto(`${HOME}constellations.html?lang=ja&culture=chinese`);
  await expect(page.getByTestId("gallery-heading")).toHaveText("中国の空: 238の図");
  await expect(page.getByTestId("gallery-mix")).toHaveText("宿28と星官210");
});

test("the list: three culture buttons, a table of the culture's figures with a search and the filters that fit, and Map opens the figure", async ({ page }) => {
  await page.goto(`${HOME}constellation-list.html`);
  await expect(page.getByTestId("cultures").getByRole("button")).toHaveText(["Western", "Japanese", "Chinese"]);
  await expect(page.getByTestId("list-search")).toBeHidden();
  await cultureButton(page, "Chinese").click();
  await expect.poll(() => param(page, "culture")).toBe("chinese");
  await expect(page.getByTestId("list-heading")).toHaveText("The Chinese sky: a table of its figures");
  await expect(page.getByTestId("list-mix")).toHaveText("28 mansions and 210 asterisms");
  const rows = page.getByTestId("list-table").locator("tbody tr");
  await expect(rows).toHaveCount(238);
  await expect(page.getByTestId("list-count")).toHaveText("238 of 238 shown");
  await expect(rows.first()).toContainText("角宿");
  await expect(rows.first()).toContainText("jiǎo xiù");
  await expect(rows.first()).toContainText("Mansion");
  await expect(rows.first().locator("img")).toHaveAttribute("src", /thumbnails\/chinese\/png\/160\/(light|dark)\/jiao3-xiu4\.png$/);
  await page.getByTestId("list-search").fill("beidou");
  await expect(rows).toHaveCount(1);
  await expect.poll(() => param(page, "q")).toBe("beidou");
  await page.getByTestId("list-clear").click();
  await expect(rows).toHaveCount(238);
  await page.goto(`${HOME}constellation-list.html?culture=japanese`);
  await expect(rows).toHaveCount(106);
  await expect(page.getByTestId("list-heading")).toHaveText("The Japanese sky: a table of its figures");
  await rows.filter({ hasText: "鼓星" }).getByRole("link", { name: /Map/ }).click();
  await expect.poll(() => param(page, "pick")).toBe("C:tsuzumi-boshi");
  expect(param(page, "culture")).toBe("japanese");
});

test("nothing overflows at 390 wide: the strip, the gallery and the list in every culture", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const culture of ["", "japanese", "chinese"]) {
    const query = culture === "" ? "" : `?culture=${culture}`;
    await open(page, query);
    expect(await noOverflow(page), `the map page ${culture}`).toBe(true);
    await page.goto(`${HOME}constellations.html${query}`);
    await expect(page.getByTestId("gallery-grid").locator("a").first()).toBeVisible();
    expect(await noOverflow(page), `the gallery ${culture}`).toBe(true);
    await page.goto(`${HOME}constellation-list.html${query}`);
    await expect(page.getByTestId("list-table").locator("tbody tr").first()).toBeVisible();
    expect(await noOverflow(page), `the list ${culture}`).toBe(true);
  }
});

/** The height of every element in a list, and how many of them (rounded, so a sub-pixel difference is not a difference). */
const heights = (items: ReturnType<Page["locator"]>) => items.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));

test("every card is one height in all three skies: the strip, the gallery and the list, with the name and one small line and nothing taller", async ({ page }) => {
  test.setTimeout(120_000);
  const seen = new Map<string, number>();
  for (const culture of ["western", "japanese", "chinese"]) {
    const query = culture === "western" ? "" : `?culture=${culture}`;
    await open(page, query);
    await expect(page.getByTestId("picker-strip").locator("button").first()).toBeVisible();
    const strips = await heights(page.getByTestId("picker-strip").locator("button:not([hidden])"));
    expect(new Set(strips).size, `${culture}: the strip's cards are one height (${[...new Set(strips)].join(", ")})`).toBe(1);
    seen.set(`strip ${culture}`, strips[0]!);
    // the name and the line never run to a third line: nothing in the card is cut but the line under the name, whose whole text is its title
    const cut = await page.getByTestId("picker-strip").locator("button:not([hidden])").evaluateAll((cards) =>
      cards.filter((card) => {
        const name = card.querySelector("span:first-of-type") as HTMLElement;
        return name.scrollHeight > name.clientHeight + 1;
      }).map((card) => card.getAttribute("data-abbr")),
    );
    expect(cut, `${culture}: a name that needs a third line`).toEqual([]);
    await page.goto(`${HOME}constellations.html${query}`);
    await expect(page.locator(".gl-tile").first()).toBeVisible();
    const tiles = await heights(page.locator(".gl-tile"));
    expect(new Set(tiles).size, `${culture}: the gallery's tiles are one height (${[...new Set(tiles)].join(", ")})`).toBe(1);
    seen.set(`gallery ${culture}`, tiles[0]!);
    const lines = await page.locator(".gl-tile").evaluateAll((all) => all.map((tile) => ({ name: (tile.querySelector(".gl-name") as HTMLElement).scrollHeight > (tile.querySelector(".gl-name") as HTMLElement).clientHeight + 1, children: tile.children.length })));
    expect(lines.filter((line) => line.name || line.children !== 3)).toEqual([]);
    await page.goto(`${HOME}constellation-list.html${query}`);
    await expect(page.locator(".ls-table tbody tr").first()).toBeVisible();
    const rows = await heights(page.locator(".ls-table tbody tr"));
    expect(new Set(rows).size, `${culture}: the list's rows are one height (${[...new Set(rows)].join(", ")})`).toBe(1);
    seen.set(`list ${culture}`, rows[0]!);
  }
  for (const place of ["strip", "gallery", "list"]) {
    const three = ["western", "japanese", "chinese"].map((culture) => seen.get(`${place} ${culture}`)!);
    expect(new Set(three).size, `${place}: the three skies' cards are one height (${three.join(", ")})`).toBe(1);
  }
});

test("a single named star's card is that star ringed in the sky round it, with no other figure's lines", async ({ page }) => {
  await open(page, "?culture=japanese");
  const card = page.locator("button[data-abbr='genji-boshi']");
  await expect(card.locator("img")).toHaveAttribute("src", /thumbnails\/japanese\/png\/160\/(light|dark)\/genji-boshi\.png$/);
  await card.locator("img").scrollIntoViewIfNeeded();
  await expect.poll(() => loaded(card.locator("img"))).toBe(160);
  const response = await page.request.get(await card.locator("img").evaluate((img: HTMLImageElement) => img.src));
  expect(response.ok()).toBe(true);
  // the picture is the sky round the star, not a lone dot (which is under 2 kB), and not its constellation's figure (over 6 kB with the figure's lines): the unit tests hold that it has no lines
  const size = (await response.body()).length;
  expect(size).toBeGreaterThan(2_000);
  expect(size).toBeLessThan(6_000);
});

test("an address that picks a figure and gives no place opens on the figure: lit where it has lines, its stars ringed where it has none, in each sky", async ({ page }) => {
  // the lit lines and the rings of the picked figure, and where they are on the map
  const litOn = (page: Page) =>
    page.locator("#chart").evaluate((svg) => {
      const box = svg.getBoundingClientRect();
      const lit = [...svg.querySelectorAll('path[stroke="#ffd86b"][stroke-width="2.2"]')].filter((path) => (path.getAttribute("d") ?? "") !== "");
      const rings = [...svg.querySelectorAll("[data-figure-star]")];
      const inView = [...lit, ...rings].some((shape) => {
        const at = shape.getBoundingClientRect();
        return at.right > box.left && at.left < box.right && at.bottom > box.top && at.top < box.bottom;
      });
      return { lines: lit.reduce((sum, path) => sum + (path.getAttribute("d")!.match(/M/g) ?? []).length, 0), rings: rings.length, inView };
    });
  for (const [query, lines, rings] of [
    ["culture=chinese&pick=C%3Afang2-xiu4", 2, 0],
    ["culture=chinese&pick=C%3Adi1-xiu4", 0, 1],
    ["culture=japanese&pick=C%3Asubaru", 5, 0],
    ["pick=C%3ALib", 6, 0],
  ] as const) {
    await open(page, `?${query}`);
    await expect.poll(() => litOn(page), { message: query }).toEqual({ lines, rings, inView: true });
    // the address keeps the pick, and the place is the figure's, written once the view is
    expect(param(page, "pick")).toBe(decodeURIComponent(query.split("pick=")[1]!));
  }
});
