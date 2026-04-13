# Cross-Component Prompt: Error Reporting Backend — Phases 2-6

**Component:** Web Site Clean
**Issue Type:** feature
**Priority:** high
**Source Component:** clean-language-compiler (telemetry module)
**Specification:** `system-documents/ERROR_REPORTING_SPECIFICATION.md`

---

## Context

Phase 1 (compiler-side) is complete. The live API at `https://errors.cleanlanguage.dev` already handles:
- `POST /api/v1/reports` — receives error reports
- `GET /api/v1/reports/status?id=<report_id>` — returns report status
- `GET /api/v1/reports/health` — health check

The compiler now also sends an optional `user.contact` email field with reports (when the user provides one). This prompt covers everything remaining: resolution API, email notifications, Discord integration, GitHub issues, dashboard, and analytics.

---

## Phase 2: Resolution API & Email Notifications

### New Routes

```
POST /api/v1/fingerprints/<fingerprint>/resolve
GET  /api/v1/fixes?since=<version>
```

### POST /api/v1/fingerprints/:fp/resolve

Used by the team (or CI) to mark an error as fixed. Protected by a simple API key in the `Authorization` header.

```
Handler logic:
1. Check Authorization header matches the configured API key
   - If missing/wrong: return 401 {"error": "unauthorized"}
2. Parse JSON body:
   {
     "fixed_in_version": "0.16.0",
     "fix_description": "Parser now handles nested generics",
     "fix_commit": "abc123",
     "fix_pr": "#247",
     "resolved_by": "team"
   }
3. Find the fingerprint in error_fingerprints table
   - If not found: return 404 {"error": "fingerprint_not_found"}
4. Update error_fingerprints:
   - status = 'resolved'
   - fixed_in_version, fix_description, fix_commit, fix_pr = from body
   - resolved_at = NOW()
   - resolved_by = from body
5. Send email notifications (see below)
6. Return 200 {"status": "resolved", "fingerprint": "<fp>"}
```

### GET /api/v1/fixes?since=version

Returns all errors fixed since a given compiler version.

```
Handler logic:
1. Get 'since' query parameter
2. Query error_fingerprints WHERE status = 'resolved'
   AND there exist reports in error_reports with compiler_version <= since
3. Return JSON:
   {
     "fixes": [
       {
         "fingerprint": "abc123",
         "error_code": "SYN042",
         "fixed_in_version": "0.16.0",
         "fix_description": "...",
         "total_reports": 47
       }
     ],
     "since_version": "0.15.0",
     "latest_version": "<current version from config>"
   }
```

### Email Notifications

When a fingerprint is resolved (step 5 above), send emails to users who reported it:

```
Handler logic:
1. Query error_reports WHERE fingerprint = <resolved_fingerprint>
   AND user_contact IS NOT NULL AND user_contact != ''
2. Deduplicate by email address
3. For each unique email, send:

   Subject: Your reported bug has been fixed — Clean Language {fixed_in_version}

   Body:
   Good news! A bug you reported has been fixed.

   Error:       {error_code} — {canonical_message}
   Fixed in:    {fixed_in_version}
   Description: {fix_description}

   Update your compiler to get the fix:
     cleen install latest

   Thank you for helping improve Clean Language!

   ---
   You received this because you provided your email when reporting a compiler error.
   To stop receiving these, run: cln config set email clear
```

Use whatever email sending method is available on the server (SMTP, API like Resend/Postmark, or shell `mail` command). Keep it simple — one transactional email per resolved fingerprint per user.

### Database Changes

Add a column to `error_reports` if not already present:
```sql
-- The user.contact field from the compiler's report JSON
-- Already stored via the POST /reports handler — just ensure it's being saved
-- from the JSON body: report.user.contact → error_reports.user_contact
ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS user_contact VARCHAR(255) DEFAULT NULL;
```

Ensure the `POST /api/v1/reports` handler saves `user.contact` from the JSON body into the `user_contact` column.

---

## Phase 3: Discord Integration

### Setup

Add a Discord webhook URL to the server configuration (environment variable or config file):
```
DISCORD_WEBHOOK_BUGS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_STATS=https://discord.com/api/webhooks/...
```

