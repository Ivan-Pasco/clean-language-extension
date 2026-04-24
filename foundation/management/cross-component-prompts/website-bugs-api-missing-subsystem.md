# Bug Fix: bugs_list() API Missing subsystem Field

## Component
Web Site Clean (error API)

## Issue Type
Bug — the `bugs_list()` API endpoint does not return the `error_subsystem` field

## Priority
Medium — the data is stored correctly but not exposed via the API, so MCP tools querying `list_component_bugs` don't get subsystem info.

## Problem

The `bugs_list()` function in `app/server/errors_api.cln` builds a JSON_OBJECT for each bug but omits `error_subsystem`. The `error_subsystem` column exists in the database (added by migration 007) and is populated on ingest, but the API response doesn't include it.

### Current JSON_OBJECT (line ~437-457)

```sql
JSON_OBJECT(
  'fingerprint', ef.fingerprint,
  'error_code', ef.error_code,
  'component', ef.error_component,
  -- 'subsystem' is MISSING here
  'canonical_message', ef.canonical_message,
  'occurrences', ef.occurrence_count,
  ...
)
```

### Fix

Add `'subsystem', COALESCE(ef.error_subsystem, '')` after the `'component'` line:

```sql
JSON_OBJECT(
  'fingerprint', ef.fingerprint,
  'error_code', ef.error_code,
  'component', ef.error_component,
  'subsystem', COALESCE(ef.error_subsystem, ''),
  'canonical_message', ef.canonical_message,
  ...
)
```

## Also Needed: Deploy Current Build

The production error server has not been redeployed with the latest changes:
- Migration 007 (component taxonomy normalization) has NOT been applied
- The dashboard still shows old component names (`codegen` instead of `compiler/codegen`)
- The subsystem column exists in code but isn't in the production database yet

### Steps
1. Apply migration 007: `app/data/migrations/007_component_taxonomy.sql`
2. Fix `bugs_list()` JSON_OBJECT (add subsystem field)
3. Rebuild: `bash scripts/build.sh`
4. Deploy: `DEPLOY_HOST=165.227.62.95 bash deploy.sh`

## Verification

After deploy:
```bash
# bugs API should include subsystem
curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?component=compiler&status=open"
# Each bug should have: "subsystem": "parser" (or "codegen", etc.)

# Dashboard should show normalized names
curl -s "https://errors.cleanlanguage.dev/errors"
# Should show "compiler/codegen" instead of "codegen"
```

## Files Affected
- `app/server/errors_api.cln` — `bugs_list()` function, add subsystem to JSON_OBJECT
