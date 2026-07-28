/** Environment probes. Kept in one place so the rest of the SDK never touches globals directly. */

/** Name of the environment variable read when no `apiKey` is passed to the client. */
export const API_KEY_ENV_VAR = 'AFFIC_API_KEY';

/**
 * Detects a browser-like environment.
 *
 * The integration token identifies a whole program, so shipping it to a browser hands every
 * visitor the ability to write activities. The client refuses to construct when this returns
 * `true`. Probing `globalThis` rather than the bare globals keeps the check compiling with the
 * DOM library disabled.
 */
export function isBrowserLike(): boolean {
  const candidate = globalThis as { window?: unknown; document?: unknown };

  return candidate.window !== undefined && candidate.document !== undefined;
}

/** Reads the API key from the environment, if present. */
export function readApiKeyFromEnv(): string | undefined {
  return process.env[API_KEY_ENV_VAR];
}

/** Node version used in the `user-agent` header. */
export function nodeVersion(): string {
  return process.versions.node;
}
