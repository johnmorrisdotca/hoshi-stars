// Small kana readings (ruby) over the Chinese sky's group names, 三垣 (the Three Enclosures), 二十八宿 (the Twenty-Eight Mansions) and 星官 (asterisms), and over the 28 mansions' names,
// for a child or anyone still learning kanji on the Japanese page. Off by default. On with the Readings switch, which only the Japanese page of the Chinese sky shows and whose choice is
// kept on this device and written to the address, or for one visit with `readings=on` in the address.
import type { AddressState } from "@johnmorrisdotca/kazoku-ui/address-state";

const STORE = "hoshi-stars.readings";

/** Each word and its reading, the longest first, so 二十八宿 is read as one word and not as 宿. The mansions are in the Traditional characters their cards show. */
export const READINGS: ReadonlyArray<readonly [string, string]> = (
  [
    ["二十八宿", "にじゅうはっしゅく"],
    ["三垣", "さんえん"],
    ["星官", "せいかん"],
    ["角宿", "かくしゅく"],
    ["亢宿", "こうしゅく"],
    ["氐宿", "ていしゅく"],
    ["房宿", "ぼうしゅく"],
    ["心宿", "しんしゅく"],
    ["尾宿", "びしゅく"],
    ["箕宿", "きしゅく"],
    ["斗宿", "としゅく"],
    ["牛宿", "ぎゅうしゅく"],
    ["女宿", "じょしゅく"],
    ["虛宿", "きょしゅく"],
    ["危宿", "きしゅく"],
    ["室宿", "しっしゅく"],
    ["壁宿", "へきしゅく"],
    ["奎宿", "けいしゅく"],
    ["婁宿", "ろうしゅく"],
    ["胃宿", "いしゅく"],
    ["昴宿", "ぼうしゅく"],
    ["畢宿", "ひっしゅく"],
    ["觜宿", "ししゅく"],
    ["參宿", "しんしゅく"],
    ["井宿", "せいしゅく"],
    ["鬼宿", "きしゅく"],
    ["柳宿", "りゅうしゅく"],
    ["星宿", "せいしゅく"],
    ["張宿", "ちょうしゅく"],
    ["翼宿", "よくしゅく"],
    ["軫宿", "しんしゅく"],
    ["宿", "しゅく"],
  ] as const
).toSorted((a, b) => b[0].length - a[0].length);

/** Writes `text` into `host`, with each word of READINGS in a `<ruby>` with its reading when `on`, else as plain text. */
export function writeReadings(host: Element, text: string, on: boolean): void {
  if (!on) {
    host.textContent = text;
    return;
  }
  const parts: Array<string | Node> = [];
  let plain = "";
  let at = 0;
  while (at < text.length) {
    const found = READINGS.find(([word]) => text.startsWith(word, at));
    if (found === undefined) {
      plain += text[at];
      at += 1;
      continue;
    }
    if (plain !== "") parts.push(plain);
    plain = "";
    const ruby = document.createElement("ruby");
    // the brackets show only where a browser cannot set the reading above the word
    const bracket = (text: string): HTMLElement => Object.assign(document.createElement("rp"), { textContent: text });
    ruby.append(found[0], bracket("("), Object.assign(document.createElement("rt"), { textContent: found[1] }), bracket(")"));
    parts.push(ruby);
    at += found[0].length;
  }
  if (plain !== "") parts.push(plain);
  host.replaceChildren(...parts);
}

/**
 * The Readings switch: `button` turns the readings on and off, and `row`, which holds it, is shown while `show` says so (the readings are on only then). Only a press of the switch
 * is kept on this device; `readings=on` in the address (a link from the sheets page) turns them on for that visit and leaves what is kept alone. While the switch is shown, a
 * choice kept on and missing from the address is written to it; `refresh`, called after a change of language or sky, does that. `changed` runs after a press, so the page draws again.
 */
export function mountReadings(row: HTMLElement, button: HTMLButtonElement, address: AddressState, show: () => boolean, changed: () => void): { on: () => boolean; refresh: (label: string) => void } {
  let kept: string | null = null;
  try {
    kept = localStorage.getItem(STORE);
  } catch {
    // A browser that keeps nothing starts with the readings off.
  }
  const asked = (): boolean => address.get("readings") === "on" || (!address.has("readings") && kept === "on");
  button.addEventListener("click", () => {
    const next = !asked();
    kept = next ? "on" : "off";
    try {
      localStorage.setItem(STORE, kept);
    } catch {
      // Not kept; the address still has it.
    }
    address.set("readings", next ? "on" : null);
    changed();
  });
  return {
    on: () => show() && asked(),
    refresh(label) {
      row.hidden = !show();
      if (show() && !address.has("readings") && kept === "on") address.set("readings", "on");
      button.textContent = label;
      button.setAttribute("aria-pressed", String(asked()));
    },
  };
}
