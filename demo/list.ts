// The list: a table of all 88 constellations with their pictures and facts, and filters that combine (hemisphere, best month, origin, how easy, asterisms, meteor showers), a count and Clear all.
// Within one filter the choices add up (north or south); between filters they narrow (north and easy). The choices are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { allConstellationFacts, type ConstellationFacts } from "../src/constellation-facts.ts";
import { inOrder, langNow, lookNow, nameIn, onLook, thumbSrc } from "./thumbs.ts";
import { monthName, say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState();

interface Group {
  key: string;
  label: string;
  values: readonly string[];
  text: (value: string) => string;
  of: (facts: ConstellationFacts) => string;
}

const shortMonth = (month: number): string => new Date(2026, month - 1, 15).toLocaleString(langNow() === "ja" ? "ja-JP" : "en", { month: "short" });
const GROUPS: readonly Group[] = [
  { key: "hemi", label: "ls_hemi", values: ["north", "south", "both"], text: (v) => say(`hemi_${v}`), of: (f) => f.hemisphere },
  { key: "month", label: "ls_month", values: Array.from({ length: 12 }, (_, i) => String(i + 1)), text: (v) => shortMonth(Number(v)), of: (f) => String(f.bestMonth) },
  { key: "origin", label: "ls_origin", values: ["ancient", "voyages", "early", "modern"], text: (v) => say(`origin_${v}`), of: (f) => f.origin },
  { key: "easy", label: "ls_easy", values: ["easy", "medium", "hard"], text: (v) => say(`diff_${v}`), of: (f) => f.difficulty },
  { key: "ast", label: "ls_ast", values: ["yes", "no"], text: (v) => say(v === "yes" ? "ls_yes" : "ls_no"), of: (f) => (f.asterisms.length > 0 ? "yes" : "no") },
  { key: "shower", label: "ls_shower", values: ["yes", "no"], text: (v) => say(v === "yes" ? "ls_yes" : "ls_no"), of: (f) => (f.meteorShowers.length > 0 ? "yes" : "no") },
];

const chosen = (group: Group): string[] => (address.get(group.key) ?? "").split(",").filter((value) => group.values.includes(value));

function toggle(group: Group, value: string): void {
  const now = chosen(group);
  const next = now.includes(value) ? now.filter((one) => one !== value) : [...now, value];
  address.set(group.key, next.length === 0 ? null : group.values.filter((one) => next.includes(one)).join(","));
  render();
}

let builtFor = "";
function buildFilters(): void {
  const host = $("ls-filters");
  host.replaceChildren(
    ...GROUPS.map((group) => {
      const row = document.createElement("div");
      row.className = "fam-row";
      const label = Object.assign(document.createElement("span"), { className: "fam-label", textContent: say(group.label) });
      const seg = document.createElement("span");
      seg.className = "fam-seg ls-seg";
      seg.dataset.group = group.key;
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", say(group.label));
      for (const value of group.values) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.value = value;
        button.textContent = group.text(value);
        button.addEventListener("click", () => toggle(group, value));
        seg.append(button);
      }
      row.append(label, seg);
      return row;
    }),
  );
  builtFor = langNow();
}

function render(): void {
  if (builtFor !== langNow()) buildFilters();
  const lang = langNow();
  const look = lookNow();
  for (const group of GROUPS) {
    const on = chosen(group);
    $("ls-filters")
      .querySelectorAll<HTMLButtonElement>(`[data-group="${group.key}"] button`)
      .forEach((button) => button.setAttribute("aria-pressed", String(on.includes(button.dataset.value!))));
  }
  const order = new Map(inOrder(lang).map((c, index) => [c.abbreviation, index]));
  const shown = allConstellationFacts()
    .filter((facts) => GROUPS.every((group) => chosen(group).length === 0 || chosen(group).includes(group.of(facts))))
    .sort((a, b) => order.get(a.constellation.abbreviation)! - order.get(b.constellation.abbreviation)!);
  $("ls-count").textContent = say("ls_count", { n: shown.length });
  $<HTMLButtonElement>("ls-clear").disabled = GROUPS.every((group) => chosen(group).length === 0);
  $("ls-empty").hidden = shown.length > 0;
  const table = $("ls-table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const heads = ["", "ls_name", "cp_abbreviation", "cp_meaning", "cp_hemisphere", "cp_best", "cp_origin", "cp_easy", "cp_asterisms", "cp_showers", ""];
  headRow.append(...heads.map((key) => Object.assign(document.createElement("th"), { scope: "col", textContent: key === "" ? "" : say(key) })));
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const facts of shown) {
    const c = facts.constellation;
    const row = document.createElement("tr");
    row.dataset.abbr = c.abbreviation;
    const cell = (...content: Array<string | Node>): HTMLTableCellElement => {
      const td = document.createElement("td");
      td.append(...content);
      return td;
    };
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
  table.replaceChildren(head, body);
}

$("ls-clear").addEventListener("click", () => {
  address.setMany(Object.fromEntries(GROUPS.map((group) => [group.key, null])));
  render();
});
address.subscribe(({ source }) => {
  if (source === "navigation") render();
});
document.addEventListener("hoshi-language", render);
onLook(render);
render();
