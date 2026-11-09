// Types for scripts/data-source.mjs: which parallax data the package is built with.
export const DEFAULT_NO_GCTP: boolean;
export function noGctp(env?: Record<string, string | undefined>): boolean;
export const SWAPPED: readonly { name: string; shipped: string; fallback: string; shippedPath: string; fallbackPath: string }[];
