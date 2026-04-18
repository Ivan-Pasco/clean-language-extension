# /errors — Team Error Dashboard Check

**Internal tool.** Query the production error dashboard and compare with local telemetry to give a single, consistent view of error state across all components.

This skill is for Clean Language team developers only. External language developers use `report_error` and `check_reported_fixes` MCP tools directly — they do not have access to `/errors`.

## Usage
- `/errors` — show all open errors from the production dashboard
- `/errors compiler` — filter to a specific component
- `/errors local` — show local-only errors that never reached the server
- `/errors sync` — detect and fix local/server discrepancies

## Why This Exists

Different data sources give different answers:
- `check_reported_fixes` reads `~/.cleen/telemetry/reported_errors.json` (local, often stale)
- The web dashboard reads the server database (authoritative, but may miss failed uploads)

This skill always queries the **production dashboard first** (single source of truth), then cross-references with local state to surface sync issues.

## Prerequisites

Requires team API key at `~/.cleen/error-api-key`. If not present, stop with:
> This skill requires team access. If you're a Clean Language team member, set up your API key. If you're a language developer reporting errors, use the `report_error` MCP tool instead.

```bash
if [ ! -f ~/.cleen/error-api-key ]; then
    echo "NO_API_KEY"
fi
```

## Instructions

### Step 1: Query the Production Dashboard

Always start here — the server is the source of truth.

```bash
# Get all errors from the dashboard
curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?status=open" 2>/dev/null
```

If the API doesn't support a generic `?status=open` query, fetch by component:
```bash
for component in compiler codegen parser semantic runtime plugin unknown; do
  curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?component=$component&status=open" 2>/dev/null
done
```

Also fetch resolved count for context:
```bash
curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?status=resolved" 2>/dev/null
```

### Step 2: Load Local Store

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
if not os.path.exists(path):
    print('NO_LOCAL_STORE')
else:
    with open(path) as f:
        store = json.load(f)
    reports = store.get('reports', [])
    total = len(reports)
    no_fp = sum(1 for r in reports if not r.get('fingerprint'))
    unresolved = sum(1 for r in reports if r.get('status') not in ('resolved', 'wont_fix'))
    resolved = sum(1 for r in reports if r.get('status') in ('resolved', 'wont_fix'))
    print(f'LOCAL: {total} total, {resolved} resolved, {unresolved} unresolved, {no_fp} never uploaded (no fingerprint)')
"
```

### Step 3: Cross-Reference and Report

Compare local and server state. Present a unified table:

```
## Error Dashboard (Production) — Source of Truth

| Status | Code       | Component | Occurrences | Last Seen  |
|--------|------------|-----------|-------------|------------|
| open   | E001       | compiler  | 5           | 2026-04-17 |

Total: X open, Y resolved

## Local Telemetry Sync

| Metric                                  | Count |
|-----------------------------------------|-------|
| Local reports                           | N     |
| Uploaded (have fingerprint)             | N     |
| Never uploaded (no fingerprint)         | N     |
| Locally resolved                        | N     |
| Server resolved, local still pending    | N     |
```

### Step 4: Sync Guidance

If there are discrepancies:

**Case 1: Local reports with no fingerprint (never uploaded)**
> Found N local reports that never reached the server. These were likely blocked by rate limiting or network failure.
> Options:
> - Review and re-submit important ones via `report_error`
> - Clear stale local reports: run `/errors sync`

**Case 2: Server shows resolved, local still shows pending**
> Found N reports that the server marks as resolved but your local store still shows as pending.
> Run `check_reported_fixes` to pull the latest status, or `/errors sync` to force reconciliation.

**Case 3: Local shows resolved, server still shows open**
> Found N reports resolved locally but still open on the server. This means `/resolve-fix` was not run or the API call failed.
> Run `/resolve-fix <ERROR_CODE> <VERSION> "<description>"` for each.

### Step 5: Component Filter (if argument provided)

If the user specified a component (e.g., `/errors compiler`), filter the output to only show errors where component matches the argument.

Map component names:
- `compiler` → component in (compiler, codegen, parser, semantic)
- `server` → component = runtime
- `extension` → component = extension
- `framework` → component = plugin
- `website` → component = unknown (website errors often use "unknown")

### Sync Mode (`/errors sync`)

When the user runs `/errors sync`, actively reconcile:

1. **Pull server status for all local reports that have fingerprints:**
```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
with open(path) as f:
    store = json.load(f)
ids = [r['report_id'] for r in store.get('reports', []) if r.get('status') not in ('resolved', 'wont_fix')]
print(','.join(ids[:50]))  # batch of 50
"
```

Then call `check_reported_fixes` MCP tool to pull updates.

2. **Mark locally resolved any reports the server shows as resolved.**

3. **Flag orphaned local reports** (no fingerprint, older than 24h) — suggest cleanup or re-submission.

4. **Report the result:**
```
Sync complete:
  - N reports updated from server (now resolved)
  - N orphaned reports flagged for review
  - N reports still legitimately open
```

### Local Mode (`/errors local`)

Show only local reports that have no server fingerprint:

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
with open(path) as f:
    store = json.load(f)
for r in store.get('reports', []):
    if not r.get('fingerprint') and r.get('status') not in ('resolved', 'wont_fix'):
        print(f\"{r.get('error_code','?'):30} {r.get('reported_at','?')[:19]:20} {r.get('summary','')[:60]}\")
"
```

## Key Principles

1. **Team only.** This skill requires `~/.cleen/error-api-key`. External users use `report_error` / `check_reported_fixes` MCP tools.

2. **Dashboard is always right.** When local and server disagree:
   - Server says resolved → it's resolved (update local)
   - Server says open → it's open (even if local says resolved)
   - Local has report, server doesn't know about it → upload failed

3. **Never present local-only data as "the error state."** Always lead with the server view.
