// The picker above the sky map: a strip of the constellations' pictures with a search box. Tapping one calls `go`, and the page's map flies there and picks it.
import { constellation } from "../src/constellations.ts";
import { makeCard, paintCard } from "./constellation-card.ts";
import { answers, inOrder, langNow, lookNow, onLook } from "./thumbs.ts";

export interface PickerOptions {
  strip: HTMLElement;
  search: HTMLInputElement;
  /** Fly to and pick this constellation (its IAU abbreviation). */
  go: (abbreviation: string) => void;
  /** The abbreviation of the constellation picked now, if one is. */
  current: () => string | undefined;
  say: (key: string) => string;
}

export function mountPicker(o: PickerOptions): { refresh: () => void } {
  const tiles = new Map<string, HTMLButtonElement>();
  let built = "";
  let shown: string[] = [];

  function build(): void {
    const lang = langNow();
    tiles.clear();
    o.strip.replaceChildren(
      ...inOrder(lang).map((c) => {
        const button = makeCard(c.abbreviation) as HTMLButtonElement;
        button.addEventListener("click", () => o.go(c.abbreviation));
        tiles.set(c.abbreviation, button);
        return button;
      }),
    );
    built = lang;
  }

  function refresh(): void {
    if (built !== langNow()) build();
    const lang = langNow();
    const look = lookNow();
    const here = o.current();
    shown = [];
    for (const [abbreviation, button] of tiles) {
      const c = constellation(abbreviation)!;
      const show = answers(c, o.search.value);
      button.hidden = !show;
      if (show) shown.push(abbreviation);
      paintCard(button, c, lang, look);
      button.setAttribute("aria-pressed", String(abbreviation === here));
    }
    const none = (o.strip.closest(".picker") ?? o.strip.parentElement)?.querySelector<HTMLElement>("[data-pick-none]");
    if (none !== null && none !== undefined) none.hidden = shown.length > 0;
    const picked = here === undefined ? undefined : tiles.get(here);
    if (picked !== undefined && !picked.hidden) {
      const left = picked.offsetLeft - o.strip.offsetLeft - (o.strip.clientWidth - picked.offsetWidth) / 2;
      if (Math.abs(o.strip.scrollLeft - left) > o.strip.clientWidth / 2) o.strip.scrollTo({ left, behavior: "auto" });
    }
  }

  o.search.addEventListener("input", refresh);
  o.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && shown[0] !== undefined) {
      event.preventDefault();
      o.go(shown[0]);
    }
  });
  onLook(refresh);
  document.addEventListener("hoshi-language", refresh);
  refresh();
  return { refresh };
}
