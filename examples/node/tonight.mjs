import { visibleStars } from "@johnmorrisdotca/hoshi-stars/tonight";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const night = visibleStars({ observer: vancouver, when: new Date("2026-11-08T10:00:00Z"), sky: { limit: "suburb" } });
console.log(`${night.twilight}, limit ${night.limitingMagnitude}: ${night.stars.length} stars, the brightest ${night.stars[0].star.name}`);

const noon = visibleStars({ observer: vancouver, when: new Date("2026-11-08T20:00:00Z") });
console.log(`${noon.twilight}: ${noon.stars.length} stars`);

const polaris = night.stars.find((one) => one.star.name === "Polaris");
console.log(`Polaris ${polaris.altitude.toFixed(0)} degrees up, ${polaris.ease}`);