### When to Post

**On new fingerprint** (during POST /reports, when a fingerprint is inserted for the first time):

Post to the bugs webhook:
```
New Error Report
━━━━━━━━━━━━━━━━━━━
Code:      {error_code}
Component: {error_component}
Severity:  {error_severity}
Version:   {compiler_version}

Message:
{error_message}

Report ID: {report_id (first 8 chars)}
Dashboard: https://errors.cleanlanguage.dev/report/{report_id}
```

**On duplicate milestones** (5, 10, 25, 50, 100 occurrences):

Post to the bugs webhook:
```
Error {error_code} — {occurrence_count} reports from {unique_users} users
Component: {component} | Version: {version range}
Priority score: {priority_score}
```

**On high priority** (priority_score > 100):

Post to the alerts webhook:
```
HIGH PRIORITY: {error_code} — {canonical_message}
Priority: {priority_score} | Reports: {occurrence_count} | Users: {unique_users}
```

**On resolution** (during POST /fingerprints/:fp/resolve):

Post to the bugs webhook:
```
RESOLVED: {error_code} — {canonical_message}
Fixed in:    {fixed_in_version}
PR:          {fix_pr}
Reports:     {occurrence_count} from {unique_users} users
```

### Daily Summary

Add a cron job or scheduled task that runs daily at 09:00 UTC. It queries the last 24 hours of data and posts to the stats webhook:

```
Daily Error Report — {date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

New reports:    {count}
New errors:     {new fingerprints count}
Duplicates:     {duplicate count}
Resolved:       {resolved count}

Top errors:
  1. {code} — {message} ({reports} reports, {users} users)
  2. ...
  3. ...
```

---

## Phase 3b: GitHub Issues Integration

### Auto-Creation Rules

When processing a new report in `POST /api/v1/reports`:

| Condition | Action |
|-----------|--------|
| New fingerprint with severity "crash" | Create issue immediately |
| Fingerprint reaches 10 unique users | Create issue with "[Community]" label |
| AI confidence is "high" with suggested fix | Create issue with "[AI-Suggested]" label |

### How to Create Issues

Use the GitHub API (`https://api.github.com/repos/Ivan-Pasco/clean-language-compiler/issues`) with a GitHub personal access token stored as an environment variable.

Issue body template:
```markdown
## Error Report: {error_code}

**Component:** {component}
**Severity:** {severity}
**Compiler Version:** {compiler_version}
**Reports:** {occurrence_count} from {unique_users} users
**Priority Score:** {priority_score}

### Description

{error_message}

### Minimal Reproduction

```cln
{minimal_repro_code or "Not available"}
```

### AI Analysis

{ai_analysis or "Not available"}

### Metadata

- Fingerprint: {fingerprint}
- Dashboard: https://errors.cleanlanguage.dev/fingerprint/{fingerprint}

---
*Auto-generated from community error reports*
```

### Auto-Resolve on Issue Close

Add a GitHub webhook endpoint:
```
POST /api/v1/github/webhook
```

When a linked issue is closed:
1. Find the fingerprint linked to that issue
2. Extract the fix version from the closing PR (if available)
3. Call the resolve logic (same as POST /fingerprints/:fp/resolve)

Store the GitHub issue number in a new column:
```sql
ALTER TABLE error_fingerprints ADD COLUMN github_issue_number INT DEFAULT NULL;
ALTER TABLE error_fingerprints ADD COLUMN github_issue_url VARCHAR(255) DEFAULT NULL;
```

### CI Commit Parsing

When the CI webhook fires (or as part of the GitHub webhook handler), check commit messages for:
```
Fixes-Error: SYN042
Fingerprint: abc123def456
```

If found, auto-resolve the fingerprint with the commit SHA and PR URL.

---

## Phase 4: Dashboard

Add web pages to the website for viewing and managing error reports. These are HTML pages served by the same Clean Language website backend.

### Routes

```
GET /errors              → Overview page
GET /errors/component    → Filtered by component
GET /errors/:fingerprint → Error detail page
GET /report/:report_id   → Single report redirect to fingerprint view
```

