// The stars whose catalogue parallax is too poor to print as it stands, and what the package does about each. Facts typed from published papers (see NOTICE.md), not catalogue data.
// A "paper" entry replaces the parallax with the paper's own distance, written as a parallax (1000 divided by the distance in parsecs) with the larger side of the paper's error, so the range is never narrower than the paper's.
// A "widened" entry keeps the Yale parallax but makes its error at least the parallax itself, so the distance has no upper limit and is `rough` everywhere: no clear-licence replacement was found, and the ground-based parallax of a bright supergiant is not to be read as a best value.

/** A distance from a published paper, as a parallax. */
export interface PaperDistance {
  kind: "paper";
  /** The parallax in milliarcseconds: 1000 divided by the paper's distance in parsecs. */
  parallaxMas: number;
  /** The error in milliarcseconds: the larger side of the paper's range, as a parallax. */
  parallaxErrorMas: number;
  /** The reference, shown beside the distance. */
  note: string;
}

/** A catalogue parallax kept with its error widened to at least the parallax itself. */
export interface WidenedDistance {
  kind: "widened";
  note: string;
}

/** The replaced or widened distances, by Bright Star Catalogue (HR) number. */
export const STAR_DISTANCE_NOTES: Readonly<Record<number, PaperDistance | WidenedDistance>> = {
  // Betelgeuse: Joyce, Leung, Molnar, Ireland, Kobayashi and Nomura (2020), ApJ 902, 63: 168 (+27/-15) pc, a parallax of 5.95 (+0.58/-0.85) mas. Error: the larger side, 0.85.
  2061: { kind: "paper", parallaxMas: 5.95, parallaxErrorMas: 0.85, note: "Joyce et al. 2020, ApJ 902, 63: 168 (+27/-15) pc, from asteroseismology and stellar models" },
  // Rigel: de Almeida et al. (2022), MNRAS, DOI 10.1093/mnras/stac1617 (arXiv:2204.00372): 0.26 +/- 0.02 kpc for a luminosity of 123,000 solar, 0.42 +/- 0.03 kpc for 279,000. 0.26 kpc is 3.85 mas; the error 1.65 mas reaches 0.45 kpc.
  1713: { kind: "paper", parallaxMas: 3.85, parallaxErrorMas: 1.65, note: "de Almeida et al. 2022, MNRAS (arXiv:2204.00372): 0.26 +/- 0.02 kpc, or 0.42 +/- 0.03 kpc for a higher luminosity; the range spans both" },
  // Polaris: Bond, Nelan, Evans, Schaefer and Harmer (2018), ApJ 853, 55: the Hubble parallax of its companion Polaris B, 6.26 +/- 0.24 mas.
  424: { kind: "paper", parallaxMas: 6.26, parallaxErrorMas: 0.24, note: "Bond et al. 2018, ApJ 853, 55: Hubble parallax of its companion Polaris B, 6.26 +/- 0.24 mas; other measurements put it nearer, so treat the distance as disputed" },
  6134: { kind: "widened", note: "Yale parallax with its error widened to the parallax itself: the ground-based parallax of a supergiant; no clear-licence figure to replace it" },
  2326: { kind: "widened", note: "Yale parallax with its error widened to the parallax itself: the ground-based parallax of a bright giant; no clear-licence figure to replace it" },
  8316: { kind: "widened", note: "Yale parallax, whose error already exceeds it: the distance has no upper limit" },
};
