import { creditLine, starSky } from "@johnmorrisdotca/hoshi-stars/door";

// A source of your own: here two stars in one tile, held in memory. A real one would fetch its tiles from a server, and says whose they are and under what licence.
const mine = {
  kind: "tiles",
  info: {
    id: "my-stars",
    name: { en: "My stars", ja: "私の星" },
    credit: { en: "My stars, A. Person (2026)", ja: "私の星（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-stars",
    retrieved: "2026-11-10",
  },
  need: () => ["tile-0"],
  load: async () => {
    const column = (values) => Float64Array.from(values);
    return { id: { level: 0, band: 0, column: 0 }, count: 2, rightAscension: column([83.8, 83.9]), declination: column([-5.4, -5.3]), magnitude: column([9.1, 10.4]), colourIndex: column([0.6, NaN]) };
  },
  bytes: (tile) => tile.count * 32,
};

const sky = starSky({ sources: [mine] });
const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
await sky.load(orion, 12);
const { stars } = sky.stars(orion, 12);
console.log(`${stars.length} stars, the brightest of magnitude ${stars[0].magnitude}`);
console.log(creditLine(sky.credits(), "en"));
console.log(creditLine(sky.credits(), "ja"));

sky.enable("my-stars", false);
console.log(`${sky.stars(orion, 12).stars.length} stars with the source off`);
