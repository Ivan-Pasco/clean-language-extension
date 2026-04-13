# Claude Code Tooling Strategy

**Purpose:** Define every hook, skill, rule, scheduled task, and configuration that enforces the Project Management Principles automatically.
**Scope:** All components in the Clean Language ecosystem.
**Relationship:** This document specifies WHAT to build. The Project Management Principles specify WHY.

---

## Design Philosophy

The 20 management principles are rules. Rules that depend on someone reading them before every session will be forgotten. This tooling strategy converts principles into **executable guardrails** — hooks that block violations, skills that automate workflows, and schedules that generate reports without being asked.

The hierarchy:

1. **Hooks** prevent violations. An AI instance cannot cross a component boundary, cannot modify a test to make it pass, cannot merge code without tests passing. The hook blocks it before it happens.
2. **Skills** codify workflows. Instead of an AI reading Principle 15 and figuring out how to prioritize upstream, it runs `/upstream` and gets the answer.
3. **Rules** load context. Instead of an AI reading 20 principles, the right subset loads automatically based on which component it's working in.
4. **Schedules** generate reports. Health checks run themselves. Nobody remembers to run them — they just happen.
5. **The plugin** packages everything. Any session, any machine, any component — the full system loads automatically.

---

## 1. Hooks

Hooks are shell commands or prompts that execute automatically at specific points in Claude Code's lifecycle. They enforce principles without relying on the AI instance to remember them.

### 1.1 Session Start — Auto Health Check

**Enforces:** Principle 19 (AI Work Session Protocol — start with current state)

**What it does:** When a session begins, automatically runs the health check for the current component and displays the pass/fail state. The AI starts every session knowing exactly what's broken.

**Event:** `SessionStart`

**Implementation:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/session-health-check.sh"
          }
        ]
      }
    ]
  }
}
```

**Script: `session-health-check.sh`**

Detects which component the current directory belongs to, runs the appropriate health check command, and outputs a summary.

Logic:
- If inside `clean-language-compiler/`: run `cargo test 2>&1 | grep -E 'test result|failures'` and count `.cln` test results from `tests/results/`
- If inside `clean-server/`: run `cargo test 2>&1 | grep -E 'test result|failures'`
- If inside `clean-extension/`: run `npm run compile 2>&1 | tail -3`
- If inside `clean-node-server/`: run `npm test 2>&1 | tail -5`
- If at project root: detect all components present, run a lightweight check for each (build only, not full tests — full tests would be too slow for session start)
- Output format: `[component] [pass_count]/[total] [date]`

**Output example:**
```
Session health check — 2026-04-11
compiler: cargo test → 68/98 lib tests passing
compiler: .cln tests → 104/379 passing (27%)
Component maturity: Foundation
```

The AI receives this as a system message at session start. It doesn't need to run anything — it already knows the state.

**Exit codes:**
- 0: Health check completed (results may show failures — that's information, not a block)
- Non-zero: Health check script itself failed (e.g., cargo not found) — session continues with a warning

---

### 1.2 Cross-Component Boundary Guard

**Enforces:** Principle 1 (Component Isolation)

**What it does:** Before any file edit, checks whether the file being edited belongs to a different component than the current working directory. If it does, the edit is blocked with a message explaining the cross-component prompt process.

**Event:** `PreToolUse`
**Matcher:** `Edit`

**Implementation:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/check-component-boundary.sh"
          }
        ]
      }
    ]
  }
}
```

**Script: `check-component-boundary.sh`**

Receives the file path being edited (from stdin as JSON). Determines which component the file belongs to by checking if the path starts with any of the 11 component prefixes. Determines which component the current working directory belongs to. If they differ, exits with code 2 (blocking).

Logic:
- Extract `file_path` from the JSON input on stdin
- Map file path to component by checking prefixes: `clean-language-compiler/`, `clean-server/`, `clean-extension/`, `clean-framework/`, `clean-manager/`, `clean-node-server/`, `clean-ui/`, `clean-canvas/`, `clean-llm/`, `Clean MCP/`, `clean-cpanel-plugin/`
- Map current working directory (`$PWD`) to component using the same prefixes
- If file component != working directory component: exit 2 with stderr message: "BLOCKED: You are working in [component A] but trying to edit a file in [component B]. Per Principle 1, create a cross-component prompt in management/cross-component-prompts/ instead."
- If same component or file is in shared locations (`management/`, `platform-architecture/`, `spec/`): exit 0

