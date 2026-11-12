import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  document.getElementById("picked")!.textContent = `${kind} ${id ?? ""}`;
});
