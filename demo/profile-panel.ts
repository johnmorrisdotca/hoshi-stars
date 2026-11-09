// The star's profile in the demo's side panel: the portrait (or the star next to the Sun) at the top and the figures worked out for it below, each with its range. The drawing and the numbers come from
// `/profile` and `/portrait`; this file only lays them out, in the page's language. A figure that could not be worked out says why, in words.
import { starPortrait, starComparison } from "../src/portrait.ts";
import type { Estimate, ProfileInput, StarProfile } from "../src/profile.ts";
import { NO_GCTP } from "./build.ts";

/** What the panel needs from the page. */
export interface ProfileContext {
  say: (key: string) => string;
  lang: () => "en" | "ja";
}

/** The two pictures the panel offers. */
export type ProfileView = "portrait" | "compare";

/** A number with about three significant figures and the page's digit grouping: 0.71, 2.63, 47, 336, 1,930. */
export function figure(value: number, lang: "en" | "ja"): string {
  if (!Number.isFinite(value)) return "∞";
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  const rounded = value >= 1000 ? Math.round(value / 10) * 10 : Number(value.toFixed(digits));
  return rounded.toLocaleString(lang === "ja" ? "ja-JP" : "en", { maximumFractionDigits: 3 });
}

const range = (e: Estimate, lang: "en" | "ja", say: (key: string) => string): string => (Number.isFinite(e.range[1]) ? `${figure(e.range[0], lang)} ${say("rangeTo")} ${figure(e.range[1], lang)}` : `${figure(e.range[0], lang)} ${say("rangeOrMore")}`);
const fill = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** The picture and the buttons that switch it, as a node to put under the star's name. `onView` is called when a button is pressed. */
export function profileTop(profile: StarProfile, name: string, view: ProfileView, context: ProfileContext, onView: (next: ProfileView) => void): HTMLElement {
  const lang = context.lang();
  const top = document.createElement("div");
  top.className = "star-profile";
  top.dataset.testid = "star-profile";
  const tabs = document.createElement("div");
  tabs.className = "fam-seg";
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", context.say("viewLabel"));
  tabs.dataset.testid = "star-view";
  const compare = starComparison(profile, { lang, name });
  for (const [value, text] of [["portrait", context.say("viewPortrait")], ["compare", context.say("viewCompare")]] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fam-button";
    button.dataset.value = value;
    button.dataset.testid = `star-view-${value}`;
    button.setAttribute("aria-pressed", String(view === value));
    button.textContent = text;
    if (value === "compare" && compare === undefined) button.disabled = true;
    button.addEventListener("click", () => onView(value));
    tabs.append(button);
  }
  const art = document.createElement("div");
  art.className = view === "compare" ? "star-art compare" : "star-art";
  art.dataset.testid = view === "compare" ? "star-compare" : "star-portrait";
  const svg = view === "compare" ? compare : starPortrait(profile, { lang, name });
  if (svg !== undefined) art.innerHTML = svg;
  else art.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: context.say(view === "compare" ? "noComparison" : "noPortrait") }));
  top.append(tabs, art);
  return top;
}

/** One line of the figures: a name, the value and, small under it, how it was found. */
export interface ProfileRow {
  key: string;
  value: string;
  note?: string | undefined;
}

/** The figures of a profile as rows for the panel's list: temperature, radius, luminosity, size in the sky, and the measured shape. Each says its range or why it is not known. */
export function profileRows(profile: StarProfile, context: ProfileContext): ProfileRow[] {
  const { say } = context;
  const lang = context.lang();
  const rows: ProfileRow[] = [];
  const r = profile.radius;
  rows.push(
    r === undefined
      ? { key: "fieldRadius", value: say("unknown"), note: say(`why_${profile.unknown.radius ?? "no-parallax"}`) }
      : { key: "fieldRadius", value: Math.abs(r.value - 1) < 0.03 ? say("sunSize") : fill(say("timesSun"), { n: figure(r.value, lang) }), note: `${range(r, lang, say)} · ${say(r.basis === "parallax" ? "radiusParallax" : "radiusType")}` },
  );
  const t = profile.temperature;
  rows.push(
    t === undefined
      ? { key: "fieldTemperature", value: say("unknown"), note: say(`why_${profile.unknown.temperature ?? "no-colour-or-type"}`) }
      : { key: "fieldTemperature", value: `${figure(t.value, lang)} K`, note: `± ${figure(t.error, lang)} · ${say(t.basis === "colour" ? "tempColour" : t.basis === "spectral type" ? "tempType" : "tempBoth")}` },
  );
  const l = profile.luminosity;
  rows.push(
    l === undefined
      ? { key: "fieldLuminosity", value: say("unknown"), note: say(`why_${profile.unknown.luminosity ?? "no-parallax"}`) }
      : { key: "fieldLuminosity", value: Math.abs(l.value - 1) < 0.03 ? say("sunLight") : fill(say("timesSunLight"), { n: figure(l.value, lang) }), note: range(l, lang, say) },
  );
  const a = profile.angularDiameterMas;
  if (a !== undefined) rows.push({ key: "fieldAngular", value: `${figure(a.value, lang)} ${say("milliarcseconds")}`, note: `${range(a, lang, say)} · ${say("angularNote")}` });
  const s = profile.shape;
  if (s !== undefined) {
    rows.push({
      key: "fieldShape",
      value: fill(say(s.kind === "oblate" ? "shapeOblate" : "shapePoleOn"), { eq: figure(s.equatorialRadius, lang), pole: figure(s.polarRadius, lang) }),
      note: s.source,
    });
  }
  return rows;
}

/** The sentences that go under the figures: what the ranges mean, a warning for a pair of stars and, on the fallback build, that a star with a parallax has no error given for it. `input` is what the profile was made from. */
export function profileNotes(profile: StarProfile, context: ProfileContext, input?: ProfileInput): string[] {
  const notes = [context.say("profileFoot")];
  if (profile.composite) notes.push(context.say("compositeNote"));
  // The fallback build has no parallax errors, so the ranges allow only for the rounding of the catalogue's parallax: it says so.
  if (NO_GCTP && input?.parallaxErrorMas === undefined && profile.radius?.basis === "parallax") notes.push(context.say("noGctpProfileNote"));
  return notes;
}

/** What `starProfile` reads for the Sun, so the Sun gets a profile too. */
export const SUN_INPUT: ProfileInput = { magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206_264_806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" };