**Exceptions:**
- Files in `management/`, `platform-architecture/`, `spec/`, and project root are shared — edits allowed from any component
- CLAUDE.md files in any component can be read but not written from another component (the Edit matcher catches writes)
- If working from project root (not inside any specific component), all edits are allowed — the root is the coordination level

---

### 1.3 Test File Modification Guard

**Enforces:** Principle 5 (Tests prove the compiler, not the other way around)

**What it does:** When an AI attempts to edit a `.cln` test file, a prompt-type hook asks whether this edit is fixing the test to match the spec (allowed) or changing expected behavior to match the compiler (forbidden). The AI must justify the edit.

**Event:** `PreToolUse`
**Matcher:** `Edit(tests/cln/**)`

**Implementation:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit(tests/cln/**)",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "A test file in tests/cln/ is being edited. Per Principle 5, tests prove the compiler — never modify a test to make it pass. The only allowed reason to edit a test is if it uses syntax that contradicts grammar.ebnf (the formal spec). Examine the edit. Is this: (A) Fixing the test to match the language specification, or (B) Changing expected behavior to match what the compiler currently does? If A, respond with just ALLOW. If B, respond with just BLOCK."
          }
        ]
      }
    ]
  }
}
```

**How prompt hooks work:** The prompt is sent to a lightweight model that evaluates the edit context. It returns ALLOW or BLOCK. If BLOCK, the edit is prevented and the AI receives feedback explaining why.

**Why a prompt and not a script:** A script can check if a test file is being edited but can't understand whether the change is fixing spec compliance or hiding a compiler bug. That requires language understanding — exactly what a prompt hook provides.

---

### 1.4 Post-Edit Test Runner

**Enforces:** Principle 5 (Regressions are blocking), Principle 8 (Quality gates)

**What it does:** After every edit to a Rust source file in the compiler, runs `cargo test --lib` and reports the result. If a previously passing test now fails, the AI is immediately informed of the regression before making more changes.

**Event:** `PostToolUse`
**Matcher:** `Edit(clean-language-compiler/src/**)`

**Implementation:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit(clean-language-compiler/src/**)",
        "hooks": [
          {
            "type": "command",
            "command": "cd clean-language-compiler && cargo test --lib 2>&1 | tail -10"
          }
        ]
      }
    ]
  }
}
```

**Scope:** Only the compiler's `src/` directory. Not tests, not docs, not configs. This keeps the hook fast — `cargo test --lib` runs unit tests only, not integration tests, completing in seconds with incremental compilation.

**Exit code:** Always 0 (non-blocking). The test results are informational — the AI sees them and decides whether to continue or fix the regression. The hook does not block edits. Blocking on every test failure would make iterative development impossible (sometimes you need multiple edits before tests pass).

**Why not run after every edit in every component:** Speed. Running `cargo test` after editing a Markdown file is waste. The hook only fires for Rust source files in the compiler.

**Extension to other components:** Similar hooks can be added for other Rust components (`clean-server/src/**`, `clean-manager/src/**`) and for TypeScript components (`clean-extension/src/**` → `npm run compile`). Each component gets its own fast feedback loop.

---

### 1.5 Commit Quality Gate

**Enforces:** Principle 8 (Quality over speed — do not merge code that doesn't compile or pass tests)

**What it does:** Before a `git commit` command runs, verifies that `cargo test` passes (or the equivalent for non-Rust components). If tests fail, the commit is blocked.

**Event:** `PreToolUse`
**Matcher:** `Bash(git commit*)`

**Implementation:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(git commit*)",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/pre-commit-quality-gate.sh"
          }
        ]
      }
    ]
  }
}
```

**Script: `pre-commit-quality-gate.sh`**

Logic:
- Detect which component has staged changes (using `git diff --cached --name-only`)
- For each component with changes, run its build and test command:
  - Compiler: `cd clean-language-compiler && cargo build && cargo test --lib`
  - Server: `cd clean-server && cargo build && cargo test`
  - Extension: `cd clean-extension && npm run compile`
  - Node server: `cd clean-node-server && npm test`
  - Manager: `cd clean-manager && cargo build && cargo test`
- If any command fails: exit 2 with stderr: "BLOCKED: Tests fail in [component]. Fix before committing."
- If all pass: exit 0

**Why block at commit, not at push:** Catching failures at commit time is cheaper. A broken commit that gets pushed triggers CI, fails, and requires another commit to fix. Catching it locally saves the round-trip.

---

## 2. Skills

Skills are executable workflows invoked with `/skill-name`. Each one automates a specific principle so the AI doesn't need to interpret the principle — it runs the skill and gets the answer.

### 2.1 `/health` — Component Health Check

**Enforces:** Principle 5 (Testing Strategy — generated reports), Principle 19 (Session protocol — know state before and after)

**Location:** `.claude/skills/health/SKILL.md`

**What it does:** Runs the full health check for the current component (or a named component) and produces a structured report. Compares to last known baseline if one exists.

**Arguments:**
- No argument: checks the component in the current directory
- Component name: checks that specific component (e.g., `/health compiler`)
- `all`: checks all components (slower)

**Workflow:**

1. Detect component from current directory or argument
2. Run the health check command for that component (from the table in Principle 5)
3. Parse results into pass/fail counts
4. If a baseline exists in `tests/results/baseline_[component].txt`, compare:
   - New passes (tests that were failing, now passing) — highlight as progress
   - Regressions (tests that were passing, now failing) — highlight as blockers
   - Unchanged failures — list count
5. Output summary:
   ```
   compiler health — 2026-04-11
   Rust lib tests: 68/98 passing
   .cln end-to-end: 104/379 passing (27%)
   Since last baseline (2026-04-10):
     +3 new passes: [test names]
     -1 regression: [test name]
   Maturity level: Foundation
   Next milestone: Reach 60% pass rate
   ```
6. Save current results as the new baseline

**Allowed tools:** `Bash`, `Read`, `Write`, `Glob`

---

### 2.2 `/upstream` — Find the Right Thing to Work On

**Enforces:** Principle 15 (Upstream-first work prioritization)

**Location:** `.claude/skills/upstream/SKILL.md`

**What it does:** Analyzes all failing tests for the current component, categorizes them by compiler stage (or equivalent for non-compiler components), and recommends what to fix first based on the upstream-first rule.

**Workflow:**

1. Run all tests for the current component, capturing individual results
2. For each failing test, determine which stage fails:
   - **Parse error**: The compiler couldn't parse the syntax (grammar.pest issue)
   - **Semantic error**: The compiler parsed it but type checking or scope resolution failed
   - **Codegen error**: Semantic analysis passed but WASM generation failed
   - **Runtime error**: WASM was generated but execution produced wrong output or trapped
   - For server: **Build error**, **Test error**, **Compliance error**
3. Count failures per stage
4. Sort stages by pipeline order (earliest first)
5. Output recommendation:
   ```
   Failure analysis — compiler
   
   Stage breakdown:
     Parse:    42 failures (earliest — fix these first)
     Semantic: 28 failures (some may resolve when parse is fixed)
     Codegen:  15 failures
     Runtime:  19 failures
   
   Recommended focus: Parse stage (42 failures)
   
   Most common parse errors:
     SYN001 (unexpected token): 18 occurrences
     SYN003 (missing element):  12 occurrences
     SYN006 (indentation):       8 occurrences
     Other:                       4 occurrences
   
   Start with SYN001 — fixing it may resolve the most downstream failures.
   ```

**Allowed tools:** `Bash`, `Read`, `Glob`, `Grep`

---

### 2.3 `/feature-status` — Track Feature Completion

**Enforces:** Principle 16 (Feature completion definition)

**Location:** `.claude/skills/feature-status/SKILL.md`

**What it does:** Takes a feature name (e.g., "iterate", "class inheritance", "string interpolation") and checks each completion stage.

**Arguments:**
- Feature name: `/feature-status iterate`
- No argument: scans for all features mentioned in grammar.pest and reports stage for each

**Workflow:**

1. Search `grammar.ebnf` (or `grammar.pest` until migration) for the feature's production rule → **Specified?**
2. Search `tests/specification_parser_tests.rs` for a test that exercises this rule → **Parser test exists?**
3. Search `tests/cln/` for test files that use this feature, attempt to compile each:
   - If compilation fails at parse: stage = Parsed (not yet)
   - If compilation fails at semantic: stage = Parsed
   - If compilation fails at codegen: stage = Analyzed
   - If compilation succeeds but execution fails: stage = Generated
   - If execution succeeds: stage = Executed
4. Check MCP quick reference for the feature → **Documented?**
5. Output:
   ```
   Feature: iterate statement
   
   [x] Specified    — grammar.pest:iterate_statement (line 342)
   [x] Parsed       — Parser accepts iterate syntax
   [x] Analyzed     — Type checking passes
   [ ] Generated    — Codegen fails: "stack balance error in loop body"
   [ ] Executed     — (blocked by codegen)
   [ ] Documented   — Not in MCP quick reference
   
   Current stage: Analyzed
   Blocker: Codegen — stack balance error
   Related test: tests/cln/control_flow/iterate.cln
   ```

**Allowed tools:** `Bash`, `Read`, `Glob`, `Grep`

---

### 2.4 `/coverage` — Spec-to-Test Traceability

**Enforces:** Principle 17 (Spec-to-test traceability)

**Location:** `.claude/skills/coverage/SKILL.md`

**What it does:** Reads the grammar (grammar.pest or grammar.ebnf) and lists every production rule. For each rule, checks whether a corresponding test exists in `tests/cln/spec_compliance/` and whether it passes.

**Workflow:**

1. Parse `grammar.pest` (or `grammar.ebnf`): extract all named rules
2. For each rule, search `tests/cln/spec_compliance/` for a test file that exercises it (by filename convention or by grep for the construct)
3. For each found test, check if it's in the pass list or fail list
4. Categorize:
   - **Covered + passing**: Rule has a test that passes
   - **Covered + failing**: Rule has a test but it fails
   - **Not covered**: No test exists for this rule
5. Output:
   ```
   Spec coverage report — 2026-04-11
   
   Grammar rules: 120 total
     Covered + passing:  45 (37%)
     Covered + failing:  30 (25%)
     Not covered:        45 (38%)
   
   Uncovered rules (highest priority):
     function_def, class_constructor, iterate_range,
     string_interpolation, pairs_type, matrix_literal, ...
   
   Failing covered rules (fix these — test exists but compiler doesn't pass):
     class_inheritance, async_function, error_handler,
     import_block, plugin_block, ...
   ```

**Allowed tools:** `Bash`, `Read`, `Glob`, `Grep`

---

### 2.5 `/triage` — Cross-Component Prompt Triage

**Enforces:** Principle 7 (Cross-component prompts must be triaged)

**Location:** `.claude/skills/triage/SKILL.md`

**What it does:** Reads all prompt files in `management/cross-component-prompts/`, determines which target the current component, checks if each issue still exists, and recommends status updates.

**Arguments:**
- No argument: triage prompts for current component
- `all`: triage all prompts across all components
- Component name: triage prompts for that specific component

**Workflow:**

1. List all `.md` files in `management/cross-component-prompts/` (excluding archive/)
2. Read each file, extract: target component, priority, description, files affected
3. Filter for prompts targeting the current component (or all, if argument is `all`)
4. For each matching prompt:
   - Check if the affected files still exist
   - If the prompt mentions a specific function or signature, grep for it
   - If the code matches the "suggested fix" already, mark as likely resolved
   - If the affected files don't exist, mark as likely obsolete
   - Otherwise, mark as still open
5. Output:
   ```
   Triage report — compiler prompts
   
   Total prompts targeting compiler: 34
   
   Likely resolved (verify and archive):
     compiler-iterate-in-keyword-broken.md — iterate parsing works in current grammar.pest
     compiler-string-literal-assignment-regression.md — string assignment tests pass
   
   Likely obsolete (code no longer exists):
     compiler-companion-file-pattern.md — referenced file was removed
   
   Still open (needs work):
     compiler-plugin-bridge-return-type-not-applied.md — CRITICAL
     compiler-dead-import-elimination-for-plugins.md — MEDIUM
     compiler-enhancement-string-interpolation.md — HIGH
     ... (12 more)
   
   Recommended action: Archive 5 resolved/obsolete, prioritize 3 critical/high.
   ```

**Allowed tools:** `Read`, `Glob`, `Grep`

---

### 2.6 `/maturity` — Component Maturity Assessment

**Enforces:** Principle 20 (Component maturity assessment)

**Location:** `.claude/skills/maturity/SKILL.md`

**What it does:** Evaluates the current component's maturity level based on objective criteria: test pass rate, contract test status, known open issues.

**Workflow:**

1. Run health check for the component
2. Check contract tests:
   - Does the component have contract tests? (yes/no for each interface it participates in)
   - Do they pass?
3. Check TASKS.md for open CRITICAL issues
4. Evaluate:
   - **Foundation**: Test pass rate < 70%, OR missing contract tests, OR open CRITICAL issues
   - **Functional**: Test pass rate 70-95%, contract tests exist (some may fail), no open CRITICAL
   - **Stable**: Test pass rate > 95%, all contract tests pass, no open CRITICAL or HIGH
   - **Mature**: Stable + used in production + no changes in 30 days without issues
5. Output:
   ```
   Maturity assessment — compiler
   
   Test pass rate: 27% (104/379)
   Contract tests: 0/1 (spec_compliance.wat exists in server, not in compiler)
   Open CRITICAL tasks: 2
   
   Level: Foundation
   
   Criteria not met for Functional:
     [ ] Test pass rate >= 70% (currently 27%)
     [ ] All contract tests exist
     [x] No open CRITICAL tasks... FAIL (2 open)
   
   Appropriate work: Fix existing failures only. No new features.
   Next milestone: Reach 60% test pass rate. Resolve 2 CRITICAL tasks.
   
   Dependency check:
     Upstream: spec/ (no blockers)
     Downstream blocked: server, framework, extension, MCP
       (these cannot advance past Foundation until compiler reaches Functional)
   ```

**Allowed tools:** `Bash`, `Read`, `Glob`, `Grep`

---

## 3. Per-Component Rules

Rules load automatically based on which files the AI is working in. They replace the need to read the full 20-principle document by delivering only the relevant subset.

### 3.1 Rule Structure

**Location:** `.claude/rules/`

```
.claude/rules/
├── tier1-foundations.md              # Always loaded. Principles 1-3.
├── tier2-quality.md                  # Loaded for all code work. Principles 4-9.
├── compiler-work.md                  # Loaded when working in compiler.
├── server-work.md                    # Loaded when working in server.
├── extension-work.md                 # Loaded when working in extension.
├── test-work.md                      # Loaded when editing tests.
└── spec-work.md                      # Loaded when editing spec files.
```

### 3.2 Rule: `tier1-foundations.md`

**Applies to:** All files (no path filter)

**Contents:**

```markdown
# Foundational Rules (Always Active)

## Component Isolation
- You may only edit files in the component matching your current working directory
- Cross-component issues go to management/cross-component-prompts/
- Shared specs (spec/, platform-architecture/, management/) can be edited from any context

## Execution Layers
- Layer 0 (Compiler): parse, analyze, generate WASM imports — never implement I/O
- Layer 2 (Host Bridge): portable I/O — defined in function-registry.toml
- Layer 3 (Server Extensions): HTTP-only functions
- If unsure which layer: check platform-architecture/EXECUTION_LAYERS.md

## Specification Authority
- grammar.ebnf (or grammar.pest until migration) defines core language syntax
- spec/plugins/<name>.ebnf defines plugin syntax extensions (one per plugin)
- function-registry.toml defines host function signatures
- semantic-rules.md defines type checking rules
- When spec and code disagree, the spec is right. Fix the code.
```

### 3.3 Rule: `compiler-work.md`

**Applies to:** `clean-language-compiler/**`

```markdown
---
paths:
  - "clean-language-compiler/**"
---

# Compiler Work Rules

## Maturity: Foundation
This component has significant test failures. Fix existing failures only. No new features.

## Priority Order
Fix upstream stages first: lexer → parser → semantic → codegen → runtime.
Do not work on codegen bugs if parser bugs exist for the same construct.

## Stage Tests Required
Every fix must have a stage-level Rust test (not just end-to-end .cln):
- Parser fix → test in tests/specification_parser_tests.rs
- Semantic fix → test in tests/semantic_tests.rs
- Codegen fix → test in tests/codegen_tests.rs

## Regression Rule
If cargo test shows a previously passing test now fails, stop current work and fix the regression first.

## Read Before Working
- KNOWLEDGE.md in this component for known fragile areas
- TASKS.md for current priorities
```

### 3.4 Rule: `server-work.md`

**Applies to:** `clean-server/**`

```markdown
---
paths:
  - "clean-server/**"
---

# Server Work Rules

## Maturity: Functional
Core host bridge works. Focus on completing missing bridge functions and contract tests.

## Contract Test Authority
function-registry.toml is the single source of truth for all host function signatures.
Every new or changed function must pass spec_compliance.wat.

## Bridge Function Checklist
When adding a host function:
1. Verify it exists in function-registry.toml with exact signature
2. Implement in host-bridge/src/ (Layer 2) or src/bridge.rs (Layer 3)
3. Run cargo test — spec compliance test must pass
4. Create cross-component prompt for clean-node-server to add parity implementation
```

### 3.5 Rule: `test-work.md`

**Applies to:** `**/tests/**`

```markdown
---
paths:
  - "**/tests/**"
---

# Test Editing Rules

## Tests prove the compiler
Never modify a test to make it pass. Fix the compiler instead.

## Exception
If the test uses syntax that contradicts grammar.ebnf (or grammar.pest), the test is wrong.
Fix the test to match the spec, then fix the compiler if it still fails.

## New tests
Before creating a test, check the category folder for existing coverage.
New spec compliance tests go in tests/cln/spec_compliance/ mirroring the spec structure.
All compiled output goes to tests/output/ — never in the source tree.
```

---

## 4. Scheduled Tasks

Scheduled tasks run health checks and triage automatically so the project state is always known.

### 4.1 Daily Health Check

**Schedule:** Every day at 09:00 local time
**Command:** `/health all`

**What it does:** Runs health checks across all components, compares to yesterday's baseline, saves results. The next session that starts sees the report in memory.

**Configuration:**

```
/schedule "0 9 * * *" Run /health all. Save the report to management/reports/daily-health/YYYY-MM-DD.md. Highlight any regressions.
```

**Output saved to:** `management/reports/daily-health/2026-04-11.md`

---

### 4.2 Weekly Triage

**Schedule:** Every Monday at 09:00
**Command:** `/triage all`

**What it does:** Triages all cross-component prompts. Identifies resolved and obsolete ones. Reports how many actionable prompts remain per component.

**Configuration:**

```
/schedule "0 9 * * 1" Run /triage all. Save the report to management/reports/weekly-triage/YYYY-MM-DD.md. If any prompts are clearly resolved, move them to the archive folder.
```

---

### 4.3 Weekly Spec Coverage

**Schedule:** Every Wednesday at 09:00
**Command:** `/coverage`

**What it does:** Measures spec-to-test coverage. Tracks whether coverage is improving week over week.

**Configuration:**

```
/schedule "0 9 * * 3" Run /coverage. Save the report to management/reports/weekly-coverage/YYYY-MM-DD.md. Compare to last week's report and note changes.
```

---

## 5. MCP Server Integration

### 5.1 Existing: Clean Language MCP Server

Already configured in `.mcp.json`. Provides: `get_quick_reference`, `check`, `compile`, `parse`, `get_specification`, `list_functions`, `list_types`, `list_builtins`, `list_plugins`, `get_architecture`, `explain_error`.

Used by Principle 11 (MCP before writing .cln code).

No changes needed. Already working.

### 5.2 Proposed: GitHub MCP Server

**Purpose:** Automate the error reporting pipeline (Principle 14). When a diagnostic bundle identifies a high-priority bug, automatically create a GitHub issue. When a fix is merged, automatically close the issue and update the error report status.

**Configuration:**

```json
{
  "mcpServers": {
    "github": {
      "command": "gh",
      "args": ["mcp-server"]
    }
  }
}
```

**Use cases:**
- `/triage` can check if a cross-component prompt already has a GitHub issue
- Contract test failures can auto-create issues
- CI results can be checked from within a session without leaving Claude Code

### 5.3 Proposed: Project Health MCP Server

**Purpose:** Expose project state as MCP tools that any AI instance can call. Instead of parsing raw `cargo test` output, the AI calls `get_component_health("compiler")` and gets structured JSON.

**Tools it would expose:**

| Tool | Returns |
|------|---------|
| `get_component_health` | Pass/fail counts, maturity level, regressions since baseline |
| `get_spec_coverage` | Grammar rules covered/uncovered/failing |
| `get_upstream_failures` | Failures sorted by pipeline stage |
| `get_feature_status` | Completion stage for a named feature |
| `get_open_prompts` | Cross-component prompts targeting a given component |

**Implementation:** A small Rust or Python service that reads test results, grammar.pest, TASKS.md, and cross-component prompts, and returns structured responses.

**Why an MCP server instead of just skills:** MCP tools are available to any AI instance in any context — including subagents, agent teams, and scheduled tasks. Skills require being invoked explicitly. An MCP server makes project health queryable from anywhere.

**Priority:** Lower than hooks and skills. Build this after the core tooling is working and the overhead of parsing raw output becomes a bottleneck.

---

## 6. Subagent Definitions

### 6.1 QA Agent

**Purpose:** Comprehensive quality assurance after significant changes.

**Location:** `.claude/agents/qa/AGENT.md`

**Trigger:** After completing a batch of fixes, invoke to verify nothing was broken.

```markdown
---
name: qa
description: Run comprehensive quality assurance on the current component
allowed-tools: Bash Read Glob Grep
---

Run a full quality check:
1. cargo test (all tests, not just lib)
2. For compiler: run scripts/test_all_files.sh and capture per-file results
3. Compare to baseline — identify regressions and new passes
4. Check for todo!() macros in src/
5. Check for #[ignore] tests without justification comments
6. Report findings as a structured summary
```

### 6.2 Explore Agent for Research

**Purpose:** Deep codebase research without polluting the main context.

Used when the main session needs to understand something complex (e.g., "how does the codegen handle class method calls?") without reading 50 files into the main context window.

Already available as `subagent_type: Explore`. No custom definition needed — just use it with a good prompt.

### 6.3 Contract Test Agent

**Purpose:** Verify all cross-component interfaces.

**Location:** `.claude/agents/contracts/AGENT.md`

```markdown
---
name: contracts
description: Verify all cross-component contracts are satisfied
allowed-tools: Bash Read Glob Grep
---

Check every cross-component interface:
1. Read platform-architecture/function-registry.toml — list all functions
2. In clean-server: run cargo test for spec_compliance — does it pass?
3. In clean-node-server: check if equivalent tests exist
4. In clean-framework/plugins: for each plugin.toml, verify every bridge function exists in registry
5. Report which contracts are verified, which are missing tests, which fail
```

---

## 7. Plugin Package

All of the above — hooks, skills, rules, agents, MCP config — packaged as a single plugin that loads automatically.

### 7.1 Plugin Structure

```
clean-project-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── health/SKILL.md
│   ├── upstream/SKILL.md
│   ├── feature-status/SKILL.md
│   ├── coverage/SKILL.md
│   ├── triage/SKILL.md
│   └── maturity/SKILL.md
├── agents/
│   ├── qa/AGENT.md
│   └── contracts/AGENT.md
├── hooks/
│   ├── session-health-check.sh
│   ├── check-component-boundary.sh
│   └── pre-commit-quality-gate.sh
└── rules/
    ├── tier1-foundations.md
    ├── tier2-quality.md
    ├── compiler-work.md
    ├── server-work.md
    ├── extension-work.md
    ├── test-work.md
    └── spec-work.md
```

### 7.2 Plugin Manifest

```json
{
  "name": "clean-project",
  "description": "Management principles, quality enforcement, and workflow automation for the Clean Language ecosystem",
  "version": "1.0.0",
  "author": { "name": "Clean Language Team" }
}
```

### 7.3 What Loading the Plugin Provides

Every AI session, in any component, automatically gets:
- Session health check on start
- Cross-component boundary enforcement
- Test modification guard
- Post-edit test feedback (compiler)
- Commit quality gate
- `/health`, `/upstream`, `/feature-status`, `/coverage`, `/triage`, `/maturity` skills
- QA and contract test agents
- Per-component rules loaded by path
- Scheduled daily health checks and weekly triage

Nothing needs to be remembered. Nothing needs to be manually invoked at session start. The plugin IS the management principles, executable.

---

## Implementation Priority

Build in this order. Each item is independently useful — you don't need them all to get value.

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| 1 | Session start hook (1.1) | Every session starts with truth | Small — one shell script |
| 2 | `/health` skill (2.1) | One command for full component state | Medium — test parsing logic |
| 3 | `/upstream` skill (2.2) | Directs work to highest-impact fixes | Medium — failure categorization |
| 4 | Post-edit test runner hook (1.4) | Instant regression feedback | Small — one-line command |
| 5 | Cross-component boundary hook (1.2) | Prevents accidental boundary violations | Small — path comparison script |
| 6 | Per-component rules (3.x) | AI reads only relevant principles | Small — extract from principles doc |
| 7 | Test file modification guard (1.3) | Prevents hiding bugs behind test changes | Small — prompt hook |
| 8 | `/coverage` skill (2.4) | Measures real spec verification | Medium — grammar parsing |
| 9 | Commit quality gate hook (1.5) | No broken commits | Medium — multi-component detection |
| 10 | `/triage` skill (2.5) | Clears the 124-prompt backlog | Medium — prompt analysis |
| 11 | `/feature-status` skill (2.3) | Honest progress tracking | Medium — multi-stage checking |
| 12 | `/maturity` skill (2.6) | Objective maturity assessment | Small — aggregates other skills |
| 13 | Daily health schedule (4.1) | Continuous monitoring | Small — schedule config |
| 14 | QA agent (6.1) | Deep post-fix verification | Small — agent definition |
| 15 | Contract test agent (6.3) | Cross-component verification | Medium — multi-repo checking |
| 16 | Project health MCP server (5.3) | Structured state access from anywhere | Large — new service |
| 17 | Full plugin package (7.x) | Everything portable and automatic | Medium — packaging |
| 18 | CI .cln end-to-end tests (Principle 22) | Catches codegen regressions that unit tests miss | Medium — test runner script + CI yaml |
| 19 | Bug-fix test guard hook (Principle 21) | Blocks fix commits without accompanying tests | Small — prompt hook |
| 20 | Codegen path audit (Principle 23) | Eliminates dual-path regression class entirely | Large — analysis + deletion + verification |
| 21 | Workaround cleanup tracking | Measures and reduces CRITICAL FIX / HACK count | Small — grep + baseline count |

---

## 8. CI End-to-End Test Runner

**Enforces:** Principle 22 (CI tests what ships)

### Script: `scripts/run_ci_tests.sh`

Compiles, validates, and executes every `.cln` file in `tests/cln/ci/`. Compares results against a stored baseline. Exits non-zero if any baseline test regresses.

**Logic:**

1. Build the compiler binary (`cln`)
2. For each `.cln` file in `tests/cln/ci/`:
   a. Compile to WASM: `cln compile <file> --output tests/output/<name>.wasm`
   b. Execute with wasmtime runner: `wasmtime_runner tests/output/<name>.wasm`
   c. Compare stdout to expected output (from `<file>.expected` or `// Expected:` comment)
   d. Record: pass, fail-compile, fail-execute, fail-output
3. Load baseline from `tests/results/ci_baseline.json`
4. Compare: if any test that passed in baseline now fails → REGRESSION → exit 1
5. If all baseline tests pass, update baseline with any new passes
6. Print summary: `X/Y passing, Z regressions, W new passes`

**CI integration:**

```yaml
- name: End-to-end .cln tests
  run: |
    cargo build --bin cln --bin wasmtime_runner --release
    bash scripts/run_ci_tests.sh
```

### 8.1 Bug-Fix Test Guard

**Enforces:** Principle 21 (Every bug fix starts with a failing test)

**Event:** `PreToolUse`
**Matcher:** `Bash(git commit*)`

**Implementation:** A prompt hook that examines the staged diff. If the diff modifies files in `src/` (fix code) but does not modify or add files in `tests/` (test code), the hook asks the AI to justify why no test was added.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(git commit*)",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Per Principle 21, every bug fix must have an accompanying test. Check the staged changes: are there modifications to src/ files? If yes, are there also modifications or additions to test files (tests/)? If src/ is changed but tests/ is not, respond with BLOCK unless the commit message indicates this is a docs-only, config-only, or version-bump change. If tests are included or the change doesn't touch src/, respond with ALLOW."
          }
        ]
      }
    ]
  }
}
```

---

## Document History

| Date | Change |
|------|--------|
| 2026-04-11 | Initial version. Complete specification of hooks, skills, rules, schedules, agents, MCP integration, and plugin packaging for the Clean Language project. |
| 2026-04-12 | Added CI end-to-end test runner (Section 8), bug-fix test guard hook (8.1), and implementation priorities 18-21 for Principles 21-23. |
