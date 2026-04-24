Component: Web Site Clean
Issue Type: enhancement
Priority: high
Source Component: clean-language-compiler
Description: When a bug report arrives at POST /api/v1/reports, the server should check if the fingerprint matches an already-resolved bug. If so, return an "already_fixed" response immediately so the reporter knows to upgrade — no need to wait and call check_reported_fixes later.

## Current Behavior

When POST /reports receives a duplicate of a resolved bug:
```json
{"report_id": "...", "status": "duplicate", "occurrences": 47}
```
The reporter has no idea it's already fixed. They must separately call GET /reports/status to discover the fix.

## Enhanced Behavior

When the computed fingerprint matches an entry in `error_fingerprints` with `status = 'resolved'`:

```json
{
  "report_id": "<uuid>",
  "status": "already_fixed",
  "is_duplicate": true,
  "fingerprint": "<hash>",
  "fixed_in_version": "0.30.27",
  "fix_description": "Plugin manifests stored in registry, auto-derive dot-notation aliases",
  "fix_commit": "d976d84",
  "fix_pr": null,
  "resolved_at": "2026-04-01T00:00:00Z",
  "upgrade_command": "cleen install latest",
  "message": "This bug was fixed in v0.30.27. Update your compiler: cleen install latest"
}
```

When the fingerprint matches an entry with `status = 'open'` or `status = 'in_progress'`:
```json
{
  "report_id": "<uuid>",
  "status": "known",
  "is_duplicate": true,
  "fingerprint": "<hash>",
  "occurrences": 47,
  "current_status": "in_progress",
  "message": "This is a known issue being worked on. Your report helps prioritize the fix."
}
```

When the fingerprint is new (no match):
```json
{
  "report_id": "<uuid>",
  "status": "received",
  "is_duplicate": false,
  "fingerprint": "<hash>",
  "tracking_url": "https://errors.cleanlanguage.dev/report/<report_id>",
  "message": "Thank you for reporting. This is a new issue and has been logged."
}
```

## Implementation

In the POST /api/v1/reports handler, after computing the fingerprint and checking `error_fingerprints`:

```
IF fingerprint EXISTS in error_fingerprints:
    IF status = 'resolved':
        - Still increment occurrence_count and update last_seen_at (tracks regression signals)
        - Still insert into error_reports (for analytics)
        - Return 200 with "already_fixed" response including fix details
    ELSE:
        - Increment occurrence_count, update last_seen_at
        - Insert into error_reports
        - Return 200 with "known" response
ELSE:
    - Insert new fingerprint
    - Insert error_report
    - Calculate priority
    - Return 201 with "received" response
```

## Why This Matters

This creates an instant feedback loop:
1. User/AI writes code that triggers a known (fixed) bug
2. Compiler reports it
3. Server instantly says "fixed in v0.30.27, upgrade"
4. Compiler shows the message
5. User upgrades and the problem is gone — zero wasted time

Without this, the user either:
- Writes workaround code (bad)
- Waits for someone to manually tell them about the fix (slow)
- Remembers to call check_reported_fixes (unlikely)

## Files to Modify

- `app/server/main.cln` (or wherever the POST /reports handler is) — enhance the response logic based on fingerprint status
