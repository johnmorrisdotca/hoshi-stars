import { createServer } from "node:http";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
import { within } from "@johnmorrisdotca/hoshi-stars/nearest";

const port = Number(process.env.PORT ?? 8262);
createServer((request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "GET") return send(400, { error: "GET only" });
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/star") {
    const name = url.searchParams.get("name")?.trim();
    const found = name && starByName(name);
    return found ? send(200, found) : send(400, { error: "Unknown or missing star name" });
  }
  if (url.pathname === "/constellation") {
    const abbr = url.searchParams.get("abbr")?.trim();
    const found = abbr && constellation(abbr);
    return found ? send(200, found) : send(400, { error: "Unknown or missing constellation" });
  }
  if (url.pathname === "/near") {
    const values = ["ra", "dec", "radius"].map((key) => url.searchParams.get(key));
    if (values.some((value) => value === null || value.trim() === "")) return send(400, { error: "ra, dec and radius are required" });
    const [ra, dec, radius] = values.map(Number);
    if (![ra, dec, radius].every(Number.isFinite) || ra < 0 || ra >= 360 || dec < -90 || dec > 90 || radius < 0 || radius > 180) return send(400, { error: "Invalid coordinates or radius" });
    return send(200, within({ rightAscension: ra, declination: dec }, radius));
  }
  return send(404, { error: "Unknown route" });
}).listen(port, "127.0.0.1", () => console.log(`Listening on http://127.0.0.1:${port}`));
