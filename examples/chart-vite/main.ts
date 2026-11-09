import { chartSvg, type HoshiChart, type PickDetail } from "@johnmorrisdotca/hoshi-stars/chart";

const chart = document.querySelector<HoshiChart>("#chart")!;

chart.addEventListener("hoshi-pick", (event) => {
  console.log((event as CustomEvent<PickDetail>).detail.key);
});
document.querySelector("#orion")!.addEventListener("click", () => {
  chart.setAttribute("projection", "stereographic");
  chart.setAttribute("ra", "84");
  chart.setAttribute("dec", "0");
  chart.setAttribute("zoom", "2");
  chart.setAttribute("constellation", "Ori");
});
document.querySelector("#plain")!.addEventListener("click", () => chart.setAttribute("controls", "none"));

// The same chart as a string, for a page that runs no element.
const svg = chartSvg({ width: 320, height: 240, layers: ["lines", "names"] });
document.body.insertAdjacentHTML("beforeend", `<div data-testid="string">${svg}</div>`);
