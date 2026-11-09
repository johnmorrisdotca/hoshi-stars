// The demo's own tests: a real browser, real taps. `pnpm test:demo` builds the site and runs them.
// The server is scripts/dev.ts on port 8251, at the site's real address /hoshi-stars/: this package's block of ports is 8250 to 8274, and tests use 8251.
// The projects are Chromium and WebKit at a desk's width and a phone's. The sky chart is SVG; the constellation in 3D is WebGL, so every Chromium project draws it in software (SOFTWARE_GL_ARGS), never on the machine's graphics
// card, and WebKit, which has no software switch, skips the pages that draw WebGL off CI (CI plays them).
import { SOFTWARE_GL_ARGS } from "@johnmorrisdotca/kazoku-ui/testing";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_PORT ?? 8251);
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const desk = { viewport: { width: 1280, height: 900 } };
/** The pages and tests that draw WebGL. */
const WEBGL = ["**/space*.demo.ts", "**/freeze.demo.ts"];
const software = { launchOptions: { args: [...SOFTWARE_GL_ARGS] } };

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.demo.{ts,mjs}",
  fullyParallel: true,
  forbidOnly: true,
  workers: process.env.CI ? 2 : 2,
  globalSetup: "@johnmorrisdotca/kazoku-ui/testing/global-setup",
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: "reduce", locale: "en-US" },
  webServer: { command: "node scripts/dev.ts", env: { PORT: String(port) }, url: `http://127.0.0.1:${port}/hoshi-stars/`, reuseExistingServer: false },
  projects: [
    { name: "chromium-desk", use: { ...devices["Desktop Chrome"], ...desk, ...software } },
    { name: "chromium-phone", use: { ...devices["Desktop Chrome"], ...phone, ...software } },
    // WebKit on a desktop viewport with touch: `isMobile` is Chromium's to honour.
    { name: "webkit-desk", use: { ...devices["Desktop Safari"], ...desk }, testIgnore: process.env.CI ? [] : WEBGL },
    { name: "webkit-phone", use: { ...devices["Desktop Safari"], viewport: phone.viewport, hasTouch: true }, testIgnore: process.env.CI ? [] : WEBGL },
  ],
});
