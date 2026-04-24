# Clean Language Error Reporting & Telemetry Specification

**Version:** 1.0.0
**Status:** Draft
**Components Affected:** Compiler (MCP), Backend (new), Discord Bot (new), CLI, All Runtimes

---

## 1. Overview

### 1.1 Problem Statement

Clean Language is an open-source language with a growing ecosystem (compiler, framework, plugins, server, etc). When users encounter bugs, the team has no automated way to learn about them. Users must manually file GitHub issues, which means:

- Most bugs go unreported
- Reports lack structured context
- No deduplication or prioritization
- No visibility into which features break most

### 1.2 Unique Opportunity

Clean Language users frequently work with AI assistants via the compiler's MCP server. When an AI detects a compiler error through MCP, it already understands the full context. This creates a unique opportunity: **the AI can generate structured, high-quality bug reports automatically** — with user consent.

### 1.3 Goals

| Goal | Description |
|------|-------------|
| **Zero-friction reporting** | User says "yes" once, AI handles the rest |
| **High signal** | AI-enriched reports are more useful than raw crash logs |
| **Privacy-first** | Opt-in only, no source code transmitted, anonymous by default |
| **Actionable** | Reports are auto-categorized, deduplicated, and prioritized |
| **Multi-channel** | Works via MCP+AI, CLI telemetry, and manual reporting |

---

## 2. Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User's Development Environment                          │
│                                                          │
│  ┌──────────┐    MCP     ┌──────────────────────┐       │
│  │ IDE + AI │◄──────────►│ Compiler MCP Server   │       │
│  │ (Claude) │            │ (15 existing tools    │       │
│  │          │            │  + report_error NEW)  │       │
│  └────┬─────┘            └──────────────────────┘       │
│       │                                                  │
│       │  AI detects error, asks user                     │
│       │  "Report this bug?" → [Yes] [No]                │
│       │                                                  │
│  ┌────┴─────┐                                           │
│  │ CLI Tool │ (also: `cln report` manual command)       │
│  │ cln      │ (also: opt-in crash telemetry)            │
│  └────┬─────┘                                           │
│       │                                                  │
└───────┼──────────────────────────────────────────────────┘
        │  HTTPS POST
        │  (error report JSON)
        ▼
┌───────────────────────────────────────────────────────────┐
│  Clean Language Error API (Backend)                        │
│  https://errors.cleanlanguage.dev/api/v1                  │
│                                                            │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐   │
│  │ Ingestion    │  │ Fingerprint   │  │ Storage      │   │
│  │ & Validation │─►│ & Dedup       │─►│ (PostgreSQL) │   │
│  └──────────────┘  └──────┬────────┘  └──────────────┘   │
│                           │                                │
│  ┌──────────────┐  ┌──────┴────────┐  ┌──────────────┐   │
│  │ Rate Limiter │  │ Notification  │  │ Dashboard    │   │
│  │ (per-IP)     │  │ Router        │  │ (Web UI)     │   │
│  └──────────────┘  └──────┬────────┘  └──────────────┘   │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │
              ┌─────────────┼─────────────────┐
              ▼             ▼                  ▼
        ┌──────────┐  ┌──────────┐     ┌────────────┐
        │ Discord  │  │ GitHub   │     │ Email      │
        │ Webhook  │  │ Issues   │     │ (optional) │
        │ #bugs    │  │ (auto)   │     │            │
        └──────────┘  └──────────┘     └────────────┘
