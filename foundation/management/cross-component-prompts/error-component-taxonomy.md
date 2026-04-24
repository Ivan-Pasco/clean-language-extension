# Standardize Error Component Taxonomy

## Component
Cross-component (MCP Server + Website API)

## Issue Type
Bug — component names are inconsistent across the error reporting pipeline, causing mismatched queries and lost reports.

## Priority
High — this is the root cause of "different answers from different components" when checking the dashboard.

## Problem

There are **three different component enums** in the error pipeline that don't match each other:

### 1. `report_error` MCP tool — what gets stored
```json
"enum": ["parser", "semantic", "codegen", "runtime", "plugin", "cli", "unknown"]
```

### 2. `list_component_bugs` MCP tool — what gets queried
```json
"enum": ["compiler", "server", "node-server", "framework", "extension", "manager", "canvas", "ui", "all"]
```

### 3. Auto-detect from error code prefix — hardcoded in `server.rs:3507`
```
SYN → "syntax"
SEM → "semantic"
COM → "codegen"
RUN → "runtime"
SYS → "system"
```

### Consequence

- A bug reported with component `"plugin"` can never be found by querying `"framework"` — different names for the same thing.
- A bug reported with component `"runtime"` can never be found by querying `"server"` — same mismatch.
- External users reporting bugs against the website, extension, or manager must pick `"unknown"` because those aren't in the `report_error` enum.
- The dashboard stores whatever was sent, with no normalization. So `error_component` contains a mix of all three vocabularies.

## Solution: Unified Component Taxonomy

### Two-Level Naming

Every error has a **component** (which project) and a **subsystem** (which part within that project):

| Component (project-level) | Subsystem (internal detail) | Description |
|----------------------------|----------------------------|-------------|
| `compiler` | `parser` | Pest grammar, tokenization, AST |
| `compiler` | `semantic` | Type checking, scope analysis |
| `compiler` | `codegen` | WASM generation, MIR |
| `compiler` | `cli` | CLI argument handling |
| `server` | `runtime` | WASM execution, host bridge |
| `server` | `bridge` | Host function implementations |
| `node-server` | `runtime` | Node.js WASM runtime |
| `framework` | `plugin` | Plugin WASM (frame.ui, frame.data, etc.) |
| `framework` | `auth` | frame.auth plugin |
| `extension` | `lsp` | Language server protocol |
| `extension` | `ui` | VS Code UI elements |
| `manager` | `install` | Version management, downloads |
| `website` | `dashboard` | Error dashboard |
| `website` | `api` | Error reporting API |
| `canvas` | `render` | Canvas rendering |
| `ui` | `components` | UI component library |
| `mcp` | `tools` | MCP server tools |

### Unified Enum for `report_error`

Replace the current enum with the component-level names:

```json
"component": {
    "type": "string",
    "description": "Which project component produced the error.",
    "enum": ["compiler", "server", "node-server", "framework", "extension", "manager", "website", "canvas", "ui", "mcp", "unknown"]
}
```

Add a new optional field for subsystem detail:

```json
"subsystem": {
    "type": "string",
    "description": "Optional: which subsystem within the component (e.g., parser, codegen, runtime, bridge, plugin)."
}
```

### Unified Enum for `list_component_bugs`

Same enum as above (already close, just needs `website`, `mcp`):

```json
"component": {
    "type": "string",
    "description": "Component to query bugs for.",
    "enum": ["compiler", "server", "node-server", "framework", "extension", "manager", "website", "canvas", "ui", "mcp", "all"]
}
```

### Auto-Detect Mapping Update

The error code prefix mapping (`server.rs:3507`) should map to **subsystem**, not component:

```rust
let subsystem = if error_code.starts_with("SYN") {
    "parser"
} else if error_code.starts_with("SEM") {
    "semantic"
} else if error_code.starts_with("COD") || error_code.starts_with("COM") {
    "codegen"
} else if error_code.starts_with("RUN") {
    "runtime"
} else if error_code.starts_with("SYS") {
    "system"
} else {
    "unknown"
};
```

The **component** should come from the explicit parameter the AI provides, NOT from the error code prefix. The prefix gives the subsystem only.

### Dashboard Normalization

The website API should normalize incoming `error_component` values on ingest:

```
"parser" → component="compiler", subsystem="parser"
"semantic" → component="compiler", subsystem="semantic"
"codegen" → component="compiler", subsystem="codegen"
"runtime" → component="server", subsystem="runtime"
"plugin" → component="framework", subsystem="plugin"
"cli" → component="compiler", subsystem="cli"
"syntax" → component="compiler", subsystem="parser"
"system" → component="compiler", subsystem="system"
```

