// Back and forward on the sky-by-distance page redraw the sky and then refresh the copied code. A write this page made itself does neither.

/** Apply an address change. `redraw` runs first, then `codes`, so the copied code matches the sky just drawn. A change this page wrote is ignored. */
export function followDistanceAddress(source: string, redraw: () => void, codes: () => void): void {
  if (source !== "navigation") return;
  redraw();
  codes();
}