### Overview Page (`/errors`)

Display:
- Total reports count
- New errors this week
- Top 10 errors by priority score (table: code, component, message, reports, users, status)
- Resolution rate (% of fingerprints resolved)
- Component breakdown (pie/bar chart or simple table)

Each row links to the detail page.

### Error Detail Page (`/errors/:fingerprint`)

Display:
- Error code, component, severity, canonical message
- Occurrence count, unique users, first seen, last seen
- Priority score
- Status (with color: open=red, in_progress=yellow, resolved=green)
- Fix info if resolved (version, PR link, description)
- List of individual reports (report_id, version, timestamp)
- AI analysis if available (from the highest-confidence report)
- Minimal reproduction code if available

### Resolution Controls

Add a form on the detail page (protected by the same API key or a simple password):
- "Mark as Resolved" button
- Fields: fix_version, fix_description, fix_pr, fix_commit
- Submits to `POST /api/v1/fingerprints/:fp/resolve`

### Filtering

Support query parameters:
- `?component=parser` — filter by component
- `?status=open` — filter by status
- `?severity=crash` — filter by severity
- `?version=0.30.0` — filter by compiler version

---

## Phase 6: Analytics

### Regression Detection

When a new report comes in for a fingerprint that was previously resolved:
1. Check if `error_fingerprints.status = 'resolved'`
2. If yes, change status to `'open'` and add a `regression` flag
3. Post to Discord alerts: "REGRESSION: {error_code} has reappeared in {compiler_version}"
4. If a GitHub issue exists, reopen it with a comment

### Version Comparison

Add an endpoint:
```
GET /api/v1/analytics/versions?from=0.29.0&to=0.30.0
```

Returns:
```json
{
  "from": "0.29.0",
  "to": "0.30.0",
  "new_errors": 5,
  "fixed_errors": 12,
  "regression_errors": 1,
  "total_reports_from": 150,
  "total_reports_to": 80
}
```

### AI Suggestion Accuracy

Track how often AI-suggested fixes match the actual fix:
```sql
ALTER TABLE error_fingerprints ADD COLUMN ai_suggestion_matched BOOLEAN DEFAULT NULL;
```

When resolving, optionally compare `ai_suggested_fix` from the report with `fix_description`. This can be manual (team checks a box on the dashboard) or automated later.

---

## Implementation Order

1. **Resolution API** — `POST /fingerprints/:fp/resolve` + `GET /fixes?since=`
2. **Email notifications** — on resolve, send to users who reported
3. **Discord webhooks** — new fingerprint, milestones, alerts, resolutions
4. **GitHub issues** — auto-create, webhook for auto-close
5. **Dashboard pages** — overview, detail, resolution controls
6. **Daily summary cron** — post stats to Discord
7. **Analytics** — regression detection, version comparison

---

## Environment Variables Needed

```
# API key for resolution endpoints (generate a random string)
ERROR_API_KEY=<random-secret>

# Discord webhooks
DISCORD_WEBHOOK_BUGS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_STATS=https://discord.com/api/webhooks/...

# GitHub integration
GITHUB_TOKEN=<personal-access-token>
GITHUB_REPO=Ivan-Pasco/clean-language-compiler
GITHUB_WEBHOOK_SECRET=<random-secret>

# Email (choose one method)
SMTP_HOST=smtp.example.com
SMTP_USER=errors@cleanlanguage.dev
SMTP_PASS=<password>
# OR use an email API service
EMAIL_API_KEY=<resend-or-postmark-key>
```

---

## Testing

```bash
# Test resolution API
curl -X POST "https://errors.cleanlanguage.dev/api/v1/fingerprints/b472537ec46b6f6cd84dea78810f4d33e04dd30345613660b25503640a768d27/resolve" \
  -H "Authorization: Bearer <ERROR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"fixed_in_version": "0.31.0", "fix_description": "Test resolution", "resolved_by": "team"}'

# Test fixes endpoint
curl "https://errors.cleanlanguage.dev/api/v1/fixes?since=0.30.0"

# Test dashboard
open https://errors.cleanlanguage.dev/errors

# Test from compiler
cln fixes
```
