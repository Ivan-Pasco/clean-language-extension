# MCP Server — Add Team-Only Task Tools

## Component
`Clean MCP/`

## Issue Type
feature

## Priority
Medium (depends on `website-tasks-api-team-only.md` shipping first)

## Background

See:
- `management/ERROR_REPORTING_WORKFLOW.md`
- `management/cross-component-prompts/website-tasks-api-team-only.md` — the website endpoints these MCP tools wrap.

Once `/api/v1/tasks` is live on the website, AI instances should stop grepping `management/cross-component-prompts/` and start calling MCP. This eliminates the file-based work-item store the same way the bug system eliminated the local telemetry store.

## Required Changes

### 1. Detect team membership at startup

When the MCP server starts, check for `~/.cleen/error-api-key`:

- **Key present** → register the task tools below. The user is team.
- **Key missing** → do **not** register the task tools at all. External users see only `report_error` and `check_reported_fixes`.

This is the gating mechanism. There is no per-call auth check on the tools — the tools simply don't exist for non-team users.

### 2. New MCP tools (team-only)

| Tool | Inputs | Output | Wraps |
|---|---|---|---|
| `report_task` | target_component, type, priority, title, body_md | task id + url | `POST /api/v1/tasks` |
| `list_tasks_for_component` | target_component, optional status (default: open) | array of {id, type, priority, title, created_at} | `GET /api/v1/tasks?target_component=X&status=Y` |
| `get_task` | id | full task incl. body_md | `GET /api/v1/tasks/<id>` |
| `accept_task` | id | task with status=in_progress | `PATCH /api/v1/tasks/<id>/accept` |
| `resolve_task` | id, resolution_commit, optional resolution_notes | task with status=resolved | `PATCH /api/v1/tasks/<id>/resolve` |
| `decline_task` | id, decision (required string) | task with status=declined | `PATCH /api/v1/tasks/<id>/decline` |

All tools pass the API key in the `X-API-Key` header.

### 3. Tool descriptions for AI consumers

Each tool's description (visible to the AI) must say:

- **report_task**: "Create a cross-component work item for another team component. Use when you discover work that belongs in a different component than the one you're working in. Title: one-line summary. body_md: full markdown design doc. Returns task id."
- **list_tasks_for_component**: "List open work items targeted at a component. **Call this at session start in any component you're working in to discover queued work.** Returns array sorted by priority then created_at."
- **accept_task**: "Mark a task as in_progress. Call this BEFORE starting work so other AI instances know it's claimed."
- **resolve_task**: "Mark a task as resolved. Provide the git commit hash that closes it. Call this AFTER the work has been committed and (where applicable) released."
- **decline_task**: "Decline a task with a written reason. Use when the task is out of scope, conflicts with current direction, or has been superseded. Reason is required and stored permanently."

### 4. Session-start hint

When `list_tasks_for_component` is the first call in a session and returns >0 open tasks, the response should include a hint field the AI can surface:

```json
{
  "tasks": [...],
  "hint": "There are N open tasks for this component. Consider reviewing them before starting other work."
}
```

This replaces the current "ls cross-component-prompts/<prefix>-*.md" pickup protocol.

### 5. No local store

Like `report_error` post-refactor, these tools never read or write any local file. The server is canonical. If the server is unreachable, the tool fails loudly — there is no offline queue for tasks (different from `report_error`'s outbox, because tasks are deliberate and synchronous, not error-triggered).

## What MUST NOT Change

- `report_error` and `check_reported_fixes` behavior (those are for bugs, not tasks).
- The team API key file location.
- Which tools external users see (still just `report_error`, `check_reported_fixes`).

## Verification

- MCP server with `~/.cleen/error-api-key` present → `report_task` etc. listed in tools.
- MCP server without that file → only `report_error` / `check_reported_fixes` listed.
- `report_task` with target_component="compiler" creates a task; `list_tasks_for_component("compiler")` returns it.
- `resolve_task` removes it from the open list.
- All tools fail loudly if the server is unreachable.

## Files Likely Affected

- `Clean MCP/src/tools/tasks/*` (new module: report_task, list_tasks, get_task, accept, resolve, decline)
- `Clean MCP/src/server.rs` (register tools conditionally on API key presence)
- `Clean MCP/README.md` (document team-only tools)
