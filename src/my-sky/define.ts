// Defines <hoshi-my-sky>, once: a page that loads this twice, or two copies of the package, never throws, and the first definition wins.
import { HoshiMySkyElement, MY_SKY_TAG } from "./element.ts";

/**
 * Define `<hoshi-my-sky>` in `registry` (the page's `customElements` by default) unless the name is taken. On a server, where there is no registry, it does nothing.
 *
 * @param registry - Where to define it.
 * @returns Whether this call defined it.
 *
 * @example
 * ```js no-run
 * import { defineMySky } from "@johnmorrisdotca/hoshi-stars/my-sky/define";
 *
 * defineMySky();
 * document.body.insertAdjacentHTML("beforeend", '<hoshi-my-sky latitude="49.28" longitude="-123.12"></hoshi-my-sky>');
 * ```
 */
export function defineMySky(registry: CustomElementRegistry | undefined = globalThis.customElements): boolean {
  if (registry === undefined || registry.get(MY_SKY_TAG) !== undefined) return false;
  registry.define(MY_SKY_TAG, HoshiMySkyElement);
  return true;
}

defineMySky();
