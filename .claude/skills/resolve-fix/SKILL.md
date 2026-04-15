# /resolve-fix — Mark Reported Errors as Fixed

After fixing a compiler bug that was reported via the error dashboard, mark it as resolved on the backend so users are notified.

## Usage
- `/resolve-fix E007 0.30.52 "Increased data section limit"` — resolve all reports with error code E007
- `/resolve-fix fingerprint abc123 0.30.52 "Fixed buffer overflow"` — resolve a specific fingerprint
- `/resolve-fix check` — list locally tracked reports that are still open

## Instructions

### Step 1: Identify What to Resolve

Parse the arguments:
- **By error code** (default): `<error_code> <version> "<description>"`
- **By fingerprint**: `fingerprint <fp> <version> "<description>"`
- **Check mode**: `check` — list open reports from `~/.cleen/telemetry/reported_errors.json`

If no arguments are given, check `~/.cleen/telemetry/reported_errors.json` for reports with status `reported` and ask which to resolve.

### Step 2: Read the API Key

The API key is stored as an environment variable. Read it:

```bash
echo "$ERROR_API_KEY"
```

If `ERROR_API_KEY` is not set, check `~/.cleen/error-api-key` as a fallback:

```bash
cat ~/.cleen/error-api-key 2>/dev/null
```

If neither exists, tell the user:
> ERROR_API_KEY is not set. Set it with: `export ERROR_API_KEY=<key>` or save it to `~/.cleen/error-api-key`

Do NOT proceed without a valid key.

### Step 3: Get the Current Compiler Version

If no version was provided in the arguments, detect it:

```bash
cln --version 2>/dev/null || cargo run --bin cln -- --version 2>/dev/null
```

### Step 4: Resolve by Error Code (Batch)

Call the batch resolve endpoint:

```bash
curl -s -X POST "https://errors.cleanlanguage.dev/api/v1/resolve-batch" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "error_code": "<ERROR_CODE>",
    "fixed_in_version": "<VERSION>",
    "fix_description": "<DESCRIPTION>",
    "resolved_by": "dev-team"
  }'
```

Check the response:
- `"ok": true` with `"resolved": N` — success, N fingerprints resolved
- `401` — bad API key
- `400` — missing required fields

### Step 5: Resolve by Fingerprint (Single)

If using `fingerprint` mode, call the single-resolve endpoint:

```bash
curl -s -X POST "https://errors.cleanlanguage.dev/api/v1/fingerprints/<FINGERPRINT>/resolve" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fixed_in_version": "<VERSION>",
    "fix_description": "<DESCRIPTION>",
    "fix_commit": "<COMMIT_HASH>",
    "fix_pr": "",
    "resolved_by": "dev-team"
  }'
```

For the commit hash, get it from git:

```bash
git log -1 --format="%h" 2>/dev/null
```

### Step 6: Update Local Report Store

After a successful API call, update the local tracking file so `check_reported_fixes` reflects the change:

```bash
python3 -c "
import json, sys, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
if not os.path.exists(path):
    print('No local report store found')
    sys.exit(0)
with open(path) as f:
    store = json.load(f)
error_code = '$ERROR_CODE'
version = '$VERSION'
changed = 0
for rid, report in store.get('reports', {}).items():
    if report.get('error_code') == error_code and report.get('status') != 'resolved':
        report['status'] = 'resolved'
        report['resolved_in'] = version
        report['notified'] = False
        changed += 1
if changed:
    with open(path, 'w') as f:
        json.dump(store, f, indent=2)
    print(f'Updated {changed} local report(s) to resolved')
else:
    print('No matching local reports to update')
"
```

### Step 7: Report Results

Report what happened:

```
Resolved: E007 — "Increased data section limit"
  Backend: N fingerprint(s) marked as resolved in v0.30.52
  Local: M report(s) updated
  Notifications: Users who reported this error will be notified
```

### Step 8: Publish Reminder

After resolving, remind about the deployment steps so the fix reaches users:

```
Next steps to publish the fix:
  1. comita                          — commit, push, wait for CI
  2. cleen install latest            — verify locally
  3. Deploy website (if error dashboard updated):
     cd "Web Site Clean" && bash scripts/build.sh && DEPLOY_HOST=165.227.62.95 bash deploy.sh
```

## Check Mode

When called with `/resolve-fix check`, read the local store and list open reports:

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
if not os.path.exists(path):
    print('No local reports found')
else:
    with open(path) as f:
        store = json.load(f)
    open_reports = [(rid, r) for rid, r in store.get('reports', {}).items()
                    if r.get('status') not in ('resolved', 'wont_fix')]
    if not open_reports:
        print('All reports are resolved')
    else:
        for rid, r in open_reports:
            print(f\"{r.get('error_code', '?'):10} {r.get('status', '?'):15} {r.get('error_message', '')[:60]}\")
"
```

Then ask the user which ones to resolve, or suggest checking with `/triage` first.

## Integration with comita

When the AI fixes a bug that was originally reported via `report_error`, the ideal workflow is:

```
1. /triage                    — identify the bug to fix
2. Fix the code               — in the correct component
3. comita                     — commit, push, CI passes, cleen install latest
4. /resolve-fix <code> <ver>  — mark as fixed on the dashboard
```

The AI should call `/resolve-fix` automatically after a successful `comita` if the session included fixing a reported bug.
