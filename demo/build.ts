// What the demo knows about the build it was made in. `__HOSHI_NO_GCTP__` is set by scripts/site.ts (esbuild's `define`): true when the bundle holds the fallback parallax data in place of the Yale GCTP's
// (scripts/data-source.mjs), so a page can say what that data lacks. It is undefined where nothing defines it (a test that imports a demo module), and then the Yale data is assumed.
declare const __HOSHI_NO_GCTP__: boolean | undefined;

/** Whether this bundle was built without the Yale GCTP parallaxes: the distances have no error ranges, and there is no nearby-star layer. */
export const NO_GCTP: boolean = typeof __HOSHI_NO_GCTP__ === "boolean" && __HOSHI_NO_GCTP__;
