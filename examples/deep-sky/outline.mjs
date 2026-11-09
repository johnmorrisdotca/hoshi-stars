import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyOutline, deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
import { deepSkyPicture, pictureCorners } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

// Andromeda at its measured size and angle, and the frame of its picture, on a map 4 degrees across (north up, east on the left).
const m31 = deepSkyObject("M31");
const shape = deepSkyShape(m31);
const picture = deepSkyPicture("M31");
const view = { centre: m31, scale: (800 / 4) * (180 / Math.PI) };
const path = (ring) =>
  ring
    .map((point, i) => {
      const at = project("gnomonic", point, view);
      return `${i === 0 ? "M" : "L"}${(400 + at.x).toFixed(1)} ${(400 - at.y).toFixed(1)}`;
    })
    .join("") + "Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Andromeda"><rect width="800" height="800" fill="#0b1020"/><path d="${path(pictureCorners(picture))}" fill="none" stroke="#6f93e0"/><path d="${path(deepSkyOutline(m31, shape))}" fill="none" stroke="#e0a458"/></svg>`;
writeFileSync(join(tmpdir(), "hoshi-m31.svg"), svg);
console.log("M31", shape.majorArcmin, shape.minorArcmin, shape.positionAngle, picture.file);
