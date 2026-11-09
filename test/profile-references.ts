// The published measurements `starProfile` is checked against, each with where it is from. Typed from the papers' tables.

/**
 * Boyajian et al. (2012, ApJ 746, 101, arXiv:1112.3316): CHARA Array angular diameters of A, F and G dwarfs and subgiants, with the radii they give. Table 1 (HR number), Table 5 (limb-darkened angular diameter
 * and its error, mas) and Table 10 (radius and its error, solar radii). HR number, theta_LD mas, error, radius, error. HD 103095 is left out: it is not in the Bright Star Catalogue.
 * The paper's parallaxes (van Leeuwen's reduction of Hipparcos, CC BY-NC) are deliberately not copied: this package reads none of ESA's data (NOTICE.md), so the radius is tested with the
 * catalogue's own parallax, for the stars where that fixes a distance, and the angular diameter, which needs no distance, for all of them.
 */
export const CHARA_DWARFS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [219, 1.623, 0.004, 1.039, 0.004],
  [244, 0.865, 0.01, 1.743, 0.023],
  [321, 0.972, 0.009, 0.79, 0.009],
  [511, 0.763, 0.019, 0.825, 0.021],
  [799, 1.103, 0.009, 1.319, 0.011],
  [937, 1.246, 0.008, 1.412, 0.009],
  [996, 0.936, 0.025, 0.919, 0.025],
  [1101, 1.081, 0.014, 1.622, 0.024],
  [1543, 1.526, 0.004, 1.323, 0.004],
  [1729, 0.981, 0.015, 1.331, 0.021],
  [2047, 1.051, 0.009, 0.979, 0.009],
  [2484, 1.401, 0.009, 2.71, 0.021],
  [2763, 0.835, 0.013, 2.777, 0.047],
  [2852, 0.853, 0.014, 1.655, 0.028],
  [3757, 1.133, 0.009, 2.902, 0.026],
  [3775, 1.632, 0.005, 2.365, 0.008],
  [3815, 0.821, 0.013, 1.003, 0.016],
  [3951, 0.771, 0.012, 1.247, 0.021],
  [4112, 0.794, 0.014, 1.091, 0.02],
  [4295, 1.149, 0.014, 3.021, 0.038],
  [4357, 1.328, 0.009, 2.557, 0.02],
  [4496, 0.91, 0.009, 0.94, 0.01],
  [4540, 1.431, 0.006, 1.681, 0.008],
  [4785, 1.238, 0.03, 1.123, 0.028],
  [4983, 1.127, 0.011, 1.106, 0.011],
  [5107, 0.852, 0.009, 2.079, 0.025],
  [5404, 1.109, 0.007, 1.733, 0.011],
  [5447, 0.841, 0.013, 1.431, 0.023],
  [5544, 1.196, 0.014, 0.863, 0.011],
  [5892, 0.768, 0.017, 1.783, 0.04],
  [5933, 1.217, 0.005, 1.472, 0.007],
  [6060, 0.78, 0.017, 1.166, 0.026],
  [6636, 0.949, 0.026, 2.329, 0.067],
  [6710, 0.775, 0.027, 1.961, 0.071],
  [7061, 1, 0.006, 2.064, 0.017],
  [7235, 0.895, 0.017, 2.449, 0.046],
  [7373, 0.845, 0.025, 1.379, 0.042],
  [7462, 1.254, 0.012, 0.776, 0.008],
  [7469, 0.861, 0.015, 1.697, 0.03],
  [8450, 0.862, 0.018, 2.623, 0.083],
  [8585, 0.634, 0.022, 2.143, 0.074],
  [8665, 1.091, 0.008, 1.912, 0.016],
  [8969, 1.082, 0.009, 1.595, 0.014],
];

/**
 * Single stars, each with a measured limb-darkened (or Rosseland) angular diameter in milliarcseconds and its error, and where it is from. None of them depends on a parallax.
 */
export const MEASURED_DIAMETERS: ReadonlyArray<{ name: string; thetaMas: number; error: number; radius?: number; radiusError?: number; source: string }> = [
  { name: "Sirius", thetaMas: 6.039, error: 0.019, radius: 1.711, radiusError: 0.013, source: "Kervella et al. 2003, A&A 408, 681 (VLTI/VINCI), limb-darkened; radius from the paper" },
  { name: "Arcturus", thetaMas: 21.05, error: 0.21, source: "Lacour et al. 2008, A&A 485, 561 (IOTA/IONIC), Rosseland diameter" },
  { name: "Aldebaran", thetaMas: 20.3, error: 0.4, source: "Richichi, Dyachenko, Pandey et al. 2016, arXiv:1609.06007, lunar occultations, 'about 20.3 mas on average'" },
  { name: "Pollux", thetaMas: 8.51, error: 0.09, source: "van Belle et al. 2021, ApJ 922, 163, Table 18 (PTI)" },
  { name: "Betelgeuse", thetaMas: 42.28, error: 0.09, source: "Montargès, Kervella, Perrin et al. 2013, EAS Publications Series 60, 167 (arXiv:1305.6718, VLTI/AMBER), K-band continuum, limb-darkened (the star varies: 42 to 44 mas)" },
  { name: "Antares", thetaMas: 37.38, error: 0.06, source: "Ohnaka et al. 2013, A&A 555, A24 (VLTI/AMBER), continuum, limb-darkened (2009)" },
];
