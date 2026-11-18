import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";

const flight = document.querySelector<HoshiFlightElement>("hoshi-flight")!;
flight.addEventListener("hoshi-flight", (event) => {
  const { change, at } = (event as CustomEvent<FlightChange>).detail;
  if (change !== "moving") document.getElementById("where")!.textContent = at;
});
document.getElementById("go")!.addEventListener("click", () => flight.goTo("hr-7001"));
