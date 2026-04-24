# Cross-Component Prompt: Error Reporting API for Web Site Clean

**Component:** Web Site Clean
**Issue Type:** feature
**Priority:** high
**Source Component:** clean-language-compiler (telemetry module)
**Specification:** `system-documents/ERROR_REPORTING_SPECIFICATION.md`

---

## Context

The Clean Language compiler now has a complete client-side error reporting system (`src/telemetry/`). When users encounter compiler bugs, the system can generate structured error reports via MCP tools or CLI commands. Reports are currently queued locally in `~/.cleen/telemetry/pending_reports/` because no backend exists yet.

The compiler sends HTTP requests to `https://errors.cleanlanguage.dev/api/v1`. The decision is to add the error reporting API routes to the existing **Web Site Clean** backend, which already has `frame.httpserver` and `frame.data` plugins.

---

## What to Implement

Add error reporting API routes to `app/server/main.cln`. The API handles three things:
1. Receive error reports from compilers in the field
2. Return status of reported errors (for fix notifications)
3. Health check for the error reporting subsystem

### New Routes to Add

Add these routes to `main.cln` after the existing routes:

```
s = _http_route("POST", "/api/v1/reports", <handler_index>)
s = _http_route("GET", "/api/v1/reports/status", <handler_index>)
s = _http_route("GET", "/api/v1/reports/health", <handler_index>)
```

### Database Schema

Create these tables in the MySQL database (same database as the website):

```sql
-- Error reports received from compilers
CREATE TABLE error_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(36) NOT NULL UNIQUE,
    schema_version VARCHAR(10) NOT NULL DEFAULT '1.0.0',
    fingerprint VARCHAR(64) NOT NULL,

    -- Source info
    channel VARCHAR(20) NOT NULL,          -- mcp_ai, cli_telemetry, manual
    compiler_version VARCHAR(20) NOT NULL,
    os VARCHAR(20),
    arch VARCHAR(20),
    runtime VARCHAR(20),

    -- Error info
    error_code VARCHAR(20) NOT NULL,
    error_category VARCHAR(20) NOT NULL,   -- syntax, semantic, codegen, runtime, system
    error_component VARCHAR(20) NOT NULL,  -- parser, semantic, codegen, runtime, plugin
    error_severity VARCHAR(30) NOT NULL,   -- bug, crash, regression, unexpected_behavior
    error_message TEXT NOT NULL,
    file_context VARCHAR(255),

    -- Reproduction (optional)
    minimal_code TEXT,
    expected_behavior TEXT,
    actual_behavior TEXT,
    spec_reference VARCHAR(255),

    -- AI context (optional, MCP channel only)
    ai_analysis TEXT,
    ai_suggested_component VARCHAR(255),
    ai_suggested_fix TEXT,
    ai_confidence VARCHAR(10),

    -- User info
    user_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
    user_contact VARCHAR(255),
    consent_level VARCHAR(20) NOT NULL DEFAULT 'error_only',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_fingerprint (fingerprint),
    INDEX idx_error_code (error_code),
    INDEX idx_component (error_component),
    INDEX idx_created_at (created_at),
    INDEX idx_compiler_version (compiler_version)
);

-- Deduplicated error fingerprints with resolution tracking
CREATE TABLE error_fingerprints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL UNIQUE,
    error_code VARCHAR(20) NOT NULL,
    error_component VARCHAR(20) NOT NULL,
    canonical_message TEXT NOT NULL,

    -- Occurrence tracking
    occurrence_count INT NOT NULL DEFAULT 1,
    unique_users INT NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Resolution tracking
    status ENUM('open', 'acknowledged', 'in_progress', 'resolved', 'wont_fix') NOT NULL DEFAULT 'open',
    priority_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    fixed_in_version VARCHAR(20),
    fix_description TEXT,
    fix_commit VARCHAR(40),
    fix_pr VARCHAR(255),
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(100),

    INDEX idx_status (status),
    INDEX idx_priority (priority_score DESC),
    INDEX idx_error_code (error_code)
);

-- Rate limiting tracking
CREATE TABLE report_rate_limits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(64) NOT NULL,          -- IP or anonymous_id
    identifier_type ENUM('ip', 'anonymous_id') NOT NULL,
    report_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_identifier (identifier, identifier_type, window_start)
);
```

### Route Handler: POST /api/v1/reports

This is the main ingestion endpoint. The compiler sends a JSON body matching the ErrorReport schema from the spec (Section 3.1).

```
Handler logic:
1. Parse JSON body from request
2. Rate limit check:
   - Per IP: max 10 reports per hour
   - If over limit: return 429 with {"error": "rate_limited", "retry_after": <seconds>}
3. Generate fingerprint:
   - SHA256(error_code + component + major.minor version + lowercase error_message)
   - Strip line/column numbers and file paths from message before hashing
4. Check if fingerprint exists in error_fingerprints table:
   - If exists: increment occurrence_count, update last_seen_at
     - Return 200 with {"report_id": "...", "status": "duplicate", "occurrences": N}
   - If new: insert into error_fingerprints
5. Insert full report into error_reports table
6. Calculate priority score:
   priority = occurrence_count * 1.0 + unique_users * 5.0 + severity_weight
   (severity_weight: crash=100, bug=50, regression=75, unexpected=25)
7. Update priority_score in error_fingerprints
8. Return 201 with:
   {
     "report_id": "<uuid>",
     "status": "received",
     "is_duplicate": false,
     "fingerprint": "<hash>",
     "tracking_url": "https://errors.cleanlanguage.dev/report/<report_id>"
   }
```

