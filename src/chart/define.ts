// Defines <hoshi-chart>, once: a page that loads this twice, or two copies of the package, never throws, and the first definition wins.
import { CHART_TAG, HoshiChartElement } from "./element.ts";

/**
 * Define `<hoshi-chart>` in `registry` (the page's `customElements` by default) unless the name is taken. On a server, where there is no registry, it does nothing.
 *
 * @param registry - Where to define it.
 * @returns Whether this call defined it.
 *
 * @example
 * ```js no-run
 * import { defineChart } from "@johnmorrisdotca/hoshi-stars/chart/define";
 *
 * defineChart();
 * document.body.insertAdjacentHTML("beforeend", '<hoshi-chart constellation="Ori"></hoshi-chart>');
 * ```
 */
export function defineChart(registry: CustomElementRegistry | undefined = globalThis.customElements): boolean {
  if (registry === undefined || registry.get(CHART_TAG) !== undefined) return false;
  registry.define(CHART_TAG, HoshiChartElement);
  return true;
}

defineChart();
