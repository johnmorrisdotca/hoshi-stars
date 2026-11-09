import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { ChartComponent } from "./chart.component";

void bootstrapApplication(ChartComponent, { providers: [provideZonelessChangeDetection()] });
