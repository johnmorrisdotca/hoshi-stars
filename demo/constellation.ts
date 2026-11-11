// One figure's own page, chosen by the address (constellation.html?c=Ori, ?c=hokuto-shichisei&culture=japanese, ?c=bei3-dou3&culture=chinese): a Western constellation, a figure of the Japanese sky or a mansion or asterism of the Chinese sky.
// Its picture, its names in the sky's own writing, its facts, the Western stars it uses, the same patch of sky in the other two cultures side by side, its neighbours as that sky's cards, and what to keep in mind about the data.
// The sky culture is kept in the address (`culture=`, nothing for the Western sky); the choice on the page is a link to the figure of that sky that stands for this one.
import { constellations, starsIn, type Constellation } from "../src/constellations.ts";
import { constellationFacts } from "../src/constellation-facts.ts";
import { messier } from "../src/deep-sky.ts";
import { starDistanceLightYears, type Star } from "../src/stars.ts";
import { makeCard, paintCard } from "./constellation-card.ts";
import { cardsOf, faceOf, pictureOf, type FigureCard } from "./culture-cards.ts";
import { CULTURE_IDS, DEFAULT_CULTURE, cultureOf, type CultureId } from "./cultures.ts";
import { counterpart, figureFor, figureHref, neighboursOf, sameSky, starsOfFigure } from "./figure-sky.ts";
import { langNow, lookNow, nameIn, onLook, thumbSrc, type Lang, type Look } from "./thumbs.ts";
import { monthName, say } from "./words.ts";

/** How many figures of each other sky the page shows: the ones that have the most of these stars. */
const SHOWN = 4;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const named = (cultureOf(params.get("culture"))?.id as CultureId | undefined) ?? DEFAULT_CULTURE;
const found = figureFor(params.get("c") ?? "", named);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<string | Node>): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

const starName = (star: Star, lang: Lang): string => (lang === "ja" ? star.nameJa : undefined) ?? star.name ?? star.designation ?? `HR ${star.hr}`;
const mapHref = (query: Record<string, string | number>): string => `./?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()}`;
const skyWord = (culture: CultureId): string => say(`culture${culture[0]!.toUpperCase()}${culture.slice(1)}`);

function speak(text: string, voice: string): void {
  if (!("speechSynthesis" in window)) return;
  const words = new SpeechSynthesisUtterance(text);
  words.lang = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(words);
}

/** The constellations a figure's stars lie in, the one with most of them first. */
function liesIn(stars: readonly Star[]): Constellation[] {
  const count = new Map<string, number>();
  for (const star of stars) count.set(star.constellation, (count.get(star.constellation) ?? 0) + 1);
  const all = new Map(constellations().map((c) => [c.abbreviation, c]));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([abbreviation]) => all.get(abbreviation)).filter((c): c is Constellation => c !== undefined);
}

/** A Chinese name as the map gives it: Traditional characters, the Simplified ones where they differ, and the pinyin. */
function chineseName(a: NonNullable<FigureCard["asterism"]>): string {
  const hant = a.names["zh-Hant"] ?? a.name;
  const hans = a.names["zh-Hans"];
  return `${hant}${hans !== undefined && hans !== hant ? ` / ${hans}` : ""}${a.readings.zh === undefined ? "" : ` (${a.readings.zh})`}`;
}

