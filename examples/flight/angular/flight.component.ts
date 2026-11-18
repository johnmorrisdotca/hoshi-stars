import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";

@Component({
  selector: "app-flight",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-flight #flight at="sun" style="height: 60vh" (hoshi-flight)="onChange($event)"></hoshi-flight><button type="button" (click)="flight.goTo('hr-7001')">Fly to Vega</button><p>{{ where() }}</p>`,
})
export class FlightComponent {
  readonly where = signal("sun");
  onChange(event: Event): void {
    const { change, at } = (event as CustomEvent<FlightChange>).detail;
    if (change !== "moving") this.where.set(at);
  }
}
