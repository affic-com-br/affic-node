import { AfficInvalidArgumentError } from '../errors.js';
import type { RequestExecutor } from '../internal/request.js';
import type { JsonObject, RequestOptions } from '../types.js';

/** Path of the activity endpoint, relative to the client's `baseURL`. */
const ACTIVITY_PATH = '/api/v1/integration-api/activity';

/** Shape the API requires of a track id: exactly twelve url-safe characters. */
const TRACK_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

/** Largest `data` payload the API accepts, measured on its serialized JSON. */
const MAX_DATA_BYTES = 4096;

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
   * Opaque identifier of the affiliate credited for this activity: exactly twelve url-safe
   * characters (`[A-Za-z0-9_-]`).
   *
   * This is the value your storefront received in the `__affic` query parameter and that the tag
   * keeps in its attribution cookie. Read it from there and forward it verbatim — it is not a UUID
   * and carries no meaning you should parse.
   *
   * Pass `null` (or omit) when the activity cannot be attributed: it is still recorded against the
   * program, but no affiliate is credited. A well-formed id that belongs to no active affiliate of
   * this program is **rejected** with {@link "../errors".AfficNotFoundError} — it is not silently
   * treated as unattributed.
   */
  trackId?: string | null | undefined;

  /**
   * Free-form JSON stored alongside the activity: order id, cart contents, campaign, page URL.
   *
   * Recorded as-is and never part of the commission, which is driven solely by `value` and the
   * matched metric. Must serialize to at most 4096 bytes of JSON.
   */
  data?: JsonObject | undefined;
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
   * The affiliate is identified by `trackId`, the value the tag put in the attribution cookie.
   * Anything you want stored but kept out of the commission goes in `data`.
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
   * @throws {AfficInvalidArgumentError} when `name` is empty, `value` is not a finite number,
   * `trackId` is not twelve url-safe characters, or `data` serializes past 4096 bytes.
   * @throws {import('../errors.js').AfficBadRequestError} when the API rejects the payload.
   * @throws {import('../errors.js').AfficAuthenticationError} when the API key is missing or unknown.
   * @throws {import('../errors.js').AfficNotFoundError} when `trackId` matches no affiliate of this
   * program; nothing was recorded.
   * @throws {import('../errors.js').AfficInternalServerError} on a server error; nothing was recorded.
   * @throws {import('../errors.js').AfficTimeoutError} when the request exceeds the timeout.
   *
   * @example
   * ```ts
   * // A sale attributed to a known affiliate, with order context attached.
   * await client.activity.create({
   *   name: 'purchase',
   *   value: 149.9,
   *   trackId: 'V1StGXR8_Z5j',
   *   data: { orderId: 'A-10293', items: 3 },
   * });
   *
   * // Recorded against the program only: no affiliate is credited.
   * await client.activity.create({ name: 'purchase', value: 149.9, trackId: null });
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

  // `null` is a legitimate trackId — it means "unattributed" — so only strings are shape-checked.
  // Whether the id belongs to an affiliate is server-side knowledge, and comes back as a 404.
  if (typeof params.trackId === 'string' && !TRACK_ID_PATTERN.test(params.trackId)) {
    throw new AfficInvalidArgumentError(
      `activity.create: \`trackId\` must be exactly twelve url-safe characters ([A-Za-z0-9_-]), ` +
        `received ${JSON.stringify(params.trackId)}. Forward the \`__affic\` value from the ` +
        `attribution cookie verbatim, or pass null to record an unattributed activity.`,
    );
  }

  if (params.data !== undefined) {
    // The API measures the limit in bytes, so multi-byte characters have to be counted as such.
    const bytes = new TextEncoder().encode(JSON.stringify(params.data)).byteLength;

    if (bytes > MAX_DATA_BYTES) {
      throw new AfficInvalidArgumentError(
        `activity.create: \`data\` must serialize to at most ${String(MAX_DATA_BYTES)} bytes of ` +
          `JSON, received ${String(bytes)}.`,
      );
    }
  }

  // Absent fields are omitted rather than sent as null: `value: null` and a missing `value` are
  // not the same thing to the API, and an omitted `trackId` must stay omitted.
  return {
    name: params.name,
    ...(params.value === undefined ? {} : { value: params.value }),
    ...(params.trackId === undefined ? {} : { trackId: params.trackId }),
    ...(params.data === undefined ? {} : { data: params.data }),
  };
}
