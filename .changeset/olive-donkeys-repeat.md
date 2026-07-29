---
'@affic/sdk': minor
---

Sync `activity.create` with the current Integration API.

**Breaking:** `affiliateAccountId` is replaced by `trackId`. It is not an affiliate UUID — it is the
opaque twelve url-safe-character value (`[A-Za-z0-9_-]{12}`) your storefront received in the
`__affic` query parameter and that the tag keeps in its attribution cookie. Forward it verbatim, or
pass `null` for an unattributed activity. A malformed track id is rejected client-side with
`AfficInvalidArgumentError` before any request is sent.

A well-formed `trackId` that matches no active affiliate of your program is now rejected by the API
with `404 TRACK_NOT_FOUND` instead of being recorded as unattributed. The new `AfficNotFoundError`
maps that status, so you can catch it on its own.

New optional `data` field: free-form JSON stored alongside the activity (order id, cart contents,
campaign). Recorded as-is, never part of the commission, and capped at 4096 bytes of serialized
JSON — measured in bytes, not characters.

```diff
 await client.activity.create({
   name: 'purchase',
   value: 149.9,
-  affiliateAccountId: '3f1c2a5e-9b47-4d1e-8a10-6c0f2d7b9e34',
+  trackId: 'V1StGXR8_Z5j',
+  data: { orderId: 'A-10293' },
 });
```
