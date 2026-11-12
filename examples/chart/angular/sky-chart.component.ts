import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";

@Component({
  selector: "app-sky-chart",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart constellation="Cas" layers="milky lines names" (hoshi-pick)="onPick($event)"></hoshi-chart><p>{{ picked() }}</p>`,
})
export class SkyChartComponent {
  readonly picked = signal("Tap a star.");
  onPick(event: Event): void {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    this.picked.set(`${kind} ${id ?? ""}`);
  }
}
