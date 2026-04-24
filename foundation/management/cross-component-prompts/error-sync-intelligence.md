# Error Sync Intelligence — Server-Side Guidance for Local-Only Errors

## Component
Cross-component (MCP Server + Website API)

## Problem

When an AI instance calls `check_reported_fixes`, it gets back a mix of:
1. Reports that were successfully uploaded and have server-side status
2. Reports that **never uploaded** (fingerprint: null) and exist only locally
3. Reports the server already resolved but the local store doesn't know about

Each component's AI instance interprets this differently, leading to inconsistent answers about "how many errors are open."

## Developer Profiles

| Profile | Tools Available | What They See |
|---------|----------------|---------------|
| **Team developer** (has `~/.cleen/error-api-key`) | `/errors` skill, `check_reported_fixes`, `report_error`, dashboard API | Full dashboard view + local sync status |
| **Language developer** (external user, no API key) | `check_reported_fixes`, `report_error` only | Status of their own reports only |

The `/errors` skill is **team-only** — it is not distributed to external users. External developers interact with the error system exclusively through the MCP tools built into the compiler (`report_error` to submit, `check_reported_fixes` to poll their own reports).

The MCP server should detect external users (no API key) and guide them to publish local errors when they call `check_reported_fixes` repeatedly without resolution. This is the "server-side intelligence" — not a separate tool, but smarter responses from the existing MCP tool.

## Design: Server-Aware Local Telemetry

### Concept

The `check_reported_fixes` MCP tool should become **sync-aware**. Instead of just listing pending reports, it should:

1. **Categorize** reports by sync state
2. **Guide** the AI instance on what to do with each category
3. **Detect patterns** (e.g., repeated checks without uploads) and suggest action

### Response Schema (Enhanced)

Current response:
```json
{
  "fixes": [],
  "pending": [...],
  "open_bugs_for_component": [...]
}
```

Proposed response:
```json
{
  "server_status": {
    "open": 2,
    "resolved": 28,
    "total": 30
  },
  "local_status": {
    "total": 199,
    "synced": 12,
    "orphaned": 187,
    "stale_resolved": 5
  },
  "categories": {
    "server_open": [...],
    "server_resolved_local_pending": [...],
    "local_only_never_uploaded": [...],
    "local_resolved": [...]
  },
  "guidance": [
    {
      "type": "orphaned_reports",
      "severity": "warning",
      "message": "187 local reports were never uploaded to the server. They exist only on this machine. Consider re-submitting important ones via report_error or clearing stale entries.",
      "action": "review_and_resubmit"
    },
    {
      "type": "stale_local_status",
      "severity": "info",
      "message": "5 reports are resolved on the server but still show as pending locally. Run /errors sync to update.",
      "action": "sync"
    }
  ],
  "fixes": [...],
  "pending": [...],
  "open_bugs_for_component": [...]
}
```

### Detection Patterns

The MCP server should track call frequency in a lightweight local file (`~/.cleen/telemetry/check_history.json`):

```json
{
  "checks": [
    {"timestamp": "2026-04-17T20:00:00Z", "component": "compiler", "orphaned_count": 187},
    {"timestamp": "2026-04-17T20:30:00Z", "component": "compiler", "orphaned_count": 187}
  ]
}
```

**Pattern: Repeated checks without resolution**
If `orphaned_count` hasn't decreased over 3+ checks, add guidance:
> "You've checked 3 times but 187 local reports remain orphaned. These were never published to the dashboard. The dashboard cannot track what it doesn't know about. Would you like to /errors sync to reconcile?"

**Pattern: High orphan ratio**
If orphaned > 80% of total local reports, add guidance:
> "93% of your local error reports never reached the server. This suggests the upload path is broken. Check network connectivity to errors.cleanlanguage.dev and rate-limit status in ~/.cleen/telemetry/retry_after."

**Pattern: Component mismatch**
If the AI is checking component X but most orphaned reports are for component Y, note:
> "Most orphaned reports (45) are for component 'compiler', not 'server'. The compiler instance should handle those."

### Implementation Plan

#### Phase 1: MCP Server Enhancement (clean-language-compiler)

File: `src/mcp/server.rs` — `check_reported_fixes` handler

1. After loading local store, categorize reports:
   - `synced`: has fingerprint AND status matches server
   - `orphaned`: no fingerprint (never uploaded)
   - `stale`: server says resolved, local says pending
2. Add `local_status` and `guidance` fields to response
3. Track check history in `~/.cleen/telemetry/check_history.json`

#### Phase 2: Upload Retry (clean-language-compiler)

File: `src/telemetry/submit.rs`

1. On `check_reported_fixes`, attempt to re-upload orphaned reports (up to 5 per call)
2. Respect rate limits from `~/.cleen/telemetry/retry_after`
3. Update fingerprint on successful upload

#### Phase 3: Server API Enhancement (Website)

File: `Web Site Clean/app/server/errors_api.cln`

1. Add `GET /api/v1/status/summary` — returns open/resolved counts without auth
2. Add batch status check: `POST /api/v1/reports/status` with array of report_ids
3. Return resolved status + fix metadata for each known report

### Integration with /errors Skill

The `/errors` skill already handles the cross-referencing logic. Once the MCP tool returns categorized data, the skill can present it directly without needing to do its own local store parsing.

### Migration Path

1. The enhanced `check_reported_fixes` response is **backwards-compatible** — new fields are additive
2. Existing AI instances that don't understand the new fields will ignore them
3. AI instances that know about `/errors` will use the richer data

## Files Affected

| Component | File | Change |
|-----------|------|--------|
| Compiler (MCP) | `src/mcp/server.rs` | Enhanced check_reported_fixes response |
| Compiler (Telemetry) | `src/telemetry/submit.rs` | Orphan retry on check |
| Compiler (Telemetry) | `src/telemetry/report.rs` | Check history tracking |
| Website | `app/server/errors_api.cln` | Status summary + batch status endpoints |
| Shared | `.claude/skills/errors/SKILL.md` | Already created |
