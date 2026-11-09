// The resolve hook behind scripts/data-source-hook.mjs: when the fallback is in, an import that resolves to src/data/stars.ts or src/data/nearby.ts is answered with the file in data-no-gctp/.
// It runs on node's loader thread; the swap table comes in through `data`.
let swap = new Map();

export function initialize(data) {
  swap = new Map(data.pairs);
}

export async function resolve(specifier, context, next) {
  const found = await next(specifier, context);
  const to = swap.get(found.url);
  return to === undefined ? found : { ...found, url: to };
}
