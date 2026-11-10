// The gallery: a grid of the pictures of a sky culture's figures with a search box and pages: the 88 constellations (the Western sky), the Japanese sky or the Chinese sky. A Western tile opens that constellation's own page (constellation.html);
// a figure of the Japanese or Chinese sky opens on the sky map in its culture. The culture, the search and the page are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { cardAnswers, cardsOf, faceOf, mixOf, pictureOf, type FigureCard } from "./culture-cards.ts";
import { cultureIn, mountCultureButtons } from "./culture-buttons.ts";
import { langNow, lookNow, onLook } from "./thumbs.ts";
import { say } from "./words.ts";

const PAGE = 24;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState({ defaults: { q: "", page: "1" } });

/** Where a tile leads: the constellation's own page in the Western sky, else the sky map in the culture, opened on the figure. */
const hrefOf = (card: FigureCard): string => (card.culture === "western" ? `constellation.html?c=${card.id}` : `./?culture=${card.culture}&go=${encodeURIComponent(card.id)}`);

function tile(card: FigureCard, lang: "en" | "ja", look: "light" | "dark"): HTMLLIElement {
  const face = faceOf(card, lang);
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "gl-tile";
  link.href = hrefOf(card);
  link.dataset.abbr = card.id;
  const image = document.createElement("img");
  image.src = pictureOf(card, 480, look);
  image.width = 240;
  image.height = 240;
  image.loading = "lazy";
  image.alt = "";
  const name = Object.assign(document.createElement("span"), { className: "gl-name", textContent: face.name });
  const sub = Object.assign(document.createElement("span"), {
    className: "gl-sub",
    textContent: card.culture === "western" ? `${card.id} · ${lang === "ja" ? card.constellation!.name : card.constellation!.japanese}` : [face.reading, face.english].filter((part) => part !== "").join(" · "),
  });
  link.append(image, name, sub);
  if (face.missingText !== "") link.append(Object.assign(document.createElement("span"), { className: "gl-sub", textContent: face.missingText }));
  link.setAttribute("aria-label", face.label);
  item.append(link);
  return item;
}

function render(): void {
  const lang = langNow();
  const look = lookNow();
  const culture = cultureIn(address);
  const all = cardsOf(culture, lang);
  const found = all.filter((card) => cardAnswers(card, address.get("q") ?? ""));
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(address.get("page")) || 1));
  const search = $<HTMLInputElement>("gl-search");
  if (search.value !== (address.get("q") ?? "") && document.activeElement !== search) search.value = address.get("q") ?? "";
  // the page says which sky it shows, in its heading, its title and its words
  const western = culture === "western";
  const n = all.length;
  const heading = western ? say("gl_heading") : say(`gl_heading_${culture}`, { n });
  $("gl-heading").textContent = heading;
  document.title = western ? say("gl_title") : say(`gl_title_${culture}`, { n });
  $("gl-lede").textContent = say(western ? "gl_lede" : `gl_lede_${culture}`);
  $("gl-search-label").textContent = say(western ? "gl_search" : "gl_search_figures");
  search.placeholder = western ? say("gl_placeholder") : say(`pk_placeholder_${culture}`);
  $("gl-count").textContent = say("gl_count", { n: found.length, total: n });
  const mix = mixOf(culture);
  const mixText = $("gl-mix");
  mixText.hidden = mix === undefined;
  mixText.textContent = mix === undefined ? "" : say(`gl_mix_${culture}`, { a: mix[0], b: mix[1] });
  $("gl-none").textContent = say(western ? "gl_none" : "gl_none_figures");
  $("gl-none").hidden = found.length > 0;
  cultures.refresh();
  $("gl-grid").replaceChildren(...found.slice((page - 1) * PAGE, page * PAGE).map((card) => tile(card, lang, look)));
  const pager = $("gl-pager");
  pager.hidden = pages === 1;
  const buttons: HTMLButtonElement[] = [];
  const add = (label: string, to: number, current = false, name = label): void => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fam-button";
    button.textContent = label;
    button.setAttribute("aria-label", name);
    button.disabled = to < 1 || to > pages;
    if (current) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      address.set("page", to === 1 ? null : String(to));
      render();
      window.scrollTo({ top: 0 });
    });
    buttons.push(button);
  };
  add(say("gl_prev"), page - 1);
  for (let n = 1; n <= pages; n++) add(String(n), n, n === page, say("gl_page", { n, total: pages }));
  add(say("gl_next"), page + 1);
  pager.replaceChildren(...buttons);
}

const cultures = mountCultureButtons($("gl-cultures"), address, () => render());
$("gl-find").addEventListener("submit", (event) => event.preventDefault());
$<HTMLInputElement>("gl-search").addEventListener("input", (event) => {
  const text = (event.target as HTMLInputElement).value;
  address.setMany({ q: text === "" ? null : text, page: null });
  render();
});
address.subscribe(({ source }) => {
  if (source === "navigation") render();
});
document.addEventListener("hoshi-language", render);
onLook(render);
render();
