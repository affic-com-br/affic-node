import type { JsonObject, RequestOptions } from '../types.js';

/**
 * The slice of the client that resources are allowed to use.
 *
 * Resources depend on this interface rather than on the concrete client, which keeps them
 * trivially testable and stops the module graph from cycling.
 *
 * @internal
 */
export interface RequestExecutor {
  /**
   * Sends a JSON body and resolves once the API answers with a 2xx.
   *
   * @throws {import('../errors.js').AfficAPIError} on any non-2xx response.
   */
  post(path: string, body: JsonObject, options?: RequestOptions): Promise<void>;
}
