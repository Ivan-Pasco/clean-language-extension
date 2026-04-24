# Cross-Component Prompt: Update Error Reporting API Base URL

**Component:** clean-language-compiler
**Issue Type:** compatibility
**Priority:** medium
**Source Component:** Web Site Clean (error reporting API implementation)

---

## Context

The error reporting API has been implemented in the Clean Language website backend at `cleanlanguage.dev`. The API routes are:

- `POST /api/v1/reports` — Submit error reports
- `GET /api/v1/reports/status?id={report_id}` — Check report status
- `GET /api/v1/reports/health` — Health check

These routes are served by the existing website at `https://cleanlanguage.dev`, NOT at a separate `errors.cleanlanguage.dev` subdomain.

## Required Change

Update the `API_BASE` constant in `src/telemetry/submit.rs` from:
```
https://errors.cleanlanguage.dev/api/v1
```
to:
```
https://cleanlanguage.dev/api/v1
```

## Additional Note

The status endpoint uses query parameters instead of path parameters:
- Current compiler: `GET /reports/{report_id}/status` (path param)
- Backend implementation: `GET /reports/status?id={report_id}` (query param)

If the compiler's `submit.rs` uses `/reports/{report_id}/status`, update it to use `/reports/status?id={report_id}` instead.

## Files Affected

- `src/telemetry/submit.rs` — Update `API_BASE` constant and status endpoint URL format
