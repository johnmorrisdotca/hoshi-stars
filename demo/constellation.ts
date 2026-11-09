// One constellation's own page, chosen by the address (constellation.html?c=Ori): its picture, the facts, the stars and Messier objects in it, its neighbours, and a button that opens it on the sky map.
import { constellation, constellations, starsIn, type Constellation } from "../src/constellations.ts";
import { constellationFacts } from "../src/constellation-facts.ts";
import { messier } from "../src/deep-sky.ts";
import { neighbouringConstellations } from "../src/nearest.ts";
import { starDistanceLightYears, type Star } from "../src/stars.ts";
import { langNow, lookNow, nameIn, onLook, thumbSrc, type Lang } from "./thumbs.ts";
import { monthName, say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const found = constellation(new URLSearchParams(location.search).get("c") ?? "");

function element<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<string | Node>): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

const starName = (star: Star, lang: Lang): string => (lang === "ja" ? star.nameJa : undefined) ?? star.name ?? star.designation ?? `HR ${star.hr}`;
const mapHref = (query: Record<string, string | number>): string => `./?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()}`;

function say2(c: Constellation, kind: "en" | "ja"): void {
  if (!("speechSynthesis" in window)) return;
  const words = new SpeechSynthesisUtterance(kind === "ja" ? c.japanese : c.name);
  words.lang = kind === "ja" ? "ja-JP" : "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(words);
}

function render(c: Constellation): void {
  const lang = langNow();
  const look = lookNow();
  const facts = constellationFacts(c.abbreviation);
  document.title = `${nameIn(c, lang)} - Hoshi Stars`;
  $("cp-heading").textContent = nameIn(c, lang);
  $("cp-sub").textContent = `${lang === "ja" ? c.name : c.japanese} · ${c.abbreviation} · ${facts.meaning[lang]}`;
  const image = $<HTMLImageElement>("cp-image");
  image.src = thumbSrc(c.abbreviation, 1200, look);
  image.alt = `${nameIn(c, lang)} (${c.abbreviation})`;
  const files = $("cp-files");
  files.replaceChildren(
    ...(["light", "dark"] as const).flatMap((one) =>
      ([["svg", `thumbnails/svg/${one}/${c.abbreviation}.svg`], ["480", thumbSrc(c.abbreviation, 480, one)], ["1200", thumbSrc(c.abbreviation, 1200, one)]] as const).map(([label, href]) => {
        const link = element("a", { href, className: "fam-chip", textContent: `${say(one === "light" ? "cp_light" : "cp_dark")} ${label === "svg" ? "SVG" : `PNG ${label}`}` });
        link.setAttribute("download", "");
        return link;
      }),
    ),
  );
  const open = $<HTMLAnchorElement>("cp-map");
  open.href = `./?go=${c.abbreviation}`;
  $<HTMLAnchorElement>("cp-space").href = `constellation-3d.html?c=${c.abbreviation}`;

  const list = $("cp-facts");
  const row = (key: string, value: string | Node): void => {
    list.append(element("dt", { textContent: say(key) }), element("dd", {}, value));
  };
  list.replaceChildren();
  row("cp_abbreviation", c.abbreviation);
  row("cp_latin", `${c.name} (${c.genitive})`);
  row("cp_english", c.english);
  row("cp_japanese", `${c.japanese} (${c.reading})`);
  row("cp_meaning", facts.meaning[lang]);
  row("cp_hemisphere", say(`hemi_${facts.hemisphere}`));
  row("cp_best", monthName(facts.bestMonth));
  row("cp_origin", `${facts.designer[lang]}, ${facts.year === 150 ? say("cp_about", { year: facts.year }) : facts.year}. ${say(`origin_${facts.origin}`)}`);
  row("cp_easy", `${say(`diff_${facts.difficulty}`)}. ${say("cp_easyNote")}`);
  row("cp_asterisms", facts.asterisms.length === 0 ? say("cp_none") : facts.asterisms.map((a) => a[lang]).join(", "));
  row(
    "cp_showers",
    facts.meteorShowers.length === 0 ? say("cp_none") : facts.meteorShowers.map((s) => `${s.name[lang]} (${say("cp_peak")} ${Number(s.peak.slice(0, 2))}/${Number(s.peak.slice(3))})`).join(", "),
  );

  const speakers = $("cp-say");
  speakers.replaceChildren();
  if ("speechSynthesis" in window) {
    for (const kind of ["en", "ja"] as const) {
      const button = element("button", { type: "button", className: "fam-button", textContent: say(kind === "en" ? "cp_sayEn" : "cp_sayJa") });
      button.addEventListener("click", () => say2(c, kind));
      speakers.append(button);
    }
  }

  $("cp-neighbours").replaceChildren(...neighbouringConstellations(c.abbreviation).map((n) => element("a", { href: `constellation.html?c=${n.abbreviation}`, className: "fam-chip", textContent: nameIn(n, lang) })));
  $("cp-stars").replaceChildren(
    ...starsIn(c.abbreviation).slice(0, 24).map((star) => {
      const light = starDistanceLightYears(star);
      const link = element("a", { href: mapHref({ pick: `S:${star.hr}`, ra: star.rightAscension.toFixed(2), dec: star.declination.toFixed(2), zoom: 8 }), className: "fam-chip", textContent: `${starName(star, lang)} ${star.magnitude.toFixed(1)}` });
      if (light !== undefined) link.title = `${Math.round(light).toLocaleString(lang)} ${say("lightYears")}`;
      return link;
    }),
  );
  const objects = messier().filter((object) => object.constellation === c.abbreviation);
  $("cp-messier").replaceChildren(
    ...(objects.length === 0
      ? [element("span", { className: "fam-fine", textContent: say("cp_none") })]
      : objects.map((o) => element("a", { href: mapHref({ pick: `D:${o.id}`, ra: o.rightAscension.toFixed(2), dec: o.declination.toFixed(2), zoom: 12 }), className: "fam-chip", textContent: o.name === undefined ? o.id : `${o.id} ${o.name}` }))),
  );
  const all = constellations();
  const at = all.findIndex((one) => one.abbreviation === c.abbreviation);
  const previous = all[(at + 87) % 88]!;
  const next = all[(at + 1) % 88]!;
  const prev = $<HTMLAnchorElement>("cp-prev");
  prev.href = `constellation.html?c=${previous.abbreviation}`;
  prev.textContent = `‹ ${say("cp_prev")}: ${nameIn(previous, lang)}`;
  const following = $<HTMLAnchorElement>("cp-next");
  following.href = `constellation.html?c=${next.abbreviation}`;
  following.textContent = `${say("cp_next")}: ${nameIn(next, lang)} ›`;
}

if (found === undefined) {
  $("cp-missing").hidden = false;
} else {
  $("cp-body").hidden = false;
  const draw = (): void => render(found);
  document.addEventListener("hoshi-language", draw);
  onLook(draw);
  draw();
}
