"use client";
import NextLinkModule from "next/link.js";

/**
 * next/link ships as CJS without an exports map. Under NodeNext a default
 * import is typed (and, in pure Node ESM, shaped) as the module namespace,
 * while bundlers (Next's webpack/turbopack, vite in tests) hand us the
 * component directly. Normalize both shape and type once here.
 */
type LinkComponent = typeof NextLinkModule extends { default: infer C }
  ? C
  : typeof NextLinkModule;

export const Link = ((NextLinkModule as { default?: unknown }).default ??
  NextLinkModule) as LinkComponent;
