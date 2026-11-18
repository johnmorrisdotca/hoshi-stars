// Defines <hoshi-flight>, once: a page that loads this twice, or two copies of the package, never throws, and the first definition wins.
import { FLIGHT_TAG, HoshiFlightElement } from "./flight-element.ts";

/**
 * Define `<hoshi-flight>` in `registry` (the page's `customElements` by default) unless the name is taken. On a server, where there is no registry, it does nothing.
 *
 * @param registry - Where to define it.
 * @returns Whether this call defined it.
 *
 * @example
 * ```js no-run
 * import { defineFlight } from "@johnmorrisdotca/hoshi-stars/flight/define";
 *
 * defineFlight();
 * document.body.insertAdjacentHTML("beforeend", '<hoshi-flight at="sun"></hoshi-flight>');
 * ```
 */
export function defineFlight(registry: CustomElementRegistry | undefined = globalThis.customElements): boolean {
  if (registry === undefined || registry.get(FLIGHT_TAG) !== undefined) return false;
  registry.define(FLIGHT_TAG, HoshiFlightElement);
  return true;
}

defineFlight();
