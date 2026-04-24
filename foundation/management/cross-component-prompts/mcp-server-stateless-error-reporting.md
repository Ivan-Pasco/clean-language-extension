# MCP Server — Stateless Error Reporting (No Local State Store)

## Component
`Clean MCP/` (the MCP server that exposes `report_error` and `check_reported_fixes`)

## Issue Type
Refactor / architectural simplification

## Priority
High

## Background

See `management/ERROR_REPORTING_WORKFLOW.md` for the full design rationale.

The `~/.cleen/telemetry/reported_errors.json` file currently acts as a parallel state store for bug status, alongside the server DB at `https://errors.cleanlanguage.dev`. This dual-store design is the root cause of every "ghost report" / "8 local-unresolved bugs the server has never heard of" problem we've been chasing.

**New rule: server is the only source of truth for bug status. Local has no opinion.**

## Required Changes

### 1. `report_error` — write to server only

Current behavior:
- POSTs to `https://errors.cleanlanguage.dev/api/v1/reports`
- ALSO writes the report (with status, fingerprint, timestamps) to `~/.cleen/telemetry/reported_errors.json`

New behavior:
- POSTs to the server
- On success: returns the server's response (fingerprint, report_id, server URL). Does **not** persist locally.
- On failure (network error, 5xx, timeout): writes the payload to a transient outbox: `~/.cleen/telemetry/outbox/<uuid>.json`. The next `cleen` invocation (or the next `report_error` call) flushes this outbox by retrying each file. On successful upload, the outbox file is deleted.
- The outbox is a **queue**, not a state store. It contains only payloads that have not yet been delivered. It does not track status, resolution, or anything else.

### 2. `check_reported_fixes` — query server only

Current behavior:
- Reads `~/.cleen/telemetry/reported_errors.json`, lists local pending reports, optionally cross-references server.

New behavior:
- Calls the server endpoint that returns the reporter's bugs across components: `GET /api/v1/bugs?reporter=me` (using the API key) OR (for external users without an API key) `GET /api/v1/bugs?reporter_fingerprint=<machine-id>` if such an endpoint is added website-side.
- Returns server-canonical state: open + resolved bugs reported by this user/machine.
- Does **not** read the local store.

### 3. Migration on first run

When the new MCP server starts and detects an existing `~/.cleen/telemetry/reported_errors.json`:
- Rename it to `reported_errors.archive.json` (preserving forensics).
- Log: "Local error state archived. Server is now sole source of truth. See management/ERROR_REPORTING_WORKFLOW.md."
- Do not import or re-upload archived entries (they're already on the server if they were ever uploaded).

### 4. Remove these MCP tools / behaviors (if they exist)

- Any tool that exposes the local store (e.g., `list_local_reports`, `clear_local_telemetry`).
- Any sync-mode logic in `check_reported_fixes` that tries to reconcile local vs server.

## What MUST NOT Change

- The error report schema sent to the server (compatibility with the website).
- The fingerprint algorithm (server depends on stable fingerprints for dedup).
- The error lifecycle stages on the server side (reported → fix_committed → fix_released → fix_installed → resolved). Those still exist; only the *storage location* of the status is changing (server only).

## Coordination

The website API (`Clean Web/` or wherever the dashboard backend lives) may need a `reporter=me` filter on `GET /api/v1/bugs` to support external users. If that endpoint does not yet exist:
- Add it: returns bugs filtered by the API key's reporter identity, OR by an anonymous machine fingerprint for unauthenticated users.
- See `management/cross-component-prompts/website-reporter-filter.md` (to be created if needed).

## Verification

After this refactor:
- `report_error` then `rm -rf ~/.cleen/telemetry/` then `check_reported_fixes` should still return the report (because it's on the server, not local).
- `/errors` (team skill) and `check_reported_fixes` (MCP) should return the same bugs.
- No "ghost reports" possible — local has no opinion to drift from.

## Files Likely Affected

- `Clean MCP/src/tools/report_error.rs` (or .ts/.py depending on impl)
- `Clean MCP/src/tools/check_reported_fixes.rs`
- `Clean MCP/src/storage/local_telemetry.rs` (delete or reduce to outbox-only)
- `Clean MCP/README.md` (document the new behavior)