### Route Handler: GET /api/v1/reports/status

The compiler calls this to check if reported bugs have been fixed. It sends report IDs as a query parameter.

```
Handler logic:
1. Get report_id from query parameter: ?id=<report_id>
2. Look up the report in error_reports by report_id
3. Join with error_fingerprints on fingerprint
4. Return JSON:
   {
     "report_id": "...",
     "status": "open|acknowledged|in_progress|resolved|wont_fix",
     "fixed_in_version": "0.16.0" or null,
     "fix_description": "Fixed bracket depth tracking" or null,
     "fix_commit": "abc123" or null,
     "fix_pr": "#247" or null,
     "resolved_at": "2026-02-20T10:00:00Z" or null,
     "message": "Your reported bug has been fixed in version 0.16.0!" or null
   }
5. If report_id not found: return 404 with {"error": "not_found"}
```

### Route Handler: GET /api/v1/reports/health

Simple health check for the error reporting subsystem.

```
Handler logic:
1. Run a simple query: SELECT COUNT(*) as total FROM error_reports
2. Return 200 with:
   {
     "ok": true,
     "service": "error-reporting",
     "total_reports": <count>
   }
```

---

## Important Notes

### Fingerprint Generation

Since Clean Language doesn't have a SHA256 built-in yet, you can use a simpler fingerprint approach for now:
- Concatenate: `error_code + "|" + component + "|" + major_minor_version + "|" + lowercase_message`
- Store this as the fingerprint string directly (up to 64 chars)
- When SHA256 becomes available as a host function, switch to proper hashing

### Rate Limiting

Use the `report_rate_limits` table. On each POST:
1. Check if there's a row for this IP in the current hour window
2. If count >= 10, reject with 429
3. Otherwise, insert or update the count

Clean up old rate limit rows periodically (or just let them accumulate — they're small).

### No Authentication Required

Error reports are anonymous by design. No API keys or auth tokens needed. Rate limiting by IP is sufficient protection.

### CORS Headers

The compiler uses `reqwest::blocking` for HTTP, not browser-based requests, so CORS isn't needed initially. If a web dashboard is added later, CORS can be added then.

### The Compiler Client

The compiler's HTTP client is in `clean-language-compiler/src/telemetry/submit.rs`. It:
- POSTs to `{API_BASE}/reports` with JSON body
- GETs from `{API_BASE}/reports/{report_id}/status`
- Has a 5-second timeout
- Falls back to local queue on any error

The `API_BASE` is currently `https://errors.cleanlanguage.dev/api/v1`. If the website runs on a different domain, update this constant in `submit.rs`.

**Note:** The GET endpoint in the compiler uses the path `/reports/{report_id}/status` with the report_id as a path segment. Since Clean Language routing may not support path parameters yet, the backend should use query parameters instead: `/api/v1/reports/status?id={report_id}`. If the compiler's submit.rs needs updating for this, create a cross-component prompt back to the compiler team.

---

## Files Affected

- `app/server/main.cln` — Add new routes and handler functions
- Database — Run CREATE TABLE statements
- Potentially `app/server/api/` — New file `errors.cln` if you want to keep route handlers organized

---

## Testing

1. After adding routes, compile and deploy the website
2. Test with curl:
   ```bash
   # Health check
   curl https://errors.cleanlanguage.dev/api/v1/reports/health

   # Submit a test report
   curl -X POST https://errors.cleanlanguage.dev/api/v1/reports \
     -H "Content-Type: application/json" \
     -d '{
       "schema_version": "1.0.0",
       "report_id": "test-001",
       "timestamp": "2026-02-18T00:00:00Z",
       "source": {
         "channel": "manual",
         "compiler_version": "0.30.0",
         "os": "darwin",
         "arch": "aarch64",
         "runtime": null
       },
       "error": {
         "code": "SYN042",
         "category": "syntax",
         "component": "parser",
         "severity": "bug",
         "message": "Nested generic types fail to parse",
         "file_context": null
       },
       "reproduction": null,
       "ai_context": null,
       "user": {
         "anonymous": true,
         "contact": null,
         "consent_level": "error_only"
       }
     }'

   # Check status
   curl "https://errors.cleanlanguage.dev/api/v1/reports/status?id=test-001"
   ```

3. Then test from the compiler:
   ```bash
   cln report --error-code SYN001 --message "Test error" --component parser
   ```

---

## Future Phases (Not in This Prompt)

These will come later as separate prompts:
- Discord webhook integration (POST to Discord on new fingerprints)
- GitHub issue auto-creation
- Web dashboard for browsing errors
- Resolution API (team marks errors as fixed)
- Daily summary cron job
