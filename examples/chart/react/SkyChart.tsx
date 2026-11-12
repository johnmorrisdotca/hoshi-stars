import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { createElement, useEffect, useRef, useState } from "react";

export function SkyChart() {
  const chart = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState("Tap a star.");
  useEffect(() => {
    const element = chart.current!;
    const onPick = (event: Event) => {
      const { kind, id } = (event as CustomEvent<ChartPick>).detail;
      setPicked(`${kind} ${id ?? ""}`);
    };
    element.addEventListener("hoshi-pick", onPick);
    return () => element.removeEventListener("hoshi-pick", onPick);
  }, []);
  return (
    <>
      {createElement("hoshi-chart", { ref: chart, constellation: "Cyg", layers: "milky lines names" })}
      <p>{picked}</p>
    </>
  );
}
