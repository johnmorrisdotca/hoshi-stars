import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { OrionComponent } from "./orion.component";

void bootstrapApplication(OrionComponent, { providers: [provideZonelessChangeDetection()] });
