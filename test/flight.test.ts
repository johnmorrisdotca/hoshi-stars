// The flight: light's own times come out (the Moon, the Sun, a light-year), a step moves along the heading, a flight to a place stops there and never passes it, the dial steps in tens,
// a place near a far camera keeps its digits, and the sky from where the flight is agrees with the sky-from tier.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FLIGHT_SPEEDS, LIGHT_SPEED, flightPoint, flightReadout, flightStart, flightTime, flyStep, flyToward, fromCamera, stepFlightSpeed } from "../src/flight.ts";
import { skyFrom } from "../src/sky-from.ts";
import { starByName, starDistance } from "../src/stars.ts";

const YEAR = 31_557_600; // a Julian year, in seconds: the year of the light-year
const near = (a: number, b: number, relative = 1e-9): boolean => Math.abs(a - b) <= Math.abs(b) * relative;

test("at the speed of light a year's flight is a light-year, 499 seconds is the Earth's distance and 1.28 seconds the Moon's", () => {
  const year = flightReadout(flyStep(flightStart(), YEAR).position);
  assert.ok(near(year.lightYears, 1, 1e-6), `${year.lightYears}`);
  assert.ok(near(year.lightSeconds, YEAR, 1e-9));
  assert.equal(year.scale, "light-years");
  const earth = flightReadout(flyStep(flightStart(), 499.004784).position);
  assert.ok(near(earth.astronomicalUnits, 1, 1e-6), `${earth.astronomicalUnits}`);
  assert.equal(earth.scale, "astronomical-units");
  const moon = flightReadout(flyStep(flightStart(), 1.282).position);
  assert.ok(near(moon.kilometres, 384_334, 1e-4), `${moon.kilometres}`);
  assert.equal(moon.scale, "kilometres");
  assert.ok(near(LIGHT_SPEED * YEAR * 3.261563777, 1, 1e-6));
});

test("a step moves along the heading by speed times time and changes neither; the state handed in is not changed", () => {
  const start = { position: { x: 1, y: 2, z: 3 }, heading: { x: 0, y: 3, z: 4 }, speed: 1e9 };
  const after = flyStep(start, 10);
  const far = 1e9 * LIGHT_SPEED * 10;
  assert.ok(near(after.position.y - 2, far * 0.6) && near(after.position.z - 3, far * 0.8));
  assert.equal(after.position.x, 1);
  assert.deepEqual(after.heading, { x: 0, y: 0.6, z: 0.8 }); // made a unit vector
  assert.equal(after.speed, 1e9);
  assert.deepEqual(start.position, { x: 1, y: 2, z: 3 });
  assert.deepEqual(flyStep(start, 0).position, start.position);
});

test("a flight to Sirius turns to it, gets nearer each step, stops at the stopping distance and never passes it", () => {
  const star = starByName("Sirius")!;
  const sirius = flightPoint(star.rightAscension, star.declination, starDistance(star)!.lightYears);
  let flight = { ...flightStart(), speed: 1e8 };
  let last = Number.POSITIVE_INFINITY;
  let steps = 0;
  for (; steps < 10_000; steps += 1) {
    const leg = flyToward(flight, sirius, 1 / 30, { stopAt: 0.01 });
    assert.ok(leg.remaining < last || leg.arrived, `step ${steps}: ${leg.remaining} after ${last}`);
    last = leg.remaining;
    flight = leg.state;
    if (leg.arrived) break;
  }
  assert.ok(near(last, 0.01, 1e-9), `${last}`);
  // about 2.64 parsecs at 100 million c: the time the tier says, in frames of a thirtieth of a second
  assert.ok(Math.abs(steps - flightTime(2.637 - 0.01, 1e8) * 30) < 3, `${steps}`);
  const again = flyToward(flight, sirius, 100, { stopAt: 0.01 });
  assert.equal(again.arrived, true);
  assert.deepEqual(again.state.position, flight.position);
  // one huge step stops there too
  const jump = flyToward({ ...flightStart(), speed: 1e13 }, sirius, 3600, { stopAt: 0.01 });
  assert.equal(jump.arrived, true);
  assert.ok(near(jump.remaining, 0.01, 1e-9));
});

test("the sky from where the flight is, is the sky-from tier's: beside Sirius the Sun is a star of about magnitude 2", () => {
  const star = starByName("Sirius")!;
  const sirius = flightPoint(star.rightAscension, star.declination, starDistance(star)!.lightYears);
  const sun = skyFrom(sirius).find((one) => one.id === "sun")!;
  assert.ok(near(sun.lightYears, starDistance(star)!.lightYears, 1e-9));
  assert.ok(sun.magnitude > 1.5 && sun.magnitude < 2.5, `${sun.magnitude}`);
});

test("the dial goes up and down in tens and holds at its ends", () => {
  assert.equal(FLIGHT_SPEEDS[0], 1);
  assert.equal(FLIGHT_SPEEDS[FLIGHT_SPEEDS.length - 1], 1e13);
  for (let i = 1; i < FLIGHT_SPEEDS.length; i += 1) assert.equal(FLIGHT_SPEEDS[i], FLIGHT_SPEEDS[i - 1]! * 10);
  assert.equal(stepFlightSpeed(1, 1), 10);
  assert.equal(stepFlightSpeed(250, -1), 100);
  assert.equal(stepFlightSpeed(250, 1), 1000);
  assert.equal(stepFlightSpeed(1, -1), 1);
  assert.equal(stepFlightSpeed(1e13, 1), 1e13);
  assert.equal(stepFlightSpeed(0, 1), 1);
  // the fastest reaches the Andromeda galaxy (2.5 million light-years) in under ten seconds, the slowest takes light's own time
  assert.ok(flightTime(2_500_000 / 3.261563777, 1e13) < 10);
  assert.ok(near(flightTime(1 / 3.261563777, 1), YEAR, 1e-6));
});

test("a place beside a far camera keeps its digits: half a parsec from a camera 770,000 parsecs out is half a unit", () => {
  assert.deepEqual(fromCamera({ x: 770_000.5, y: -3, z: 2 }, { x: 770_000, y: -3, z: 0 }), [0.5, 0, 2]);
  assert.deepEqual(fromCamera({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.5), [4, 0, 0]);
  // as 32-bit numbers the two places are the same number: the difference has to be taken first
  assert.equal(Math.fround(770_000.5) - Math.fround(770_000), 0.5);
  assert.equal(Math.fround(770_000.01) - Math.fround(770_000), 0);
  assert.ok(near(fromCamera({ x: 770_000.01, y: 0, z: 0 }, { x: 770_000, y: 0, z: 0 })[0], 0.01, 1e-6));
});

test("a wrong input is refused by name", () => {
  assert.throws(() => flyStep(flightStart(), -1), RangeError);
  assert.throws(() => flyStep({ ...flightStart(), speed: -1 }, 1), RangeError);
  assert.throws(() => flyStep({ ...flightStart(), heading: { x: 0, y: 0, z: 0 } }, 1), RangeError);
  assert.throws(() => flyStep({ ...flightStart(), position: { x: Number.NaN, y: 0, z: 0 } }, 1), TypeError);
  assert.throws(() => flyToward(flightStart(), { x: 1, y: 0, z: 0 }, 1, { stopAt: -1 }), RangeError);
  assert.throws(() => flightTime(1, 0), RangeError);
  assert.throws(() => fromCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0), RangeError);
  assert.throws(() => flightPoint(0, 0, -1), RangeError);
  assert.throws(() => stepFlightSpeed(1, 0 as 1), RangeError);
});
