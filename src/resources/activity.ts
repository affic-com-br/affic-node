import { AfficInvalidArgumentError } from '../errors.js';
import type { RequestExecutor } from '../internal/request.js';
import type { JsonObject, RequestOptions } from '../types.js';

/** Path of the activity endpoint, relative to the client's `baseURL`. */
const ACTIVITY_PATH = '/api/v1/integration-api/activity';

/** Parameters for {@link Activity.create}. */
export interface ActivityCreateParams {
  /**
   * Name of the activity being reported, matched against the metric names configured for the
   * integration to resolve the commission rule.
   *
   * An unmatched name is still accepted and stored, but the activity carries no metric and no
   * commission — so keep these values stable and identical to the configured metrics.
   */
  name: string;

  /**
   * Monetary amount of the activity in the domain default currency, as a decimal number
   * (`149.9` — not cents, not a string).
   *
   * Drives `PERCENTAGE` commission rules; a `PERCENTAGE` metric with no value yields a commission
   * of `0`. Ignored by `FIXED` rules, which always pay the configured amount.
   */
  value?: number | undefined;

  /**
   * Affiliate account credited for this activity, as the UUID shown in the affiliate area.
   *
   * Pass `null` (or omit) when the activity cannot be attributed: it is still recorded against the
   * program, but no affiliate is credited. An id matching no account behaves like `null` rather
   * than failing.
   */
  affiliateAccountId?: string | null | undefined;
}

/**
 * Activity reporting.
 *
 * Reached through {@link "../client".Affic.activity} — never constructed directly.
 */
export class Activity {
  readonly #client: RequestExecutor;

  constructor(client: RequestExecutor) {
    this.#client = client;
  }

  /**
   * Records one activity against the program that owns the API key and computes the affiliate
   * commission from the metric whose name matches `name`.
   *
   * Commission rules:
   * - `FIXED` metric: the configured amount is paid, whatever `value` holds.
   * - `PERCENTAGE` metric: the configured percentage of `value`; a missing `value` yields `0`.
   * - No matching metric: the activity is stored with no metric and no commission.
   *
   * **This call is not idempotent.** Every accepted call creates one activity, so retrying after a
   * network timeout can double-count. The SDK therefore never retries. Retry yourself only on
   * {@link "../errors".AfficInternalServerError}, where nothing was recorded, and reconcile in the
   * affiliate area afterwards.
   *
   * @param params - The activity to record.
   * @param options - Per-call timeout, abort signal, and headers.
   * @returns Nothing: the API answers `204` with no body. The resulting commission is visible in
   * the affiliate area.
   *
   * @throws {AfficInvalidArgumentError} when `name` is empty or `value` is not a finite number.
   * @throws {import('../errors.js').AfficBadRequestError} when the API rejects the payload.
   * @throws {import('../errors.js').AfficAuthenticationError} when the API key is missing or unknown.
   * @throws {import('../errors.js').AfficInternalServerError} on a server error; nothing was recorded.
   * @throws {import('../errors.js').AfficTimeoutError} when the request exceeds the timeout.
   *
   * @example
   * ```ts
   * // A sale attributed to a known affiliate.
   * await client.activity.create({
   *   name: 'purchase',
   *   value: 149.9,
   *   affiliateAccountId: '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34',
   * });
   *
   * // A non-monetary activity, for a FIXED metric such as a signup.
   * await client.activity.create({ name: 'signup' });
   * ```
   */
  async create(params: ActivityCreateParams, options?: RequestOptions): Promise<void> {
    await this.#client.post(ACTIVITY_PATH, toRequestBody(params), options);
  }
}

function toRequestBody(params: ActivityCreateParams): JsonObject {
  if (params.name.trim() === '') {
    throw new AfficInvalidArgumentError(
      'activity.create: `name` must be a non-empty string matching a configured metric name.',
    );
  }

  if (params.value !== undefined && !Number.isFinite(params.value)) {
    throw new AfficInvalidArgumentError(
      `activity.create: \`value\` must be a finite number, received ${String(params.value)}.`,
    );
  }

  // Absent fields are omitted rather than sent as null: `value: null` and a missing `value` are
  // not the same thing to the API, and an omitted `affiliateAccountId` must stay omitted.
  return {
    name: params.name,
    ...(params.value === undefined ? {} : { value: params.value }),
    ...(params.affiliateAccountId === undefined
      ? {}
      : { affiliateAccountId: params.affiliateAccountId }),
  };
}
