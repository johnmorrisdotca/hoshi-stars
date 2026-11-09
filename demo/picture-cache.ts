// The deep-sky pictures the page has fetched, each held once as a blob address: the chart is drawn from a string again and again, and an <image> made
// fresh on each draw would ask the server again while the first answer is still on its way (slow machines did, two requests for one picture).
// The loader (deep.ts) fills it; the drawing (deep-draw.ts) reads it. Nothing else.

/** The blob address of each fetched picture, by picture id. */
export const pictureBlobs = new Map<string, string>();
