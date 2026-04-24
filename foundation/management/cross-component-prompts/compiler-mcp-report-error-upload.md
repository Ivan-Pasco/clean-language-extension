# Bug Fix: report_error MCP Tool Never Uploads to Dashboard

## Component
Compiler (MCP server)

## Issue Type
Bug

## Priority
Critical — report_error is the only mechanism for cross-component bug reporting. Zero reports reach the dashboard.

## Problem

The `report_error` MCP tool returns `{"success": true}` but never POSTs to the dashboard API. All reports are written to `~/.cleen/telemetry/reported_errors.json` with `fingerprint: null`, meaning the server never assigned them a fingerprint because it never received them.

Evidence (2026-04-17):
- Local store: 10 reports, all with `fingerprint: null`
- Dashboard: 10 reports total — but these were submitted through other paths (direct curl, website UI), not via `report_error`
- `POST /api/v1/reports` is the correct endpoint (confirmed working via manual curl)

## Root Cause Investigation

Trace the `report_error` handler in the MCP server code. Look for:

1. The HTTP POST call that should send the report to `https://errors.cleanlanguage.dev/api/v1/reports`
2. Whether the call exists but errors are swallowed (no error propagation, silent catch)
3. Whether the call is missing entirely (local-only save was implemented, upload was deferred)
4. Whether there's a network/auth issue (missing API key, wrong URL, TLS failure)

## Fix Requirements

1. After writing the report to the local JSON file, POST it to the dashboard API
2. On success, store the returned `fingerprint` in the local report entry
3. On failure, log the error visibly (not silently) and keep the report in a retry queue
4. Add a `cln telemetry flush` CLI command that retries all reports with `fingerprint: null`

## Expected POST Payload

The dashboard API uses a **nested** schema. The flat fields from the MCP tool must be mapped:

```
POST https://errors.cleanlanguage.dev/api/v1/reports
Authorization: Bearer $ERROR_API_KEY
Content-Type: application/json

{
  "report_id": "<uuid>",
  "schema_version": "1.0.0",
  "user": {
    "anonymous": true,
    "consent_level": "error_with_code"
  },
  "error": {
    "code": "<error_code>",
    "component": "<component>",
    "severity": "<severity>",
    "category": "<component>",
    "message": "<error_message>"
  },
  "reproduction": {
    "minimal_code": "<minimal_repro>",
    "expected_behavior": "<expected_behavior>",
    "actual_behavior": "<actual_behavior>",
    "spec_reference": "<spec_reference>"
  },
  "source": {
    "compiler_version": "<compiler_version>",
    "os": "<os>",
    "arch": "<arch>"
  },
  "ai_context": {
    "analysis": "<ai_analysis>",
    "suggested_component": "<suggested_component_file>"
  }
}
```

Mapping from MCP tool parameters to nested fields:
- `error_code` → `error.code`
- `error_message` → `error.message`
- `component` → `error.component`
- `severity` → `error.severity`
- `minimal_repro` → `reproduction.minimal_code`
- `expected_behavior` → `reproduction.expected_behavior`
- `actual_behavior` → `reproduction.actual_behavior`
- `spec_reference` → `reproduction.spec_reference`
- `ai_analysis` → `ai_context.analysis`
- `suggested_component_file` → `ai_context.suggested_component`

The API key is stored at `~/.cleen/error-api-key`.

The API returns:
```json
{
  "report_id": "...",
  "fingerprint": "...",   // <-- store this in the local report entry
  "status": "received",
  "tracking_url": "...",
  "message": "..."
}
```

## Verification

1. Call `report_error` via MCP with a test error (error_code: TEST_UPLOAD)
2. Check `~/.cleen/telemetry/reported_errors.json` — the report should have a non-null `fingerprint`
3. Check the dashboard at `https://errors.cleanlanguage.dev/errors` — TEST_UPLOAD should appear
4. Run `cln telemetry flush` — all 10 stuck reports should upload and receive fingerprints

## Files Likely Affected
- `src/mcp/server.rs` or equivalent MCP handler for `report_error`
- Possibly `src/telemetry.rs` or `src/error_reporting.rs` if upload logic lives there
