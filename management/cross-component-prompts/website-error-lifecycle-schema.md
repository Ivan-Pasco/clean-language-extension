# Cross-Component Prompt: Error Report Full-Lifecycle Schema

## Component
Web Site Clean (error dashboard)

## Related Components
- Clean MCP / Compiler (telemetry uploader bug — see separate section below)
- All dev-team components that call `/resolve-fix`

## Issue Type
Feature request + schema extension

## Priority
Medium — current schema accepts fix metadata but discards most of it. Fixes appear "done" on the dashboard without users being able to see the full deployment trail.

## Context

`.claude/skills/resolve-fix/SKILL.md` and `.claude/rules/tier1-foundations.md` (Principle 1.1) now define a **mandatory 5-stage lifecycle** for every reported error:

| Stage | Meaning | Verified by |
|---|---|---|
| 1. `reported` | Bug logged via `report_error` | MCP call |
| 2. `fix_committed` | Code fix pushed to git | commit hash referencing the error |
| 3. `fix_released` | Tagged release with CI pass | `gh run list` + `git tag` |
| 4. `fix_installed` | Active in local dev env | `cln --version` / `cleen frame list` |
| 5. `resolved` | Dashboard closed + users notified | `/resolve-fix` backend ACK |

A fix is not "finished" until all 5 stages are independently verified. Locally, the tracking file `~/.cleen/telemetry/reported_errors.json` already captures this in the `workflow` object per report.

The dashboard backend (`app/server/errors_api.cln`, migration `app/data/migrations/002_error_reports.sql`) currently **discards most of this lifecycle data**. It only persists `status`, `fixed_in_version`, `fix_description`, `fix_commit`, `fix_pr`, `resolved_at` on `error_fingerprints`. It does not surface:

- Which git tag the fix was released under
- Which installed version is known-good
- Whether each of the 5 stages was verified

Users visiting the dashboard see "resolved" but cannot tell when the fix reaches their version or whether it was validated end-to-end.

## Change Required

### 1. Extend `error_fingerprints` schema

Add columns to `error_fingerprints`:

```sql
ALTER TABLE error_fingerprints ADD COLUMN fix_released_tag VARCHAR(64) NULL;
ALTER TABLE error_fingerprints ADD COLUMN fix_installed_version VARCHAR(64) NULL;
ALTER TABLE error_fingerprints ADD COLUMN fix_installed_at TIMESTAMP NULL;
ALTER TABLE error_fingerprints ADD COLUMN stage ENUM(
    'reported',
    'fix_committed',
    'fix_released',
    'fix_installed',
    'resolved'
) NOT NULL DEFAULT 'reported';
```

`stage` is a derived field but worth storing explicitly so the dashboard can filter "in-progress fixes" from "fully shipped fixes".

### 2. Extend `/api/v1/resolve-batch` payload

The resolve-batch endpoint (currently at `errors_api.cln:492-534`) accepts:
```json
{
  "error_code": "...",
  "fixed_in_version": "...",
  "fix_description": "...",
  "resolved_by": "..."
}
```

Extend to accept:
```json
{
  "error_code": "...",
  "fixed_in_version": "...",
  "fix_description": "...",
  "fix_commit": "<full-sha>",
  "fix_released_tag": "v0.30.52",
  "fix_installed_version": "0.30.52",
  "fix_installed_at": "2026-04-16T12:00:00Z",
  "resolved_by": "..."
}
```

The same extension applies to `/api/v1/fingerprints/<fp>/resolve`.

### 3. Update `check_reported_fixes` response

When the MCP tool checks for fixes, return the lifecycle stage so clients can see progress even before full resolution:

```json
{
  "report_id": "...",
  "status": "resolved",
  "stage": "fix_installed",       // NEW
  "fix_released_tag": "v0.30.52", // NEW
  "fix_installed_version": "0.30.52"  // NEW
}
```

### 4. Dashboard UI

Show a 5-dot progress indicator per resolved error:
- `●●●●●` — fully resolved, users notified
- `●●●●○` — installed locally but not yet pushed to dashboard (edge case)
- `●●●○○` — released but not yet in local dev env
- `●●○○○` — committed but not released
- `●○○○○` — reported, no fix yet

## Separate Issue: MCP Telemetry Upload Failure

**Blocker discovered 2026-04-16.** The `report_error` MCP tool stores reports in `~/.cleen/telemetry/reported_errors.json` but **never successfully uploads them to the dashboard server**.

Evidence:
- Local store: 199 reports, all with `fingerprint: null`
- `GET /api/v1/reports/status?id=<any_uuid>` returns `{"error":"not_found"}` for every UUID
- `GET /api/v1/bugs?component=codegen&status=open` returns `"total":0` despite ~45 codegen errors stored locally
- `POST /api/v1/resolve-batch` returns `{"ok":true,"resolved":0}` because no fingerprints exist to match

The backend is healthy — reports never arrive. Likely causes:
- Network/fetch call silently swallowed
- Rate limited (429) with no retry
- Call never wired up in the MCP `report_error` handler

This lives in whichever component implements `src/mcp/server.rs` (Clean Language compiler, per earlier CLAUDE.md references). Fix direction:
1. Trace the code path in `report_error` that should POST to `https://errors.cleanlanguage.dev/api/v1/reports`
2. Surface upload errors instead of failing silently (log or retry queue)
3. Add a `cln telemetry flush` command that retries all `fingerprint: null` local reports

Once uploaded, the 199 pending reports should get server-side fingerprints and become resolvable via batch.

## Immediate Local State

Local store has been backfilled with full lifecycle data for 3 reports resolved this session:

| report_id | error_code | fix_commit | released | installed |
|---|---|---|---|---|
| `156929c4` | `PLUGIN_RUNTIME_MISMATCH` | `c4108a3` | v2.10.12 | frame 2.10.13 |
| `da1fc6e6` | `CODEGEN_EVENT_HANDLERS` | `c32a338` | v0.30.52 | 0.30.52 |
| `b8716d35` | `PLUGIN_RUNTIME_NAMESPACE` | `6cef7b5` | v2.10.13 | frame 2.10.13 |

Once the schema is extended, the next `/resolve-fix` call will populate these columns server-side. Until then, the dashboard shows them as plain `resolved` with `fixed_in_version` only.

## Files Affected

### Web Site Clean
- `app/data/migrations/00X_error_lifecycle.sql` (new migration)
- `app/server/errors_api.cln` — extend `resolve_batch`, `resolve_fingerprint`, `check_reported_fixes`, `reports_create` handlers
- `app/pages/admin/errors.html` or equivalent dashboard pages — add stage indicator UI

### Clean MCP / Compiler
- `src/mcp/server.rs` — fix `report_error` upload path
- Add retry/flush mechanism for stuck local reports

## Verification

1. Apply migration, redeploy.
2. Call `POST /api/v1/resolve-batch` with the extended payload → verify columns populated on a test fingerprint.
3. Call `GET /api/v1/bugs?status=in_progress` — should return fingerprints where `stage != 'resolved'`.
4. Run `/resolve-fix CODEGEN_EVENT_HANDLERS 0.30.52 "..."` → verify backend receives `fix_released_tag=v0.30.52` and `fix_installed_version=0.30.52`.
