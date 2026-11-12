import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { SkyChartComponent } from "./sky-chart.component";

void bootstrapApplication(SkyChartComponent, { providers: [provideZonelessChangeDetection()] });
