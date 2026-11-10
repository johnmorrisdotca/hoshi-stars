// The picture card, built in one place: the picker's strip above the map (the Western, Japanese or Chinese sky), the Neighbours of a constellation's own page and the Nearby panel's neighbouring constellations all show this card, a thumbnail with the name under it.
// Every card is one block, a name and one small line, whichever sky it is from; the stars a figure is missing are in its title.
import type { Constellation } from "../src/constellations.ts";
import { faceOf, pictureOf, westernFace, type FigureCard } from "./culture-cards.ts";
import { thumbSrc, type Lang, type Look } from "./thumbs.ts";

export type Card = HTMLButtonElement | HTMLAnchorElement;

/** A card for a figure: a button the page listens to, or, with `href`, a link. Fill it in with `paintCard`. */
export function makeCard(abbreviation: string, href?: string): Card {
  const card = href === undefined ? Object.assign(document.createElement("button"), { type: "button" }) : Object.assign(document.createElement("a"), { href });
  card.className = "pick-tile";
  card.dataset.abbr = abbreviation;
  const image = document.createElement("img");
  image.width = 80;
  image.height = 80;
  image.loading = "lazy";
  image.alt = "";
  card.append(image, document.createElement("span"), Object.assign(document.createElement("span"), { className: "pick-sub" }));
  return card;
}

/**
 * Set a card's name, the one small line under it and its picture for the page's language and look (the picture's source is only touched when it changed). Every card is the same block: the name,
 * then one line, so the strip is one height in all three skies. The stars a figure holds fewer of than it should (`3+ fainter stars not shown`) are in the card's title and its name for a screen reader.
 */
export function paintCard(card: Card, subject: Constellation | FigureCard, lang: Lang, look: Look): void {
  const [name, sub] = Array.from(card.querySelectorAll("span"));
  const image = card.querySelector("img")!;
  const western = "abbreviation" in subject;
  const face = western ? westernFace(subject, lang) : faceOf(subject, lang);
  name!.textContent = face.name;
  sub!.textContent = face.sub;
  card.setAttribute("aria-label", face.label);
  card.title = face.label;
  const src = western ? thumbSrc(subject.abbreviation, 160, look) : pictureOf(subject, 160, look);
  if (image.getAttribute("src") !== src) image.setAttribute("src", src);
}
