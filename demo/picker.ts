// The picker above the sky map: a strip of the figures' pictures with a search box. Tapping one calls `go`, and the page's map flies there and picks it.
// The strip follows the sky culture the page is in: the 88 constellations in the Western sky, the traditional figures and the 88 under their Japanese names in the Japanese sky, the Three Enclosures and the Twenty-Eight Mansions in the Chinese sky.
import { makeCard, paintCard } from "./constellation-card.ts";
import { cardAnswers, cardsOf, type FigureCard } from "./culture-cards.ts";
import { DEFAULT_CULTURE, type CultureId } from "./cultures.ts";
import { langNow, lookNow, onLook } from "./thumbs.ts";

export interface PickerOptions {
  strip: HTMLElement;
  search: HTMLInputElement;
  /** The sky culture the strip shows (the Western sky when left out). */
  culture?: () => CultureId;
  /** Fly to and pick this figure (a constellation's IAU abbreviation, else the figure's id in its culture). */
  go: (abbreviation: string) => void;
  /** The id of the figure picked now, if one is. */
  current: () => string | undefined;
  /** Whether the cards' names carry kana readings (readings.ts). */
  readings?: () => boolean;
  /** The page's words by key (`pk_all`, `pk_placeholder` and the `pk_…_japanese` and `pk_…_chinese` ones). */
  say: (key: string) => string;
}

export function mountPicker(o: PickerOptions): { refresh: () => void } {
  const tiles = new Map<string, { button: HTMLButtonElement; card: FigureCard }>();
  const cultureNow = (): CultureId => o.culture?.() ?? DEFAULT_CULTURE;
  let built = "";
  let shown: string[] = [];

  /** The strip's cards, made again when the culture changes (and, in the Western sky, the language, which orders them). */
  function build(): void {
    tiles.clear();
    o.strip.replaceChildren(
      ...cardsOf(cultureNow(), langNow()).map((card) => {
        const button = makeCard(card.id) as HTMLButtonElement;
        button.addEventListener("click", () => o.go(card.id));
        tiles.set(card.id, { button, card });
        return button;
      }),
    );
    o.strip.scrollLeft = 0;
    built = `${cultureNow()}|${cultureNow() === "western" ? langNow() : ""}`;
  }

  /** The link to the gallery and the search box's hint, in the culture's words. */
  function words(): void {
    const culture = cultureNow();
    const all = (o.strip.closest(".picker") ?? o.strip.parentElement)?.querySelector<HTMLAnchorElement>("[data-pick-all]");
    if (all !== null && all !== undefined) {
      all.textContent = culture === "western" ? o.say("pk_all") : o.say("pk_all_figures").replace("{n}", String(tiles.size));
      all.href = culture === "western" ? "constellations.html" : `constellations.html?culture=${culture}`;
    }
    o.search.placeholder = o.say(culture === "western" ? "pk_placeholder" : `pk_placeholder_${culture}`);
  }

  function refresh(): void {
    if (built !== `${cultureNow()}|${cultureNow() === "western" ? langNow() : ""}`) build();
    const lang = langNow();
    const look = lookNow();
    const here = o.current();
    shown = [];
    for (const [id, { button, card }] of tiles) {
      const show = cardAnswers(card, o.search.value);
      button.hidden = !show;
      if (show) shown.push(id);
      paintCard(button, card, lang, look, o.readings?.() ?? false);
      button.setAttribute("aria-pressed", String(id === here));
    }
    words();
    const none = (o.strip.closest(".picker") ?? o.strip.parentElement)?.querySelector<HTMLElement>("[data-pick-none]");
    if (none !== null && none !== undefined) none.hidden = shown.length > 0;
    const picked = here === undefined ? undefined : tiles.get(here)?.button;
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
