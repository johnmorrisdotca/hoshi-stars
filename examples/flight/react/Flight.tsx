import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { createElement, useEffect, useRef, useState } from "react";

export function Flight() {
  const flight = useRef<HoshiFlightElement>(null);
  const [where, setWhere] = useState("sun");
  useEffect(() => {
    const element = flight.current!;
    const onChange = (event: Event) => {
      const { change, at } = (event as CustomEvent<FlightChange>).detail;
      if (change !== "moving") setWhere(at);
    };
    element.addEventListener("hoshi-flight", onChange);
    return () => element.removeEventListener("hoshi-flight", onChange);
  }, []);
  return (
    <>
      {createElement("hoshi-flight", { ref: flight, at: "sun", style: { height: "60vh" } })}
      <button type="button" onClick={() => flight.current!.goTo("hr-7001")}>
        Fly to Vega
      </button>
      <p>{where}</p>
    </>
  );
}
