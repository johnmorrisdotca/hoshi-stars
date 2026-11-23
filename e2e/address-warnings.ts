// For a test that waits for the address to follow a choice: what the page said on the console, printed when the wait fails, so a dropped write says why (a refused replaceState warns once).
import { expect, type Page } from "@playwright/test";

/** Remember the page's console warnings and errors and its uncaught errors. */
export function watchConsole(page: Page): string[] {
  const said: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") said.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => said.push(`pageerror: ${error.message}`));
  return said;
}

/** Wait for a part of the address to be `expected` (`null` for none); when it never is, the failure carries the address and what the page said. */
export async function expectParam(page: Page, name: string, expected: string | null, said: string[]): Promise<void> {
  try {
    await expect.poll(() => new URL(page.url()).searchParams.get(name)).toBe(expected);
  } catch (error) {
    throw new Error(`${(error as Error).message}\nthe address is now ${page.url()}\nthe page's console warnings and errors: ${said.length === 0 ? "none" : said.join(" | ")}`);
  }
}
