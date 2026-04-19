# Error Reporting Workflow — Single Source of Truth

**Status:** Proposed
**Owner:** Ivan
**Date:** 2026-04-18

## Problem

The current error system has two stores claiming authority over the same fact (bug status):

1. **Server DB** (https://errors.cleanlanguage.dev) — accessible via dashboard and `/api/v1/bugs`
2. **Local file** (`~/.cleen/telemetry/reported_errors.json`) — written by `report_error`, read by `check_reported_fixes`

Nothing forces them to stay in sync. Every check produces a different answer:

- Server-side resolutions never push back to local → local stays "open" forever
- Local store is append-only → same fingerprint reported twice = two local entries with separate statuses
- `/resolve-fix` updates server but local "status" field can drift independently
- Failed uploads sit in local as fingerprint-less ghosts, never retried

A real `/errors` run today shows: 11 server-open bugs, 21 local-unresolved, **8 of which the server has never heard of as open**. This is the steady state, not an exception.

## Principle

**One fact, one home.** Bug status lives only on the server. Local has no opinion about whether a bug is open or resolved.

## New Workflow

| Action | Tool | What touches what |
|---|---|---|
| **Report a bug** | `report_error` MCP | POST to server. Local gets nothing persistent. |
| **Check status** | `/errors` (team) or `check_reported_fixes` (external) | GET from server. Local is never read. |
| **Fix → release** | `comita` | Tags + releases. Doesn't touch error state. |
| **Mark resolved** | `/resolve-fix CODE VERSION "msg"` | POST to server. Local is never read or written. |

That's the whole protocol. No sync, no reconciliation, no drift.

## What Changes

### Removed

- `~/.cleen/telemetry/reported_errors.json` as a state store
- The `status` field anywhere outside the server DB
- All "is local in sync with server?" logic in skills and tools
- `/errors sync` and `/errors local` subcommands (no longer meaningful)

### Kept (with new role)

- A **transient outbound retry queue** for `report_error`. If the POST fails (network, server down), hold the payload in memory; if the process exits with unsent payloads, write them to `~/.cleen/telemetry/outbox/<uuid>.json` and retry on next `cleen` invocation. Once delivered, the file is deleted. **Not a state store — a queue.**

### Added

- `GET /api/v1/bugs?reporter=me` (already implicit via API key) — returns this user's reports across components in one call. Replaces the local "what did I report?" view.
- New MCP tool behavior: `check_reported_fixes` queries the server with the user's API key (or anonymously by reporter fingerprint for external users) and returns canonical state.

## Migration

1. **Archive existing local store:** rename `~/.cleen/telemetry/reported_errors.json` → `~/.cleen/telemetry/reported_errors.archive.json`. Don't delete; preserve for forensics. Stop reading it.
2. **Update tools in this order:**
   - Skills (`/errors`, `/resolve-fix`) — server-only queries. *(this PR)*
   - MCP server (`Clean MCP/`) — `report_error` writes to outbox-only on failure; `check_reported_fixes` queries server only. *(cross-component prompt)*
   - cleen CLI (`clean-manager/`) — drops the telemetry store; keeps only the outbox directory. *(cross-component prompt)*
3. **Verify:** after migration, every `/errors` run should show the same numbers as the dashboard. No "ghost reports."

## Failure Modes & Trade-offs

| Scenario | Old behavior | New behavior |
|---|---|---|
| Network down when reporting | Saved with no fingerprint, never retried | Held in outbox, retried on next `cleen` invocation |
| Server down when checking | Stale local data shown as truth | Tool fails loudly: "server unreachable, cannot determine status" |
| Working offline | Limited offline visibility of past reports | None. Acceptable — you're online when fixing bugs. |
| Multiple devs, same bug | Each had a separate local record | Server dedupes by fingerprint; everyone sees the same one |

The lost capability is **offline visibility of bug status**. We accept that loss because the cost (perpetual drift, 8 ghost reports per developer per week, every `/errors` check requiring a manual reconciliation pass) is much higher than the benefit.

## Acceptance Criteria

- `/errors` run returns the exact set of bugs the dashboard shows. No "discrepancies" section.
- `report_error` either succeeds (server has it) or queues to outbox (will retry). No third state.
- `/resolve-fix` either succeeds (server marks resolved) or fails loudly. No partial local state.
- A developer can wipe `~/.cleen/telemetry/` entirely and lose nothing meaningful.

## Out of Scope

- Multi-user collaboration features on the dashboard (separate effort).
- Changing the bug fingerprint algorithm (orthogonal).
- The error lifecycle stages (`reported → fix_committed → fix_released → fix_installed → resolved`) — those still exist, but all of them are tracked server-side. `/resolve-fix` verifies stages 2-4 from local sources (git, `cln --version`) and posts the verified result to the server in one call.
