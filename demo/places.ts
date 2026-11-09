// The places the sheets pick from: the regions of the countries that span many latitudes (kuni's subdivision facts, each region's point from Wikidata) and the flags (hata's) of the countries most classes ask for. Demo only: this package
// depends on neither. Each is its own chunk, fetched when a country is picked.
import { countryName } from "@johnmorrisdotca/kuni";

export interface RegionPoint {
  code: string;
  name: { en: string; ja: string };
  lat: number;
}

const FACTS: Record<string, () => Promise<{ default: readonly { code: string; point: { lat: number; lon: number } | null }[] }>> = {
  CA: () => import("@johnmorrisdotca/kuni/subdivision-facts/ca"),
  US: () => import("@johnmorrisdotca/kuni/subdivision-facts/us"),
  RU: () => import("@johnmorrisdotca/kuni/subdivision-facts/ru"),
  BR: () => import("@johnmorrisdotca/kuni/subdivision-facts/br"),
  AU: () => import("@johnmorrisdotca/kuni/subdivision-facts/au"),
  JP: () => import("@johnmorrisdotca/kuni/subdivision-facts/jp"),
  CN: () => import("@johnmorrisdotca/kuni/subdivision-facts/cn"),
  IN: () => import("@johnmorrisdotca/kuni/subdivision-facts/in"),
  CL: () => import("@johnmorrisdotca/kuni/subdivision-facts/cl"),
  AR: () => import("@johnmorrisdotca/kuni/subdivision-facts/ar"),
  MX: () => import("@johnmorrisdotca/kuni/subdivision-facts/mx"),
  NZ: () => import("@johnmorrisdotca/kuni/subdivision-facts/nz"),
};
const NAMES: Record<string, () => Promise<{ default: readonly { code: string; name: { en: string; ja: string | null } }[] }>> = {
  CA: () => import("@johnmorrisdotca/kuni/subdivisions/ca"),
  US: () => import("@johnmorrisdotca/kuni/subdivisions/us"),
  RU: () => import("@johnmorrisdotca/kuni/subdivisions/ru"),
  BR: () => import("@johnmorrisdotca/kuni/subdivisions/br"),
  AU: () => import("@johnmorrisdotca/kuni/subdivisions/au"),
  JP: () => import("@johnmorrisdotca/kuni/subdivisions/jp"),
  CN: () => import("@johnmorrisdotca/kuni/subdivisions/cn"),
  IN: () => import("@johnmorrisdotca/kuni/subdivisions/in"),
  CL: () => import("@johnmorrisdotca/kuni/subdivisions/cl"),
  AR: () => import("@johnmorrisdotca/kuni/subdivisions/ar"),
  MX: () => import("@johnmorrisdotca/kuni/subdivisions/mx"),
  NZ: () => import("@johnmorrisdotca/kuni/subdivisions/nz"),
};

/** The countries whose regions can be picked: those that span many latitudes. */
export const REGION_COUNTRIES: ReadonlySet<string> = new Set(Object.keys(FACTS));

/** The first-level regions of a country that have a point, by name. */
export async function regionPoints(country: string): Promise<RegionPoint[]> {
  const [facts, names] = await Promise.all([FACTS[country]!(), NAMES[country]!()]);
  const byCode = new Map(names.default.map((one) => [one.code, one.name]));
  return facts.default
    .filter((one) => one.point !== null && byCode.has(one.code))
    .map((one) => ({ code: one.code, name: { en: byCode.get(one.code)!.en, ja: byCode.get(one.code)!.ja ?? byCode.get(one.code)!.en }, lat: one.point!.lat }))
    .sort((a, b) => a.name.en.localeCompare(b.name.en));
}

const FLAGS: Record<string, () => Promise<{ default: string }>> = {
  JP: () => import("@johnmorrisdotca/hata/flags/jp"),
  CA: () => import("@johnmorrisdotca/hata/flags/ca"),
  US: () => import("@johnmorrisdotca/hata/flags/us"),
  AU: () => import("@johnmorrisdotca/hata/flags/au"),
  NZ: () => import("@johnmorrisdotca/hata/flags/nz"),
  GB: () => import("@johnmorrisdotca/hata/flags/gb"),
  IE: () => import("@johnmorrisdotca/hata/flags/ie"),
  FR: () => import("@johnmorrisdotca/hata/flags/fr"),
  DE: () => import("@johnmorrisdotca/hata/flags/de"),
  IT: () => import("@johnmorrisdotca/hata/flags/it"),
  ES: () => import("@johnmorrisdotca/hata/flags/es"),
  BR: () => import("@johnmorrisdotca/hata/flags/br"),
  AR: () => import("@johnmorrisdotca/hata/flags/ar"),
  CL: () => import("@johnmorrisdotca/hata/flags/cl"),
  MX: () => import("@johnmorrisdotca/hata/flags/mx"),
  CN: () => import("@johnmorrisdotca/hata/flags/cn"),
  KR: () => import("@johnmorrisdotca/hata/flags/kr"),
  IN: () => import("@johnmorrisdotca/hata/flags/in"),
  ZA: () => import("@johnmorrisdotca/hata/flags/za"),
  RU: () => import("@johnmorrisdotca/hata/flags/ru"),
};

/** A flag as a `data:` address for an `<img>`, or `null` when this page does not carry that flag. */
export async function regionFlag(country: string, region: string): Promise<string | null> {
  const load = FLAGS[country];
  if (load === undefined) return null;
  void region;
  const flag = (await load()).default;
  return `data:image/svg+xml,${encodeURIComponent(flag)}`;
}

export { countryName };
