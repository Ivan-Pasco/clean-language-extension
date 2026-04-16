# /resolve-fix — Close Out a Reported Error Through the Full Lifecycle

After fixing a bug that was reported via `report_error`, verify the fix has actually reached the local dev environment before marking the report resolved. A fix is not "finished" until all lifecycle stages have been verified.

## Lifecycle Stages

Every reported error moves through these stages. The skill enforces all of them before marking `resolved`:

| Stage | Field | Verified by |
|---|---|---|
| 1. `reported` | initial | `report_error` MCP call |
| 2. `fix_committed` | `fix_commit` | git log shows commit with the fix |
| 3. `fix_released` | `fix_released_tag`, `fix_release_run` | git tag exists + GH release workflow conclusion == success |
| 4. `fix_installed` | `fix_installed_version`, `fix_installed_at` | `cln --version` / `cleen frame list` shows the new version as active |
| 5. `resolved` | `resolved_at`, `notified` | backend ACK + local store updated |

If any stage fails verification, the skill stops and reports which stage needs attention. It does NOT flip status to resolved on partial progress.

## Usage

- `/resolve-fix <ERROR_CODE> <VERSION> "<description>"` — run full lifecycle verification for all reports with that error code
- `/resolve-fix fingerprint <FP> <VERSION> "<description>"` — single fingerprint
- `/resolve-fix check` — list open reports and which stage they are stuck at
- `/resolve-fix status <ERROR_CODE>` — show the full lifecycle status of reports with that error code

## Instructions

### Step 0: Prep

Load the API key:
```bash
export ERROR_API_KEY="${ERROR_API_KEY:-$(cat ~/.cleen/error-api-key 2>/dev/null)}"
[ -z "$ERROR_API_KEY" ] && echo "ERROR_API_KEY not set" && exit 1
```

Get the target version (arg 2) and the current active versions:
```bash
cln --version                                  # active compiler version
cleen frame list | grep '^\*'                  # active frame version
```

### Step 1: Verify Stage 2 — fix_committed

Find the commit that references the bug. A qualifying commit message mentions either the error code or a report_id.
```bash
git log --all --grep="<ERROR_CODE>" --format="%h %s" -n 5
git log --all --grep="<REPORT_ID>" --format="%h %s" -n 5
```

If no commit is found, STOP and report:
> Stage 2 (fix_committed) failed: no git commit references `<ERROR_CODE>`. Make the fix first, then re-run `/resolve-fix`.

Record the commit hash for Stage 5 payload.

### Step 2: Verify Stage 3 — fix_released

Check the git tag exists for the target version:
```bash
git tag -l "v<VERSION>"
```

Check the release workflow succeeded:
```bash
gh run list --limit=5 --json name,conclusion,status,headBranch | \
  jq '.[] | select(.headBranch=="v<VERSION>" and (.name | contains("Release")))'
```

If either is missing, STOP and report:
> Stage 3 (fix_released) failed: tag `v<VERSION>` does not exist, or release workflow did not complete. Run `comita` first.

### Step 3: Verify Stage 4 — fix_installed

The fix must be installed in the local Clean Language dev environment. Run the matching install command based on the component:
- Compiler fix → `cleen install latest` → check `cln --version`
- Framework plugin fix → `cleen frame install latest` → check `cleen frame list | grep '^\*'`
- Server fix → check running server version

```bash
# compiler
installed=$(cln --version 2>/dev/null | awk '{print $NF}')
# framework (active version marked with *)
frame_installed=$(cleen frame list | awk '/^\*/ {print $2}')
```

If `installed` does not match `<VERSION>` (or `frame_installed` for framework fixes), STOP and report:
> Stage 4 (fix_installed) failed: local `cln` is at `<installed>`, expected `<VERSION>`. Run `cleen install latest` / `cleen frame install latest` and `cleen use <VERSION>`.

### Step 4: Compile a Sanity Test (Optional but Recommended)

If the report's minimal_repro is available in the local store, compile it with the installed version. If the error reproduces, STOP — the "fix" didn't actually fix anything.

```bash
python3 -c "
import json, os
p = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
store = json.load(open(p))
for r in store['reports']:
    if r.get('error_code') == '<ERROR_CODE>' and r.get('minimal_repro'):
        print(r['minimal_repro'])
        break
" > /tmp/repro.cln

cln compile /tmp/repro.cln --output /tmp/repro.wasm
```

Missing reproductions → skip this step.

### Step 5: Call the Backend Resolve API

Only after Stages 2-4 pass:
```bash
curl -s -X POST "https://errors.cleanlanguage.dev/api/v1/resolve-batch" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"error_code\": \"<ERROR_CODE>\",
    \"fixed_in_version\": \"<VERSION>\",
    \"fix_description\": \"<DESCRIPTION>\",
    \"fix_commit\": \"<COMMIT_HASH>\",
    \"resolved_by\": \"dev-team\"
  }"
```

