# Website — Add /api/v1/tasks (Team-Only Cross-Component Work Items)

## Component
`Web Site Clean/` (the website backend that owns `errors.cleanlanguage.dev`)

## Issue Type
feature

## Priority
Medium

## Background

See:
- `management/ERROR_REPORTING_WORKFLOW.md` — established that the server is the only source of truth for bug status.
- `management/cross-component-prompts/README.md` — current file-based system for cross-component work items.

We currently maintain two parallel systems for "things one component needs another component to do":

1. **Bugs** — runtime errors, reported via `report_error` MCP, tracked on the server, dashboard at errors.cleanlanguage.dev.
2. **Cross-component prompts** — refactors / features / design tasks, written as `.md` files in `management/cross-component-prompts/`, picked up by AI instances grepping for filename prefixes.

This is the same drift-prone anti-pattern we just eliminated for bug status: two stores, no single source of truth, prompts rot in the folder, no visibility, no dedup.

The fix is one server-side concept of "work item" with two subtypes: `bug` (runtime-discovered, open to all) and `task` (development-team-authored, team-only).

## What to Build

### Database

Add a `tasks` table (or extend the existing `bugs` table — implementation choice). Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | server-generated |
| `target_component` | text | enum from the prefix table in cross-component-prompts/README.md (compiler, framework, server, mcp, cleen, extension, ui, canvas, llm, cpanel, studio, website, spec) |
| `type` | text | enum: refactor, feature, bug, enhancement, compatibility |
| `priority` | text | enum: critical, high, medium, low |
| `title` | text | one-line summary |
| `body_md` | text | full markdown content (no length cap; tasks can be long design docs) |
| `status` | text | enum: open, in_progress, resolved, declined |
| `decision` | text | optional — populated when status=declined, explains why |
| `created_by` | text | API key reporter identity |
| `created_at` | timestamp | server-set |
| `accepted_at` | timestamp | nullable — when receiver moved to in_progress |
| `accepted_by` | text | nullable — receiver identity |
| `resolved_at` | timestamp | nullable |
| `resolved_by` | text | nullable |
| `resolution_commit` | text | nullable — git hash where the work shipped |

### Endpoints

All endpoints **require a valid team API key** (same `X-API-Key` header used by `/api/v1/bugs`). Reject requests without a valid key with `401`. **Do not allow anonymous or external-user access.** This is the key difference from the bug API: bugs are open for any compiler user to report; tasks are internal team coordination.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/tasks` | Create a new task. Body: target_component, type, priority, title, body_md. |
| `GET` | `/api/v1/tasks?target_component=X&status=Y` | List tasks, filterable by component and status. Returns array. |
| `GET` | `/api/v1/tasks/<id>` | Fetch one task with full body. |
| `PATCH` | `/api/v1/tasks/<id>/accept` | Mark in_progress, set accepted_at/accepted_by. |
| `PATCH` | `/api/v1/tasks/<id>/resolve` | Mark resolved. Body: resolution_commit, optional resolution_notes. |
| `PATCH` | `/api/v1/tasks/<id>/decline` | Mark declined. Body: decision (required, explains why). |

### Auth

- **Team API key required** for all endpoints (same key file `~/.cleen/error-api-key`).
- The same key gates `/api/v1/bugs` admin operations today; reuse that mechanism.
- The compiler's `report_error` MCP tool (used by external users) MUST NOT be able to call these endpoints. If the MCP server detects the user has no team key, the task tools (`report_task`, `list_tasks_for_component`, etc.) should not be exposed at all.

### Dashboard

Add a Tasks tab to the dashboard at `errors.cleanlanguage.dev`:
- Same look-and-feel as the Bugs tab.
- Default view: open tasks grouped by `target_component`, sorted by `priority` then `created_at`.
- Status filter chips: open / in_progress / resolved / declined.
- Click a task → full markdown render of `body_md`, plus history (created → accepted → resolved/declined timeline).
- Team-only access (gated by the same login that gates the admin dashboard).

## What MUST NOT Change

- The `/api/v1/bugs` endpoints stay exactly as they are — no schema changes, no breaking changes. External users keep reporting bugs as today.
- The team API key file location (`~/.cleen/error-api-key`) and header name (`X-API-Key`).
- The bug fingerprint algorithm or any bug behavior.

## Verification

After this ships:
1. `curl -X POST .../api/v1/tasks` without API key → 401.
2. `curl -X POST .../api/v1/tasks -H "X-API-Key: $TEAM_KEY" -d '{"target_component":"compiler","type":"refactor","priority":"medium","title":"Test","body_md":"# Test"}'` → 200 + task id.
3. `GET /api/v1/tasks?target_component=compiler&status=open` returns the task.
4. `PATCH .../resolve` moves it to resolved; subsequent open queries no longer return it.
5. The compiler's `report_error` MCP tool (no team key) cannot enumerate or create tasks.

## Follow-up Cross-Component Prompts

Once this endpoint exists, two follow-up prompts will be written:

1. **`mcp-server-add-task-tools.md`** — Add `report_task`, `list_tasks_for_component`, `accept_task`, `resolve_task`, `decline_task` MCP tools. **Team-only** (require team API key to be present; if not, do not register these tools). When this ships, AI instances stop grepping the folder and start calling MCP.
2. **`framework-migrate-cross-component-prompts-to-server.md`** — One-shot migration: walk every open `.md` in `cross-component-prompts/`, POST to `/api/v1/tasks`, move the file to `migrated/` (preserving the audit trail). After verification, the folder becomes read-only legacy.

These will be filed once the endpoint is live.

## Files Likely Affected

- `Web Site Clean/api/routes/tasks.<ext>` (new)
- `Web Site Clean/db/migrations/<timestamp>_create_tasks.<ext>` (new)
- `Web Site Clean/api/middleware/team_auth.<ext>` (reuse if it exists, otherwise extend the bugs auth)
- `Web Site Clean/dashboard/pages/tasks.<ext>` (new dashboard view)
