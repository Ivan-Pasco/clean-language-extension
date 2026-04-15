# Cross-Component Prompt: Error Report Resolution Tracking

## Component
Website (error dashboard)

## Related Components
- MCP Server (reports `current_version` — currently stale at 0.30.50 after 0.30.51 release)
- Compiler (source of fixes)

## Issue Type
Feature Request

## Priority
Medium-High — 27 BufferOverflow reports are fixed in v0.30.51 but still show as "reported"

## Description

When a new compiler version is released that fixes reported errors, there is no mechanism to update report statuses on the error dashboard. Reports remain in "reported" status indefinitely, even after the fix ships.

### Current Behavior
1. Errors are reported via `report_error` MCP tool with the compiler version at time of report
2. Reports are stored with `status: "reported"`
3. New compiler version is released with the fix
4. `check_reported_fixes` still returns all reports as `status: "reported"`
5. `current_version` field still shows the old version (0.30.50 instead of 0.30.51)

### Expected Behavior
1. When a new version is released, reports should be re-evaluated or manually resolvable
2. Resolved reports should show `status: "fixed"` with the version that includes the fix
3. `check_reported_fixes` should return accurate fix status

## Suggested Approach

### Option A: Manual Resolution API
Add an API endpoint to mark reports as fixed:
```
POST /api/errors/resolve
{
  "report_ids": ["44574c1b-...", "8b2d2810-...", ...],
  "fixed_in_version": "0.30.51",
  "resolution_note": "Increased data section limit from 256KB to 1MB"
}
```

### Option B: Automatic Re-testing
When a new compiler version is detected:
1. Re-compile the reproduction code from each pending report
2. If the error no longer occurs, mark as `status: "fixed"` with the new version
3. If the error persists, keep as `status: "reported"`

### Option C: Batch Resolution by Error Code
Allow resolving all reports with a specific error code in a version range:
```
POST /api/errors/resolve-batch
{
  "error_code": "CODEGEN_BUFFER_OVERFLOW",
  "reported_before": "2026-04-15",
  "fixed_in_version": "0.30.51"
}
```

## Immediate Reports to Resolve

These 4 reports from 2026-04-14 are confirmed fixed in v0.30.51:

| Report ID | Error Code | Summary |
|-----------|-----------|---------|
| `44574c1b` | `CODEGEN_BUFFER_OVERFLOW` | BufferOverflow at address 261736 |
| `8b2d2810` | `E007` | BufferOverflow adding `<circle>` HTML string |
| `5c1f80ef` | `E007` | BufferOverflow adding `<div>` HTML string |
| `9a81b65e` | `E007` | BufferOverflow adding `<meta>` HTML string |

Additionally, 23 older BufferOverflow reports (same root cause) are also fixed.

## Also Needed: MCP Server Version Detection

The MCP server's `check_reported_fixes` returns `current_version: "0.30.50"` even after `0.30.51` is installed and active. It should detect the currently active compiler version (e.g., by running `cln --version` or reading from `~/.cleen/`).

## Files Affected
- Website error dashboard API (report status management)
- MCP server `check_reported_fixes` handler (version detection)
