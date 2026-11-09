// The luminosity class of a spectral type: the Roman numeral that tells a supergiant from a giant from a dwarf. Pure: no data, no DOM, no state.

/**
 * A luminosity class: `Ia`, `Iab` and `Ib` are supergiants (`I` where the type does not say which), `II` bright giants, `III` giants, `IV` subgiants, `V` dwarfs (main-sequence stars), `VI` subdwarfs and `D` white dwarfs.
 *
 * @example
 * ```ts
 * import { luminosityClass, type LuminosityClass } from "@johnmorrisdotca/hoshi-stars";
 *
 * const kind: LuminosityClass | undefined = luminosityClass("M1-2Ia-Iab");
 * console.log(kind);
 * ```
 */
export type LuminosityClass = "Ia" | "Iab" | "Ib" | "I" | "II" | "III" | "IV" | "V" | "VI" | "D";

const OLD_PREFIX: Readonly<Record<string, LuminosityClass>> = { c: "I", g: "III", d: "V", sd: "VI" };

/**
 * The luminosity class a spectral type states: the first class in the string (`Ia` for `M1-2Ia-Iab`, `IV` for `F5IV-V`, `V` for `A0Va`, `III` for `gK2`, whose `g` is the old word for a giant). A white dwarf type
 * (`DA2`) is `D`. A type with no class, such as `Am` or `K0`, gives `undefined`.
 *
 * @param spectralType - A spectral type as a catalogue prints it (`K1.5IIIFe-0.5`, `M5.5eV`).
 * @returns The class, or `undefined` where the type states none.
 * @throws TypeError if `spectralType` is not a string.
 *
 * @example
 * ```ts
 * import { luminosityClass } from "@johnmorrisdotca/hoshi-stars";
 *
 * console.log(luminosityClass("A1Vm"), luminosityClass("K0III"), luminosityClass("Am"));
 * ```
 */
export function luminosityClass(spectralType: string): LuminosityClass | undefined {
  if (typeof spectralType !== "string") throw new TypeError(`spectralType must be a string, got ${String(spectralType)}`);
  const text = spectralType.trim();
  if (/^D[A-Z]/.test(text)) return "D";
  const prefix = /^(sd|g|d|c)(?=[A-Z])/.exec(text)?.[1];
  const rest = /^[OBAFGKMCRNS](?:[0-9](?:\.[0-9])?)?(?:-[0-9.]+)?(.*)$/.exec(prefix === undefined ? text : text.slice(prefix.length))?.[1] ?? "";
  const found = /(Iab|Ia|Ib|III|II|IV|VI|V|I)/.exec(rest)?.[1];
  return (found ?? (prefix === undefined ? undefined : OLD_PREFIX[prefix])) as LuminosityClass | undefined;
}
