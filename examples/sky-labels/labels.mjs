import { createFigureLines, createStarNames, discCover, labelStyleVars, lineStrengthFromAttribute, starNamesFromAttributes } from "@johnmorrisdotca/hoshi-stars/sky-labels";

// Your own sky: this one looks at Orion, 8 pixels to the degree, in a view 1280 by 720.
const project = (ra, dec, out) => {
  const across = ((ra - 84 + 540) % 360) - 180;
  out.x = 640 - across * 8;
  out.y = 360 - dec * 8;
  return Math.abs(across) < 80;
};
const view = { width: 1280, height: 720 };

// The names. The settings come from the page's attributes, star-names="5" here, and a look is a setting too.
const names = createStarNames({ ...starNamesFromAttributes("5", null), style: { case: "upper" } });
names.update(project, view);
console.log(names.labels.map((label) => label.text).join(", "));

// A body in front of the sky hides the stars behind it: here a disc over Sirius, and the next star is named instead.
const sirius = names.labels[0];
names.update(project, view, discCover(sirius.x, sirius.y, 30));
console.log(names.labels.map((label) => label.text).join(", "));

// The lines, from constellation-lines="0.3": every figure at that strength, the one under the pointer at full strength.
const lines = createFigureLines({ strength: lineStrengthFromAttribute("0.3") });
lines.update(project, view);
const orion = lines.figures.find((figure) => figure.abbreviation === "Ori");
lines.point(lines.segments[orion.start * 4], lines.segments[orion.start * 4 + 1]);
const other = lines.figures.find((figure) => figure !== lines.picked);
console.log(lines.picked.abbreviation, lines.name.text, lines.opacityOf(lines.picked), lines.opacityOf(other));

// The look as CSS custom properties, to set on the element that holds the labels.
console.log(labelStyleVars({ size: 14, case: "upper" })["--hoshi-label-size"]);

// SIRIUS, RIGEL, PROCYON, BETELGEUSE, ALDEBARAN
// RIGEL, PROCYON, BETELGEUSE, ALDEBARAN, POLLUX
// Ori Orion 1 0.3
// 14
