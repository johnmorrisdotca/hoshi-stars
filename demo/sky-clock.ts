// How far a sky's clock has moved. Pure: the page decides when to draw.

/** The moment after `elapsedMs` of real time at `speed` (1 is real time, 3600 is an hour a second, a negative speed runs backward). */
export function skyMoment(startMs: number, elapsedMs: number, speed: number): number {
  return startMs + elapsedMs * speed;
}
