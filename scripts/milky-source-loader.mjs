// The resolve hook behind scripts/milky-source-hook.mjs: an import that resolves to src/data/milky-way.ts is answered with data-no-sao/milky-way.ts. It runs on node's loader thread; the swap table
// comes in through `data`.
let swap = new Map();

export function initialize(data) {
  swap = new Map(data.pairs);
}

export async function resolve(specifier, context, next) {
  const found = await next(specifier, context);
  const to = swap.get(found.url);
  return to === undefined ? found : { ...found, url: to };
}
