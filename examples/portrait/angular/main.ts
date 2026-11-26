import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { StarComponent } from "./star.component";

void bootstrapApplication(StarComponent, { providers: [provideZonelessChangeDetection()] });
