# cleen — Drop Telemetry State Store, Keep Outbox Only

## Component
`clean-manager/` (the `cleen` CLI binary that owns `~/.cleen/`)

## Issue Type
Refactor / cleanup

## Priority
Medium (do after MCP server change; before would leave the CLI inconsistent)

## Background

See `management/ERROR_REPORTING_WORKFLOW.md` and `management/cross-component-prompts/mcp-server-stateless-error-reporting.md`.

Today `~/.cleen/telemetry/reported_errors.json` accumulates bug status that drifts from the server's authoritative state. We're removing it as a state store.

## Required Changes

### 1. Stop maintaining `reported_errors.json`

If `cleen` reads or writes this file anywhere (status display, install hooks, version checks), remove that code. The MCP server is the only thing that previously wrote to it, and that's also being changed.

### 2. Add an outbox flusher

If `~/.cleen/telemetry/outbox/` exists and contains files on `cleen` startup or any command invocation:
- For each `*.json` file: POST it to `https://errors.cleanlanguage.dev/api/v1/reports`.
- On 2xx: delete the file.
- On retriable error (5xx, network): leave the file in place.
- On 4xx (malformed): move to `~/.cleen/telemetry/outbox/rejected/<uuid>.json` so it doesn't loop forever, and emit a single warning.
- This flush should be silent on success and run in the background where possible. It should not block the user's command.

### 3. Migration on first run with new version

If `~/.cleen/telemetry/reported_errors.json` exists:
- Rename to `~/.cleen/telemetry/reported_errors.archive.json`.
- Print a one-line notice: "Local error state archived. See management/ERROR_REPORTING_WORKFLOW.md."
- Do not delete the archive automatically. The user can `rm` it whenever.

### 4. Optional command for visibility

`cleen errors` (NEW, optional) — thin wrapper that calls the dashboard API and prints this user's reports. This replaces the old "look at my local file" workflow without reintroducing local state. If implemented, it MUST query the server, never local.

## What MUST NOT Change

- `cleen install` / `cleen frame install` behavior.
- The `~/.cleen/versions/`, `~/.cleen/plugins/`, `~/.cleen/bin/` layouts.
- The `error-api-key` file location.

## Verification

- `rm -rf ~/.cleen/telemetry/` should be safe and lose nothing meaningful.
- After `report_error` while online, `~/.cleen/telemetry/outbox/` is empty.
- After `report_error` while offline, the payload appears in the outbox; running `cleen` while online flushes it.

## Files Likely Affected

- `clean-manager/src/telemetry.rs` (or equivalent)
- `clean-manager/src/cli/install.rs` (if it touches telemetry)
- Anywhere `reported_errors.json` is referenced — grep the codebase for it.
