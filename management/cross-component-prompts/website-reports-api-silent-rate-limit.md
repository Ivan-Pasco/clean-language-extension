# Bug: `POST /api/v1/reports` returns `status: received` for rate-limited requests

## Component
`clean-website` (error dashboard + API)

## Issue Type
Bug — silent data loss

## Priority
Critical — blocks every cross-component bug report that flows through the compiler MCP. Reports appear to succeed but are never persisted, so the ecosystem-wide bug tracker silently drops most incoming data.

## Discovered
2026-04-17 during a session where the compiler team submitted ~10 bug reports via `report_error` MCP tool. Only 3 fingerprints ended up visible on `errors.cleanlanguage.dev/errors`; the rest returned success but did not persist.

## Problem

The `/api/v1/reports` endpoint has **two failure modes that look identical to successful persistence** from the client's perspective:

1. **Silent rate-limit acceptance (documented observation):**
   ```
   POST /api/v1/reports  (with Authorization: Bearer …)
   → HTTP 200
   → {"report_id":"…","fingerprint":"<64hex>","status":"received",
      "tracking_url":"…","message":"New issue logged. Thank you for reporting.",
      "other_fixes_since":[]}
   ```
   Client parses the fingerprint, stores it locally, reports success to the user.
   But the detail page (`/errors/detail?fp=<fp>`) for that fingerprint returns:
   > Error: fingerprint not found
   And the dashboard `/errors` listing does not show it.

2. **Explicit rate-limit (seen after ~15 consecutive POSTs today):**
   ```
   → HTTP 200
   → {"error":"rate_limited","retry_after":3600}
   ```
   Client today does not understand this response shape and treats it as a protocol error.

## Evidence

The following fingerprints are in the compiler's local store `~/.cleen/telemetry/reported_errors.json` with the client-captured fingerprint from the server response, but `/errors/detail?fp=<fp>` says `fingerprint not found`:

| Local fp | Error code |
|---|---|
| `f8e7a4a39468601565c3889b4bfbe932c411291d25ed8e8fc1e2ad58c4098beb` | PLUGIN_HTML_CONCAT_PARSE |
| `5d3b8ce47766ea308710f9c41a9ef5b387bb8cf0c3d005f9cd0fb274c7b7f3d9` | DASHBOARD_STAGE_INCOMPLETE |
| `1e1cfe2571fb65a210e818c795bc5ced3e2aa48d2ee0419d53ee97e3ef4b890a` | MCP_REPORT_ERROR_COMPONENT_ENUM_INCOMPLETE |
| `5af020f8c553eaef62095588736658edad2a1d9779c019fa07100ac98e7c51d9` | COD001_FOLLOWUP_STDLIB_LAZY |
| `4c9cd77b8a6df5d2468f79ac2db7fb9e5a3809a4238fdcf8555c401e0846c12c` | DASHBOARD_STAGE_UPDATE |

When the same report payloads were re-POSTed via direct `curl` in the same session, the server again returned a fingerprint (different from the one it returned before — suggesting each call gets a fresh-looking response computed but then discarded) and the detail page still said `fingerprint not found`.

## Root cause hypothesis (for website team to confirm)

Likely in `clean-website/app/server/errors_api.cln` — the `reports_create` handler:

- Computes a fingerprint from payload content (SHA256 or similar).
- Returns `{"status":"received","fingerprint":<computed>}` early.
- Only AFTER responding does it attempt the DB INSERT.
- If the INSERT fails (rate-limit quota, unique constraint conflict, transaction rollback), the failure is caught and logged but not propagated to the already-sent HTTP response.

Alternatively the rate-limiter middleware may be returning 200 with an ambiguous body before reaching the handler at all.

## Required behavior

The endpoint MUST reflect actual persistence state in the HTTP response:

| Server state | Correct response |
|---|---|
| Report accepted and persisted | `HTTP 200 { status: "received", fingerprint: "<fp>", tracking_url: … }` |
| Report is a known issue (dedup hit) | `HTTP 200 { status: "known", fingerprint: "<fp>", occurrences: N, … }` |
| Rate-limit rejection | `HTTP 429 { error: "rate_limited", retry_after: <seconds> }` (NOT 200) |
| DB/persistence failure | `HTTP 5xx { error: "…" }` (NOT 200) |
| Unauthorized | `HTTP 401` |

The client (`src/telemetry/submit.rs` in clean-language-compiler) currently interprets HTTP-200-plus-`status:received` as authoritative success and stores the returned fingerprint. If the server returns that response without actually persisting, the client has no way to detect it.

## Compiler-side partial mitigation (shipped as `0.30.68`)

The compiler now:
- Detects `{"error":"rate_limited","retry_after":N}` in any HTTP response body (including 200) AND the HTTP 429 status code.
- On detection, records a retry-after timestamp in `~/.cleen/telemetry/retry_after` and returns a new `SubmitResult::RateLimited` variant.
- Before every subsequent `submit_report` or `flush_pending_telemetry` call, checks the timestamp and skips the HTTP round-trip entirely until it elapses.
- Caps the backoff at 1 hour so a misbehaving server can't permanently disable client-side telemetry.

This prevents the compiler from DDoS'ing the server but does not rescue reports from the silent-drop code path above — that's the server's job.

## Verification after server fix

1. Apply the website fix.
2. From the compiler: `cln telemetry flush` — this will replay all queued reports. All of them SHOULD end up visible on `/errors` with fingerprints matching the client's local store (or return `status: known` if they duplicate something already on the server).
3. Cross-check: `POST /api/v1/reports` with a fresh payload → verify detail page renders, dashboard lists it.
4. Exceed rate limit intentionally → verify HTTP 429 is returned, not HTTP 200 with a fake `received`.

## Files likely affected

- `clean-website/app/server/errors_api.cln` — `reports_create` handler, rate-limit middleware.
- `clean-website/app/data/migrations/` — possibly a missing index or constraint causing INSERT to silently fail.
- `clean-website/app/server/` rate-limit layer — whatever is currently emitting `{"error":"rate_limited"}` inside an HTTP 200 body needs to change that body AND status code to 429.

## Related

- `management/cross-component-prompts/website-error-lifecycle-schema.md` — existing request for lifecycle columns; same handler.
- Compiler TASKS entry added today covering the client-side backoff behavior.
