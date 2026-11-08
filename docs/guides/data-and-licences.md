---
title: Data and licences
section: explanation
order: 20
description: Where each part of the data comes from, what each licence lets an MIT package pass on, and what is deliberately left out.
---

[日本語](ja/data-and-licences.md)

The code is MIT. The data is in tiers, and a tier is in the package only if its licence lets an MIT package pass it on. `NOTICE.md` in the repository names every source, the sentence relied on and the day it was read; this page is the short version.

| Part | Source | Footing |
|---|---|---|
| The 5,080 stars | The Yale Bright Star Catalogue (Hoffleit and Warren 1991), from NASA HEASARC | The catalogue calls itself public domain and asks for credit, which the notice gives. There is no formal licence text, so the footing is informal. |
| Star names | The IAU Working Group on Star Names | A list of facts. |
| The 88 constellations, in English and Japanese | The IAU list; the National Astronomical Observatory of Japan | Names are facts, typed from published lists. No Wikipedia text. |
| Constellation boundaries | N. G. Roman (1987) from E. Delporte (1930), VizieR VI/42 | No licence stated; kept with credit and removed on request. |
| Constellation lines | Ours | Decided from the star data; no figure is copied from a book, atlas or program. |
| Messier, NGC and IC objects | Wikidata (CC0), checked against NASA/IPAC NED | CC0; positions corrected from NED where they disagree. |
| The Milky Way's brightness | SAO star counts (NASA HEASARC), the IRAS 100 micron dust map and COBE DIRBE (NASA), and a bulge of our own figures | The SAO catalogue states no licence: used with credit and removed on request. The two infrared maps are NASA mission data (public domain). No picture of the sky is read or traced. |
| Projections, sidereal time, refraction | Snyder's *Map Projections* and Meeus's *Astronomical Algorithms* | Formulas; no book text or library code. |

## Left out on purpose

- **ESA's Hipparcos, Tycho and Gaia** are CC BY-NC 3.0 IGO: non-commercial, which an MIT package cannot pass on.
- **HYG, AT-HYG and OpenNGC** are CC BY-SA, which would put share-alike on this package's data.
- **Stellarium's sky-culture files** are GPL, and **d3-celestial's data** has no stated licence. The constellation figures here are our own for that reason.

Stars fainter than 6.0 are not in the package. When a clear-licence catalogue is found they will be a tier of their own.

## How a number is checked

A test holds each count and each famous value: 15, 50, 174, 518, 1,630 and 5,080 stars to magnitudes 1 to 6; every bright star lies in the constellation the catalogue names, by the boundaries; every line's stars lie in its own constellation; the Messier, NGC and IC positions are NED's wherever Wikidata's was more than a minute of arc away. A failing test is a reason not to publish.
