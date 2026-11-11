// The list: a table of the IAU's 88 constellations (the Western sky) with their pictures and facts, and filters that combine (hemisphere, best month, origin, how easy, asterisms, meteor showers), a count and Clear all.
// The Japanese and Chinese skies are tables of their own figures (name, reading, English, kind, stars), with a search box and the filters that fit them. The culture is kept in the address, as on the map.
// The filters are a row of chips on a desk and a sheet on a phone (list-filters.ts). Within one filter the choices add up (north or south); between filters they narrow (north and easy). The choices are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { allConstellationFacts, type ConstellationFacts } from "../src/constellation-facts.ts";
import { cultureIn, mountCultureButtons } from "./culture-buttons.ts";
import { cardAnswers, cardsOf, faceOf, mixOf, pictureOf, type FigureCard } from "./culture-cards.ts";
import type { CultureId } from "./cultures.ts";
import { inOrder, langNow, lookNow, nameIn, onLook, thumbSrc } from "./thumbs.ts";
import { mountFilterBar, type FilterGroup } from "./list-filters.ts";
import { mountReadings, writeReadings } from "./readings.ts";
import { monthName, say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState();

interface Group extends FilterGroup {
  of: (facts: ConstellationFacts) => string;
}

const shortMonth = (month: number): string => new Date(2026, month - 1, 15).toLocaleString(langNow() === "ja" ? "ja-JP" : "en", { month: "short" });
const GROUPS: readonly Group[] = [
  { key: "hemi", label: "ls_hemi", values: ["north", "south", "both"], text: (v) => say(`hemi_${v}`), of: (f) => f.hemisphere },
  { key: "month", label: "ls_month", chip: "ls_month_chip", values: Array.from({ length: 12 }, (_, i) => String(i + 1)), text: (v) => shortMonth(Number(v)), of: (f) => String(f.bestMonth) },
  { key: "origin", label: "ls_origin", chip: "ls_origin_chip", values: ["ancient", "voyages", "early", "modern"], text: (v) => say(`origin_${v}`), of: (f) => f.origin },
  { key: "easy", label: "ls_easy", values: ["easy", "medium", "hard"], text: (v) => say(`diff_${v}`), of: (f) => f.difficulty },
  { key: "ast", label: "ls_ast", values: ["yes", "no"], text: (v) => say(v === "yes" ? "ls_yes" : "ls_no"), of: (f) => (f.asterisms.length > 0 ? "yes" : "no") },
  { key: "shower", label: "ls_shower", chip: "ls_shower_chip", values: ["yes", "no"], text: (v) => say(v === "yes" ? "ls_yes" : "ls_no"), of: (f) => (f.meteorShowers.length > 0 ? "yes" : "no") },
];

/** The filters of a Japanese or Chinese table: the kind of figure, and for the Chinese the quarter of the sky a mansion belongs to. */
interface FigureGroup extends FilterGroup {
  of: (card: FigureCard) => string;
}
const FIGURE_GROUPS: Readonly<Record<"japanese" | "chinese", readonly FigureGroup[]>> = {
  japanese: [{ key: "kind", label: "ls_kind", values: ["constellation", "asterism"], text: (v) => say(v === "asterism" ? "ls_traditional" : "constellationKind"), of: (card) => card.kind }],
  chinese: [
    { key: "kind", label: "ls_kind", values: ["mansion", "asterism"], text: (v) => say(`${v}Kind`), of: (card) => card.kind },
    { key: "quarter", label: "ls_quarter", chip: "ls_quarter_chip", values: ["azure-dragon", "black-tortoise", "white-tiger", "vermilion-bird"], text: (v) => say(v), of: (card) => card.asterism?.group ?? "" },
  ],
};
const cultureNow = (): CultureId => cultureIn(address);
/** The filters the page shows now. */
const groupsNow = (): readonly FilterGroup[] => (cultureNow() === "western" ? GROUPS : FIGURE_GROUPS[cultureNow() as "japanese" | "chinese"]);
const ALL_KEYS = [...GROUPS, ...FIGURE_GROUPS.chinese].map((group) => group.key);

const chosen = (group: FilterGroup): string[] => (address.get(group.key) ?? "").split(",").filter((value) => group.values.includes(value));

function toggle(group: FilterGroup, value: string): void {
  const now = chosen(group);
  const next = now.includes(value) ? now.filter((one) => one !== value) : [...now, value];
  address.set(group.key, next.length === 0 ? null : group.values.filter((one) => next.includes(one)).join(","));
  render();
}

let builtFor = "";
const shownFigures = (): FigureCard[] => {
  const groups = FIGURE_GROUPS[cultureNow() as "japanese" | "chinese"];
  return cardsOf(cultureNow()).filter((card) => cardAnswers(card, address.get("q") ?? "") && groups.every((group) => chosen(group).length === 0 || chosen(group).includes(group.of(card))));
};
const shownNow = (): ConstellationFacts[] => allConstellationFacts().filter((facts) => GROUPS.every((group) => chosen(group).length === 0 || chosen(group).includes(group.of(facts))));

/** The lede, with its one link (to the sky map, where the Japanese and Chinese skies are) put in where the words say `{map}`. */
function fillLede(): void {
  const [before = "", after = ""] = say("ls_lede", { map: "\u0000" }).split("\u0000");
  const link = Object.assign(document.createElement("a"), { href: "./", textContent: say("ls_lede_map") });
  $("ls-lede").replaceChildren(before, link, after);
}

const cell = (...content: Array<string | Node>): HTMLTableCellElement => {
  const td = document.createElement("td");
  td.append(...content);
  return td;
};
const head = (keys: readonly string[]): HTMLTableSectionElement => {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(...keys.map((key) => Object.assign(document.createElement("th"), { scope: "col", textContent: key === "" ? "" : say(key) })));
  thead.append(headRow);
  return thead;
};

/** The Western table: the 88, with their facts. */
function western(table: HTMLElement, lang: "en" | "ja", look: "light" | "dark"): number {
  const order = new Map(inOrder(lang).map((c, index) => [c.abbreviation, index]));
  const shown = shownNow().sort((a, b) => order.get(a.constellation.abbreviation)! - order.get(b.constellation.abbreviation)!);
  const body = document.createElement("tbody");
  for (const facts of shown) {
    const c = facts.constellation;
    const row = document.createElement("tr");
    row.dataset.abbr = c.abbreviation;
    const image = Object.assign(document.createElement("img"), { src: thumbSrc(c.abbreviation, 160, look), width: 72, height: 72, loading: "lazy" as const, alt: "" });
    const picture = Object.assign(document.createElement("a"), { href: `constellation.html?c=${c.abbreviation}`, className: "ls-picture" });
    picture.setAttribute("aria-hidden", "true");
    picture.tabIndex = -1;
    picture.append(image);
    const name = Object.assign(document.createElement("a"), { href: `constellation.html?c=${c.abbreviation}`, textContent: nameIn(c, lang) });
    const map = Object.assign(document.createElement("a"), { href: `./?go=${c.abbreviation}`, className: "fam-button", textContent: say("ls_map") });
    map.setAttribute("aria-label", `${say("ls_map")}: ${nameIn(c, lang)}`);
    row.append(
      cell(picture),
      Object.assign(cell(name), { className: "ls-name" }),
      cell(c.abbreviation),
      cell(facts.meaning[lang]),
      cell(say(`hemi_${facts.hemisphere}`)),
      cell(monthName(facts.bestMonth)),
      cell(say(`origin_${facts.origin}`)),
      cell(say(`diff_${facts.difficulty}`)),
      cell(facts.asterisms.length === 0 ? "-" : facts.asterisms.map((a) => a[lang]).join(", ")),
      cell(facts.meteorShowers.length === 0 ? "-" : facts.meteorShowers.map((s) => s.name[lang]).join(", ")),
      cell(map),
    );
    body.append(row);
  }
  table.replaceChildren(head(["", "ls_name", "cp_abbreviation", "cp_meaning", "cp_hemisphere", "cp_best", "cp_origin", "cp_easy", "cp_asterisms", "cp_showers", ""]), body);
  return shown.length;
}

/** The table of a Japanese or Chinese sky: a picture, the name in its own writing, the reading, English, the kind, the stars held and the faint ones missing, and the way to the map. */
function figures(table: HTMLElement, lang: "en" | "ja", look: "light" | "dark", culture: CultureId, ruby: boolean): number {
  const shown = shownFigures();
  const body = document.createElement("tbody");
  for (const card of shown) {
    const face = faceOf(card, lang);
    const href = `./?culture=${culture}&go=${encodeURIComponent(card.id)}`;
    const row = document.createElement("tr");
    row.dataset.abbr = card.id;
    const image = Object.assign(document.createElement("img"), { src: pictureOf(card, 160, look), width: 72, height: 72, loading: "lazy" as const, alt: "" });
    const picture = Object.assign(document.createElement("a"), { href, className: "ls-picture" });
    picture.setAttribute("aria-hidden", "true");
    picture.tabIndex = -1;
    picture.append(image);
    const name = Object.assign(document.createElement("a"), { href });
    writeReadings(name, face.name, ruby);
    const map = Object.assign(document.createElement("a"), { href, className: "fam-button", textContent: say("ls_map") });
    map.setAttribute("aria-label", `${say("ls_map")}: ${face.name}`);
    const kind = card.kind === "mansion" ? `${say("mansionKind")}${card.asterism?.group === undefined ? "" : `, ${say(card.asterism.group)}`}` : say(card.culture === "japanese" && card.kind === "asterism" ? "ls_traditional" : `${card.kind}Kind`);
    row.append(cell(picture), Object.assign(cell(name), { className: "ls-name" }), cell(face.reading || "-"), cell(face.english || "-"), cell(kind), cell(String(card.held)), cell(face.missing > 0 ? `${face.missing}+` : "-"), cell(map));
    body.append(row);
  }
  table.replaceChildren(head(["", "ls_name", "ls_reading", "ls_english", "ls_kind", "ls_stars", "ls_missing", ""]), body);
  return shown.length;
}

function render(): void {
  const lang = langNow();
  const look = lookNow();
  const culture = cultureNow();
  readings.refresh(say("readings"));
  const ruby = readings.on();
  const key = `${lang}|${culture}|${ruby}`;
  const rebuilt = builtFor !== key;
  if (rebuilt) {
    builtFor = key;
    const plain = culture === "western";
    $("ls-heading").textContent = say(plain ? "ls_heading" : `ls_heading_${culture}`);
    if (plain) fillLede();
    else writeReadings($("ls-lede"), say(`ls_lede_${culture}`), ruby);
    document.title = say(plain ? "ls_title" : `ls_title_${culture}`);
    $("ls-empty").textContent = say(plain ? "ls_empty" : "ls_empty_figures");
    $("ls-scroll").setAttribute("aria-label", plain ? say("ls_table") : say("ls_table_figures"));
    const mix = mixOf(culture);
    $("ls-mix").hidden = mix === undefined;
    writeReadings($("ls-mix"), mix === undefined ? "" : say(`gl_mix_${culture}`, { a: mix[0], b: mix[1] }), ruby);
    $("ls-find").hidden = plain;
    $<HTMLInputElement>("ls-search").placeholder = plain ? "" : say(`pk_placeholder_${culture}`);
    bar.rebuild();
  }
  const search = $<HTMLInputElement>("ls-search");
  if (search.value !== (address.get("q") ?? "") && document.activeElement !== search) search.value = address.get("q") ?? "";
  cultures.refresh();
  bar.refresh();
  const count = culture === "western" ? western($("ls-table"), lang, look) : figures($("ls-table"), lang, look, culture, ruby);
  $("ls-count").textContent = say("ls_count", { n: count, total: cardsOf(culture).length });
  $<HTMLButtonElement>("ls-clear").disabled = groupsNow().every((group) => chosen(group).length === 0) && (address.get("q") ?? "") === "";
  $("ls-empty").hidden = count > 0;
  bar.refresh();
}

const clearAll = (): void => {
  address.setMany(Object.fromEntries([...ALL_KEYS, "q"].map((key) => [key, null])));
  render();
};
$("ls-clear").addEventListener("click", clearAll);
const bar = mountFilterBar($("ls-chips"), $<HTMLDialogElement>("ls-sheet"), $<HTMLButtonElement>("ls-open-sheet"), {
  groups: groupsNow,
  chosen,
  toggle,
  clearAll,
  shown: () => (cultureNow() === "western" ? shownNow().length : shownFigures().length),
  showWord: () => (cultureNow() === "western" ? "ls_show" : "ls_show_figures"),
});
const cultures = mountCultureButtons($("ls-cultures"), address, () => render());
const readings = mountReadings($("ls-readings-row"), $<HTMLButtonElement>("ls-readings"), address, () => langNow() === "ja" && cultureNow() === "chinese", () => render());
$<HTMLInputElement>("ls-search").addEventListener("input", (event) => {
  const text = (event.target as HTMLInputElement).value;
  address.set("q", text === "" ? null : text);
  render();
});
$("ls-find").addEventListener("submit", (event) => event.preventDefault());

address.subscribe(({ source }) => {
  if (source === "navigation") render();
});
document.addEventListener("hoshi-language", render);
onLook(render);
render();
