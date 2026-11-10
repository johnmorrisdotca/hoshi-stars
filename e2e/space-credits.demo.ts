// The credits of the two pages that draw WebGL (the constellation in 3D and its embed frame): in a file of their own so that WebKit, which has no software drawing, leaves them to CI like the other space pages.
import { expect, test } from "@playwright/test";

const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";

for (const lang of ["en", "ja"] as const) {
  test(`the constellation in 3D in ${lang} shows its credits in the footer`, async ({ page }) => {
    await page.goto(`/hoshi-stars/constellation-3d.html?c=Ori&lang=${lang}`);
    await expect(page.locator("footer").locator('[data-say="foot"]')).toContainText(lang === "ja" ? "イェール輝星カタログ" : "Yale Bright Star Catalogue");
    await expect(page.locator("footer").locator(`a[href="${NOTICE}"]`)).toBeVisible();
  });
  test(`the 3D embed frame in ${lang} names its source in a corner`, async ({ page }) => {
    await page.goto(`/hoshi-stars/embed-3d.html?c=Ori&lang=${lang}`);
    const credit = page.getByTestId("frame-credit");
    await expect(credit).toBeVisible();
    await expect(credit).toContainText(lang === "ja" ? "イェール輝星カタログ" : "Yale Bright Star Catalogue");
    await expect(credit).toHaveAttribute("href", NOTICE);
    const box = (await credit.boundingBox())!;
    for (const button of await page.locator("button").all()) {
      const other = await button.boundingBox();
      if (other !== null) expect(box.y + box.height <= other.y || other.y + other.height <= box.y || box.x + box.width <= other.x || other.x + other.width <= box.x, "the credit covers a button").toBe(true);
    }
  });
}
