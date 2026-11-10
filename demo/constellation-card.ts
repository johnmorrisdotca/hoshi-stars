// The constellation's picture card, built in one place: the picker's strip above the map, the Neighbours of a constellation's own page and the Nearby panel's neighbouring constellations all show this card, a thumbnail with the name under it.
import type { Constellation } from "../src/constellations.ts";
import { nameIn, thumbSrc, type Lang, type Look } from "./thumbs.ts";

export type Card = HTMLButtonElement | HTMLAnchorElement;

/** A card for a constellation: a button the page listens to, or, with `href`, a link. Fill it in with `paintCard`. */
export function makeCard(abbreviation: string, href?: string): Card {
  const card = href === undefined ? Object.assign(document.createElement("button"), { type: "button" }) : Object.assign(document.createElement("a"), { href });
  card.className = "pick-tile";
  card.dataset.abbr = abbreviation;
  const image = document.createElement("img");
  image.width = 80;
  image.height = 80;
  image.loading = "lazy";
  image.alt = "";
  card.append(image, document.createElement("span"));
  return card;
}

/** Set a card's name and picture for the page's language and look (the picture's source is only touched when it changed). */
export function paintCard(card: Card, c: Constellation, lang: Lang, look: Look): void {
  card.querySelector("span")!.textContent = nameIn(c, lang);
  card.setAttribute("aria-label", nameIn(c, lang));
  const image = card.querySelector("img")!;
  const src = thumbSrc(c.abbreviation, 160, look);
  if (image.getAttribute("src") !== src) image.setAttribute("src", src);
}
