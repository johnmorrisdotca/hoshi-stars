// The sky cultures the demo offers, by the word the address uses (`culture=chinese`); the Western sky is the one a page opens with.
import type { Culture } from "../src/culture.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { western } from "../src/cultures/western.ts";

export const CULTURE_IDS = ["western", "japanese", "chinese"] as const;
export type CultureId = (typeof CULTURE_IDS)[number];
export const DEFAULT_CULTURE: CultureId = "western";

const BY_ID: Readonly<Record<CultureId, Culture>> = { western, japanese, chinese };

/** The culture an address names, or `undefined` for a word that is none of them. */
export const cultureOf = (id: string | null | undefined): Culture | undefined => (CULTURE_IDS as readonly string[]).includes(id ?? "") ? BY_ID[id as CultureId] : undefined;

/** The word an address uses for a culture: `null` for the one a page opens with, so the address stays short. */
export const cultureText = (culture: Culture): CultureId | null => (culture.id === DEFAULT_CULTURE ? null : (culture.id as CultureId));
