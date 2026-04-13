Component: Web Site Clean
Issue Type: enhancement
Priority: critical
Source Component: clean-language-compiler
Description: Redesign the error reporting API to minimize round trips between compiler clients and the server. Every call sends everything the sender knows and returns everything the receiver needs. No follow-up calls. This replaces the current chatty per-report status checks with batch operations.

## Design Principles

1. **One call per operation** — batch everything, never N calls for N bugs
2. **Self-contained responses** — include all related data so no follow-up is needed
3. **Client verifies fixes** — the AI/compiler tests reproductions locally and reports results; the server never decides if a bug is fixed
4. **Adjacent data** — when returning status, also return other useful info (e.g., fixes since the client's version)

## Endpoints

### 1. POST /api/v1/reports (submit bug) — ENHANCED

**Already exists. Enhance the response based on fingerprint matching.**

Request body: unchanged (error_code, component, severity, message, compiler_version, minimal_repro, ai_analysis, etc.)

Response logic:
```
1. Compute fingerprint from error_code + component + major.minor + normalized message
2. Look up fingerprint in error_fingerprints table
3. IF fingerprint EXISTS AND status = 'resolved':
     - Still insert into error_reports (tracks regression signals)
     - Still increment occurrence_count + update last_seen_at
     - Return 200 with status: "already_fixed"
4. IF fingerprint EXISTS AND status != 'resolved':
     - Insert into error_reports
     - Increment occurrence_count + update last_seen_at
     - Return 200 with status: "known"
5. IF fingerprint NOT FOUND:
     - Insert new fingerprint + error_report
     - Calculate priority score
     - Return 201 with status: "received"
6. ALWAYS: query other resolved fingerprints for same component
   WHERE fixed_in_version > request.compiler_version
   Include as "other_fixes_since" array (max 10)
```

Response for "already_fixed":
```json
{
  "report_id": "<uuid>",
  "fingerprint": "<hash>",
  "status": "already_fixed",
  "fixed_in_version": "0.30.27",
  "fix_description": "Plugin manifests stored in registry, auto-derive dot-notation aliases",
  "fix_commit": "d976d84",
  "verified_by_count": 3,
  "message": "This bug was fixed in v0.30.27. Update your compiler: cleen install latest",
  "upgrade_command": "cleen install latest",
  "other_fixes_since": [
    {"error_code": "SYN001", "fixed_in": "0.30.25", "description": "iterate syntax fixed"}
  ]
}
```

Response for "known":
```json
{
  "report_id": "<uuid>",
  "fingerprint": "<hash>",
  "status": "known",
  "occurrences": 47,
  "unique_users": 12,
  "priority_score": 85.0,
  "current_status": "open",
  "message": "This is a known issue. Your report helps prioritize the fix.",
  "other_fixes_since": []
}
```

Response for "received":
```json
{
  "report_id": "<uuid>",
  "fingerprint": "<hash>",
  "status": "received",
  "tracking_url": "https://errors.cleanlanguage.dev/report/<report_id>",
  "message": "New issue logged. Thank you for reporting.",
  "other_fixes_since": []
}
```

---

### 2. GET /api/v1/bugs?component=compiler&status=open (pull bugs to fix) — NEW

**Returns ALL open bugs for a component with full reproduction details in one call.**

Query parameters:
- `component` (required): compiler, framework, server, extension, etc.
- `status` (optional): open, in_progress, acknowledged (default: open)
- `limit` (optional): max results (default: 50)

Response:
```json
{
  "bugs": [
    {
      "fingerprint": "abc123...",
      "error_code": "COM001",
      "component": "codegen",
      "severity": "bug",
      "canonical_message": "Function 'http.respond' not found in function map",
      "minimal_repro": "plugins:\n\tframe.httpserver\n\nfunctions:\n\tstring test()\n\t\treturn http.respond(200, \"text/plain\", \"ok\")",
      "expected_behavior": "Should compile to WASM with http.respond import",
      "actual_behavior": "Codegen error: function not found in function map",
      "occurrences": 12,
      "unique_users": 5,
      "priority_score": 85.0,
      "first_seen": "2026-03-26T15:42:57Z",
      "last_seen": "2026-03-31T20:00:00Z",
      "first_reported_version": "0.30.23",
      "ai_suggested_fix": "Check language_to_bridge_map() — manifests may not be loaded",
      "ai_confidence": "high",
      "report_ids": ["e06a5dc6-...", "3828addc-..."]
    }
  ],
  "total": 5,
  "component": "compiler",
  "status_filter": "open"
}
```

SQL for this endpoint:
```sql
SELECT
  ef.fingerprint,
  ef.error_code,
  ef.error_component as component,
  er_first.error_severity as severity,
  ef.canonical_message,
  -- Get best minimal_repro from reports (prefer non-null, most recent)
  (SELECT er2.minimal_code FROM error_reports er2
   WHERE er2.fingerprint = ef.fingerprint AND er2.minimal_code IS NOT NULL
   ORDER BY er2.created_at DESC LIMIT 1) as minimal_repro,
  (SELECT er2.expected_behavior FROM error_reports er2
   WHERE er2.fingerprint = ef.fingerprint AND er2.expected_behavior IS NOT NULL
   ORDER BY er2.created_at DESC LIMIT 1) as expected_behavior,
  (SELECT er2.actual_behavior FROM error_reports er2
   WHERE er2.fingerprint = ef.fingerprint AND er2.actual_behavior IS NOT NULL
   ORDER BY er2.created_at DESC LIMIT 1) as actual_behavior,
  ef.occurrence_count as occurrences,
  ef.unique_users,
  ef.priority_score,
  ef.first_seen_at as first_seen,
  ef.last_seen_at as last_seen,
  -- Get first reported version
  (SELECT MIN(er3.compiler_version) FROM error_reports er3
   WHERE er3.fingerprint = ef.fingerprint) as first_reported_version,
  -- Get best AI analysis
  (SELECT er4.ai_analysis FROM error_reports er4
   WHERE er4.fingerprint = ef.fingerprint AND er4.ai_analysis IS NOT NULL
   ORDER BY er4.created_at DESC LIMIT 1) as ai_suggested_fix,
  (SELECT er4.ai_confidence FROM error_reports er4
   WHERE er4.fingerprint = ef.fingerprint AND er4.ai_confidence IS NOT NULL
   ORDER BY er4.created_at DESC LIMIT 1) as ai_confidence
FROM error_fingerprints ef
JOIN error_reports er_first ON er_first.fingerprint = ef.fingerprint
WHERE ef.error_component = ?
  AND ef.status = ?
GROUP BY ef.fingerprint
ORDER BY ef.priority_score DESC
LIMIT ?
```

---

### 3. POST /api/v1/reports/check (batch status check + verification) — NEW

**Replaces per-report GET /reports/status. One call for all reports: check status AND send verification results.**

Request:
```json
{
  "compiler_version": "0.30.28",
  "reports": [
    {
      "report_id": "e06a5dc6-...",
      "verified": "fixed",
      "verification_details": "Minimal reproduction compiles successfully in v0.30.28"
    },
    {
      "report_id": "f4f346d7-...",
      "verified": "fixed",
      "verification_details": "iterate syntax now parses correctly"
    },
    {
      "report_id": "3828addc-..."
    }
  ]
}
```

Fields per report:
- `report_id` (required): the report to check/verify
- `verified` (optional): "fixed" | "still_broken" | omit if just checking
- `verification_details` (optional): human/AI description of verification result

Server logic:
```
FOR EACH report in request.reports:
  1. Look up report_id in error_reports → get fingerprint
  2. Look up fingerprint in error_fingerprints → get current status

  IF report.verified == "fixed":
    - Update error_fingerprints SET status = 'resolved',
      fixed_in_version = request.compiler_version,
      fix_description = report.verification_details,
      resolved_at = NOW(),
      resolved_by = 'client_verified'
    - Return status: "resolved" with details

  ELSE IF report.verified == "still_broken":
    - If fingerprint was 'resolved', change back to 'open' (regression!)
    - Increment occurrence_count
    - Return status: "regression" or "open"

  ELSE (just checking):
    - Return current status from error_fingerprints
```

Response:
```json
{
  "results": [
    {
      "report_id": "e06a5dc6-...",
      "status": "resolved",
      "verified_in": "0.30.28",
      "message": "Verified as fixed. Thank you!"
    },
    {
      "report_id": "f4f346d7-...",
      "status": "resolved",
      "verified_in": "0.30.28",
      "message": "Verified as fixed. Thank you!"
    },
    {
      "report_id": "3828addc-...",
      "status": "open",
      "occurrences": 5,
      "priority_score": 60.0
    }
  ],
  "summary": {
    "total": 3,
    "resolved": 2,
    "still_open": 1,
    "regressions": 0
  }
}
```

---

### 4. GET /api/v1/fixes?since=0.30.23 (fixes feed) — EXISTS, ENHANCE

**Already specified in phases 2-6 prompt. Enhance with more detail.**

Response:
```json
{
  "fixes": [
    {
      "fingerprint": "abc...",
      "error_code": "SYN001",
      "component": "parser",
      "fixed_in": "0.30.25",
      "description": "iterate syntax fixed in parser",
      "total_reports": 12,
      "verified_by_count": 3
    },
    {
      "fingerprint": "def...",
      "error_code": "COM001",
      "component": "codegen",
      "fixed_in": "0.30.27",
      "description": "dot-notation plugin aliases auto-derived from bridge functions",
      "total_reports": 47,
      "verified_by_count": 5
    }
  ],
  "since_version": "0.30.23",
  "latest_version": "0.30.28",
  "total_fixes": 2,
  "upgrade_command": "cleen install latest"
}
```

---

## Deprecation

The following endpoint is superseded by `POST /reports/check`:
- `GET /api/v1/reports/status?id=<report_id>` — keep for backwards compatibility but mark as deprecated in docs

---

## Database Changes

### New column for client verification tracking
```sql
ALTER TABLE error_fingerprints
  ADD COLUMN verified_by_count INT NOT NULL DEFAULT 0,
  ADD COLUMN verified_in_version VARCHAR(20) DEFAULT NULL;
```

### New table for verification audit trail
```sql
CREATE TABLE error_verifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  fingerprint VARCHAR(64) NOT NULL,
  report_id VARCHAR(36) NOT NULL,
  compiler_version VARCHAR(20) NOT NULL,
  result ENUM('fixed', 'still_broken') NOT NULL,
  details TEXT,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_fingerprint (fingerprint),
  INDEX idx_report (report_id)
);
```

When a client verifies "fixed":
1. Insert into error_verifications
2. Increment verified_by_count in error_fingerprints
3. If verified_by_count reaches threshold (e.g., 1 for now), mark as resolved

When a client verifies "still_broken" on a resolved fingerprint:
1. Insert into error_verifications
2. Reset status to 'open' (regression detected)
3. Reset verified_by_count to 0
4. Post to Discord alerts if configured

---

## Round Trip Comparison

| Operation | Before | After |
|-----------|--------|-------|
| Submit 1 bug | 1 call | 1 call (richer response) |
| Check 5 bug statuses | 5 calls | 1 call |
| Verify 3 fixes | 3 status checks + 3 verify calls = 6 | 1 call |
| Pull bugs for component | N/A (didn't exist) | 1 call |
| Session-start fix feed | 1 call | 1 call (richer response) |
| **Total for typical session** | **~12 calls** | **~3 calls** |

---

## Files to Modify

1. `app/server/main.cln` — add new routes, enhance POST /reports response
2. Database — ALTER TABLE + CREATE TABLE for verification tracking
3. Deprecate but keep GET /reports/status for backwards compat

## Implementation Order

1. Enhance POST /reports response (fingerprint-aware)
2. Add POST /reports/check (batch status + verification)
3. Add GET /bugs endpoint
4. Enhance GET /fixes response
5. Add error_verifications table
