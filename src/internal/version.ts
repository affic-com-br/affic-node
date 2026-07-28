declare const __SDK_VERSION__: string;

/**
 * Version of this package, injected at build time by tsup (and by Vitest under test) so the
 * runtime never has to locate and read `package.json`.
 */
export const VERSION: string = __SDK_VERSION__;
