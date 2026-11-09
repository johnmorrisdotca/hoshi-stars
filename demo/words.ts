// The page's words in its language, for the gallery, the constellation page and the list.
import { ALL_WORDS } from "../scripts/gallery-words.ts";
import { langNow } from "./thumbs.ts";

export const say = (key: string, values: Record<string, string | number> = {}): string => {
  const text = (ALL_WORDS[langNow()] as Record<string, string>)[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (values[name] === undefined ? whole : String(values[name])));
};

/** A month's name in the page's language (`November`, `11月`). */
export const monthName = (month: number): string => new Date(2026, month - 1, 15).toLocaleString(langNow() === "ja" ? "ja-JP" : "en", { month: "long" });
