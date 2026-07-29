/**
 * Official Node.js SDK for the Affic integration API.
 *
 * Server-only: the integration token identifies a whole program and must never be shipped to a
 * browser or a mobile client.
 *
 * @example
 * ```ts
 * import { Affic, AfficAuthenticationError } from '@affic/sdk';
 *
 * const client = new Affic({ apiKey: process.env['AFFIC_API_KEY'] });
 *
 * try {
 *   await client.activity.create({
 *     name: 'purchase',
 *     value: 149.9,
 *     trackId: 'V1StGXR8_Z5j',
 *   });
 * } catch (error) {
 *   if (error instanceof AfficAuthenticationError) {
 *     // Rotate or fix AFFIC_API_KEY.
 *   }
 *   throw error;
 * }
 * ```
 *
 * @packageDocumentation
 */

export { Affic, DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from './client.js';

export {
  AfficAPIError,
  AfficAuthenticationError,
  AfficBadRequestError,
  AfficConfigurationError,
  AfficConnectionError,
  AfficError,
  AfficInternalServerError,
  AfficInvalidArgumentError,
  AfficNotFoundError,
  AfficTimeoutError,
} from './errors.js';
export type { AfficAPIErrorInit } from './errors.js';

export { Activity } from './resources/activity.js';
export type { ActivityCreateParams } from './resources/activity.js';

export type { ClientOptions, FetchLike, JsonObject, JsonValue, RequestOptions } from './types.js';

export { VERSION } from './internal/version.js';
