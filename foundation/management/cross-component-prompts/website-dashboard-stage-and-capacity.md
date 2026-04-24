# Bug Fix: Dashboard Resolve Stage + Report Capacity

## Component
Web Site Clean (error dashboard)

## Issue Type
Bug (two related issues)

## Priority
High — the dashboard is the only cross-component visibility tool for error lifecycle. Both bugs undermine trust in the resolve workflow.

## Bug 1: Resolve Endpoints Don't Advance Lifecycle Stage

### Problem

The resolve endpoints (`POST /api/v1/fingerprints/<fp>/resolve` and `POST /api/v1/resolve-batch`) update the status to "resolved" and store fix metadata (`fix_commit`, `fixed_in_version`, `resolved_by`, `resolved_at`), but they **never update the lifecycle stage column**.

The dashboard renders the stage as a 5-dot indicator (`●●●●●`). After calling resolve with a complete payload, the stage stays at `fix_committed` (2/5 dots) even though the status badge says "resolved".

### Evidence

- Fingerprint: `16afe6ecc05676da7a084bdbe062d14e126179040a8b1c0b7800eec26673eb9f`
- Error code: `RUNTIME_WASM_PARSE`, fixed in clean-server v1.9.3
- Resolve called with: `fix_commit=3030599`, `fixed_in_version=1.9.3`, `fix_released_tag=v1.9.3`, `fix_installed_version=1.9.5`, `resolved_by=dev-team`
- Dashboard shows: status badge = "resolved", stage dots = `●●○○○` (fix_committed)

### Fix

In the resolve handlers (`errors_api.cln`), after writing the fix metadata fields, also update the stage:

1. If `fix_commit` is present → stage >= `fix_committed`
2. If `fix_released_tag` is present → stage >= `fix_released`
3. If `fix_installed_version` is present → stage >= `fix_installed`
4. If all of the above + `resolved_by` → stage = `resolved`

The stage should be set to the **highest verified level** based on which fields are present in the payload.

If the `stage` column doesn't exist yet, apply the migration from `management/cross-component-prompts/website-error-lifecycle-schema.md`:

```sql
ALTER TABLE error_fingerprints ADD COLUMN IF NOT EXISTS fix_released_tag VARCHAR(64) NULL;
ALTER TABLE error_fingerprints ADD COLUMN IF NOT EXISTS fix_installed_version VARCHAR(64) NULL;
ALTER TABLE error_fingerprints ADD COLUMN IF NOT EXISTS fix_installed_at TIMESTAMP NULL;
ALTER TABLE error_fingerprints ADD COLUMN IF NOT EXISTS stage VARCHAR(20) NOT NULL DEFAULT 'reported';
```

### Verification

```bash
# Call resolve with full lifecycle payload
curl -s -X POST "https://errors.cleanlanguage.dev/api/v1/fingerprints/16afe6ecc05676da7a084bdbe062d14e126179040a8b1c0b7800eec26673eb9f/resolve" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fixed_in_version": "1.9.3",
    "fix_commit": "3030599",
    "fix_released_tag": "v1.9.3",
    "fix_installed_version": "1.9.5",
    "resolved_by": "dev-team"
  }'

# Dashboard should now show ●●●●● (5/5) for RUNTIME_WASM_PARSE
```

---

## Bug 2: Dashboard Silently Drops Reports Beyond Row Limit

### Problem

The dashboard table shows exactly 10 rows with no pagination. New reports that are accepted by the API (`"status":"received"` with a fingerprint) never appear in the table and are not retrievable by fingerprint on the detail page.

### Evidence

- Submitted `DASHBOARD_STAGE_UPDATE` via `POST /api/v1/reports` — got `"status":"received"` and fingerprint `b87b47e78283a2127b6efc98ce902521ed769f41badac5f12e87256c1fd81e6c`
- Resubmitted with different component — got new fingerprint `1948e1e4562a6ff92d3ca151c0a2f39edc15931693fd44d0dc167bb485622d7b`
- Neither appears on `/errors` dashboard
- Both return "fingerprint not found" on `/errors/detail?fp=...`
- `MCP_UPLOAD_BROKEN` (submitted in the same session) DID appear — it took position 10, replacing `TEST999`

This means the API accepts and acknowledges reports but the database either:
- Has a hard limit (10 rows) and silently discards overflow
- Has a UNIQUE constraint or deduplication that silently conflicts
- Inserts succeed but the dashboard query has `LIMIT 10` with no pagination

### Fix

1. Check the `INSERT` path in `reports_create()` — does it silently catch insert failures?
2. Check the dashboard query in the `/errors` route — add pagination or remove the row cap
3. If there's a dedup fingerprint collision, surface it in the API response instead of returning `"received"`
4. Reports accepted by the API must be retrievable on the detail page

### Verification

```bash
# Submit a test report
curl -s -X POST "https://errors.cleanlanguage.dev/api/v1/reports" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": \"$(uuidgen)\",
    \"schema_version\": \"1.0.0\",
    \"user\": {\"anonymous\": true, \"consent_level\": \"error_only\"},
    \"error\": {\"code\": \"TEST_CAPACITY\", \"component\": \"unknown\", \"severity\": \"bug\", \"message\": \"Testing dashboard capacity\"},
    \"source\": {\"compiler_version\": \"0.30.58\"}
  }"

# Should appear on /errors and be retrievable via /errors/detail?fp=<returned_fingerprint>
```

## Files Affected
- `app/server/errors_api.cln` — resolve handlers (stage update) + reports_create (insert reliability)
- `app/data/migrations/` — new migration for stage column if not present
- `app/pages/` or route handler for `/errors` — pagination or row limit fix
