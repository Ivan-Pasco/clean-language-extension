# Cross-Component Prompts — Routing

Work instructions for issues that cross component boundaries. When an AI instance working in component A discovers a bug or required change in component B, it writes a prompt here instead of editing B directly (per Principle 8).

> **Future direction:** This file-based system has the same drift problem as the local error store we just eliminated. The migration target is a server-side `/api/v1/tasks` endpoint plus team-only MCP tools (`report_task`, `list_tasks_for_component`, `accept_task`, `resolve_task`, `decline_task`). See [website-tasks-api-team-only.md](website-tasks-api-team-only.md) and [mcp-add-task-tools-team-only.md](mcp-add-task-tools-team-only.md). Once both ship, the routing protocol below changes from "grep this folder" to "call `list_tasks_for_component` at session start," and this folder becomes legacy. **Until then, the file-based protocol below is authoritative.**

## How Routing Works

There is no daemon, no queue, no inbox. **Routing is by filename prefix.** AI instances working in a given component grep this folder for their prefix and pick up the work.

### Prefix → Target Component

| Prefix         | Target folder                              | Owner AI works in           |
|----------------|--------------------------------------------|-----------------------------|
| `compiler-`    | [clean-language-compiler/](../../clean-language-compiler/)         | clean-language-compiler     |
| `framework-`   | [clean-framework/](../../clean-framework/)                         | clean-framework             |
| `server-`      | [clean-server/](../../clean-server/)                               | clean-server                |
| `node-server-` | [clean-node-server/](../../clean-node-server/)                     | clean-node-server           |
| `cleen-`       | [clean-manager/](../../clean-manager/)                             | clean-manager               |
| `mcp-`         | [Clean MCP/](../../Clean%20MCP/)                                   | Clean MCP                   |
| `extension-`   | [clean-extension/](../../clean-extension/)                         | clean-extension             |
| `ui-`          | [clean-ui/](../../clean-ui/)                                       | clean-ui                    |
| `canvas-`      | [clean-canvas/](../../clean-canvas/)                               | clean-canvas                |
| `llm-`         | [clean-llm/](../../clean-llm/)                                     | clean-llm                   |
| `cpanel-`      | [clean-cpanel-plugin/](../../clean-cpanel-plugin/)                 | clean-cpanel-plugin         |
| `studio-`      | [Clean Studio/](../../Clean%20Studio/)                             | Clean Studio                |
| `website-`     | [Web Site Clean/](../../Web%20Site%20Clean/)                       | Web Site Clean              |
| `spec-`        | [spec/](../../spec/) (shared, not a component)                      | any AI with developer approval |
| `all-`         | applies to multiple components             | each AI handles its part    |

If the prefix doesn't match this list, the prompt is unrouteable and will rot. **Always use a prefix from this table.**

## Filename Convention

```
<prefix>-<short-kebab-topic>.md
```

Examples:
- `compiler-e007-codegen-type-mismatch-storm.md`
- `mcp-server-stateless-error-reporting.md`
- `cleen-drop-telemetry-state-store.md`

Keep the topic specific. "compiler-bug.md" is unrouteable as well — the receiving AI can't tell which one.

## Required Header

Every prompt must start with this header (see existing prompts for examples):

```markdown
# <Title>

## Component
<exact folder name as it appears in /Users/earcandy/Documents/Dev/Clean Language/>

## Issue Type
bug | feature | refactor | enhancement | compatibility

## Priority
critical | high | medium | low

## Background
Why this exists. Link to dashboards, error codes, fingerprints, or design docs.
```

## Pickup Protocol (for AI instances)

When you start a session in component X, run **before** other work:

```bash
ls /Users/earcandy/Documents/Dev/Clean\ Language/management/cross-component-prompts/<prefix>-*.md 2>/dev/null
```

For each match:
1. Read the prompt.
2. Confirm the `Component` field matches your folder.
3. If accepted: do the work in your component.
4. After completion: move the prompt to `resolved/` with the same filename.

```bash
mv "<prompt>.md" resolved/<prompt>.md
```

If you decline (out of scope, disagree, blocked), add a `## Decision` section at the bottom explaining why and leave the file in place. Don't silently ignore.

## Lifecycle

```
[creator AI]  →  cross-component-prompts/<prefix>-<topic>.md
                          ↓
[receiver AI]  →  reads, executes
                          ↓
                  resolved/<prefix>-<topic>.md   (if done)
                          ↓
                  (or stays in place with ## Decision section)
```

There is no "in-progress" subfolder. Either the file is in the root (open) or in `resolved/` (closed). Atomic.

## What Goes Here vs. Where

| Type of work                               | Location                                               |
|---|---|
| Cross-component issue (this folder)        | `cross-component-prompts/<prefix>-<topic>.md`          |
| Long-running work for one component        | `component-prompts/PROMPT-<COMPONENT>.md`              |
| Architecture-level proposal or design      | `management/<TOPIC>.md`                                |
| Historical snapshot / audit                | `management/reports/<TOPIC>.md`                        |
| Bug reported by an external user           | error dashboard via `report_error` MCP, **not here**   |

## Anti-Patterns

- **No prefix or wrong prefix** — file is unrouteable, will rot
- **Editing another component's code instead of writing a prompt** — violates Principle 8
- **Vague `Component:` field** ("compiler stuff", "the server") — receiver AI can't confirm ownership
- **Resolving by deleting** instead of moving to `resolved/` — destroys the audit trail
- **Bug reports for external users** — those go through the error dashboard, not here

## Index

Run this to list all open prompts grouped by target component:

```bash
ls *.md 2>/dev/null | grep -v README | sed 's/-.*//' | sort | uniq -c | sort -rn
```
