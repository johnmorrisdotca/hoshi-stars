import { createElement } from "react";
import "@johnmorrisdotca/hoshi-stars/chart";

export function Chart({ constellation }: { constellation?: string }) {
  return createElement("hoshi-chart", { projection: "stereographic", ra: 84, dec: 0, layers: "milky-way,lines,names", constellation, style: { width: "100%", maxWidth: 640 } });
}