For single-fingerprint mode, use `POST /api/v1/fingerprints/<FP>/resolve` with the same payload.

Note: if the server returns `"resolved": 0`, the fingerprints were never ingested server-side — this is a telemetry upload bug, not a resolution failure. Continue and mark locally.

### Step 6: Update Local Store with Full Lifecycle Payload

The local store is the source of truth when the server is behind:
```bash
python3 - <<'PYEOF'
import json, os, subprocess
from datetime import datetime, timezone

path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
with open(path) as f:
    store = json.load(f)

ERROR_CODE = "<ERROR_CODE>"
VERSION = "<VERSION>"
DESC = "<DESCRIPTION>"
COMMIT = subprocess.check_output(['git','log','-1','--format=%H'],cwd='.').decode().strip()
NOW = datetime.now(timezone.utc).isoformat()

# Determine active version for the component
try:
    cln_ver = subprocess.check_output(['cln','--version']).decode().strip().split()[-1]
except Exception:
    cln_ver = None

changed = 0
for r in store.get('reports', []):
    if r.get('error_code') != ERROR_CODE:
        continue
    if r.get('status') == 'resolved':
        continue
    r['status'] = 'resolved'
    r['resolved_in'] = VERSION
    r['resolved_at'] = NOW
    r['fix_description'] = DESC
    r['fix_commit'] = COMMIT
    r['fix_released_tag'] = f'v{VERSION}'
    r['fix_installed_version'] = cln_ver or VERSION
    r['fix_installed_at'] = NOW
    r['workflow'] = {
        'reported': True,
        'fix_committed': True,
        'fix_released': True,
        'fix_installed': True,
        'resolved': True,
    }
    r['notified'] = False
    changed += 1

with open(path, 'w') as f:
    json.dump(store, f, indent=2)
print(f'Updated {changed} local report(s) to resolved')
PYEOF
```

### Step 7: Report Results

```
Resolved: <ERROR_CODE> — "<DESCRIPTION>"
  ✓ Stage 2 fix_committed:  <commit_hash>
  ✓ Stage 3 fix_released:   v<VERSION>  (release run #<N>)
  ✓ Stage 4 fix_installed:  cln <installed_version> active
  ✓ Stage 5 resolved:       backend ACK (<server_resolved_count> fp), M local report(s) updated
  Notifications: users who reported this error will be notified on next check
```

If any stage was skipped, list it explicitly so the user knows what is still pending.

## Check Mode — Show Pipeline Status

`/resolve-fix check` — list open reports by lifecycle stage:

```bash
python3 - <<'PYEOF'
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
with open(path) as f:
    store = json.load(f)

STAGE_ORDER = ['reported','fix_committed','fix_released','fix_installed','resolved']

for r in store.get('reports', []):
    status = r.get('status','reported')
    if status in ('resolved','wont_fix'):
        continue
    wf = r.get('workflow', {})
    # Determine farthest reached stage
    reached = max((i for i, s in enumerate(STAGE_ORDER) if wf.get(s)), default=0)
    stage = STAGE_ORDER[reached]
    print(f"{r.get('error_code','?'):30} {stage:20} {r.get('summary','')[:60]}")
PYEOF
```

## Status Mode — Inspect One Error Code

`/resolve-fix status <ERROR_CODE>` — show every lifecycle field for matching reports:

```bash
python3 - <<'PYEOF'
import json, os
path = os.path.expanduser('~/.cleen/telemetry/reported_errors.json')
with open(path) as f:
    store = json.load(f)
code = "<ERROR_CODE>"
for r in store.get('reports', []):
    if r.get('error_code') == code:
        print(f"\n=== {r['report_id']} ===")
        for k in ('status','fix_commit','fix_released_tag','fix_installed_version','fix_installed_at','resolved_at','notified'):
            print(f"  {k}: {r.get(k)}")
PYEOF
```

## Why This Matters

A fix in git is not a fix. A release on GitHub is not a fix. A fix is a change that has been:
1. **Committed** in the component's repo
2. **Released** as a tagged GitHub release that CI validated
3. **Installed** in the local Clean Language dev environment (via `cleen install` / `cleen frame install`)
4. **Verified** to no longer reproduce the original error (when a minimal_repro is available)

Only then can users who reported the bug trust that updating will resolve their issue. `/resolve-fix` enforces this by refusing to mark `resolved` until each stage is independently verified.

## Integration with comita

The canonical flow after identifying a reported bug:
```
1. /triage                            → pick the bug, identify component + root cause
2. Fix the code                       → in the correct component only
3. comita                             → STEP 1-6: commit, tag, push, CI, install
4. /resolve-fix <code> <ver> "..."    → STEP 7 of comita: verify + resolve
```

Comita's **STEP 7: RESOLVE REPORTED BUGS** automatically invokes this skill when the commit fixes a reported bug. Do NOT call `/resolve-fix` before comita completes — Stages 3 and 4 will fail verification.
