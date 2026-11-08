// The embed page: it draws what its address says, for a site that cannot run script of its own, once and again when its frame is resized. The address is read as text:
//   ?proj=stereographic  one of the seven projections         &ra=84&dec=0&zoom=3     where it looks (degrees) and how far in (left out: Orion, 90 degrees wide, 60 under 600 px)
//   &mag=5               the faintest star                   &layers=milky,lines,names,grid  or none (also boundaries, deep)
//   &lang=ja             constellation names in Japanese     &c=Ori                  one constellation brighter, with its boundary
import { chart } from "./chart.ts";
import { choiceOf } from "./choice.ts";

const frame = document.getElementById("frame")!;

function draw(): void {
  const width = Math.max(1, Math.round(frame.clientWidth));
  const height = Math.max(1, Math.round(frame.clientHeight));
  const choice = choiceOf(new URLSearchParams(location.search), width, height);
  frame.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${choice.lang === "ja" ? "星空の図" : "A chart of the sky"}">${chart({ ...choice, width, height }).svg}</svg>`;
  document.documentElement.dataset.ready = "true";
}

draw();
addEventListener("resize", draw);
