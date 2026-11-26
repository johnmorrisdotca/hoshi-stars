import { Component, inject } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const drawn = starPortrait(starProfile(starByName("Sirius")!), { name: "Sirius", size: 320 }) ?? "";

@Component({
  selector: "app-star",
  template: `<div [innerHTML]="picture"></div>`,
})
export class StarComponent {
  readonly picture = inject(DomSanitizer).bypassSecurityTrustHtml(drawn);
}
