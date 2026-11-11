// The teachers' guide "One sky, three traditions" links each of its five patterns to the demo in each of the three skies. Every link, in the English guide and the Japanese one, opens the demo
// in that sky with that figure picked, and its card names it.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SITE = "https://johnmorrisdotca.github.io/hoshi-stars/";
const linksOf = (file: string): string[] => [...readFileSync(new URL(`../docs/guides/${file}`, import.meta.url), "utf8").matchAll(/\]\((https:\/\/johnmorrisdotca\.github\.io\/hoshi-stars\/\?[^)]+)\)/g)].map((m) => m[1]!).filter((link) => link.includes("pick="));
const english = linksOf("one-sky-three-traditions.md");
const japanese = linksOf("ja/one-sky-three-traditions.md");

/** What the card of each picked figure says, in the culture the link chooses. */
const CARD: Record<string, string> = {
  "western C:Ori": "Orion",
  "japanese C:tsuzumi-boshi": "つづみぼし",
  "chinese C:shen1-xiu4": "shēn xiù",
  "western C:big-dipper": "Big Dipper",
  "japanese C:hokuto-shichisei": "ほくとしちせい",
  "chinese C:bei3-dou3": "běi dǒu",
  "western D:M45": "Pleiades",
  "japanese C:subaru": "すばる",
  "chinese C:mao3-xiu4": "mǎo xiù",
  "western C:summer-triangle": "Summer Triangle",
  "japanese C:orihime": "おりひめ",
  "chinese C:zhi1-nu3": "zhī nǚ",
  "western C:Sco": "Scorpius",
  "japanese C:Sco": "さそり座",
  "chinese C:xin1-xiu4": "xīn xiù",
};

test("the two guides link the same fifteen views, three skies for each of five patterns", () => {
  expect(english.length).toBe(15);
  expect(japanese.map((link) => link.replace(/&lang=ja/, ""))).toEqual(english);
});

for (const link of english) {
  const query = new URL(link).searchParams;
  const key = `${query.get("culture") ?? "western"} ${query.get("pick")}`;
  test(`${key} opens in that sky with the figure picked and named`, async ({ page }) => {
    await page.goto(link.replace(SITE, "/hoshi-stars/"));
    await expect(page.locator("#chart circle").first()).toBeVisible();
    const sky = { western: "Western", japanese: "Japanese", chinese: "Chinese" }[query.get("culture") ?? "western"]!;
    await expect(page.getByTestId("cultures").getByRole("button", { name: sky, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(CARD[key], `a card text for ${key}`).toBeDefined();
    await expect(page.getByTestId("picked")).toContainText(CARD[key]!);
  });
}
