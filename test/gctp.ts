// For the tests that pin the Yale GCTP parallaxes and the nearby layer (MODULES-779): the fallback build (scripts/data-source.mjs: HOSHI_NO_GCTP=1, or its default flipped) has neither, so they are skipped
// there, and test/no-gctp.test.ts says what that build holds instead. Pass it as the options of `test`: `test("...", onlyWithGctp, () => { ... })`.
import { noGctp } from "../scripts/data-source.mjs";

/** `skip` is the reason on the fallback build, `false` otherwise. */
export const onlyWithGctp = { skip: noGctp() ? "pins the Yale GCTP data, which the fallback build does not hold (see test/no-gctp.test.ts)" : false };