This handles backwards compatibility with existing reports that used the old naming.

### Migration for Existing Data

```sql
-- Normalize existing error_component values
UPDATE error_fingerprints SET error_component = 'compiler' WHERE error_component IN ('parser', 'semantic', 'codegen', 'syntax', 'cli', 'system');
UPDATE error_fingerprints SET error_component = 'server' WHERE error_component = 'runtime';
UPDATE error_fingerprints SET error_component = 'framework' WHERE error_component = 'plugin';

-- Add subsystem column
ALTER TABLE error_fingerprints ADD COLUMN IF NOT EXISTS error_subsystem VARCHAR(32) NULL;
ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS error_subsystem VARCHAR(32) NULL;
```

## Problem 2: Incomplete Data in Local Store

The `TrackedReport` struct (what gets saved to `~/.cleen/telemetry/reported_errors.json`) is missing critical fields:

### What's stored now

```rust
pub struct TrackedReport {
    pub report_id: String,
    pub fingerprint: Option<String>,   // often null — upload failed
    pub error_code: String,
    pub summary: String,
    pub reported_at: DateTime<Utc>,
    pub compiler_version: String,
    pub status: ReportStatus,
    pub resolved_in: Option<String>,
    pub fix_description: Option<String>,
    pub fix_pr: Option<String>,
    pub last_checked: DateTime<Utc>,
    pub notified: bool,
}
```

### What's missing

| Field | Why it matters |
|-------|---------------|
| `component` | Can't tell which project the error belongs to without re-parsing the error code |
| `subsystem` | Lost after initial report — can't filter "show me my parser bugs" |
| `severity` | No way to prioritize locally without it |
| `minimal_repro` | If upload failed, the repro is lost — can't retry with full context |
| `actual_behavior` | Same — lost on failed upload |
| `expected_behavior` | Same |

### Fix

Add `component`, `subsystem`, and `severity` to `TrackedReport`. Also store `minimal_repro` so orphaned reports can be retried with full context:

```rust
pub struct TrackedReport {
    pub report_id: String,
    pub fingerprint: Option<String>,
    pub error_code: String,
    pub component: String,           // NEW: project-level component
    pub subsystem: Option<String>,   // NEW: internal subsystem
    pub severity: String,            // NEW: bug/crash/regression
    pub summary: String,
    pub reported_at: DateTime<Utc>,
    pub compiler_version: String,
    pub status: ReportStatus,
    pub resolved_in: Option<String>,
    pub fix_description: Option<String>,
    pub fix_pr: Option<String>,
    pub last_checked: DateTime<Utc>,
    pub notified: bool,
    pub minimal_repro: Option<String>,  // NEW: for retry on failed upload
}
```

Update `add_report()` to populate these from the `ErrorReport`:

```rust
pub fn add_report(&mut self, report: &ErrorReport) {
    // ...existing dedup check...
    self.reports.push(TrackedReport {
        // ...existing fields...
        component: report.error.component.clone(),
        subsystem: report.error.subsystem.clone(),
        severity: report.error.severity.clone(),
        minimal_repro: report.reproduction.as_ref()
            .and_then(|r| r.minimal_code.clone()),
    });
}
```

## Files Affected

| Component | File | Change |
|-----------|------|--------|
| Compiler (MCP) | `src/mcp/server.rs:1087` | Update `report_error` component enum |
| Compiler (MCP) | `src/mcp/server.rs:1199` | Update `list_component_bugs` enum (add website, mcp) |
| Compiler (MCP) | `src/mcp/server.rs:3507` | Change auto-detect to set subsystem, not component |
| Compiler (MCP) | `src/mcp/server.rs:3527` | Pass subsystem field in ReportError |
| Compiler (Telemetry) | `src/telemetry/report.rs:39` | Add `subsystem` field to ReportError struct |
| Compiler (Telemetry) | `src/telemetry/report.rs:126` | Add component, subsystem, severity, minimal_repro to TrackedReport |
| Compiler (Telemetry) | `src/telemetry/report.rs:197` | Update add_report() to populate new fields |
| Website | `app/server/errors_api.cln` | Normalize component on ingest, add subsystem extraction |
| Website | `app/data/migrations/` | Add error_subsystem column |

## Verification

After applying:
```bash
# Report with new taxonomy
# (via MCP report_error with component="framework", subsystem="plugin")

# Query should now find it
curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?component=framework&status=open"

# Old reports should be normalized
curl -s "https://errors.cleanlanguage.dev/api/v1/bugs?component=compiler&status=open"
# Should include former "parser", "semantic", "codegen" reports
```
