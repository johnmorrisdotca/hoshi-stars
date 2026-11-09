// What the picker, the gallery, the constellation page and the list share: which look of the pictures the page is in, where a picture is, and a constellation's name and search text in the page's language.
import { constellations, type Constellation } from "../src/constellations.ts";

export type Look = "light" | "dark";
export type Lang = "en" | "ja";

export const langNow = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");

/** The look the page is in: the theme switch's choice on `<html>`, else the device's. */
export function lookNow(): Look {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Calls `change` whenever the theme switch or the device changes the look. */
export function onLook(change: () => void): void {
  new MutationObserver(change).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", change);
}

/** The address of a picture file, relative to the demo's pages. */
export const thumbSrc = (abbreviation: string, size: 160 | 480 | 1200 = 160, look: Look = lookNow()): string => `thumbnails/png/${size}/${look}/${abbreviation}.png`;

export const nameIn = (c: Constellation, lang: Lang): string => (lang === "ja" ? c.japanese : c.name);

/** Lower case, without accents, katakana as hiragana: what a search compares. */
export const fold = (text: string): string =>
  [...text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()].map((ch) => (ch >= "ァ" && ch <= "ヶ" ? String.fromCodePoint(ch.codePointAt(0)! - 0x60) : ch)).join("").trim();

/** Whether a constellation answers a search text, by any of its names. */
export const answers = (c: Constellation, text: string): boolean => {
  const q = fold(text);
  return q === "" || [c.name, c.genitive, c.english, c.japanese, c.reading, c.abbreviation].some((name) => fold(name).includes(q));
};

/** All 88, in the order of the page's language: Latin names, or the Japanese readings. */
export const inOrder = (lang: Lang): Constellation[] => (lang === "ja" ? [...constellations()].sort((a, b) => a.reading.localeCompare(b.reading, "ja")) : constellations());
