// The figures of a sky culture as the chart uses them: the list with its lookups, the name of a figure, where its middle is and how far it reaches. Moved out of chart.ts as it was; chart.ts imports and re-exports what it exported.
import type { Culture } from "../culture.ts";
import { western } from "../cultures/western.ts";
import { figures, type CultureFigure } from "../lines.ts";
import type { SkyPoint } from "../projection.ts";
import type { SeenSky } from "../sky-from.ts";
import type { Language } from "./types.ts";
import { wrap360 } from "./view-math.ts";

export interface Figures {
  list: CultureFigure[];
  centroids: Map<string, SkyPoint>;
}
export const cultureFigures = new Map<string, Figures>();
/** A culture's figures and the middle of each, where its name goes. */
export function figuresOfCulture(culture: Culture): Figures {
  let found = cultureFigures.get(culture.id);
  if (found === undefined) {
    const list = figures(culture);
    const centroids = new Map<string, SkyPoint>();
    for (const figure of list) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const star of figure.stars) {
        const ra = (star.rightAscension * Math.PI) / 180;
        const dec = (star.declination * Math.PI) / 180;
        x += Math.cos(dec) * Math.cos(ra);
        y += Math.cos(dec) * Math.sin(ra);
        z += Math.sin(dec);
      }
      centroids.set(figure.asterism.id, { rightAscension: wrap360((Math.atan2(y, x) * 180) / Math.PI), declination: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
    }
    found = { list, centroids };
    cultureFigures.set(culture.id, found);
  }
  return found;
}

/** The figures of a culture (the Western sky when left out), for a page that lists them. */
export const figuresOf = (culture: Culture = western): readonly CultureFigure[] => figuresOfCulture(culture).list;

/** The figure of a culture by its id. */
export const figureById = (id: string, culture: Culture = western): CultureFigure | undefined => figuresOfCulture(culture).list.find((f) => f.asterism.id === id);

/** What a figure is called on the chart: a constellation by its Latin name (its Japanese one in Japanese); a figure of the Japanese or Chinese sky in its own characters; a Western asterism by its English name (its Japanese one, if it has one, in Japanese). */
export function labelOf(figure: CultureFigure, culture: Culture, lang: Language): string {
  const a = figure.asterism;
  if (a.kind === "constellation") return lang === "ja" ? a.names.ja ?? a.name : a.names.la ?? a.name;
  if (culture.id === "western") return lang === "ja" ? a.names.ja ?? a.names.en ?? a.name : a.names.en ?? a.name;
  return a.name;
}

export function centroidOf(id: string, culture: Culture): SkyPoint | undefined {
  return figuresOfCulture(culture).centroids.get(id);
}

/** The middle of each figure as the stars of the sky seen from another star put it, from the figure's stars that sky holds (two at least). */
export function centroidsSeen(sky: SeenSky, culture: Culture): Map<string, SkyPoint> {
  const seen = new Map(sky.map((star) => [star.id, star]));
  const found = new Map<string, SkyPoint>();
  for (const figure of figuresOfCulture(culture).list) {
    let x = 0;
    let y = 0;
    let z = 0;
    let count = 0;
    for (const star of figure.stars) {
      const at = seen.get(`hr-${star.hr}`);
      if (at === undefined) continue;
      const ra = (at.rightAscension * Math.PI) / 180;
      const dec = (at.declination * Math.PI) / 180;
      x += Math.cos(dec) * Math.cos(ra);
      y += Math.cos(dec) * Math.sin(ra);
      z += Math.sin(dec);
      count++;
    }
    if (count >= 2) found.set(figure.asterism.id, { rightAscension: wrap360((Math.atan2(y, x) * 180) / Math.PI), declination: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI });
  }
  return found;
}

/** The middle of a figure (degrees), for flying to it. */
export const centreOfConstellation = (id: string, culture: Culture = western): SkyPoint | undefined => centroidOf(id, culture);

/** How far (degrees) a figure reaches from its middle: the zoom that shows all of it comes from this. */
export function reachOfConstellation(id: string, culture: Culture = western): number {
  const middle = centroidOf(id, culture);
  const figure = figureById(id, culture);
  if (middle === undefined || figure === undefined) return 30;
  const rad = Math.PI / 180;
  let far = culture.id === "chinese" ? 1.5 : 5;
  for (const star of figure.stars) {
    const c = Math.sin(middle.declination * rad) * Math.sin(star.declination * rad) + Math.cos(middle.declination * rad) * Math.cos(star.declination * rad) * Math.cos((middle.rightAscension - star.rightAscension) * rad);
    far = Math.max(far, Math.acos(Math.max(-1, Math.min(1, c))) / rad);
  }
  return far;
}