```

### 2.2 Reporting Channels

| Channel | Trigger | Who uses it | Report quality |
|---------|---------|-------------|----------------|
| **MCP + AI** | AI detects error via MCP tools | Users with AI assistants | Highest (AI-enriched) |
| **CLI Telemetry** | Opt-in crash data on compile failures | All CLI users | Medium (structured) |
| **Manual Report** | `cln report` command | Any user | Variable (user-written) |

### 2.3 Execution Layer Compliance

Per the platform architecture, error reporting is **portable I/O** and belongs in **Layer 2 (Host Bridge)** for runtime errors. However, the MCP reporting tool is a **compiler-level tool** (Layer 0) since it operates during development, not at runtime.

| Mechanism | Layer | Rationale |
|-----------|-------|-----------|
| MCP `report_error` tool | Layer 0 (Compiler) | Development-time tool, not runtime |
| CLI telemetry | Layer 0 (Compiler) | Triggered by compiler invocation |
| Runtime error telemetry | Layer 2 (Host Bridge) | Future: runtime crash reporting |

---

## 3. Error Report Schema

### 3.1 Report Structure

All channels produce reports in this unified schema:

```json
{
  "schema_version": "1.0.0",
  "report_id": "uuid-v4",
  "timestamp": "2026-02-17T14:30:00Z",

  "source": {
    "channel": "mcp_ai | cli_telemetry | manual",
    "compiler_version": "0.15.0",
    "os": "darwin | linux | windows",
    "arch": "x86_64 | aarch64",
    "runtime": "wasmtime | node | browser | null"
  },

  "error": {
    "code": "SYN001",
    "category": "syntax | semantic | codegen | runtime | system",
    "component": "parser | semantic | codegen | runtime | plugin",
    "severity": "bug | crash | regression | unexpected_behavior",
    "message": "Unexpected token 'fn' at line 42",
    "file_context": "test.cln:42:10"
  },

  "reproduction": {
    "minimal_code": "fn test(): Array<Array<integer>> {\n  return [[1, 2]]\n}",
    "expected_behavior": "Should compile nested generic types",
    "actual_behavior": "Parser error: unexpected token",
    "spec_reference": "Section 4.2 - Generic Types"
  },

  "ai_context": {
    "analysis": "The parser doesn't handle nested angle brackets in generic types. It consumes the first > as closing the outer generic.",
    "suggested_component": "parser/token_parser.rs",
    "suggested_fix": "Implement bracket depth tracking for generic type parameters",
    "confidence": "high | medium | low"
  },

  "user": {
    "anonymous": true,
    "contact": null,
    "consent_level": "error_only | error_with_code | full"
  }
}
```

### 3.2 Field Rules

| Field | Required | Source | Notes |
|-------|----------|-------|-------|
| `schema_version` | Yes | System | Always "1.0.0" |
| `report_id` | Yes | System | UUID v4, generated client-side |
| `source.channel` | Yes | System | Which reporting channel |
| `source.compiler_version` | Yes | System | From `VERSION` constant |
| `error.code` | Yes | Compiler | Error code (SYN001, SEM002, etc.) |
| `error.category` | Yes | Compiler/AI | Error classification |
| `error.component` | Yes | AI/Compiler | Which compiler component |
| `reproduction.minimal_code` | Preferred | AI | AI-generated minimal reproduction |
| `ai_context` | Optional | AI only | Only present for MCP+AI channel |
| `user.contact` | Optional | User | Only if user explicitly provides |

### 3.3 Consent Levels

| Level | What is sent | When to use |
|-------|-------------|-------------|
| `error_only` | Error code, message, compiler version, OS | Minimal — just the error signal |
| `error_with_code` | Above + minimal reproduction code | Default — includes AI-generated repro |
| `full` | Above + AI analysis, suggested fix, file context | Maximum — helps most with debugging |

### 3.4 What is NEVER Sent

- User's actual source code (only AI-generated minimal repro)
- File system paths beyond filename
- Environment variables
- Git history or repository URLs
- Package dependencies list
- Any personally identifiable information unless explicitly provided

---

## 4. MCP Tool Specification: `report_error`

### 4.1 Tool Definition

This is tool #16 in the compiler MCP server.

```json
{
  "name": "report_error",
  "description": "Report a compiler or runtime error to the Clean Language team. Generates a structured bug report with AI-enhanced context. Requires explicit user consent before sending. The report is anonymous by default and never includes the user's actual source code — only an AI-generated minimal reproduction.",
  "input_schema": {
    "type": "object",
    "properties": {
      "error_code": {
        "type": "string",
        "description": "The error code (e.g., 'SYN001', 'SEM003'). Use error codes from the compiler diagnostics."
      },
      "error_message": {
        "type": "string",
        "description": "The error message as reported by the compiler."
      },
      "component": {
        "type": "string",
        "description": "Which component produced the error.",
        "enum": ["parser", "semantic", "codegen", "runtime", "plugin", "cli", "unknown"]
      },
      "severity": {
        "type": "string",
        "description": "Severity classification of the error.",
        "enum": ["bug", "crash", "regression", "unexpected_behavior"]
      },
      "minimal_repro": {
        "type": "string",
        "description": "Minimal Clean Language code that reproduces the error. IMPORTANT: This must be a minimal reproduction, NOT the user's actual source code."
      },
      "expected_behavior": {
        "type": "string",
        "description": "What the correct behavior should be according to the Language Specification."
      },
      "actual_behavior": {
        "type": "string",
        "description": "What actually happens when the code is compiled or executed."
      },
      "spec_reference": {
        "type": "string",
        "description": "Reference to the relevant Language Specification section, if applicable."
      },
      "ai_analysis": {
        "type": "string",
        "description": "AI's analysis of the root cause and potential fix."
      },
      "suggested_component_file": {
        "type": "string",
        "description": "The source file in the compiler that likely needs fixing (e.g., 'parser/token_parser.rs')."
      },
      "consent_level": {
        "type": "string",
        "description": "What level of detail the user consented to share.",
        "enum": ["error_only", "error_with_code", "full"],
        "default": "error_with_code"
      },
      "user_contact": {
        "type": "string",
        "description": "Optional contact info if the user wants follow-up. Only include if explicitly provided by the user."
      }
    },
    "required": ["error_code", "error_message", "component", "severity"]
  }
}
```

### 4.2 AI Interaction Flow

When an AI assistant detects a compiler error via MCP, it should follow this flow:

```
1. AI calls `check`, `compile`, or `diagnostics` MCP tool
2. Error is returned in the response
3. AI analyzes the error and attempts to help the user
4. If the error appears to be a compiler bug (not a user code error):
   a. AI informs the user: "This looks like a compiler bug with [description]."
   b. AI asks: "Would you like to report this to the Clean Language team?
      The report will include an error description and a minimal code example
      I'll generate — not your actual source code."
   c. Options:
      - "Yes, report it" → consent_level: "error_with_code"
      - "Yes, with full analysis" → consent_level: "full"
      - "Just the error code" → consent_level: "error_only"
      - "No thanks" → no report sent
5. If user consents, AI calls `report_error` MCP tool
6. MCP tool returns confirmation with report_id
```

### 4.3 Bug vs User Error Classification

The AI should only suggest reporting when the error is likely a **compiler bug**, not a user mistake. Guidelines:

| Likely a compiler bug | Likely a user error |
|----------------------|---------------------|
| Valid syntax per spec produces an error | Typo in variable name |
| Compiler crashes/panics | Missing semicolon |
| WASM generation produces invalid output | Type mismatch |
| Feature documented in spec doesn't work | Undeclared variable |
| Regression (worked in previous version) | Wrong argument count |
| Internal compiler error (ICE) | Syntax not in spec |

### 4.4 Response Format

**Success:**
```json
{
  "success": true,
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Error report submitted successfully. Thank you for helping improve Clean Language!",
  "tracking_url": "https://errors.cleanlanguage.dev/report/550e8400"
}
```

**Offline/Error (non-blocking):**
```json
{
  "success": false,
  "queued": true,
  "message": "Report saved locally. It will be sent when connectivity is restored.",
  "local_path": "~/.cleen/telemetry/pending_reports/550e8400.json"
}
```

---

## 5. CLI Telemetry

### 5.1 Opt-In Configuration

Telemetry is **disabled by default**. Users explicitly opt in:

```bash
# Enable telemetry
cln config set telemetry on

