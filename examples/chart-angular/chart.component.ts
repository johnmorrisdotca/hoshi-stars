import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import "@johnmorrisdotca/hoshi-stars/chart";

@Component({
  selector: "app-chart",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" constellation="Ori" style="width: 100%; max-width: 640px"></hoshi-chart>`,
})
export class ChartComponent {}
