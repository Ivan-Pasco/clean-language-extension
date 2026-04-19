# /errors — Team Error Dashboard Check

**Internal tool.** Query the production error dashboard to give a single, consistent view of error state across all components.

This skill is for Clean Language team developers only. External language developers use `report_error` and `check_reported_fixes` MCP tools directly — they do not have access to `/errors`.

## Usage
- `/errors` — show all open errors from the production dashboard
- `/errors compiler` — filter to a specific component
- `/errors resolved` — show recently resolved errors instead of open

## Source of Truth

The production server (`https://errors.cleanlanguage.dev`) is the **only** source of truth for bug status. This skill never reads the local telemetry store. See `management/ERROR_REPORTING_WORKFLOW.md` for the rationale.

If you find yourself wanting to "compare local vs server" — don't. The local store is a transient outbox for unsent reports, not a state mirror. Drift is impossible by design because there is nothing to drift.

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

```bash
API_KEY=$(cat ~/.cleen/error-api-key)
STATUS="${1:-open}"   # default to open; allow "resolved" or other states

# The /api/v1/bugs endpoint requires component. Iterate the known components.
for component in compiler codegen parser semantic runtime plugin extension website unknown; do
  curl -s -H "X-API-Key: $API_KEY" \
    "https://errors.cleanlanguage.dev/api/v1/bugs?component=$component&status=$STATUS"
done
```

If a single argument is given (e.g., `/errors compiler`), restrict the loop to that component or its aliases:

| User arg     | Components to query                          |
|--------------|----------------------------------------------|
| `compiler`   | compiler, codegen, parser, semantic           |
| `server`     | runtime                                      |
| `extension`  | extension                                    |
| `framework`  | plugin                                       |
| `website`    | website, unknown                             |
| (none)       | all of the above                             |

If the user passes `resolved` as the argument, set `STATUS=resolved` and iterate all components.

### Step 2: Aggregate and Present

Collect all bugs from the responses. Sort by `priority_score` descending, then `last_seen` descending. Present:

```
## Error Dashboard — <STATUS> bugs

| Code   | Component | Fingerprint  | Occ | Last Seen           | First Ver | Message |
|--------|-----------|--------------|-----|---------------------|-----------|---------|
| ...    | ...       | <12 chars>   | ... | YYYY-MM-DD HH:MM:SS | ...       | <truncated> |

Total: N bugs
```

Group by error code where there is an obvious cluster (e.g., 7 E007s with similar messages → note "likely shared root cause").

### Step 3: Network Failure Handling

If the dashboard is unreachable (curl exits non-zero or returns non-JSON):

> Cannot reach error dashboard at `errors.cleanlanguage.dev`. Server is the only source of truth — without it, bug state is unknown. Check connectivity and retry.

**Do not fall back to local data.** There is no local data to fall back to. Failing loudly is the correct behavior.

## Key Principles

1. **Team only.** Requires `~/.cleen/error-api-key`. External users use the MCP tools.
2. **Server is the only truth.** No local cross-referencing, no sync mode, no discrepancy reconciliation.
3. **Fail loud on network errors.** Don't pretend to know the state when you can't reach the server.