# Disable telemetry
cln config set telemetry off

# Check current setting
cln config get telemetry
```

Configuration stored in `~/.cleen/telemetry/config.toml`:

```toml
[telemetry]
enabled = false          # Default: disabled
consent_level = "error_with_code"  # Default consent level
anonymous_id = "uuid"    # Random ID, not linked to identity
```

### 5.2 What CLI Telemetry Collects

When enabled and a compilation **fails**:

```json
{
  "channel": "cli_telemetry",
  "compiler_version": "0.15.0",
  "os": "darwin",
  "arch": "aarch64",
  "error_code": "SYN001",
  "error_category": "syntax",
  "error_component": "parser",
  "anonymous_id": "uuid",
  "timestamp": "2026-02-17T14:30:00Z"
}
```

**CLI telemetry does NOT collect:**
- Source code
- File names or paths
- Error messages (only codes)
- Environment details beyond OS/arch

### 5.3 First-Run Prompt

On first compiler installation, show a one-time prompt:

```
Welcome to Clean Language!

Help improve Clean Language by sharing anonymous error reports?
This sends only error codes and compiler version — never your source code.

  [y] Yes, enable telemetry
  [n] No thanks
  [?] Learn more (opens https://cleanlanguage.dev/telemetry)

You can change this anytime with: cln config set telemetry on/off
```

### 5.4 Manual Report Command

For users who want to file a detailed report without AI:

```bash
# Interactive report
cln report

# Quick report with error file
cln report --file error_output.txt

# Report with minimal repro
cln report --code "fn test() { ... }" --error "SYN001"
```

The `cln report` command:
1. Asks the user to describe the issue
2. Attaches latest compiler error log (sanitized)
3. Asks for optional contact info
4. Sends to the Error API

---

## 6. Backend: Error API

### 6.1 API Endpoints

**Base URL:** `https://errors.cleanlanguage.dev/api/v1`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/reports` | Submit an error report |
| `GET` | `/reports/:id` | Get report status (with report_id) |
| `GET` | `/health` | API health check |

### 6.2 POST /reports

**Request:**
```http
POST /api/v1/reports
Content-Type: application/json

{
  // Full report schema from Section 3.1
}
```

**Response (201 Created):**
```json
{
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "received",
  "is_duplicate": false,
  "fingerprint": "abc123def456",
  "tracking_url": "https://errors.cleanlanguage.dev/report/550e8400"
}
```

**Response (200 OK — Duplicate):**
```json
{
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "duplicate",
  "original_report_id": "existing-uuid",
  "occurrences": 47,
  "message": "This error has already been reported and is being tracked."
}
```

### 6.3 Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP | 10 reports | 1 hour |
| Per anonymous_id | 20 reports | 24 hours |
| Global | 1000 reports | 1 hour |

### 6.4 Error Fingerprinting

Reports are deduplicated using a fingerprint hash of:

```
fingerprint = SHA256(
  error_code +
  component +
  compiler_version_major_minor +  // e.g., "0.15" (not patch)
  normalized_error_message
)
```

**Normalization rules:**
- Strip line/column numbers from error messages
- Strip file paths
- Lowercase everything
- Strip variable/function names (replace with `_`)

### 6.5 Priority Scoring

Each unique error fingerprint receives a priority score:

```
priority = (
  occurrence_count * 1.0 +        # More reports = higher priority
  unique_users * 5.0 +            # Many users affected = much higher
  severity_weight +                # crash=100, bug=50, regression=75, unexpected=25
  ai_confidence_bonus +            # high=20, medium=10, low=0
  recency_bonus                    # Last 24h: +30, Last week: +15, Older: 0
)
```

---

## 7. Discord Integration

### 7.1 Channel Structure

| Channel | Content | Threshold |
|---------|---------|-----------|
| `#compiler-bugs` | Parser, semantic, codegen errors | All new fingerprints |
| `#runtime-bugs` | WASM execution, runtime errors | All new fingerprints |
| `#plugin-bugs` | Plugin-related errors | All new fingerprints |
| `#error-alerts` | High-priority errors only | Priority score > 100 |
| `#error-stats` | Daily summary | Once per day at 09:00 UTC |

### 7.2 Discord Message Format

**New Error (first occurrence):**

```
🆕 New Error Report
━━━━━━━━━━━━━━━━━━━
Code:      SYN042
Component: parser
Severity:  bug
Version:   0.15.0

Message:
Parser fails on nested generic types Array<Array<integer>>

Minimal Repro:
  fn test(): Array<Array<integer>> {
    return [[1, 2]]
  }

AI Analysis:
Parser doesn't track angle bracket depth for nested generics.
Suggested file: parser/token_parser.rs
Confidence: high

Report ID: 550e8400
Dashboard: https://errors.cleanlanguage.dev/report/550e8400
```

**Duplicate (milestone occurrences):**

```
📈 Error SYN042 — 10 reports from 7 users
Component: parser | Version: 0.15.x
Priority score: 285 (↑ HIGH)
Dashboard: https://errors.cleanlanguage.dev/fingerprint/abc123
```

Milestone thresholds: 5, 10, 25, 50, 100 occurrences.

### 7.3 Daily Summary

Posted to `#error-stats` at 09:00 UTC:

```
📊 Daily Error Report — Feb 17, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

New reports:    42
New errors:     8 (unique fingerprints)
Duplicates:     34
Resolved:       3

Top errors:
  1. SYN042 — nested generics (12 reports, 9 users)
  2. SEM015 — type inference loop (8 reports, 6 users)
  3. COM003 — WASM validation (5 reports, 3 users)

Component breakdown:
  parser:   18 reports (43%)
  semantic: 14 reports (33%)
  codegen:   7 reports (17%)
  runtime:   3 reports (7%)

Version breakdown:
  0.15.0: 30 reports
  0.14.2: 12 reports
```

---

## 8. Dashboard

### 8.1 Views

| View | Purpose | Audience |
|------|---------|----------|
| **Overview** | Total reports, trends, top errors | Whole team |
| **Error Detail** | Single error: repro, AI analysis, occurrences | Developer fixing it |
| **Component View** | Errors grouped by component | Component owners |
| **Version View** | Errors by compiler version | Release management |
| **Resolution Tracker** | Link errors to fix commits/PRs | Project management |

### 8.2 Key Metrics

- **Error discovery rate** — New unique errors per day/week
- **Mean time to resolution** — From first report to fix commit
- **User impact** — Unique users affected per error
- **Regression rate** — Errors reintroduced after being fixed
- **Channel effectiveness** — Report quality by channel (MCP vs CLI vs manual)
- **AI accuracy** — How often AI's component/fix suggestions are correct

---

## 9. Fix Notification Feedback Loop

Closing the loop is critical — if users report bugs but never hear back, they stop reporting. The system uses three zero-friction channels to inform users when their reported bugs are fixed.

### 9.1 Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Team fixes bug, merges PR                            │
│  └─► CI tags fix with error fingerprint               │
│      └─► Backend marks fingerprint as "resolved"      │
│          ├─► fixed_in_version: "0.16.0"               │
│          ├─► fix_commit: "abc123"                      │
│          └─► resolved_at: "2026-02-20T10:00:00Z"      │
└──────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
   ┌─────────────┐ ┌──────────┐    ┌──────────────┐
   │ MCP Tool    │ │ CLI      │    │ Tracking URL │
   │ check_fixes │ │ post-    │    │ (passive)    │
   │ (AI asks    │ │ update   │    │              │
   │  on session │ │ message  │    │              │
   │  start)     │ │          │    │              │
   └─────────────┘ └──────────┘    └──────────────┘
   Zero friction    Zero friction    User-initiated
```

### 9.2 Local Report Tracking

When a user reports an error (via any channel), the compiler stores a local record:

**File:** `~/.cleen/telemetry/reported_errors.json`

```json
{
  "reports": [
    {
      "report_id": "550e8400-e29b-41d4-a716-446655440000",
      "fingerprint": "abc123def456",
      "error_code": "SYN042",
      "summary": "Nested generic types fail to parse",
      "reported_at": "2026-02-17T14:30:00Z",
      "compiler_version": "0.15.0",
      "status": "reported",
      "resolved_in": null,
      "last_checked": "2026-02-17T14:30:00Z"
    }
  ]
}
```

**Status transitions:**

```
reported ──► acknowledged ──► in_progress ──► resolved
                                    │
                                    └──► wont_fix
```

### 9.3 MCP Tool: `check_reported_fixes`

A new MCP tool (tool #17) that AI assistants call proactively at the start of a session or when relevant.

**Tool Definition:**

```json
{
  "name": "check_reported_fixes",
  "description": "Check if any previously reported errors have been fixed. Returns a list of resolved errors with the version that includes the fix. Call this at the start of a session to inform the user about fixes to bugs they reported. Only checks errors reported from this machine.",
  "input_schema": {
    "type": "object",
    "properties": {
      "include_all": {
        "type": "boolean",
        "description": "If true, returns all tracked reports regardless of status. If false (default), returns only reports with status changes since last check.",
        "default": false
      }
    },
    "required": []
  }
}
```

**Response:**

```json
{
  "success": true,
  "fixes": [
    {
      "report_id": "550e8400",
      "error_code": "SYN042",
      "summary": "Nested generic types fail to parse",
      "status": "resolved",
      "fixed_in_version": "0.16.0",
      "fix_description": "Parser now tracks angle bracket depth for nested generics",
      "fix_commit": "abc123",
      "fix_pr": "https://github.com/user/clean-language-compiler/pull/247",
      "resolved_at": "2026-02-20T10:00:00Z",
      "update_command": "cleen install 0.16.0"
    }
  ],
  "pending": [
    {
      "report_id": "660f9500",
      "error_code": "SEM015",
      "summary": "Type inference fails on recursive generics",
      "status": "in_progress",
      "acknowledged_at": "2026-02-18T09:00:00Z",
      "message": "Being worked on — expected fix in 0.16.1"
    }
  ],
  "current_version": "0.15.0",
  "latest_version": "0.16.0",
  "has_updates": true
}
```

**AI Interaction Flow:**

```
1. AI starts a session and calls `check_reported_fixes`
2. If there are resolved fixes:

   AI: "Good news! A bug you reported has been fixed:

   ✓ SYN042 — Nested generic types now parse correctly
     Fixed in version 0.16.0

   You're on 0.15.0. Update with: cleen install 0.16.0

   Also, SEM015 (type inference on recursive generics) is currently
   being worked on — expected in 0.16.1."

3. If no changes: AI says nothing (no noise)
```

### 9.4 CLI Post-Update Notification

When the user updates the compiler via `cleen install` or `cln update`, the CLI checks locally tracked reports against the new version:

**On update to 0.16.0:**

```
Clean Language Compiler updated to 0.16.0

Bugs you reported that are fixed in this release:
  ✓ SYN042 — Nested generic types now parse correctly
  ✓ COM008 — WASM validation error on empty functions

Thank you for helping improve Clean Language!

Still being tracked:
  ◷ SEM015 — Type inference on recursive generics (in progress)
```

**Implementation:**

```
After successful update:
  1. Read ~/.cleen/telemetry/reported_errors.json
  2. For each report with status != "resolved":
     a. GET /api/v1/reports/:id/status from Error API
     b. If resolved and fixed_in_version <= new_version:
        - Display "fixed" message
        - Update local status to "resolved"
     c. If status changed (e.g., acknowledged → in_progress):
        - Update local status
  3. Display summary
```

### 9.5 Backend Resolution API

New API endpoints for the fix notification system:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/reports/:id/status` | Get current status of a report |
| `GET` | `/fingerprints/:fp/status` | Get status by fingerprint |
| `POST` | `/fingerprints/:fp/resolve` | Mark a fingerprint as resolved (team only) |
| `GET` | `/fixes?since=version` | List all fixes since a given version |

**GET /reports/:id/status**

```json
{
  "report_id": "550e8400",
  "fingerprint": "abc123def456",
  "status": "resolved",
  "fixed_in_version": "0.16.0",
  "fix_description": "Parser now tracks angle bracket depth for nested generics",
  "fix_commit": "abc123",
  "fix_pr": "https://github.com/user/clean-language-compiler/pull/247",
  "resolved_at": "2026-02-20T10:00:00Z",
  "total_reports": 47,
  "unique_users": 23
}
```

**GET /fixes?since=0.15.0**

Returns all errors that were reported against version <= `since` and have been resolved:

```json
{
  "fixes": [
    {
      "fingerprint": "abc123def456",
      "error_code": "SYN042",
      "fixed_in_version": "0.16.0",
      "fix_description": "Parser now tracks angle bracket depth",
      "total_reports": 47
    }
  ],
  "since_version": "0.15.0",
  "latest_version": "0.16.0"
}
```

### 9.6 Team Resolution Workflow

How the team marks errors as resolved:

**Option A: Git commit convention (automated)**

Include the error fingerprint in commit messages:

```
fix(parser): handle nested generic angle brackets

Fixes-Error: SYN042
Fingerprint: abc123def456
```

CI parses the commit message and calls `POST /fingerprints/:fp/resolve` automatically with:
- `fixed_in_version` from Cargo.toml
- `fix_commit` from git SHA
- `fix_pr` from the PR URL

**Option B: Dashboard manual resolution**

Team clicks "Mark Resolved" on the dashboard, enters:
- Fix version
- Fix commit/PR link
- Fix description

**Option C: GitHub Issue close (automated)**

When an auto-created GitHub issue is closed:
1. GitHub webhook notifies the backend
2. Backend extracts fix version from the closing PR
3. Backend marks fingerprint as resolved

All three options can coexist — the system accepts the first resolution event.

### 9.7 Discord Fix Announcements

When an error is resolved, post to the original bug channel:

```
✅ RESOLVED: SYN042 — Nested generic types
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fixed in:    0.16.0
PR:          #247
Reports:     47 from 23 users
Time to fix: 3 days

Users will be notified on their next update or AI session.
```

### 9.8 Preventing Notification Fatigue

| Rule | Implementation |
|------|----------------|
| Only notify about bugs **the user reported** | Check local `reported_errors.json` |
| Only notify **once** per fix | Mark as `"notified": true` locally after displaying |
| Only notify on **status changes** | Compare `last_checked` timestamp |
| AI only mentions fixes **at session start** | Not mid-conversation interruptions |
| CLI only shows fixes **on update** | Not on every compile |
| Cap at **5 fixes per notification** | "...and 3 more. Run `cln fixes` for full list." |

### 9.9 `cln fixes` Command

A CLI command to view all fix history:

```bash
# Show fixes relevant to you (reported errors that were fixed)
cln fixes

# Show all fixes since a version
cln fixes --since 0.14.0

# Show pending reports
cln fixes --pending
```

**Output:**

```
Your reported errors — Fix Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ SYN042  Nested generic types         Fixed in 0.16.0 (3 days ago)
✓ COM008  Empty function validation     Fixed in 0.16.0 (3 days ago)
◷ SEM015  Recursive generic inference   In progress (assigned)
○ RUN003  WASM memory overflow on loop  Reported (2 days ago)

You've reported 4 errors. 2 have been fixed. Thank you!
```

---

## 10. Offline Support & Queuing

### 9.1 Local Queue

When the Error API is unreachable:

1. Report is saved to `~/.cleen/telemetry/pending_reports/<report_id>.json`
2. MCP tool returns `{ "success": false, "queued": true }`
3. On next successful compilation, CLI attempts to flush the queue
4. Queue is capped at 50 reports (oldest dropped first)

### 9.2 Flush Behavior

```
On every `cln compile` invocation:
  1. Check if ~/.cleen/telemetry/pending_reports/ has files
  2. If yes and telemetry is enabled:
     a. Attempt to POST each report to Error API
     b. Remove successfully sent reports
     c. Non-blocking — don't delay compilation
```

---

## 11. GitHub Issues Integration

### 11.1 Auto-Creation Rules

The backend can automatically create GitHub issues when:

| Condition | Action |
|-----------|--------|
| New fingerprint with severity "crash" | Create issue immediately |
| Error reaches 10 unique users | Create issue with "[Community]" label |
| AI confidence is "high" with suggested fix | Create issue with "[AI-Suggested]" label |

### 11.2 Issue Template

```markdown
## Error Report: {error_code}

**Component:** {component}
**Severity:** {severity}
**Compiler Version:** {compiler_version}
**Reports:** {occurrence_count} from {unique_users} users
**First Seen:** {first_occurrence}
**Priority Score:** {priority_score}

### Description

{error_message}

### Minimal Reproduction

```cln
{minimal_repro_code}
```

### Expected Behavior

{expected_behavior}

### Actual Behavior

{actual_behavior}

### AI Analysis

{ai_analysis}

**Suggested file:** {suggested_component_file}
**Confidence:** {confidence}
**Spec reference:** {spec_reference}

### Metadata

- Report ID: {report_id}
- Fingerprint: {fingerprint}
- Dashboard: {tracking_url}

---
*Auto-generated from community error reports*
```

---

## 12. Security Considerations

### 12.1 Data Minimization

- Never store raw source code — only AI-generated minimal repros
- Strip all file paths beyond filename
- No environment variables, no git info
- Anonymous IDs are random UUIDs, not derived from system info

### 12.2 Transport Security

- All API communication over HTTPS (TLS 1.3)
- API key not required for submitting reports (public endpoint)
- Rate limiting prevents abuse
- Reports are validated server-side before storage

### 12.3 Report Validation

Server-side validation before accepting a report:

```
- schema_version must be "1.0.0"
- error_code must match pattern [A-Z]{3}[0-9]{3}
- component must be one of: parser, semantic, codegen, runtime, plugin, cli, unknown
- minimal_repro must be < 5000 characters
- ai_analysis must be < 2000 characters
- No embedded URLs in free-text fields
- No executable content in any field
```

### 12.4 Data Retention

| Data | Retention | Reason |
|------|-----------|--------|
| Individual reports | 1 year | Track resolution |
| Aggregated metrics | Indefinitely | Trend analysis |
| User contact info | 90 days | Follow-up window |
| Pending local reports | 30 days | Flush window |

---

## 13. Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

**Compiler changes:**
- [x] Add `report_error` MCP tool to `src/mcp/server.rs` (tool #16)
- [x] Add `check_reported_fixes` MCP tool to `src/mcp/server.rs` (tool #17)
- [x] Add local report tracking (`~/.cleen/telemetry/reported_errors.json`)
- [x] Add local report queuing (`~/.cleen/telemetry/pending_reports/`)
- [x] Add telemetry config to `~/.cleen/telemetry/config.toml` handling
- [x] Add `cln config set telemetry on/off` CLI command
- [x] Add first-run telemetry prompt

**Deliverable:** MCP tools work, reports saved locally (no backend yet)

### Phase 2: Backend API (Weeks 3-4)

**New service (`clean-error-api/`):**
- [ ] REST API with POST /reports endpoint
- [ ] REST API with GET /reports/:id/status endpoint (fix notification)
- [ ] REST API with GET /fixes?since=version endpoint (fix notification)
- [ ] REST API with POST /fingerprints/:fp/resolve endpoint (team resolution)
- [ ] PostgreSQL schema for reports, fingerprints, and resolution tracking
- [ ] Error fingerprinting and deduplication logic
- [ ] Priority scoring algorithm
- [ ] Rate limiting middleware
- [ ] Health check endpoint

**Deliverable:** Reports sent to backend, deduplicated, stored, resolvable

### Phase 3: Notifications (Week 5)

**Discord integration:**
- [ ] Discord webhook integration
- [ ] Channel routing by component
- [ ] Milestone notifications for duplicates
- [ ] Fix resolution announcements
- [ ] Daily summary cron job

**GitHub integration:**
- [ ] Auto-create issues for high-priority errors
- [ ] Issue template with report data
- [ ] Link issues to fingerprints
- [ ] Auto-resolve on issue close (webhook)

**CI integration:**
- [ ] Parse `Fixes-Error:` / `Fingerprint:` in commit messages
- [ ] Auto-call resolve API on merge to main

**Deliverable:** Team gets real-time notifications, resolutions auto-propagate

### Phase 4: Dashboard (Weeks 6-8)

**Web dashboard:**
- [ ] Overview page with key metrics
- [ ] Error detail view
- [ ] Component and version filtering
- [ ] Resolution tracking (link to commits)
- [ ] Trend visualization

**Deliverable:** Team can browse and manage errors

### Phase 5: CLI Telemetry, Manual Reports & Fix Notifications (Week 9)

**CLI changes:**
- [x] Background telemetry on compile failures (when opted in)
- [x] `cln report` interactive command
- [x] `cln fixes` command (view fix status of reported errors)
- [x] Post-update fix notification (on version change)
- [x] Pending report queue flushing
- [x] First-run prompt implementation

**Deliverable:** Non-AI users can also report errors and get notified of fixes

### Phase 6: Analytics & Refinement (Ongoing)

- [ ] AI suggestion accuracy tracking
- [ ] Regression detection (same fingerprint reappearing)
- [ ] Version comparison analytics
- [ ] Monthly reports for release planning

---

## 14. Cross-Component Considerations

Per the Cross-Component Work Policy, this feature touches multiple components:

| Component | Changes needed | Handled by |
|-----------|---------------|------------|
| **Compiler** (`clean-language-compiler/`) | MCP tool, CLI config, telemetry | Compiler AI instance |
| **Backend** (`clean-error-api/` — NEW) | Full API service | New component |
| **Server** (`clean-server/`) | Runtime error telemetry (Phase 6) | Server AI instance |
| **Framework** (`clean-framework/`) | Plugin error forwarding (Phase 6) | Framework AI instance |
| **Manager** (`clean-manager/`) | Telemetry config in `cleen` tool | Manager AI instance |

Each component's changes should be implemented by its respective AI instance, with cross-component prompts created as needed.

---

## 15. Backend Decision

**The Error API will be a module in the Clean Language Website backend, written in Clean Language itself.** This makes the error reporting system a real-world showcase for the language and its ecosystem (frame.httpserver for routing, frame.data for database). The API endpoints defined in this spec will be routes in the website backend rather than a separate service.

This means:
- No separate `clean-error-api/` repository — it lives as a module in the website backend
- Uses the same database and deployment infrastructure as the website
- The dashboard can be a section of the Clean Language website (`cleanlanguage.dev/errors/`)
- Discord webhooks are triggered from the backend route handlers

---

## 16. Diagnostic Bundles (v2 — AI-Actionable Error Context)

### 16.1 Problem

The v1 error report schema (Section 3) is designed for human triage: an error code, a message, a minimal repro, and an AI's guess about the root cause. This is sufficient for a human developer who can open the codebase and investigate.

But in the Clean Language project, **AI instances are the primary fixers.** The fixer AI is a different instance than the reporter AI — it has no shared context. When it receives a v1 report, it must rediscover where the grammar rule failed, what the partial AST looks like, what the spec says, and which source files implement the failing construct. This rediscovery is expensive, error-prone, and often leads to wrong-path investigations.

### 16.2 Solution: Diagnostic Bundles

A diagnostic bundle is a structured extension to the error report that carries machine-actionable context. It is generated by the component that produces the error and attached to the report as an optional `diagnostic_data` field.

The v1 report tells the fixer **what happened.** The diagnostic bundle tells the fixer **where to look, what the spec says, and how similar bugs were fixed.**

### 16.3 Extended Report Schema (v2)

The v2 schema is backward-compatible with v1. The only addition is the optional `diagnostic_data` field:

```json
{
  "schema_version": "2.0.0",

  "report_id": "uuid-v4",
  "timestamp": "2026-04-11T10:00:00Z",

  "source": {
    "channel": "mcp_ai | cli_telemetry | manual",
    "compiler_version": "0.30.22",
    "server_version": "1.2.0",
    "os": "darwin",
    "arch": "aarch64",
    "runtime": "wasmtime | node | browser | null"
  },

  "error": {
    "code": "SYN001",
    "category": "syntax | semantic | codegen | runtime | system | cross_component",
    "stage": "lexer | parser | semantic | codegen | wasm_load | host_bridge | plugin_expansion",
    "component": "compiler | server | node_server | plugin | framework",
    "severity": "bug | crash | regression | unexpected_behavior",
    "message": "Expected type annotation, found 'fn'",
    "location": {
      "file": "test.cln",
      "line": 42,
      "column": 10
    }
  },

  "reproduction": {
    "minimal_code": "functions:\n\tfn add(integer a, integer b)\n\t\treturn a + b",
    "expected_behavior": "Parse as function definition",
    "actual_behavior": "SYN001: Expected type annotation before function name",
    "spec_rule": "function_def = INDENT , return_type , identifier , '(' , [ param_list ] , ')' ;",
    "spec_reference": "spec/grammar.ebnf:function_def"
  },

  "diagnostic_data": {
    "type": "compiler | server | plugin | cross_component",
    "contents": { }
  },

  "resolution_context": {
    "related_source_files": [
      "src/parser/grammar.pest:function_def",
      "src/parser/parser_impl.rs:parse_function_def"
    ],
    "similar_resolved_reports": [
      {
        "report_id": "REPORT-2026-0042",
        "error_code": "SYN003",
        "fix_commit": "abc123",
        "fix_description": "Added lookahead for return type in function definitions"
      }
    ],
    "failing_test_category": "tests/cln/language/functions/"
  },

  "ai_context": {
    "analysis": "...",
    "suggested_component": "...",
    "suggested_fix": "...",
    "confidence": "high | medium | low"
  },

  "user": {
    "anonymous": true,
    "contact": null,
    "consent_level": "error_only | error_with_code | full | full_with_diagnostics"
  }
}
```

### 16.4 Diagnostic Data by Error Type

The `diagnostic_data.contents` field varies by type:

#### Compiler Errors (type: "compiler")

Generated by the compiler when a parse, semantic, or codegen error occurs.

```json
{
  "type": "compiler",
  "contents": {
    "grammar_rule_stack": [
      "program",
      "top_level_block",
      "functions_block",
      "function_def",
      "return_type"
    ],
    "token_at_failure": {
      "type": "identifier",
      "value": "fn",
      "byte_offset": 412,
      "line": 42,
      "column": 10
    },
    "tokens_before": [
      { "type": "NEWLINE", "value": "\\n" },
      { "type": "INDENT", "value": "\\t" }
    ],
    "tokens_after": [
      { "type": "identifier", "value": "add" },
      { "type": "LPAREN", "value": "(" }
    ],
    "partial_ast": {
      "node_type": "FunctionsBlock",
      "children": [],
      "state": "incomplete",
      "expected_next": "FunctionDef"
    },
    "semantic_context": {
      "current_scope": "module",
      "type_environment": { "integer": "i32", "number": "f64" },
      "visible_symbols": ["print", "math"]
    }
  }
}
```

**Required fields for compiler bundles:**
- `grammar_rule_stack` — Always. This is the single most valuable piece of diagnostic data. Without it, the fixer AI is guessing which grammar path failed.
- `token_at_failure` + `tokens_before` — Always. These let the fixer see what the lexer produced and where parsing diverged from expectation.
- `partial_ast` — When available (some early parse failures produce no AST).
- `semantic_context` — For SEM errors only. Includes scope, type environment, and visible symbols at the failure point.

#### Server/Runtime Errors (type: "server")

Generated by clean-server or clean-node-server when a WASM module fails to load, a host function errors, or a runtime trap occurs.

```json
{
  "type": "server",
  "contents": {
    "wasm_module": "app.wasm",
    "failure_phase": "instantiation | execution | host_call",

    "import_failure": {
      "module": "env",
      "function": "_db_query",
      "expected_signature": "(i32, i32, i32, i32) -> i32",
      "actual_signature": null,
      "registry_entry": {
        "name": "_db_query",
        "layer": 2,
        "params": ["string", "string"],
        "returns": "string",
        "expanded_wasm": "(i32, i32, i32, i32) -> (i32)"
      }
    },

    "host_function_failure": {
      "namespace": "env",
      "function": "_http_route",
      "error_message": "Invalid HTTP method 'PATCH'",
      "arguments_received": [5, 42, 3, 12, 0],
      "memory_around_args": "base64-encoded-bytes"
    },

    "wasm_trap": {
      "trap_type": "unreachable | memory_out_of_bounds | stack_overflow | integer_overflow",
      "instruction_offset": 4872,
      "function_index": 12,
      "function_name": "app::handle_request",
      "call_stack": [
        "app::handle_request (func 12, offset 4872)",
        "app::start (func 0, offset 128)"
      ]
    }
  }
}
```

**Required fields for server bundles:**
- `failure_phase` — Always. Tells the fixer whether this is a linking problem, a runtime crash, or a host function bug.
- `import_failure` — When `failure_phase` is "instantiation." Includes both the expected and actual signatures, plus the `function-registry.toml` entry.
- `host_function_failure` — When a bridge function returns an error. Includes the arguments it received.
- `wasm_trap` — When the WASM module traps. Includes the call stack if available.

#### Plugin Errors (type: "plugin")

Generated when a plugin's DSL block expansion fails.

```json
{
  "type": "plugin",
  "contents": {
    "plugin_name": "frame.server",
    "plugin_version": "2.0.0",
    "plugin_toml_path": "plugins/frame.server/plugin.toml",

    "expansion_failure": {
      "dsl_block_type": "endpoints",
      "input_source": "endpoints:\n\tGET \"/users\" -> listUsers",
      "expansion_output_before_failure": "functions:\n\tstring __route_handler_0()",
      "failure_point": "Bridge function _http_route_protected not declared in plugin.toml",
      "expected_bridge_functions": ["_http_route", "_http_route_protected", "_http_respond"],
      "declared_bridge_functions": ["_http_route", "_http_respond"]
    },

    "bridge_mismatch": {
      "functions_declared_not_in_registry": ["_custom_auth"],
      "functions_used_not_declared": ["_http_route_protected"]
    }
  }
}
```

#### Cross-Component Errors (type: "cross_component")

Generated when a contract test fails or an interface mismatch is detected.

```json
{
  "type": "cross_component",
  "contents": {
    "producer_component": "compiler",
    "consumer_component": "server",
    "contract_file": "platform-architecture/function-registry.toml",
    "interface_type": "wasm_import | plugin_bridge | version_compatibility",

    "mismatch": {
      "function_name": "print_integer",
      "producer_signature": "(i32) -> void",
      "consumer_signature": "(i64) -> void",
      "registry_signature": "(i64) -> void",
      "diagnosis": "Compiler generates i32 import but registry and server expect i64"
    }
  }
}
```

### 16.5 Consent Level Extension

A new consent level is added for diagnostic bundles:

| Level | v1 fields sent | v2 fields sent |
|-------|---------------|---------------|
| `error_only` | Error code, message, compiler version, OS | Same |
| `error_with_code` | Above + minimal reproduction code | Same |
| `full` | Above + AI analysis, suggested fix, file context | Same |
| `full_with_diagnostics` | Above | Above + `diagnostic_data` + `resolution_context` |

The `full_with_diagnostics` level sends the complete bundle. It is never the default — the user must explicitly choose it. The diagnostic data may contain internal compiler state (grammar rule names, AST fragments) that is not sensitive but is more than what `full` sends.

**Privacy rule:** Diagnostic bundles never contain user source code. The `partial_ast` contains node types and structure, not literal code. Token values are included only for the immediate failure point (5 tokens before/after), not the entire file.

### 16.6 Generation Requirements

Each component is responsible for generating its own diagnostic data when producing an error:

| Component | Generates | Required fields |
|-----------|-----------|----------------|
| Compiler (parser) | `type: "compiler"` | `grammar_rule_stack`, `token_at_failure`, `tokens_before` |
| Compiler (semantic) | `type: "compiler"` | `grammar_rule_stack`, `semantic_context` |
| Compiler (codegen) | `type: "compiler"` | `partial_ast`, `tokens_before` |
| clean-server | `type: "server"` | `failure_phase` + relevant sub-object |
| clean-node-server | `type: "server"` | Same as clean-server |
| Framework plugins | `type: "plugin"` | `plugin_name`, `expansion_failure` |
| Contract tests | `type: "cross_component"` | `producer_component`, `consumer_component`, `mismatch` |

### 16.7 Local Storage

Diagnostic bundles are always stored locally, regardless of whether the user consents to send them:

```
~/.cleen/telemetry/diagnostic_bundles/<report_id>.json
```

This allows a fixer AI working locally (not via the backend) to access the full context. The local bundle is retained for 90 days, then deleted.

### 16.8 Resolution Linking

When a report with a diagnostic bundle is resolved, the resolution includes:

```json
{
  "resolution": {
    "fix_commit": "abc123",
    "fix_description": "Added return type lookahead in function_def grammar rule",
    "error_pattern": {
      "code": "SYN001",
      "grammar_rule_stack_signature": "program > functions_block > function_def > return_type",
      "token_at_failure_type": "identifier"
    }
  }
}
```

The `error_pattern` is indexed. When a future diagnostic bundle matches the same pattern (same grammar rule stack, same token type at failure), the backend automatically links it to the previous resolution as `similar_resolved_reports`. This creates a growing knowledge base: the more bugs are fixed, the faster future similar bugs are diagnosed.

### 16.9 MCP Tool Update: `report_error` v2

The existing `report_error` tool (Section 4) gains optional fields for diagnostic data:

```json
{
  "name": "report_error",
  "input_schema": {
    "properties": {
      "...existing v1 fields...",

      "diagnostic_data": {
        "type": "object",
        "description": "Structured diagnostic context generated by the component that produced the error. See schema in Section 16.4. Include only if consent_level is 'full_with_diagnostics'."
      },
      "resolution_context": {
        "type": "object",
        "description": "Related source files, similar resolved reports, and failing test category. Helps the fixer AI locate the fix."
      },
      "spec_rule": {
        "type": "string",
        "description": "The EBNF production rule from grammar.ebnf that defines the expected syntax for this construct."
      }
    }
  }
}
```

The tool is backward-compatible: v1 reports (without `diagnostic_data`) continue to work exactly as before.

---

## 17. Open Questions

1. **Domain path:** Should the API be at `cleanlanguage.dev/api/v1/reports` or a subdomain `errors.cleanlanguage.dev/api/v1/reports`?
2. **GitHub repo:** Should auto-created issues go to the main repo or a dedicated `clean-language-bugs` repo?
3. **Discord server:** Does the Clean Language project already have a Discord, or should one be created?
4. **GDPR/Privacy:** Need a privacy policy page for the telemetry data collection.
