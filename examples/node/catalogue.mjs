import { catalogueCounts, catalogueStar, catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";

console.log(`${catalogueStars().length} bright stars load with /catalogue`);

const { nearbyLayer } = await import("@johnmorrisdotca/hoshi-stars/catalogue/nearby");
const layers = ["bright", nearbyLayer];
for (const count of catalogueCounts({ layers })) console.log(`${count.layer}: ${count.stars} stars, A ${count.grades.A}, B ${count.grades.B}, C ${count.grades.C}`);

const proxima = catalogueStar("gctp-3278", { layers });
const [near, far] = proxima.distance.lightYearsRange;
console.log(`${proxima.id} ${proxima.name}: ${proxima.layer} tier, grade ${proxima.grade}, ${near.toFixed(2)} to ${far.toFixed(2)} light-years`);

const sure = catalogueStars({ layers, minGrade: "A", magnitude: 9 });
console.log(`${sure.length} grade A stars to magnitude 9, the faintest ${sure.at(-1).name ?? sure.at(-1).id}`);
