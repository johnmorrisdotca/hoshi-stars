// The picture card, built in one place: the picker's strip above the map (the Western, Japanese or Chinese sky), the Neighbours of a constellation's own page and the Nearby panel's neighbouring constellations all show this card, a thumbnail with the name under it.
// A figure of the Japanese or Chinese sky adds its reading and English under the name, and how many of its stars are fainter than the catalogue goes.
import type { Constellation } from "../src/constellations.ts";
import { faceOf, pictureOf, type FigureCard } from "./culture-cards.ts";
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
  const sub = Object.assign(document.createElement("span"), { className: "pick-sub", hidden: true });
  const missing = Object.assign(document.createElement("span"), { className: "pick-missing", hidden: true });
  card.append(image, document.createElement("span"), sub, missing);
  return card;
}

/** Set a card's name and picture for the page's language and look (the picture's source is only touched when it changed). A constellation shows its name; a figure of the Japanese or Chinese sky its name, reading, English and missing stars. */
export function paintCard(card: Card, subject: Constellation | FigureCard, lang: Lang, look: Look): void {
  const [name, sub, missing] = Array.from(card.querySelectorAll("span"));
  const image = card.querySelector("img")!;
  card.classList.toggle("pick-own", !("abbreviation" in subject) && subject.asterism !== undefined);
  let src: string;
  if ("abbreviation" in subject) {
    name!.textContent = lang === "ja" ? subject.japanese : subject.name;
    card.setAttribute("aria-label", name!.textContent);
    src = thumbSrc(subject.abbreviation, 160, look);
  } else {
    const face = faceOf(subject, lang);
    name!.textContent = face.name;
    sub!.textContent = [face.reading, face.english].filter((part) => part !== "").join(" · ");
    sub!.hidden = sub!.textContent === "";
    missing!.textContent = face.missingText;
    missing!.hidden = face.missingText === "";
    card.setAttribute("aria-label", face.label);
    src = pictureOf(subject, 160, look);
  }
  if (image.getAttribute("src") !== src) image.setAttribute("src", src);
}
