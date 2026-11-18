import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { FlightComponent } from "./flight.component";

void bootstrapApplication(FlightComponent, { providers: [provideZonelessChangeDetection()] });
