// The faint stars, to magnitude 12 from UCAC4, in sky tiles loaded for the part of the sky a page shows: the tile grid and decoder (`./faint-core.ts`, pure) and the loader that fetches them (`./faint-load.ts`).
// The faint tier (`@johnmorrisdotca/hoshi-stars/faint`): nothing else imports it, so a page that never loads it pays nothing.
export * from "./faint-core.ts";
export * from "./faint-load.ts";
