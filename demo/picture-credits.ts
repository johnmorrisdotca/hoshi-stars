// The credits of the deep-sky pictures on the chart, shown on the chart while they are drawn, not only in an object's card. ESA/Hubble, ESO and NSF NOIRLab release their images under CC BY 4.0, which asks
// for the credit wherever the picture is shown, with the licence named and any change said (ESA/Hubble asks for it "clearly and visibly", with the wording unaltered); NOTICE.md has each file's source, address
// and the day it was read.
import { deepSkyPictures, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";

const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";
/** Where each Creative Commons licence named is linked: the licence itself, or for SDSS, which names no version, its image use policy. */
const LICENCE_PAGES: Record<string, string> = { "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/", "CC BY": "https://www.sdss.org/collaboration/image-use-policy/" };

/** One piece of the credit line: words, or words that link to a page. */
export interface CreditPiece {
  text: string;
  href?: string;
}

let byId: Map<string, DeepSkyPicture> | undefined;

/**
 * The short name of a licence where it is plain Creative Commons Attribution (`CC BY 4.0`, `CC BY`), else nothing: a US government work or the public domain needs no licence named, and a share-alike,
 * non-commercial or no-derivatives one is refused rather than named as plain CC BY, however it is written (`CC BY-SA`, `CC BY SA 4.0`, `CC BY 4.0-SA`, `CC BY 4.0 NC`, `CC-BY-SA`: an SA, NC or ND
 * anywhere after "CC BY", up to the next comma, semicolon or closing bracket). The package takes no picture under one; the data test holds that.
 */
export function licenceName(licence: string): string | undefined {
  return /\bCC BY(?: \d\.\d)?(?![-\w])(?![^,;)]*\b(?:SA|NC|ND|ShareAlike|NonCommercial|NoDerivatives)\b)/i.exec(licence)?.[0];
}

const licenceOf = (picture: DeepSkyPicture): string | undefined => licenceName(picture.source.licence);

/**
 * The credit line for the pictures drawn (the chart's `pictures`), in pieces: each credit once and word for word, in a fixed order (by source, then credit) so that panning does not reshuffle it, with its
 * licence linked where it is a Creative Commons one, that the pictures are resized and faded at the edges (every one is: the survey pictures are resampled and made clear at the black, the observatories'
 * images resized and faded), and a link to every credit. Empty when no picture is drawn.
 */
export function pictureCredits(ids: readonly string[], ja: boolean): CreditPiece[] {
  byId ??= new Map(deepSkyPictures().map((picture) => [picture.id, picture]));
  const credits = new Map<string, { credit: string; licence: string | undefined }>();
  for (const id of ids) {
    const picture = byId.get(id);
    if (picture === undefined) continue;
    const licence = licenceOf(picture);
    credits.set(`${picture.source.name}|${picture.credit}|${licence ?? ""}`, { credit: picture.credit, licence });
  }
  if (credits.size === 0) return [];
  const pieces: CreditPiece[] = [{ text: ja ? "写真：" : "Pictures: " }];
  [...credits.keys()].sort().forEach((key, i) => {
    const { credit, licence } = credits.get(key)!;
    if (i > 0) pieces.push({ text: "; " });
    pieces.push({ text: credit });
    if (licence !== undefined) pieces.push({ text: " (" }, { text: licence, href: LICENCE_PAGES[licence] }, { text: ")" });
  });
  pieces.push({ text: ja ? "。大きさを変え、縁をぼかしています。" : ". Resized, with the edges faded. " });
  pieces.push({ text: ja ? "出典一覧" : "All credits", href: NOTICE });
  return pieces;
}

/** Fills `host` with the credit line of the pictures drawn, links opening in a new tab, and hides it when none is drawn. Returns whether the line changed (so its box may have: the page draws again to keep names clear of it). */
export function showPictureCredits(host: HTMLElement, ids: readonly string[], ja: boolean): boolean {
  const pieces = pictureCredits(ids, ja);
  const text = pieces.map((piece) => piece.text).join("");
  host.hidden = pieces.length === 0;
  if ((host.dataset["text"] ?? "") === text) return false;
  host.dataset["text"] = text;
  host.replaceChildren(
    ...pieces.map((piece) => {
      if (piece.href === undefined) return document.createTextNode(piece.text);
      const link = Object.assign(document.createElement("a"), { href: piece.href, target: "_blank", rel: "noopener", textContent: piece.text });
      link.style.color = "inherit";
      return link;
    }),
  );
  return true;
}