/** The facts of a figure, as a word's key and its value: the 88 constellations as they have always been, the other figures by what their sky records of them. */
function factsOf(card: FigureCard, lang: Lang): Array<[string, string]> {
  const c = card.constellation;
  if (c !== undefined) {
    const facts = constellationFacts(c.abbreviation);
    const rows: Array<[string, string]> = [["cp_abbreviation", c.abbreviation], ["cp_latin", `${c.name} (${c.genitive})`], ["cp_english", c.english], ["cp_japanese", `${c.japanese} (${c.reading})`]];
    if (card.asterism?.names["zh-Hant"] !== undefined) rows.push(["fieldChinese", chineseName(card.asterism)]);
    rows.push(
      ["cp_meaning", facts.meaning[lang]],
      ["cp_hemisphere", say(`hemi_${facts.hemisphere}`)],
      ["cp_best", monthName(facts.bestMonth)],
      ["cp_origin", `${facts.designer[lang]}, ${facts.year === 150 ? say("cp_about", { year: facts.year }) : facts.year}. ${say(`origin_${facts.origin}`)}`],
      ["cp_easy", `${say(`diff_${facts.difficulty}`)}. ${say("cp_easyNote")}`],
      ["cp_asterisms", facts.asterisms.length === 0 ? say("cp_none") : facts.asterisms.map((a) => a[lang]).join(", ")],
      ["cp_showers", facts.meteorShowers.length === 0 ? say("cp_none") : facts.meteorShowers.map((s) => `${s.name[lang]} (${say("cp_peak")} ${Number(s.peak.slice(0, 2))}/${Number(s.peak.slice(3))})`).join(", ")],
    );
    return rows;
  }
  const a = card.asterism!;
  const stars = starsOfFigure(card.culture, card.id);
  const rows: Array<[string, string]> = [["fieldType", say(a.kind === "mansion" ? "mansionKind" : "asterismKind")]];
  if (card.culture === "japanese") {
    rows.push(["cp_japanese", a.readings.ja === undefined || a.readings.ja === a.name ? a.name : `${a.name} (${a.readings.ja})`]);
    if (a.names.en !== undefined) rows.push(["cp_romaji", a.names.en]);
    if (a.aka.length > 0) rows.push(["cp_aka", a.aka.join("、")]);
    if (a.about !== "") rows.push(["fieldAbout", lang === "ja" ? say(`story_${a.id.replaceAll("-", "_")}`) : a.about]);
  } else {
    rows.push(["fieldChinese", chineseName(a)], ["fieldEnglish", a.names.en ?? say("cp_noEnglish")]);
    if (a.kind === "mansion") rows.push(["fieldQuarter", say(a.group!)], ["cp_mansionNo", say("cp_mansionOf", { n: cardsOf("chinese").filter((one) => one.kind === "mansion").indexOf(card) + 1 })]);
    else {
      const mansion = cardsOf("chinese").find((one) => one.id === a.partOf)?.asterism;
      const part = a.partOf === undefined ? say("cp_notRecorded") : mansion === undefined ? say(a.partOf) : `${mansion.name}${lang === "en" && mansion.names.en !== undefined ? ` (${mansion.names.en})` : ""}`;
      rows.push(["fieldEnclosure", part]);
    }
  }
  const lies = liesIn(stars);
  if (lies.length > 0) rows.push(["fieldLiesIn", lies.map((one) => nameIn(one, lang)).join(", ")]);
  rows.push(["cp_held", `${stars.length}${a.missing > 0 ? ` (+${a.missing})` : ""}`]);
  return rows;
}

/** The three choices of sky, each a link to the figure of that sky that stands for this one, so the choice is in the address and a reload or a shared link keeps it. */
function cultureLinks(card: FigureCard): void {
  $("cp-cultures").replaceChildren(
    ...CULTURE_IDS.map((id) => {
      const there = counterpart(card.culture, card.id, id);
      const link = element("a", { href: there === undefined ? `constellations.html${id === DEFAULT_CULTURE ? "" : `?culture=${id}`}` : figureHref(id, there.id), textContent: skyWord(id) });
      link.dataset.value = id;
      if (id === card.culture) link.setAttribute("aria-current", "page");
      else if (there === undefined) link.title = say("cp_noFigure", { sky: skyWord(id) });
      return link;
    }),
  );
}

/** The same stars in the other two skies, side by side: for each, the figures that share most of them, as that sky's cards, each a link to its own page. */
function compare(card: FigureCard, lang: Lang, look: Look): void {
  $("cp-compare").replaceChildren(
    ...CULTURE_IDS.filter((id) => id !== card.culture).map((id) => {
      const all = sameSky(card.culture, card.id, id);
      const shown = all.slice(0, SHOWN);
      const column = element("section", { className: "cp-column" }, element("h3", { textContent: say(`cp_in_${id}`) }));
      column.dataset.culture = id;
      if (shown.length === 0) {
        column.append(element("p", { className: "fam-fine", textContent: say("cp_nomatch", { sky: skyWord(id) }) }));
        return column;
      }
      if (all.length > shown.length) column.append(element("p", { className: "fam-fine", textContent: say("cp_more", { n: all.length, shown: shown.length }) }));
      column.append(
        element(
          "ul",
          { className: "pick-grid" },
          ...shown.map((one) => {
            const tile = makeCard(one.card.id, figureHref(id, one.card.id));
            paintCard(tile, one.card, lang, look);
            tile.title = `${tile.title}${lang === "ja" ? "、" : ", "}${say("cp_shared", { n: one.shared })}`;
            tile.setAttribute("aria-label", tile.title);
            return element("li", {}, tile);
          }),
        ),
      );
      return column;
    }),
  );
}

