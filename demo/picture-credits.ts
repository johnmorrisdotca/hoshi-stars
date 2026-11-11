// The credits of the deep-sky pictures on the chart, shown on the chart while they are drawn, not only in an object's card. ESA/Hubble, ESO and NSF NOIRLab release their images under CC BY 4.0, which asks
// for the credit wherever the picture is shown, with the licence named and any change said (ESA/Hubble asks for it "clearly and visibly", with the wording unaltered); NOTICE.md has each file's source, address
// and the day it was read.
import { deepSkyPictures, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";

const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";
const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";
/** The observatories whose released images are laid over the chart: resized and faded at the edges here, which the line says. */
const RELEASES = new Set(["ESA/Hubble", "NSF NOIRLab", "ESO"]);

/** One piece of the credit line: words, or words that link to a page. */
export interface CreditPiece {
  text: string;
  href?: string;
}

let byId: Map<string, DeepSkyPicture> | undefined;

/** The short name of a picture's licence where it is a Creative Commons one (`CC BY 4.0`, `CC BY`), else nothing: a US government work or the public domain needs no licence named. */
function licenceOf(picture: DeepSkyPicture): string | undefined {
  return /\bCC BY(?: \d\.\d)?/.exec(picture.source.licence)?.[0];
}

/**
 * The credit line for the pictures drawn (the chart's `pictures`, the most seen first), in pieces: each credit once and word for word, with its licence linked where it is CC BY 4.0, that the released images are
 * resized and faded at the edges, and a link to every credit. Empty when no picture is drawn.
 */
export function pictureCredits(ids: readonly string[], ja: boolean): CreditPiece[] {
  byId ??= new Map(deepSkyPictures().map((picture) => [picture.id, picture]));
  const pictures = ids.map((id) => byId!.get(id)).filter((picture): picture is DeepSkyPicture => picture !== undefined);
  if (pictures.length === 0) return [];
  const pieces: CreditPiece[] = [{ text: ja ? "写真: " : "Pictures: " }];
  const seen = new Set<string>();
  for (const picture of pictures) {
    const licence = licenceOf(picture);
    const key = `${picture.credit}|${licence ?? ""}`;
    if (seen.has(key)) continue;
    if (seen.size > 0) pieces.push({ text: "; " });
    seen.add(key);
    pieces.push({ text: picture.credit });
    if (licence !== undefined) pieces.push({ text: " (" }, licence === "CC BY 4.0" ? { text: licence, href: CC_BY_4 } : { text: licence }, { text: ")" });
  }
  pieces.push({ text: ". " });
  if (pictures.some((picture) => RELEASES.has(picture.source.name))) pieces.push({ text: ja ? "大きさを変え、縁をぼかしています。" : "Resized, with the edges faded. " });
  pieces.push({ text: ja ? "出典一覧" : "All credits", href: NOTICE });
  return pieces;
}

/** Fills `host` with the credit line of the pictures drawn, links opening in a new tab, and hides it when none is drawn. */
export function showPictureCredits(host: HTMLElement, ids: readonly string[], ja: boolean): void {
  const pieces = pictureCredits(ids, ja);
  const text = pieces.map((piece) => piece.text).join("");
  host.hidden = pieces.length === 0;
  if (host.dataset["text"] === text) return;
  host.dataset["text"] = text;
  host.replaceChildren(
    ...pieces.map((piece) => {
      if (piece.href === undefined) return document.createTextNode(piece.text);
      return Object.assign(document.createElement("a"), { href: piece.href, target: "_blank", rel: "noopener", textContent: piece.text });
    }),
  );
}
