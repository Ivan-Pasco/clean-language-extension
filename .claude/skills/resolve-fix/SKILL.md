# /resolve-fix — Close Out a Reported Error Through the Full Lifecycle

After fixing a bug that was reported via `report_error`, verify the fix has actually reached the local dev environment, then mark the report resolved on the **server**. The server is the only source of truth for resolution status — this skill never reads or writes any local state store.

## Lifecycle Stages

Every reported error moves through these stages. The skill enforces all of them before posting `resolved` to the server:

| Stage | Verified by | Where it lives |
|---|---|---|
| 1. `reported` | `report_error` MCP call | Server |
| 2. `fix_committed` | git log shows commit referencing the error | Local git (read-only) |
| 3. `fix_released` | git tag exists + GH release workflow conclusion == success | Git + GitHub (read-only) |
| 4. `fix_installed` | `cln --version` / `cleen frame list` shows the new version active | Local install (read-only) |
| 5. `resolved` | server `/api/v1/resolve-batch` returns success | Server |

If any stage fails verification, the skill stops and reports which stage needs attention. It does NOT post resolution on partial progress.

See `management/ERROR_REPORTING_WORKFLOW.md` for why local state is never used here.

## Usage

- `/resolve-fix <ERROR_CODE> <VERSION> "<description>"` — full lifecycle verification + server resolve for all reports with that error code
- `/resolve-fix fingerprint <FP> <VERSION> "<description>"` — single fingerprint
- `/resolve-fix check` — list bugs the server still has open and which stage they're stuck at locally
- `/resolve-fix status <ERROR_CODE>` — show server-side lifecycle status for that error code

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

Record the commit hash for the Stage 5 payload.

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

Pull the bug's `minimal_repro` from the server (not local) and try to reproduce:
```bash
curl -s -H "X-API-Key: $ERROR_API_KEY" \
  "https://errors.cleanlanguage.dev/api/v1/bugs?error_code=<ERROR_CODE>&status=open" | \
  jq -r '.bugs[0].minimal_repro' > /tmp/repro.cln

[ -s /tmp/repro.cln ] && cln compile /tmp/repro.cln --output /tmp/repro.wasm
```

If the error reproduces, STOP — the "fix" didn't actually fix anything. If no `minimal_repro` is on the server, skip this step.

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

If the server returns `"resolved": 0`:
> Server reports 0 fingerprints resolved for `<ERROR_CODE>`. Either the bug was never reported (server has no record), or it was already resolved. Verify with `/resolve-fix status <ERROR_CODE>`.

### Step 6: Report Results

```
Resolved: <ERROR_CODE> — "<DESCRIPTION>"
  ✓ Stage 2 fix_committed:  <commit_hash>
  ✓ Stage 3 fix_released:   v<VERSION>  (release run #<N>)
  ✓ Stage 4 fix_installed:  cln <installed_version> active
  ✓ Stage 5 resolved:       server marked <N> fingerprint(s) resolved
  Notifications: users who reported this error will be notified on next check
```

If any stage was skipped, list it explicitly so the user knows what is still pending.

## Check Mode — Show Pipeline Status

`/resolve-fix check` — list bugs the server still has open, with the local stage they're stuck at:

```bash
API_KEY=$(cat ~/.cleen/error-api-key)
for component in compiler codegen parser semantic runtime plugin extension website unknown; do
  curl -s -H "X-API-Key: $API_KEY" \
    "https://errors.cleanlanguage.dev/api/v1/bugs?component=$component&status=open"
done | jq -r '.bugs[]? | "\(.error_code)\t\(.fingerprint[:12])\t\(.canonical_message[:60])"' | \
while IFS=$'\t' read -r code fp msg; do
  # For each open bug, check whether a local commit, tag, or installed version satisfies any stage
  commit=$(git log --all --grep="$code" --format=%h -n 1 2>/dev/null)
  if [ -z "$commit" ]; then
    stage="reported"
  else
    stage="fix_committed (need release/install)"
  fi
  printf "%-25s %-14s %-32s %s\n" "$code" "$fp" "$stage" "$msg"
done
```

## Status Mode — Inspect One Error Code

`/resolve-fix status <ERROR_CODE>` — show server-side state for that error code:

```bash
API_KEY=$(cat ~/.cleen/error-api-key)
for component in compiler codegen parser semantic runtime plugin extension website unknown; do
  curl -s -H "X-API-Key: $API_KEY" \
    "https://errors.cleanlanguage.dev/api/v1/bugs?component=$component&error_code=<ERROR_CODE>"
done | jq '.bugs[]? | {fingerprint, status, occurrences, first_seen, last_seen, fixed_in_version, fix_commit, resolved_at}'
```

## Why This Matters

A fix in git is not a fix. A release on GitHub is not a fix. A fix is a change that has been:
1. **Committed** in the component's repo
2. **Released** as a tagged GitHub release that CI validated
3. **Installed** in the local Clean Language dev environment (via `cleen install` / `cleen frame install`)
4. **Verified** to no longer reproduce the original error (when a minimal_repro is available)
5. **Recorded** as resolved on the server, so users who reported it get notified

Only then can users who reported the bug trust that updating will resolve their issue. `/resolve-fix` enforces this by refusing to post resolution until each stage is independently verified.

## Integration with comita

The canonical flow after identifying a reported bug:
```
1. /triage                            → pick the bug, identify component + root cause
2. Fix the code                       → in the correct component only
3. comita                             → STEP 1-6: commit, tag, push, CI, install
4. /resolve-fix <code> <ver> "..."    → STEP 7 of comita: verify + resolve on server
```

Comita's **STEP 7: RESOLVE REPORTED BUGS** automatically invokes this skill when the commit fixes a reported bug. Do NOT call `/resolve-fix` before comita completes — Stages 3 and 4 will fail verification.