/** What to keep in mind about the data, only the limits that apply to this figure: our own joins, the faint stars the catalogue lacks, and where the names come from. */
function limits(card: FigureCard): void {
  const a = card.asterism;
  const notes = [say("cp_limit_joins")];
  notes.push(a !== undefined && a.missing > 0 ? say("noteMissing", { missing: a.missing, held: starsOfFigure(card.culture, card.id).length }) : say("cp_limit_faint"));
  if (card.culture === "chinese") notes.push(say("cp_limit_wikidata"));
  else if (card.culture === "japanese" && card.kind !== "constellation") notes.push(say("cp_limit_japanese"));
  $("cp-limits").replaceChildren(...notes.map((text) => element("li", { textContent: text })));
}

function render(card: FigureCard): void {
  const lang = langNow();
  const look = lookNow();
  const culture = card.culture;
  const face = faceOf(card, lang);
  const c = card.constellation;
  const western = culture === DEFAULT_CULTURE;
  // a Western constellation is named in the page's language; a figure of the other skies stays in its own writing
  const title = western ? nameIn(c!, lang) : face.name;
  document.title = western ? `${title} - Hoshi Stars` : `${say("cp_title_figure", { name: title, sky: skyWord(culture) })} - Hoshi Stars`;
  const heading = $("cp-heading");
  heading.textContent = title;
  heading.lang = western ? "" : culture === "chinese" ? "zh-Hant" : "ja";
  const kind = say(card.kind === "mansion" ? "mansionKind" : card.kind === "asterism" ? "asterismKind" : "constellationKind");
  $("cp-sub").textContent = western ? `${lang === "ja" ? c!.name : c!.japanese} · ${c!.abbreviation} · ${constellationFacts(c!.abbreviation).meaning[lang]}` : [face.reading, face.english, kind].filter((part) => part !== "").join(" · ");
  const back = $<HTMLAnchorElement>("cp-back");
  back.href = `constellations.html${western ? "" : `?culture=${culture}`}`;
  back.textContent = say(western ? "cp_back" : `cp_back_${culture}`);
  cultureLinks(card);

  const image = $<HTMLImageElement>("cp-image");
  image.src = c === undefined ? pictureOf(card, 480, look) : thumbSrc(c.abbreviation, 1200, look);
  image.alt = face.label;
  const downloads = (one: Look): Array<[string, string]> =>
    c === undefined ? [["PNG 480", pictureOf(card, 480, one)]] : [["SVG", `thumbnails/svg/${one}/${c.abbreviation}.svg`], ["PNG 480", thumbSrc(c.abbreviation, 480, one)], ["PNG 1200", thumbSrc(c.abbreviation, 1200, one)]];
  $("cp-files").replaceChildren(
    ...(["light", "dark"] as const).flatMap((one) =>
      downloads(one).map(([label, href]) => {
        const link = element("a", { href, className: "fam-chip", textContent: `${say(one === "light" ? "cp_light" : "cp_dark")} ${label}` });
        link.setAttribute("download", "");
        return link;
      }),
    ),
  );
  $<HTMLAnchorElement>("cp-map").href = western ? `./?go=${card.id}` : `./?culture=${culture}&go=${encodeURIComponent(card.id)}`;
  const space = $<HTMLAnchorElement>("cp-space");
  space.hidden = c === undefined;
  if (c !== undefined) space.href = `constellation-3d.html?c=${c.abbreviation}`;

  const list = $("cp-facts");
  list.replaceChildren();
  for (const [key, value] of factsOf(card, lang)) list.append(element("dt", { textContent: say(key) }), element("dd", { textContent: value }));

  const speakers = $("cp-say");
  speakers.replaceChildren();
  if ("speechSynthesis" in window) {
    const add = (key: string, text: string, voice: string): void => {
      const button = element("button", { type: "button", className: "fam-button", textContent: say(key) });
      button.addEventListener("click", () => speak(text, voice));
      speakers.append(button);
    };
    if (c !== undefined) {
      add("cp_sayEn", c.name, "en-US");
      add("cp_sayJa", c.japanese, "ja-JP");
    } else if (culture === "japanese") add("cp_sayJa", card.asterism!.readings.ja ?? card.asterism!.name, "ja-JP");
    else add("cp_sayZh", card.asterism!.names["zh-Hans"] ?? card.asterism!.name, "zh-CN");
  }

  compare(card, lang, look);
  $("cp-neighbours-title").textContent = say(western ? "cp_neighbours" : "cp_neighbours_sky");
  $("cp-neighbours").replaceChildren(
    ...neighboursOf(culture, card.id).map((n) => {
      const tile = makeCard(n.id, figureHref(culture, n.id));
      paintCard(tile, n, lang, look);
      return element("li", {}, tile);
    }),
  );

  // the stars: a constellation's brightest, or the stars a figure joins, each a link to the map
  $("cp-stars-title").textContent = say(c === undefined ? "cp_westernStars" : "cp_stars");
  const stars = (c === undefined ? [...starsOfFigure(culture, card.id)].sort((x, y) => x.magnitude - y.magnitude) : starsIn(c.abbreviation)).slice(0, 24);
  $("cp-stars").replaceChildren(
    ...stars.map((star) => {
      const light = starDistanceLightYears(star);
      const text = `${starName(star, lang)}${c === undefined ? ` · ${star.constellation}` : ""} ${star.magnitude.toFixed(1)}`;
      const link = element("a", { href: mapHref({ pick: `S:${star.hr}`, ra: star.rightAscension.toFixed(2), dec: star.declination.toFixed(2), zoom: 8 }), className: "fam-chip", textContent: text });
      if (light !== undefined) link.title = `${Math.round(light).toLocaleString(lang)} ${say("lightYears")}`;
      return link;
    }),
  );
  const objects = c === undefined ? [] : messier().filter((object) => object.constellation === c.abbreviation);
  $("cp-messier-block").hidden = c === undefined;
  $("cp-messier").replaceChildren(
    ...(objects.length === 0
      ? [element("span", { className: "fam-fine", textContent: say("cp_none") })]
      : objects.map((o) => element("a", { href: mapHref({ pick: `D:${o.id}`, ra: o.rightAscension.toFixed(2), dec: o.declination.toFixed(2), zoom: 12 }), className: "fam-chip", textContent: o.name === undefined ? o.id : `${o.id} ${o.name}` }))),
  );
  limits(card);

  const all = cardsOf(culture);
  const at = all.findIndex((one) => one.id === card.id);
  const previous = all[(at + all.length - 1) % all.length]!;
  const next = all[(at + 1) % all.length]!;
  const prev = $<HTMLAnchorElement>("cp-prev");
  prev.href = figureHref(culture, previous.id);
  prev.textContent = `‹ ${say("cp_prev")}: ${faceOf(previous, lang).name}`;
  const following = $<HTMLAnchorElement>("cp-next");
  following.href = figureHref(culture, next.id);
  following.textContent = `${say("cp_next")}: ${faceOf(next, lang).name} ›`;
}

if (found === undefined) {
  $("cp-missing").hidden = false;
} else {
  // the address names the figure and its sky as the page shows them (an old link, or the choice of another sky, is made right); anything else in it stays
  const now = new URLSearchParams(location.search);
  now.set("c", found.id);
  if (found.culture === DEFAULT_CULTURE) now.delete("culture");
  else now.set("culture", found.culture);
  if (now.toString() !== params.toString()) history.replaceState(null, "", `?${now.toString()}${location.hash}`);
  $("cp-body").hidden = false;
  const draw = (): void => render(found);
  document.addEventListener("hoshi-language", draw);
  onLook(draw);
  draw();
}
