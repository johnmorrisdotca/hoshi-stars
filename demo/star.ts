// The star embed page: one star's portrait, or the star next to the Sun, drawn from its address, for a page that cannot run script of its own. The address is read as text:
//   ?star=2061         the star's Bright Star Catalogue number (Betelgeuse)      &view=compare   the star next to the Sun (the default is the portrait)
//   &lang=ja           the words in the picture in Japanese
import { starByHr } from "../src/index.ts";
import { starComparison, starPortrait } from "../src/portrait.ts";
import { starProfile } from "../src/profile.ts";
import { starChoiceOf } from "./star-code.ts";

const host = document.getElementById("star")!;
const choice = starChoiceOf(new URLSearchParams(location.search), (hr) => {
  const star = starByHr(hr);
  return star === undefined ? undefined : (star.name ?? star.designation ?? `HR ${hr}`);
});
const ja = new URLSearchParams(location.search).get("lang") === "ja";
document.documentElement.lang = ja ? "ja" : "en";

if (choice === undefined) {
  host.innerHTML = `<p>${ja ? "星の番号が見つかりません。" : "No star: give its Bright Star Catalogue number as ?star=2061."}</p>`;
} else {
  const profile = starProfile(starByHr(choice.hr)!);
  const size = Math.max(120, Math.min(host.clientWidth || 480, Math.round(((host.clientHeight || 480) / (choice.view === "portrait" ? 1.2 : 0.86)))));
  const svg = choice.view === "compare" ? starComparison(profile, { name: choice.name, lang: choice.lang, size }) : starPortrait(profile, { name: choice.name, lang: choice.lang, size });
  host.innerHTML = svg ?? `<p>${ja ? "この星は描けません。" : "This star cannot be drawn: its temperature or radius is not known."}</p>`;
}
document.documentElement.dataset.ready = "true";
