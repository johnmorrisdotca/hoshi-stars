// The embed page of the flight: <hoshi-flight> filling the frame, opened where its address says, for a site that cannot run script of its own. A drag looks around; a pinch or Ctrl and the wheel narrows the view.
// The address is read as text, and each part is the element's attribute of the same name:
//   ?at=hr-7001          where the camera is (a place's id, or a point in parsecs: pc_1.5_-2_0.25)     &to=M31       a place to fly to once it is open (with reduced motion it is there at once)
//   &ra=279&dec=38.8     the direction it opens facing (degrees)     &fov=45   the view's height (degrees)     &sun-stop=40   how far from the Sun it stops (astronomical units)     &lang=ja
import "../src/flight-define.ts";
import { setThreeLoader, type HoshiFlightElement } from "../src/flight-element.ts";
import { frameCredit } from "./frame-credit.ts";

const query = new URLSearchParams(location.search);
const lang = query.get("lang") === "ja" ? "ja" : "en";
document.documentElement.lang = lang;
frameCredit(lang === "ja");
setThreeLoader(() => import("./three-subset.ts"));
const flight = document.createElement("hoshi-flight") as HoshiFlightElement;
for (const name of ["at", "ra", "dec", "fov", "sun-stop"]) {
  const value = query.get(name);
  if (value !== null) flight.setAttribute(name, value);
}
flight.setAttribute("lang", lang);
document.body.append(flight);
const to = query.get("to");
if (to !== null) flight.goTo(to);
document.documentElement.dataset.ready = "true";
