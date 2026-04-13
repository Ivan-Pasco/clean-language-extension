# Clean Language Project — Management Principles

**Status:** Active
**Scope:** All components in the Clean Language ecosystem
**Enforcement:** Every AI instance and contributor must read this before working on any component.

---

## Compliance Checklist

Before completing any work session, verify:

**Session start:**
```
[ ] Read CLAUDE.md for this component (Principle 19)
[ ] Ran health check command — know pass/fail state before changing anything (Principle 19)
[ ] Reviewed active cross-component prompts targeting this component (Principle 7)
[ ] Checked TASKS.md for this component (Principle 10)
[ ] Checked component maturity level — work is appropriate for that level (Principle 20)
```

**During work:**
```
[ ] Working on earliest-stage failures first (Principle 15)
[ ] All changes are in the correct component folder (Principle 1)
[ ] New functions are in the correct execution layer (Principle 1)
[ ] grammar.ebnf was updated before implementing syntax changes (Principle 2)
[ ] No todo!() macros, dummy returns, or stubs in changed files (Principle 4)
[ ] No test files were modified to make them pass (Principle 5)
[ ] No language knowledge was hardcoded in the extension (Principle 6)
[ ] Information is documented in exactly one place (Principle 3)
[ ] Error handling produces error codes, not silent defaults (Principle 4)
[ ] MCP get_quick_reference was called before writing .cln code (Principle 11)
[ ] Change propagation follows the correct order (Principle 12)
[ ] Feature completion stage is tracked accurately (Principle 16)
[ ] Bug fix has a failing test written BEFORE the fix (Principle 21)
[ ] Changes to codegen are in the single active path only (Principle 23)
[ ] No unimplemented spec features left behind — all spec items have matching code (Principle 24)
[ ] No code functionality exists without a corresponding spec entry (Principle 24)
[ ] Spec changes were approved by the developer before implementation (Principle 25)
```

**Before closing:**
```
[ ] cargo build / npm run compile succeeds (Principle 8)
[ ] cargo test / npm test passes with zero regressions (Principle 8)
[ ] New code has corresponding tests (Principle 8)
[ ] Change is consistent with grammar.ebnf or function-registry.toml (Principle 8)
[ ] Contract tests pass in downstream components if interface was touched (Principle 9)
[ ] TASKS.md updated if the change resolves or creates a tracked issue (Principle 10)
[ ] Ran health check again — delta reported (Principle 19)
[ ] Cross-component prompts created for issues in other components (Principle 7)
[ ] Non-obvious discoveries recorded in KNOWLEDGE.md (Principle 18)
[ ] End-to-end .cln CI tests still pass (Principle 22)
[ ] No new CRITICAL FIX / WORKAROUND / HACK markers added (Principle 4)
```

---

## Principle Hierarchy

Not all principles are equal. They are organized in four tiers:

**Tier 1 — Foundational.** These define what the project IS. Violating them creates structural damage that cascades across components.

| # | Principle |
|---|-----------|
| 1 | Component isolation and execution layers |
| 2 | The language specification is EBNF |
| 3 | Documentation has one home |
| 24 | Spec-implementation parity |
| 25 | Specification change control |

**Tier 2 — Operational.** These define HOW work is done. Violating them introduces bugs and rework.

| # | Principle |
|---|-----------|
| 4 | All code is honest |
| 5 | Testing strategy |
| 6 | The language server is the single source of truth for IDE intelligence |
| 7 | Cross-component prompts must be triaged |
| 8 | Quality over speed |
| 9 | Cross-component interfaces are contract-tested |
| 21 | Every bug fix starts with a failing test |
| 22 | CI tests what ships |
| 23 | One codegen path |

**Tier 3 — Strategy.** These define what to work on and in what order. They turn principles into directed progress.

| # | Principle |
|---|-----------|
| 15 | Upstream-first work prioritization |
| 16 | Feature completion definition |
| 17 | Spec-to-test traceability |
| 18 | Knowledge accumulation between sessions |

**Tier 4 — Process.** These define the workflow for specific activities.

| # | Principle |
|---|-----------|
| 10 | TASKS.md tracks decisions, not status |
| 11 | MCP server before writing Clean code |
| 12 | Change propagation order |
| 13 | Version and release discipline |
| 14 | Errors produce diagnostic bundles |
| 19 | AI work session protocol |
| 20 | Component maturity assessment |

**Reading order:** Tier 1 always. Tier 3 before starting work (it tells you WHAT to work on). Tier 2 during work (it tells you HOW). Tier 4 for specific activities.

---

## 1. Component Isolation and Execution Layers

### What this means

The project has two structural rules that are inseparable: every component has one job (isolation), and every function belongs to exactly one execution layer (discipline). Together they answer two questions for any piece of work: **where does this code live?** and **what layer does this function belong to?**

#### Components

| Component | Folder | What it does |
|-----------|--------|-------------|
| Compiler | `clean-language-compiler/` | Reads `.cln` source files, parses them, type-checks them, and generates `.wasm` binary output |
| Framework | `clean-framework/` | Provides the full-stack web framework with plugin definitions (endpoints, data, auth, UI) |
| Manager | `clean-manager/` | Installs, switches, and manages compiler versions and related binaries on the developer's machine |
| Extension | `clean-extension/` | VS Code / Cursor extension that connects to the language server; displays diagnostics, completions, highlighting |
| Server | `clean-server/` | Runs compiled `.wasm` modules, providing host bridge functions (file I/O, HTTP, database, crypto) |
| Node Server | `clean-node-server/` | Alternative runtime in Node.js/TypeScript that provides the same host bridge functions as the Rust server |
| UI | `clean-ui/` | UI component system for Clean Language applications |
| Canvas | `clean-canvas/` | Canvas rendering and drawing primitives |
| LLM | `clean-llm/` | LLM integration module for AI-powered features |
| MCP | `Clean MCP/` | Model Context Protocol server that exposes compiler tools to AI assistants |
| cPanel Plugin | `clean-cpanel-plugin/` | Hosting integration plugin for cPanel control panels |

#### Execution Layers

| Layer | Component | What belongs here | Examples |
|-------|-----------|-------------------|----------|
| 0 | Compiler | Parsing, type checking, WASM code generation. The compiler generates `import` declarations for functions it doesn't implement. | `parse()`, `type_check()`, `generate_wasm()` |
| 1 | WASM Runtime | Pure computation that runs inside WASM without any external calls. Math intrinsics, memory operations. | `i32.add`, `f64.mul`, `memory.grow` |
| 2 | Host Bridge | Portable I/O operations that any runtime (Rust server, Node server) must provide. These are functions the WASM module imports and the host fills in. | `print()`, `file.read()`, `http.get()`, `db.query()`, `crypto.hash()` |
| 3 | Server Extensions | Functions that only make sense in a server context. They depend on having an HTTP request/response cycle. | `_http_route()`, `_req_param()`, `_http_respond()`, `_auth_require_role()` |
| 4 | Plugins | Custom bridge functions declared by framework plugins in their `plugin.toml`. The compiler sees these as additional imports; the server provides implementations. | `_db_query()`, `_template_render()` |
| 5 | Framework/Apps | High-level abstractions built on top of all lower layers. User application code. | `endpoints:` blocks, `component:` blocks, user functions |

### Why this principle exists

The project had a boundary violation where the manager absorbed ~2,900 lines of framework code. Separately, functions implemented in the wrong layer caused subtle failures — a file-reading function in the compiler worked during compilation but failed at runtime; a math function routed through the host bridge worked but was orders of magnitude slower than necessary. Component isolation and layer discipline are the same structural concern: **everything has one correct home.**

### The layer decision rule

Ask: **Does this function need to access anything outside WASM memory?**

- **No** → Layer 1 (pure WASM computation)
- **Yes, and it's I/O that works on any platform** → Layer 2 (host bridge)
- **Yes, and it requires an HTTP server context** → Layer 3 (server extension)
- **Yes, and it's defined by a plugin** → Layer 4
- **Too complex for WASM but pure computation** (e.g., regex) → Layer 2 (host bridge provides optimized native implementation)
- **Pure on some platforms but needs I/O on others** → Layer 2 (treat as I/O; host decides the implementation)

### Shared code between components

Some types and formats are used by multiple components (e.g., the structure of `plugin.toml`, the error report schema, the function-registry TOML format). These shared definitions live in the specification documents (`platform-architecture/`, `spec/`), not in any component's source code. Each component implements its own parser for the shared format based on the specification. Components do not share source code.

### Rules

- An AI instance working inside one component must NOT edit files inside another component.
- When work in one component reveals a bug in another, create a prompt in `management/cross-component-prompts/`.
- Each component has its own CLAUDE.md, CI/CD, and test suite.
- Reading other components for interface understanding is allowed. Writing is not.
- Before implementing any function, check `platform-architecture/EXECUTION_LAYERS.md` to confirm the correct layer. If the function is not listed, determine its layer using the decision rule, add it to the execution layers document, then implement.

Full boundary definitions: `management/ARCHITECTURE_BOUNDARIES.md`

---

## 2. The Language Specification is EBNF

### What this means

The syntax of Clean Language is defined using EBNF (Extended Backus-Naur Form). Not Markdown prose. Not examples. Not tutorials.

A formal grammar removes all ambiguity. When someone asks "can I put a `functions:` block inside a class?", the answer is a production rule:

```ebnf
class_def       = "class" , identifier , NEWLINE , class_body ;
class_body      = { INDENT , ( field_decl | functions_block | constructor_def ) , NEWLINE } ;
functions_block = "functions" , ":" , NEWLINE , function_def , { NEWLINE , function_def } ;
```

This rule says: yes, `functions_block` is one of the allowed elements inside `class_body`. No interpretation needed.

### Why this principle exists

The project used a 4,244-line Markdown document as its language specification. It mixed syntax descriptions, semantic rules, tutorials, and API docs. AI instances read prose like "Functions must be in a `functions:` block" and still produced wrong code because the prose didn't specify indentation requirements, separator rules, or nesting constraints. EBNF eliminates this class of error entirely.

### Structure

| File | Purpose | Format |
|------|---------|--------|
| `spec/grammar.ebnf` | Core language syntax — every valid construct without plugins | EBNF notation |
| `spec/plugins/frame-server.ebnf` | Syntax extensions added by frame.server plugin | EBNF notation |
| `spec/plugins/frame-data.ebnf` | Syntax extensions added by frame.data plugin | EBNF notation |
| `spec/plugins/frame-ui.ebnf` | Syntax extensions added by frame.ui plugin | EBNF notation |
| `spec/plugins/frame-auth.ebnf` | Syntax extensions added by frame.auth plugin | EBNF notation |
| `spec/plugins/frame-canvas.ebnf` | Syntax extensions added by frame.canvas plugin | EBNF notation |
| `spec/semantic-rules.md` | What the compiler checks after parsing — type errors, scope violations, each with a numbered code (SEM001, SEM002...) | Numbered rule list |
| `spec/type-system.md` | Which types are compatible, how precision modifiers work, what conversions are allowed | Structured tables |
| `spec/stdlib-reference.md` | Every built-in function with its exact signature, parameter types, and return type | Signature tables |
| `spec/examples/` | One `.cln` file per language concept, each compilable and testable | Executable code |

### Plugins are language extensions — they get EBNF too

Framework plugins are not libraries. They extend the language itself. When `frame.server` adds `endpoints:`, `GET`, `POST`, `handle:`, and `guard:` — those are new grammar productions. When `frame.data` adds `data:` with field declarations and migration syntax — those are new grammar productions. They deserve the same rigor as core syntax.

Each plugin EBNF defines exactly:
- What top-level blocks the plugin introduces (e.g., `endpoints`, `data`, `component`)
- What sub-blocks are valid inside them (e.g., `handle:`, `guard:`, `cache:` inside an endpoint)
- What attribute syntax each block accepts
- What expressions and statements are valid in each context
- What keywords the plugin reserves

The core grammar defines a single extension point for plugins:

```ebnf
top_level_block = start_block | functions_block | class_def | external_block
               | plugin_block ;
plugin_block    = plugin_name , ":" , NEWLINE , plugin_body ;
```

Each plugin EBNF defines what `plugin_body` contains for that plugin. For example, `frame-server.ebnf` would define:

```ebnf
(* frame.server grammar extension *)
server_block      = "endpoints" , [ "server" ] , ":" , NEWLINE , { endpoint_def } ;
endpoint_def      = INDENT , http_method , path_pattern , ":" , NEWLINE , endpoint_body ;
http_method       = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" ;
path_pattern      = string_literal ;
endpoint_body     = { INDENT , INDENT , ( guard_block | cache_block | handle_block | statement ) } ;
guard_block       = "guard" , ":" , NEWLINE , guard_rules ;
handle_block      = "handle" , ":" , NEWLINE , { statement } ;
```

This separates three concerns into three homes:

| Concern | Home | Format |
|---------|------|--------|
| Plugin syntax (what's valid to write) | `spec/plugins/<name>.ebnf` | EBNF |
| Plugin semantics (what it means, how it behaves) | `clean-framework/documents/specification/` | Prose + tables |
| Plugin bridge contract (what functions the host provides) | `plugin.toml` + `function-registry.toml` | TOML |

No duplication. The EBNF says what you can write. The framework spec says what it does. The TOML says what the runtime provides.

### Rules

- `grammar.ebnf` is the single source of truth for core language syntax. The compiler's `grammar.pest` is an implementation of this spec. If they diverge, `grammar.pest` is wrong.
- Each plugin EBNF in `spec/plugins/` is the single source of truth for that plugin's syntax. The plugin's `expand()` function in `src/main.cln` is an implementation. If they diverge, the implementation is wrong.
- Every syntax question must be answerable by reading `grammar.ebnf` (plus the relevant plugin EBNF, if the question involves a plugin block) without reading prose.
- Examples exist for illustration. They do not define the language. An example that contradicts an EBNF is a wrong example.
- When adding a feature to the core language: update `grammar.ebnf` first, then implement in the compiler. Never implement first and document later.
- When adding a feature to a plugin: update the plugin's EBNF first, then update the plugin's `src/main.cln` and `plugin.toml`. Never implement first and document later.
- The `plugin.toml` `[language]` section (keywords, types, functions) must be derivable from the plugin EBNF. If the EBNF doesn't define a keyword, the keyword doesn't belong in `plugin.toml`.

### Migration path

The current spec is the Markdown file at `clean-language-compiler/documentation/Clean_Language_Specification.md`. The framework specs are in `clean-framework/documents/specification/`. They will be decomposed:

**Core language:**

1. Extract all syntax rules from the Markdown spec and from `grammar.pest` into `spec/grammar.ebnf`
2. Extract all semantic rules into `spec/semantic-rules.md` with numbered codes
3. Extract all type compatibility rules into `spec/type-system.md`
4. Extract all stdlib function signatures into `spec/stdlib-reference.md`
5. Move current Markdown spec to `documentation/legacy/`
6. Update every CLAUDE.md to reference `spec/`

**Plugin grammars:**

7. For each plugin (`frame.server`, `frame.data`, `frame.ui`, `frame.auth`, `frame.canvas`): extract syntax rules from the framework spec (`03_frame_server.md`, etc.), from `plugin.toml` keyword/block definitions, and from the plugin's `src/main.cln` expand function into `spec/plugins/<name>.ebnf`
8. Cross-reference each plugin EBNF against its `plugin.toml` — every keyword, block, and type in the TOML must correspond to an EBNF production
9. The framework specs (`clean-framework/documents/specification/`) remain as the semantic/behavioral reference — they describe what the constructs mean, not what's syntactically valid. Remove any syntax definitions from them that are now covered by the EBNF.

### Verification

A syntax question is answered correctly if and only if the answer can be derived from `grammar.ebnf` (and the relevant plugin EBNF, if applicable) without reading any other file.

---

## 3. Documentation Has One Home

### What this means

Every type of information has exactly one authoritative location. All other references point to it — they do not copy it.

| Information | Authoritative location |
|-------------|----------------------|
| Core language syntax | `spec/grammar.ebnf` |
| Plugin syntax extensions | `spec/plugins/<name>.ebnf` (one per plugin) |
| Plugin semantics & behavior | `clean-framework/documents/specification/` |
| Plugin bridge contracts | `plugin.toml` + `platform-architecture/function-registry.toml` |
| Semantic rules | `spec/semantic-rules.md` |
| Type system | `spec/type-system.md` |
| Standard library | `spec/stdlib-reference.md` |
| Component boundaries | `management/ARCHITECTURE_BOUNDARIES.md` |
| Execution layers | `platform-architecture/EXECUTION_LAYERS.md` |
| Host function signatures | `platform-architecture/function-registry.toml` |
| Memory layout | `platform-architecture/MEMORY_MODEL.md` |
| Project management | This document |
| Error reporting & diagnostic bundles | `platform-architecture/ERROR_REPORTING_SPECIFICATION.md` |
| Task tracking | `TASKS.md` (per component) |

### Why this principle exists

When the same information exists in two places, they diverge. The project experienced this with: the Markdown spec vs. grammar.pest, the extension keyword list vs. the compiler, and TASKS.md pass rates vs. actual test results.

### Rules

- If you discover the same information in two places, delete one. Decide which is authoritative (using the table above) and remove the duplicate.
- CLAUDE.md files reference authoritative documents with links. They do not copy or summarize — summaries go stale.
- Tutorials and books live in `books and content/`. They are teaching aids, not specifications. If a tutorial contradicts `grammar.ebnf`, the tutorial is wrong.

---

## 4. All Code is Honest

### What this means

This principle governs three facets of the same idea: code doesn't pretend, bugs aren't hidden, and failures are loud.

#### No placeholders, no stubs, no workarounds

Every line of code must do real work.

- No `todo!()` macros in production code
- No functions that return dummy values (`return 0`, `return false`, `return ""`)
- No simplified implementations that handle easy cases and silently fail on edge cases
- No commented-out code left "for reference"

If a feature cannot be fully implemented: document it in TASKS.md and write no code. An empty slot is honest. A stub that pretends to work is a lie.

#### Fix root causes, not symptoms

When something breaks:

1. **Read the error.** Compiler errors have codes (SYN001, SEM002) — look them up.
2. **Trace to the origin.** If a WASM stack is unbalanced, the problem is in the codegen that produced the extra value. Not in the test, not in the validator.
3. **Fix the origin.** Don't add guards, wrappers, or fallbacks around it.
4. **Verify with tests.**

What this prohibits:
- Adding `if` guards to suppress errors instead of finding why the error occurs
- Adding `drop` instructions to consume extra WASM values instead of finding which codegen path produces them
- Widening a type to `any` instead of tracing why inference produced the wrong type
- Adding error recovery that silently skips constructs instead of fixing the grammar rule

#### No silent failures

Every operation either succeeds or fails loudly with a clear, specific error.

- No empty catch blocks. Caught errors must be logged or re-thrown.
- No default values on failure. Invalid input returns an error, not zero.
- No silent skipping. If the parser encounters unknown syntax, it emits a diagnostic with an error code.
- No false-green CI. Test runners exit non-zero when any test fails.
- No indefinitely ignored tests. `#[ignore]` is temporary (with a comment) or the test is deleted.

### Why this principle exists

The project has experienced all three failure modes:

- A stub returned a dummy value, downstream code treated it as real, and the bug surfaced three components later.
- A WASM stack error was "fixed" by adding `drop` instructions; the underlying codegen bug caused different failures the next week.
- A test runner exited 0 after printing failures to stderr; CI reported green for months.

Each of these cost more to debug than doing it right would have cost.

### Enforcement

- Every compiler diagnostic has a mandatory error code (SYN001, SEM002, GEN001, etc.) defined in `spec/semantic-rules.md`. A diagnostic without a code is incomplete.
- CI check: `grep -r "todo!()" src/` must return zero matches in production code.
- Test runner exit codes reflect failure: non-zero when any test fails.
- CI fails on any test failure, any compiler warning in critical paths, and any spec compliance violation.

---

## 5. Testing Strategy

### What this means

This principle unifies the project's approach to testing: what tests prove, how they're structured, and how results are reported.

#### Tests prove the compiler, not the other way around

Test files represent what the language should do, as defined by the specification. When a test fails, the default assumption is that the compiler has a bug. The burden of proof is on the compiler.

- **Never modify a test to make it pass.** Fix the compiler.
- **One exception:** If the test uses syntax that contradicts `grammar.ebnf`, the test is genuinely wrong. Fix the test to match the spec, then fix the compiler if it still fails.
- All test files live in `tests/cln/` organized by category.
- All compiled WASM output goes to `tests/output/`.
- Before creating a new test, check the category folder for existing coverage.
- The goal is 100% pass rate. Work continues until every test passes.

#### Every compiler stage has its own tests

End-to-end tests are necessary but not sufficient. When one fails, you need to know which stage broke.

| Stage | What tests verify | Test location |
|-------|-------------------|---------------|
| Lexer | Every token type, keyword, literal, precision modifier | `tests/specification_lexer_tests.rs` |
| Parser | Every grammar rule produces correct AST nodes | `tests/specification_parser_tests.rs` |
| Semantic | Type checking, scope resolution, error codes | `tests/semantic_tests.rs` |
| Codegen | WASM output validity, correct imports, stack balance | `tests/codegen_tests.rs` |
| End-to-end | Source → WASM → execute → correct output | `tests/cln/**/*.cln` |

**Rule:** When a `.cln` test fails:
1. Determine which stage fails (parse? type? codegen? runtime?)
2. Check whether that stage's Rust tests cover the failing construct
3. If not, write a stage-level test that isolates the failure
4. Fix the stage-level test first, then verify the end-to-end test passes

#### Regressions are treated as blocking

A regression is when a previously passing test starts failing. Regressions are more serious than existing failures because they represent lost ground.

- A commit that causes a previously passing test to fail must be fixed before merging. Regressions are not "new tasks" — they are blockers.
- CI compares current results to a baseline. A test that was passing in the baseline and is now failing is flagged as a regression, distinct from tests that were already failing.
- The baseline is updated only when all tests pass or when a deliberate spec change invalidates a test (in which case the test is updated to match the new spec, not deleted).

#### Test results are generated, not written

The project's test status must come from running the tests, not from manually written numbers.

- A single command produces the current pass/fail report for each component. That command's output is the truth.
- Any claim about test pass rates must include the command that produced the number and the date it was run.

**Health check commands:**

| Component | Command | What it proves |
|-----------|---------|---------------|
| Compiler | `cargo test && scripts/test_all_files.sh` | All Rust stage tests pass + all .cln files compile |
| Server | `cargo test` | Host bridge + Layer 3 + spec compliance against registry |
| Node Server | `npm test` | Host bridge parity with Rust server |
| Extension | `npm run compile && npm test` | Extension builds and LSP client functions |
| Manager | `cargo test` | Version management + compatibility matrix |
| Framework | `cargo test` (per plugin) | Plugin manifests valid + bridge declarations match registry |
| MCP | Test command TBD | Spec index matches current compiler spec |

**Report format:** `[component] [pass_count]/[total] [date]`. Detailed failures go to `tests/results/`.

---

## 6. The Language Server is the Single Source of Truth for IDE Intelligence

### What this means

The VS Code extension is a thin client. It connects to the language server (inside the compiler) via LSP. The extension contains no knowledge about Clean Language — no keyword lists, no type names, no syntax rules, no completion logic.

All IDE intelligence comes from the language server:
- Syntax highlighting (semantic tokens)
- Completions
- Hover information
- Diagnostics

### Why this principle exists

The extension previously had hardcoded keyword lists in its TextMate grammar. When the compiler added new keywords, the extension wasn't updated. Two sources of truth diverged. The fix: strip all language knowledge from the extension.

### Enforcement

- `clean-extension/syntaxes/*.tmLanguage.json` must contain ONLY lexical tokens: comments, string literals, numeric literals, and operators. No keywords, no type names, no block names.
- **Violation test:** A grep for any Clean Language keyword (e.g. `"functions"`, `"integer"`, `"iterate"`) inside the TextMate grammar files is a boundary violation.
- The extension must NOT fall back to built-in syntax highlighting when the language server is unavailable.
- Any new keyword, type, or built-in added to the compiler is automatically available in the IDE. Zero extension changes required.

---

## 7. Cross-Component Prompts Must Be Triaged

### What this means

When an AI instance working in one component discovers a bug in another, it creates a prompt in `management/cross-component-prompts/`. These are the handoff mechanism between component boundaries (Principle 1).

### Why this principle exists

The project accumulated 124 prompts, many stale or obsolete. Without triage, the folder becomes a graveyard of forgotten issues.

### Rules

- Every prompt has a status at the top: `open`, `resolved`, or `obsolete`.
- `resolved` and `obsolete` prompts move to `management/cross-component-prompts/archive/`.
- Before starting work on a component, review active prompts targeting that component.
- New prompts include: **Component**, **Issue Type** (bug/feature/enhancement/compatibility), **Priority** (critical/high/medium/low), **Description** (specific), **Context** (how discovered), **Suggested Fix** (if known), **Files Affected** (specific paths).
- A prompt that says "something is broken in the server" is not actionable. It must say "function `_http_route` in `clean-server/src/bridge.rs:78` returns i32 but `function-registry.toml` declares the return type as void."

### Triage responsibility

When an AI instance begins a work session on a component, it is responsible for triaging any prompts targeting that component that are older than 7 days. Triage means: verify the issue still exists, update the status, and either fix it (if in scope) or re-prioritize it.

---

## 8. Quality Over Speed

### What this means

The project prioritizes correct, tested, well-placed code over fast delivery. A feature that works on the first deployment is more valuable than one that ships today and breaks three things tomorrow.

### Why this principle exists

Rushed implementations introduced cascading errors. A host function with the wrong signature passed server tests but broke every WASM module that imported it. A hasty parser rule worked for simple cases but broke 40 existing tests. Debugging cost 3-5x what careful implementation would have taken.

### Quality gates

Checked in order. Each must pass before the next:

1. **Build:** `cargo build` (or equivalent) succeeds cleanly
2. **Existing tests:** All existing tests pass — zero regressions
3. **New tests:** The change has test(s) that exercise the new or modified behavior
4. **Spec consistency:** The change matches `grammar.ebnf` (syntax) or `function-registry.toml` (host functions)
5. **Task tracking:** TASKS.md updated if the change resolves or creates a tracked issue
6. **Contract tests:** If the change touches a cross-component interface, downstream contract tests pass (Principle 9)

### Rules

- Do not merge code that doesn't compile.
- Do not merge code without tests.
- Do not implement a feature before the spec for it exists.
- Do not implement a feature across multiple components simultaneously — complete one, verify, then propagate (Principle 12).
- When in doubt about where something belongs, check `ARCHITECTURE_BOUNDARIES.md`.

---

## 9. Cross-Component Interfaces Are Contract-Tested

### What this means

A "cross-component interface" is any place where two components must agree on the same thing. A "contract test" is an automated test that verifies both sides agree, reading the shared specification and checking each side matches.

### Why this principle exists

The project has 7 cross-component interfaces. Only one (compiler → server via `spec_compliance.wat`) is contract-tested. The other 6 can silently break when either side changes.

### Required contract tests

| Interface | What must match | Where the test lives | How it verifies |
|-----------|----------------|---------------------|----------------|
| Compiler → Server | WASM imports match host functions | `clean-server/` (`spec_compliance.wat`) | Declares all imports in WAT, instantiates against server linker |
| Compiler → Node Server | Same WASM imports work with Node server | `clean-node-server/` | Port of `spec_compliance.wat` to TypeScript |
| Plugin bridge → Server | Every plugin.toml function is implemented in server | `clean-server/` | Parse plugin.toml, check each function exists |
| Plugin bridge → Registry | Every plugin.toml function exists in registry | `clean-framework/` | Cross-reference plugin.toml with function-registry.toml |
| MCP → Compiler spec | MCP index matches current spec | `Clean MCP/` | Hash spec files, compare to MCP's index |
| Manager → Framework versions | Declared compatibility actually works | `clean-manager/` | Compile a minimal .cln with each compatible plugin |

### Rule

When adding a host function, the change is not complete until every contract test that touches it passes. A function in the registry but not in the server (or vice versa) is a bug, not a task.

---

## 10. TASKS.md Tracks Decisions, Not Status

### What this means

Every component has a `TASKS.md`. It answers "what work is planned and why" — not "how many tests pass." Test status comes from running tests (Principle 5). TASKS.md tracks the reasoning behind priorities, tradeoffs, and sequencing decisions.

### Why this principle exists

TASKS.md claimed "100% pass rate" for 3 months while actual results showed 33%. The file mixed metrics (which go stale) with decisions (which remain relevant). When the metrics were wrong, the entire document lost credibility.

### Format

Each task includes:
- **Date added** (absolute date, not "today")
- **Priority** — CRITICAL (blocks compilation), HIGH (significant impact), MEDIUM (non-blocking), LOW (improvement)
- **Status** — Open, in progress, completed (with date)
- **Description** — What the issue is
- **Affected files** — Which files need changes
- **Expected behavior** — What should happen after the fix

### Rules

- When you discover a bug while working on something else, add it to TASKS.md immediately.
- When you complete a task, mark it complete with date and a one-line note.
- **No test counts or percentages in TASKS.md.** Those belong in generated reports.
- Every task has a date. Tasks older than 30 days without an update are re-evaluated: still relevant? Fixed by other work? Re-prioritize or remove.
- Do not leave TASKS.md untouched for months.

---

## 11. MCP Server Before Writing Clean Code

### What this means

Any AI instance writing `.cln` code must first call `get_quick_reference` from the MCP server. This returns current syntax, types, keywords, and patterns as the compiler understands them. The AI uses this — not training data, not memorized patterns, not old documentation.

This principle applies specifically to writing Clean Language source code (`.cln` files, test files, examples). It does not apply to writing Rust, TypeScript, or other implementation code in the components themselves.

### Why this principle exists

Clean Language is evolving. AI training data has a cutoff date. The MCP server is always current because it reads from the compiler itself.

### Available MCP tools

| Tool | When to use it |
|------|---------------|
| `get_quick_reference` | **Always first.** Complete syntax cheat sheet. |
| `check` | After writing code. Fast type-check, no WASM generation. |
| `compile` | When code is ready. Full compilation to WASM. |
| `parse` | To see AST structure. |
| `get_specification` | Detailed docs on a specific feature. |
| `list_functions` | All functions in a source file. |
| `list_types` | All type/class definitions. |
| `list_builtins` | Complete built-in catalog. |
| `list_plugins` | Available plugins with DSL blocks. |
| `explain_error` | Error code explanation with fix suggestions. |

### Enforcement

- `.cln` code not preceded by `get_quick_reference` is suspect.
- After writing `.cln` code, call `check` to verify it compiles. The compiler confirms, not the AI's judgment.
- If `check` returns errors, call `explain_error` with the error code. Do not guess at solutions.
- If the MCP server and `grammar.ebnf` disagree, that is a bug. File it in TASKS.md. For immediate work, follow the MCP server (it reflects what the compiler actually accepts now).

---

## 12. Change Propagation Order

### What this means

When a change affects multiple components, there is one correct order. Each step is verified before the next begins.

### Why this principle exists

The project experienced "propagation bugs" where a change was made in several components at once. Some got it right, others got it wrong, and the inconsistency wasn't detected until runtime.

### For language syntax changes (new keyword, new construct)

1. **Update `spec/grammar.ebnf`** — Define the syntax formally
2. **Update `spec/semantic-rules.md`** — Define type/scope rules and error conditions
3. **Implement in compiler** — `grammar.pest` → parser → semantic → codegen
4. **Verify:** `cargo test` passes in compiler
5. **If host functions needed:** Update `function-registry.toml`
6. **Implement in clean-server**
7. **Verify:** `cargo test` passes in clean-server (including spec compliance)
8. **Implement in clean-node-server**
9. **Verify:** `npm test` passes
10. **Update MCP server spec index**
11. **Language server picks up changes automatically** — no extension update needed

### For host function changes (new function or signature change)

1. **Update `function-registry.toml`** — the authority
2. **Implement in clean-server**
3. **Verify:** Spec compliance passes
4. **Implement in clean-node-server**
5. **Verify:** Parity test passes
6. **Update plugin.toml** if function is plugin-exposed
7. **Update compiler registry** if function is a built-in

### For plugin changes (new DSL block or bridge function)

1. **Update plugin.toml** — declare block and/or bridge functions
2. **Verify:** Every bridge function exists in `function-registry.toml` (if not, add it — triggers host function sequence above)
3. **Implement plugin expansion** in framework
4. **Verify:** Compiler parses and expands the plugin block
5. **Verify:** Server provides all declared bridge functions

### When a step fails

- **Spec failure (steps 1-2):** Fix the spec. No code has been written yet — cheapest point to iterate.
- **Compiler failure (steps 3-4):** Fix the compiler. No downstream component is affected.
- **Server failure (steps 6-7):** The compiler already has the feature. Create a cross-component prompt for the server. The feature is available for compilation but not for execution until the server catches up. Do NOT revert the compiler — that's working code.
- **Node server failure (steps 8-9):** Same as server. The Rust server works; the Node server is behind. Create a prompt, do not revert the Rust server.

### Rule

No step may be skipped. No step may be done out of order. If step N fails, fix it before proceeding. The cost of going back after propagating a broken change is always higher.

---

## 13. Version and Release Discipline

### What this means

The project has multiple independently versioned components. Each release must be deliberate, documented, and compatible with the components it interfaces with.

### Why this principle exists

The project has a version manager, a compatibility matrix, and 11 components. Without clear rules, version numbers become meaningless and compatibility claims become untested assertions.

### What constitutes a breaking change

A change is breaking if it causes any previously working program or integration to fail:

- **Compiler:** Changing syntax that existing `.cln` files use. Changing error codes. Removing a built-in function.
- **Server:** Changing a host function signature. Removing a host function. Changing the WASM import module name.
- **Framework/Plugins:** Changing a plugin.toml bridge function signature. Removing a DSL block. Changing expansion output format.
- **Manager:** Changing CLI command names or flags. Changing install paths.

Adding new functions, new syntax, or new plugin blocks is NOT breaking — it only extends.

### Rules

- **function-registry.toml changes are always breaking unless they only add new functions.** Changing a parameter type, changing a return type, renaming a function, or removing a function breaks every WASM module that imports it.
- Every release has a changelog entry that describes what changed and whether it's breaking.
- The compatibility matrix in `clean-manager/src/core/compatibility.rs` must be updated when a new compiler or framework version is released. This matrix is tested (Principle 9).
- Breaking changes require a major version bump. Non-breaking additions require a minor bump. Bug fixes require a patch bump.
- A version number is assigned at release time, not during development.

---

## 14. Errors Produce Diagnostic Bundles

### What this means

When any component produces an error, it generates a **diagnostic bundle** — a structured package of everything needed to reproduce, locate, and fix the problem without guessing.

A diagnostic bundle is not an error message. An error message tells a human what went wrong. A diagnostic bundle tells a fixer AI **where to look, what the spec says should happen, what actually happened, and how similar bugs were fixed before.**

### Why this principle exists

The project's error reports (v1) are designed for human triage: error code, message, minimal repro, AI guess about root cause. But AI instances do the fixing, and the fixer AI is a different instance than the reporter — with no shared context. The fixer spends most of its time rediscovering context through trial and error. The diagnostic bundle pre-loads that context.

### Bundle contents per layer

**Compiler errors (Layer 0):**
- grammar_rule_stack: which grammar.pest rules were being evaluated, in order
- token_at_failure: the exact token that caused the failure
- tokens_context: 5 tokens before and after the failure point
- partial_ast: the AST built before the failure
- spec_rule: the EBNF production rule that defines the expected syntax
- related_source_files: compiler files that implement the failing rule
- similar_resolved_reports: past reports with the same pattern and how they were fixed
- failing_test_category: which `tests/cln/` subfolder the reproduction belongs in

**Server/runtime errors (Layer 2-3):**
- wasm_import_that_failed: the import declaration that couldn't be satisfied
- expected_signature: what function-registry.toml says
- actual_signature: what the server provides (if anything)
- host_function_name: which bridge function was executing
- request_context: for Layer 3, the HTTP method, route, and handler

**Plugin errors (Layer 4):**
- plugin_name and plugin.toml entry
- input_dsl_block: the DSL source being expanded
- expansion_output: what the plugin produced before failing
- bridge_functions_missing: declared functions not in the server

**Cross-component errors:**
- producer and consumer components
- contract_file: which spec defines the contract
- producer_value vs consumer_expectation

### The fix loop

```
1. Error occurs → component generates diagnostic bundle (always, locally)
2. User consents → bundle attached to error report sent to backend
3. Fixer AI receives bundle:
   a. Reads spec_rule → knows what SHOULD happen
   b. Reads grammar_rule_stack or import failure → knows WHERE it failed
   c. Reads partial_ast or memory_state → knows WHAT went wrong
   d. Reads related_source_files → knows WHERE to look in code
   e. Reads similar_resolved_reports → knows HOW similar bugs were fixed
   f. Creates test in failing_test_category → proves the fix
   g. Fixes the code
   h. Runs test → verifies
   i. Marks report resolved with commit hash
```

### Rules

- Every compiler error must include the grammar rule stack and token context.
- Every WASM load failure must include the failing import and expected signature.
- Every host bridge error must include the function name and namespace.
- Bundles are always generated locally. Sending to backend requires consent.
- Resolutions include the commit hash. The backend links error patterns to fixes, building a knowledge base: the more bugs are fixed, the faster future similar bugs are diagnosed.

Full schema: `platform-architecture/ERROR_REPORTING_SPECIFICATION.md`, Section 16.

---

## 15. Upstream-First Work Prioritization

### What this means

The compiler is a pipeline. Each stage feeds the next. A bug in an earlier stage makes all downstream stages unreliable. Therefore: **always fix the earliest failing stage first.**

```
Lexer → Parser → Semantic → Codegen → WASM execution
```

If 10 tests fail at the parser and 30 fail at codegen, fix the parser first. Some of those codegen failures may be caused by wrong AST nodes flowing out of the parser. Fixing upstream first means fixes compound — one parser fix may resolve multiple codegen failures for free.

The same logic applies across the entire ecosystem. The compiler feeds the server. The server feeds the framework. Don't fix framework plugin bugs if the server doesn't provide the bridge functions yet.

```
Spec → Compiler → Server → Node Server → Framework → Extension/MCP
```

### Why this principle exists

Without prioritization guidance, an AI instance picks whatever failure looks interesting or whatever test file comes first alphabetically. With 212 failing tests, scattered work produces scattered results — each fix is isolated, nothing compounds. The project has experienced sessions where an AI spent hours fixing codegen for string operations while the parser didn't even handle the string syntax correctly. The codegen fix was immediately invalidated when the parser was later corrected.

### The prioritization process

At the start of a work session:

1. Run the health check command for your component
2. Categorize failures by stage: how many fail at parse? At semantic? At codegen? At runtime?
3. Work on the stage with the most failures that is earliest in the pipeline
4. After fixing a batch of failures at that stage, re-run health check — some downstream failures may have resolved automatically
5. Repeat

### Applied to cross-component work

When deciding which component to work on:

1. **Compiler first.** It's the foundation. If it doesn't parse, nothing works.
2. **Server second.** It runs the WASM. If host functions are wrong, all apps fail.
3. **Node server third.** Parity with Rust server.
4. **Framework fourth.** Depends on both compiler and server being stable.
5. **Extension/MCP last.** These expose what already works — they don't add functionality.

### Rule

Never work on a downstream stage or component when there are known failures upstream that could be causing the downstream failures. Fix upstream first, re-test, then address remaining downstream issues.

---

## 16. Feature Completion Definition

### What this means

A language feature moves through stages. It is "done" only when ALL stages are complete. Reporting a feature as implemented when only parsing works is false progress — the feature doesn't work for users until it executes correctly.

| Stage | What it means | How to verify |
|-------|--------------|---------------|
| **Specified** | The construct exists in `grammar.ebnf` and `semantic-rules.md` | The EBNF rule exists. Semantic rules cover its type and scope behavior. |
| **Parsed** | The compiler's parser accepts it and produces correct AST | A stage-level parser test passes for this construct. |
| **Analyzed** | The semantic analyzer type-checks it correctly | A stage-level semantic test passes. Types and scopes are correct. |
| **Generated** | The codegen produces valid, stack-balanced WASM | A stage-level codegen test passes. WASM validates. |
| **Executed** | A program using the feature produces correct output when run | An end-to-end `.cln` test passes. |
| **Documented** | The MCP quick reference includes it | `get_quick_reference` returns the feature. |

### Why this principle exists

The project has features at every intermediate stage. `iterate` may parse but produce wrong WASM. String interpolation may type-check but crash at runtime. Without stage tracking, the project can't answer "what actually works end-to-end?" versus "what partially works?" TASKS.md claimed features as complete when they only passed the parser.

### How to track

TASKS.md tracks features by their current stage:

```
- [2026-04-11] iterate statement: Specified, Parsed, Analyzed — Codegen not started
- [2026-04-11] string interpolation: Specified, Parsed — Analyzed fails (SEM issue with type inference in interpolation context)
- [2026-04-11] class inheritance: Specified, Parsed, Analyzed, Generated, Executed — Done
```

### Rule

A feature is not "implemented" until it reaches the **Executed** stage. A feature is not "complete" until it reaches **Documented**. Any other stage is explicitly partial. When communicating progress, state the current stage, not just "working" or "done."

---

## 17. Spec-to-Test Traceability

### What this means

Every production rule in `grammar.ebnf` and every semantic rule in `semantic-rules.md` has a corresponding test. The mapping is explicit and maintained. A spec rule without a test is an untested claim. A test without a spec rule is an undocumented behavior.

### Why this principle exists

The project has 379 test files and an 860-line grammar. But nobody can answer: "which grammar rules have passing tests and which don't?" The tests are organized by category (core/types, language/functions, etc.) but don't map to specific spec rules. It's possible to have 379 tests that all exercise the same 20% of the grammar while 80% is untested.

### The mapping

Each spec rule maps to one or more test files in `tests/cln/spec_compliance/`:

```
spec/grammar.ebnf                →  tests/cln/spec_compliance/
  function_def                    →  spec_compliance/functions/function_def.cln
  class_def                       →  spec_compliance/classes/class_def.cln
  iterate_statement               →  spec_compliance/control_flow/iterate.cln
  string_interpolation            →  spec_compliance/expressions/string_interpolation.cln

spec/semantic-rules.md            →  tests/cln/spec_compliance/
  SEM001 (type mismatch)          →  spec_compliance/semantic/sem001_type_mismatch.cln
  SEM002 (undefined symbol)       →  spec_compliance/semantic/sem002_undefined_symbol.cln
  SEM003 (redefinition)           →  spec_compliance/semantic/sem003_redefinition.cln
```

### Coverage reporting

The health check can report spec coverage alongside test pass rates:

```
Compiler: 280/379 tests passing (73%)
Spec coverage: 45/120 grammar rules have passing tests (37%)
Semantic coverage: 12/30 semantic rules have passing tests (40%)
```

This separates "how many tests pass" (quantity) from "how much of the language is verified" (coverage). You can have a high pass rate with low coverage if all tests exercise the same features.

### Rules

- When adding a new rule to `grammar.ebnf`, add a corresponding test in `spec_compliance/`.
- When a spec_compliance test fails, it has higher priority than other tests because it represents a gap between what the language promises and what the compiler delivers.
- The `spec_compliance/` folder mirrors the spec structure. If the spec has sections for functions, classes, control flow, types, and expressions, so does the test folder.
- Periodically audit: for each grammar rule, does a passing test exist? Rules without passing tests are tracked in TASKS.md.

---

## 18. Knowledge Accumulation Between Sessions

### What this means

Each component has a `KNOWLEDGE.md` file that captures non-obvious discoveries made during work sessions. This is institutional memory — things that would waste significant time if rediscovered from scratch.

### Why this principle exists

Each AI work session starts fresh. If one session discovers that "codegen for string operations is fragile because function call indices depend on registration order in `registry.rs`," that insight is lost. The next session may waste hours rediscovering the same thing. The project has experienced this repeatedly — the same fragile areas cause the same confusion across sessions.

### What goes in KNOWLEDGE.md

- **Surprising behavior** that would waste time if rediscovered. Example: "Pest parser greedily consumes `>` in generic types, causing `Array<Array<integer>>` to fail. The outer `>` is consumed as part of the inner type. The workaround is lookahead, but the real fix requires changes to `type_` rule in grammar.pest."
- **Fragile areas** where changes have historically caused cascading failures. Example: "Changing function registration order in `src/builtins/registry.rs` breaks all string operations because codegen uses hardcoded Call indices. Must update codegen whenever registry order changes."
- **Dependency relationships** that aren't obvious from code structure. Example: "The `iterate` statement codegen depends on both the loop codegen AND the list access codegen. Fixing iterate without fixing list indexing first won't work."
- **Cross-component context** — when the correct fix requires changes in another component and the current state is a known compromise. Example: "Server returns i32 for `_http_route` but registry says void. The server is correct for now — a cross-component prompt exists. Don't change the compiler to match the wrong registry entry."

### What does NOT go in KNOWLEDGE.md

- Anything derivable from reading the code (architecture, function signatures)
- Test results (generated by running tests, not written)
- Task status (belongs in TASKS.md)
- Spec definitions (belong in `spec/`)
- Debugging steps for specific bugs (the fix is in the commit; the knowledge is why the area is fragile)

### Rules

- At the end of a work session, if you discovered something that took significant time to figure out and isn't obvious from the code, add it to KNOWLEDGE.md for the component.
- Keep entries concise — one paragraph per discovery. Include the specific file and line if relevant.
- When a knowledge entry becomes obsolete (the fragile area was fixed, the dependency was removed), delete it. Stale knowledge is misleading knowledge.
- KNOWLEDGE.md is read at the start of every session (part of the AI work session protocol, Principle 19).

---

## 19. AI Work Session Protocol

### What this means

Every AI work session — regardless of which component or what task — follows a defined protocol. This ensures consistency: every session starts with current state, works on the right things, and leaves the project measurably better.

### Why this principle exists

Without a standard protocol, each AI session makes ad-hoc decisions about what to read, what to work on, and when to stop. One session reads CLAUDE.md but not TASKS.md. Another dives into fixing a bug without checking if there are upstream failures causing it. Another finishes work without recording what it learned. The result: inconsistent quality, wasted effort, lost insights.

### Start protocol

Before making any changes:

1. **Read CLAUDE.md** for the component you're working in. It has build commands, architecture, and component-specific rules.
2. **Read Tier 1 principles** from this document (Principles 1-3) at minimum. Read Tier 3 (Principles 15-18) to know what to work on.
3. **Run the health check command** for the component. Record the pass/fail state. You need to know what's broken before you start changing things.
4. **Read KNOWLEDGE.md** for the component. It tells you what previous sessions discovered about fragile areas and non-obvious dependencies.
5. **Review active cross-component prompts** targeting this component. There may be issues from other components that affect your work.
6. **Check TASKS.md** for this component. Know what's tracked and prioritized.
7. **Check the component's maturity level** (Principle 20). It determines what kind of work is appropriate.

### Work protocol

While making changes:

8. **Apply upstream-first prioritization** (Principle 15). Fix the earliest-stage failures first.
9. **For each fix:** write or verify the stage-level test first, then fix the code, then verify the end-to-end test passes.
10. **Follow quality gates** in order: build → existing tests → new tests → spec consistency → contract tests (Principle 8).
11. **Track feature stages** accurately (Principle 16). If you advanced a feature from "Parsed" to "Analyzed," record that.

### Close protocol

Before ending the session:

12. **Run the health check command again.** Compare to the start. Report the delta: "Started at 280/379 passing. Ending at 295/379 passing. +15 tests fixed."
13. **Update TASKS.md:** Mark completed tasks. Add newly discovered issues with dates.
14. **Create cross-component prompts** for any issues found in other components.
15. **Update KNOWLEDGE.md** if you discovered something non-obvious that would save future sessions time.
16. **If test pass rate improved:** Note which specific tests now pass and what change fixed them. This helps identify which fixes have the highest compound value.

### Rule

The start and close protocols are not optional. An AI session that skips the health check comparison can't prove it left the project better than it found it. A session that skips KNOWLEDGE.md may repeat past mistakes. The protocol is the minimum structure that ensures compound progress.

---

## 20. Component Maturity Assessment

### What this means

Each component has a maturity level that determines what kind of work is appropriate. Building new features on an unstable foundation creates more work than it saves. Maturity levels prevent this by matching work type to component readiness.

| Level | Meaning | Appropriate work | NOT appropriate |
|-------|---------|-----------------|-----------------|
| **Foundation** | Core functionality is incomplete or unreliable. Tests have significant failure rates. | Fix existing failures. Improve test coverage. No new features. | Adding features. Refactoring. Performance optimization. |
| **Functional** | Core works. Edge cases fail. Some contract tests missing. | Fix edge cases. Add contract tests. Limited new features that don't touch unstable areas. | Large new features. Architectural changes. |
| **Stable** | All tests pass. Contracts verified. Spec coverage is high. | New features. Performance improvements. Refactoring. | Risky rewrites without justification. |
| **Mature** | Stable + used in production by real users. | Bug fixes. Carefully reviewed enhancements. Security patches. | Speculative features. Major internal changes. |

### Why this principle exists

The project has 11 components at different stages of readiness. The compiler has a 33% test pass rate — it's Foundation level. Working on the framework's plugin UI features (which depend on the compiler and server both working) is building on sand. Similarly, optimizing the server's performance when it's missing contract tests for 5 of 6 interfaces is premature.

Without maturity assessment, effort distributes evenly or randomly across components. With it, effort concentrates where it has the most impact: getting Foundation components to Functional, then Functional to Stable.

### Current assessment

| Component | Level | Rationale | Next milestone |
|-----------|-------|-----------|----------------|
| Compiler | Foundation | 33% test pass rate. Parser, semantic, and codegen all have gaps. | Reach 60% pass rate. All parser stage tests passing. |
| Server | Functional | Spec compliance tests pass. Some bridge functions incomplete. Layer 3 tested. | All 6 contract tests passing. All bridge functions implemented. |
| Node Server | Foundation | No contract tests. Parity with Rust server unverified. | Port spec_compliance.wat to TypeScript. Verify parity. |
| Extension | Functional | Thin client architecture correct. LSP integration works. | Verify zero hardcoded keywords remain. |
| Manager | Functional | Version management works. Compatibility matrix exists but is integration-untested. | Integration test: compile a .cln file with each declared-compatible plugin. |
| Framework | Foundation | Plugins depend on compiler features that don't work yet. | Wait for compiler to reach Functional. Then verify plugin expansion. |
| MCP | Functional | Tools work. Spec index freshness unverified. | Add spec freshness hash check. |
| UI | Foundation | Early stage. Depends on framework. | Wait for framework to reach Functional. |
| Canvas | Foundation | Early stage. Depends on framework. | Wait for framework to reach Functional. |
| LLM | Foundation | Early stage. | Define scope and spec before work. |
| cPanel Plugin | Foundation | Depends on server stability. | Wait for server to reach Stable. |
| Clean Studio | Not started | Empty folder. | Define whether this component is needed. |

### Dependency chain

The maturity levels have a natural order based on dependencies:

```
Compiler (Foundation → Functional → Stable)
    ↓
Server (Functional → Stable)     Node Server (Foundation → Functional)
    ↓                                ↓
Framework (Foundation → Functional)
    ↓
UI / Canvas / LLM (Foundation → Functional)
    ↓
Extension / MCP (Functional → Stable)
    ↓
cPanel Plugin / Clean Studio (Foundation → Functional)
```

A downstream component cannot advance past the maturity of its upstream dependency. If the compiler is Foundation, the framework stays Foundation regardless of how good the framework code is — it can't be verified.

### Rules

- Check the maturity level before starting work on a component. If it's Foundation, focus on fixing failures and improving test coverage. Do not add features.
- The maturity assessment is updated when a milestone is reached. It lives in this document (the table above).
- When a component reaches a new level, the next milestone is defined immediately.
- A component's level is determined by running its health check command and checking contract test status — not by subjective judgment. Foundation means significant test failures. Functional means core works with gaps. Stable means all tests pass and contracts verified.
- The dependency chain is respected. Don't promote a downstream component to Functional if its upstream is still Foundation.

---

## 21. Every Bug Fix Starts with a Failing Test

### What this means

Before writing a single line of fix code, write a test that reproduces the bug and verify it fails. The test is committed alongside the fix. No exceptions.

The sequence is:

1. **Reproduce**: Write a test (Rust unit test, .cln end-to-end test, or both) that triggers the exact bug
2. **Verify it fails**: Run the test and confirm it fails for the right reason
3. **Fix the code**: Make the minimal change that fixes the root cause
4. **Verify it passes**: Run the test and confirm it passes
5. **Run the baseline**: Confirm no other tests regressed
6. **Add to CI set**: If the test covers a new area, add it to the CI test suite

### Why this principle exists

The string comparison bug was fixed in January 2026 in the old codegen path (`instruction_generator.rs`). Three months later, the identical bug was discovered in the MIR codegen path (`mir_codegen.rs`). No test existed to prevent the recurrence. The January fix changed code but left no artifact that would catch the same bug in a different location.

This has happened more than once. Of 129 commits since January 2026, 75 (58%) are fixes. Some fix the same class of bug repeatedly because no test guards against recurrence.

A failing test written before the fix serves three purposes:
- It **proves** you understand the bug (if your test doesn't fail, you're testing the wrong thing)
- It **prevents recurrence** (the test runs forever after)
- It **documents** the bug better than any comment (the test IS the reproduction case)

### What this looks like in practice

**For a codegen bug** (like string comparison inversion):
```rust
#[test]
fn string_equality_emits_eqz_after_compare() {
    let wasm = compile_to_wasm("string x = \"hello\"\nif x == \"\"\n\tprintl(\"empty\")");
    let wat = disassemble(&wasm);
    // string_compare returns 0 for equal; == needs i32.eqz to invert
    assert!(wat_sequence_contains(&wat, &["call $string_compare", "i32.eqz"]));
}
```

**For a runtime bug** (like req.body() returning empty):
```clean
// tests/cln/ci/bridge_req_body.cln
// Expected output: "body_received"
start:
    string body = req.body()
    if body != ""
        printl("body_received")
    else
        printl("body_empty")
```

**For a parser bug**:
```rust
#[test]
fn iterate_with_step_parses() {
    let result = parse("iterate i in 0 to 10 step 2\n\tprintl(i.toString())");
    assert!(result.is_ok());
    // Verify AST contains step expression
    let ast = result.unwrap();
    assert!(has_iterate_with_step(&ast));
}
```

### Rules

- No bug fix PR/commit without an accompanying test that would have caught the bug
- The test must fail before the fix and pass after — verify both states
- For codegen bugs: write a WAT-level assertion test, not just an end-to-end test. End-to-end tests catch symptoms; WAT tests catch the mechanism.
- For bugs that existed in one codegen path: verify the test covers all active codegen paths
- The test file name or test function name should reference the bug (e.g., `test_string_compare_eqz_for_equality`, not `test_comparison_1`)

### Enforcement

The pre-commit hook (Principle 8) checks that any commit touching `src/` also touches `tests/`. A fix-only commit with no test change is flagged for review.

---

## 22. CI Tests What Ships

### What this means

If compiled WASM is what users run, CI must compile and execute WASM. Unit tests on internal Rust functions are necessary but not sufficient.

The CI pipeline must include:

| Stage | What it tests | Catches |
|-------|---------------|---------|
| `cargo test --lib` | Rust unit tests — parser, semantic, type inference internals | Logic bugs in individual functions |
| `cargo clippy` | Lint warnings, unused code, common mistakes | Code quality issues |
| **Compile .cln files** | End-to-end compilation — source to WASM | Codegen regressions, import mismatches, stack balance errors |
| **Validate .wasm** | WASM binary validity | Malformed output, invalid instructions |
| **Execute .wasm** | Runtime behavior — correct output | Bridge function failures, memory corruption, wrong results |
| **Baseline comparison** | Compare pass/fail against known baseline | Regressions (tests that passed before but fail now) |

### Why this principle exists

The current CI runs `cargo test` (420 Rust unit tests) and `cargo clippy`. It does not compile a single `.cln` file. It does not validate WASM output. It does not execute anything.

The string comparison inversion (April 2026) passed CI. The html: block bug passed CI. Every codegen regression in the project's history passed CI because CI doesn't test codegen output.

Of the 379 .cln test files that exist, zero are run in CI. The tests exist but the gate doesn't use them. This means CI gives a false green — it reports success for a compiler that produces incorrect output.

### CI .cln test set

Not all 379 tests need to run in CI. Start with a curated set of **known-passing** tests that cover core features:

**Location:** `tests/cln/ci/`

**Selection criteria:**
- Each test covers one language feature or one bug class
- All tests in this folder are **known to pass** — if a test fails, it's a regression
- Coverage spans: variables, functions, strings, numbers, control flow, classes, bridge calls, plugin blocks
- Target: 30-50 tests that run in under 60 seconds total

**Adding to the CI set:**
- When a bug is fixed and a new test is written (Principle 21), add it to `tests/cln/ci/` if it covers a new area
- Never add a test to the CI set that doesn't pass — the CI set is the passing baseline

**Baseline tracking:**
- CI stores the list of passing tests after each successful run
- On the next run, if any previously-passing test now fails, CI fails with a clear message: "REGRESSION: test X passed in baseline but fails now"
- New tests that pass are added to the baseline automatically

### Implementation

Add to `ci.yml`:

```yaml
- name: End-to-end .cln tests
  run: |
    cargo build --bin cln --release
    ./scripts/run_ci_tests.sh
```

The script `scripts/run_ci_tests.sh`:
1. For each `.cln` file in `tests/cln/ci/`:
   a. Compile with `cln compile`
   b. Validate with `wasm-validate` (if available) or the built-in validator
   c. Execute with the wasmtime runner
   d. Compare output to expected (from a comment or `.expected` file)
2. Compare results against `tests/results/ci_baseline.json`
3. Exit non-zero if any baseline test now fails

### Rules

- Every CI run must compile, validate, and execute the .cln test set. `cargo test` alone is not a passing CI.
- The CI test set (`tests/cln/ci/`) only contains tests that are known to pass. A test that is expected to fail belongs in the regular test suite, not in CI.
- A regression in the CI test set blocks the build. No merge until fixed.
- The baseline is updated automatically when CI passes — no manual maintenance.
- When a new codegen feature is implemented, at least one .cln test covering it must be added to the CI set before the feature is considered complete.

---

## 23. One Codegen Path

### What this means

The compiler has exactly one active code generation implementation. There is no "old codegen" and "new codegen" running in parallel without parity verification.

### Why this principle exists

The compiler currently has two codegen paths:

| Path | File | Lines | Status |
|------|------|-------|--------|
| Old codegen | `instruction_generator.rs`, `expression_generator.rs`, `statement_generator.rs` | ~3,500 | Unknown — partially used? |
| MIR codegen | `mir_codegen.rs` | ~6,700 | Active — the path that produces output |

Plus `mod.rs` at 9,575 lines containing shared infrastructure used by both.

The string comparison bug was fixed in January 2026 in the old codegen. The same bug shipped unfixed in the MIR codegen until April. Nobody verified parity between the two paths because there is no mechanism to do so.

Two implementations of the same logic with no parity enforcement means:
- Bugs fixed in one path are not fixed in the other
- Behavior diverges silently over time
- Neither path can be trusted to be "the correct one"
- 3,500 lines of code exist with unclear purpose — they may be dead, they may be active for edge cases, nobody knows for certain

### Rules

**Determine which path is active.** Trace the compilation pipeline from entry point to WASM output. Identify which codegen functions are actually called. The path that produces the WASM users receive is the active path.

**Remove or isolate the inactive path.** Options:

1. **Delete it.** If the MIR codegen is the active path and the old codegen is not called, delete `instruction_generator.rs`, `expression_generator.rs`, and `statement_generator.rs`. Less code = fewer places for bugs to hide. The git history preserves the old code if it's ever needed.

2. **Feature-flag it.** If a transition is in progress and both paths need to exist temporarily, put them behind a compile-time feature flag. Add parity tests that compile the same input through both paths and assert the WASM output is equivalent. The parity tests run in CI.

3. **Extract shared code.** If `mod.rs` (9,575 lines) contains logic used by both paths, extract the shared parts into clearly-named modules. The path-specific code lives in its own file with no cross-references to the other path.

**Never again:** Do not start a new codegen implementation without:
- A parity test suite that compiles a representative set of .cln files through both old and new paths
- CI enforcement that both paths produce equivalent output
- A timeline for removing the old path

### Audit checklist

This is the immediate work required:

```
[ ] Trace the active codegen path from compile() entry point to WASM bytes
[ ] List every function in instruction_generator.rs — is each one called?
[ ] List every function in expression_generator.rs — is each one called?
[ ] List every function in statement_generator.rs — is each one called?
[ ] For each "CRITICAL FIX" comment in codegen files — does the fix exist in both paths?
[ ] Decision: delete old path, feature-flag it, or extract shared code
[ ] Execute the decision
[ ] Verify CI still passes after removal/isolation
```

### Workaround cleanup

The 231 `CRITICAL FIX` markers in source code are a direct consequence of fixing symptoms in one path without addressing root causes. As part of consolidating to one codegen path:

1. Grep for `CRITICAL FIX`, `WORKAROUND`, `HACK`, `FIXME` in the codegen
2. For each marker: is the underlying issue still present? If the root cause was in the deleted path, the workaround may no longer be needed.
3. Remove workarounds whose root cause no longer exists
4. For workarounds that are still needed: convert them into proper fixes with tests (Principle 21)
5. Track the count. It should decrease monotonically. A new `CRITICAL FIX` comment is a failure to follow Principle 4.

---

## 24. Spec-Implementation Parity

### What this means

The specification and the implementation must be a 1-to-1 mirror at all times. This is a two-way constraint:

1. **Everything in the spec must be implemented.** If `grammar.ebnf` defines an `async` block, the compiler must parse, type-check, and compile it. A spec feature without a working implementation is a broken promise.

2. **Everything implemented must be in the spec.** If the compiler accepts syntax that has no production rule in `grammar.ebnf`, that syntax is unauthorized. It must either be added to the spec (with developer approval per Principle 25) or removed from the compiler.

### Why this principle exists

Drift between spec and implementation creates two failure modes:
- **Spec ahead of code:** Users read the spec, try a feature, and it doesn't work. Trust erodes.
- **Code ahead of spec:** The compiler accepts syntax that isn't documented. Other tools (language server, extension, other implementations) don't know about it. Behavior becomes implementation-defined rather than spec-defined.

Both modes compound over time. A feature added to the compiler "for now" without a spec update becomes permanent because nothing tracks it.

### Rules

- Every production rule in `grammar.ebnf` must have a corresponding implementation that passes compilation and (where runtime is available) execution.
- Every keyword, block, and type in `plugin.toml` files must have a corresponding EBNF production in the plugin's spec file.
- Every function in `spec/stdlib-reference.md` must be callable, compilable, and functional.
- Every semantic rule in `spec/semantic-rules.md` must be enforced by the type checker.
- If a feature is planned but not yet implemented, it does NOT belong in the spec. It belongs in TASKS.md as a planned feature.
- The `/coverage` skill measures this parity. Run it periodically. Any gap is a Tier 1 violation.

### Compliance check

```
For each grammar.ebnf production:
  [ ] Can I write code using this production?
  [ ] Does it compile without errors?
  [ ] Does a test exist that exercises it?
  
For each compiler feature:
  [ ] Is there a grammar.ebnf production that authorizes it?
  [ ] Is there a semantic-rules.md entry if it has type/scope implications?
```

### What to do when parity is broken

| Situation | Action |
|-----------|--------|
| Spec defines feature, compiler doesn't support it | Either implement the feature OR remove it from the spec (with developer approval per Principle 25) |
| Compiler supports feature, spec doesn't define it | Either add to the spec (with developer approval) OR remove from the compiler |
| Spec and compiler disagree on behavior | The spec is authoritative. Fix the compiler. |

---

## 25. Specification Change Control

### What this means

The specification (`spec/` directory) is a controlled document. AI instances may NOT modify it unilaterally. Changes to the spec require the developer's explicit approval and directive.

### Why this principle exists

The spec defines what the language IS. Changing it changes the language itself. An AI instance that modifies the spec to match broken compiler behavior (instead of fixing the compiler) inverts the authority relationship — the implementation becomes the spec, and the spec becomes documentation.

This principle ensures the developer remains the language designer. AI instances are implementers, not designers.

### Workflow for spec changes

```
1. AI discovers a gap or inconsistency between spec and implementation
2. AI documents the gap:
   - What the spec says
   - What the compiler does
   - Which one is correct (AI's assessment)
   - What the options are
3. AI presents the options to the developer (using AskUserQuestion or reporting)
4. Developer decides:
   a) "Fix the compiler to match the spec" — AI implements the fix
   b) "Update the spec to match the compiler" — AI updates the spec
   c) "Change both — here's what I want" — AI implements the new design
   d) "Remove the feature entirely" — AI removes from both spec and compiler
5. AI implements the decision
6. AI updates TASKS.md with the decision and rationale
```

### Rules

- **NEVER modify `spec/grammar.ebnf` without developer approval.** This is the language's constitution.
- **NEVER modify `spec/semantic-rules.md` without developer approval.** These are the type system's laws.
- **NEVER modify `spec/type-system.md` without developer approval.** Type compatibility changes can break existing programs.
- **NEVER modify `spec/stdlib-reference.md` without developer approval.** Changing a function signature is a breaking change.
- **NEVER modify `spec/plugins/*.ebnf` without developer approval.** Plugin syntax is part of the framework's API.
- **NEVER add syntax to the compiler that isn't in the spec.** Propose a spec change first, get approval, then implement.
- **NEVER remove spec entries to hide compiler bugs.** Fix the bug. If the feature is genuinely wrong, ask the developer.

### What AI CAN do without approval

- Read the spec to understand correct behavior
- Report gaps between spec and implementation
- Write tests that verify spec compliance
- Fix compiler bugs to match the spec (spec is authoritative)
- Propose spec changes (but not apply them)

### What AI CANNOT do without approval

- Add, remove, or modify any production rule in any EBNF file
- Add, remove, or modify any semantic rule
- Add, remove, or modify any type system rule
- Add, remove, or modify any stdlib function signature
- Add, remove, or modify any plugin syntax definition

### Exception: Documentation-only changes

Fixing typos, updating comments, correcting line references, and improving formatting in spec files do not change the language and do not require approval. If in doubt, ask.

---

## Document History

| Date | Change |
|------|--------|
| 2026-04-11 | Initial version. 17 principles established from observed project patterns and failure modes. |
| 2026-04-11 | Enriched all principles with What This Means, Why, and Rules sections. Added diagnostic bundles. |
| 2026-04-11 | Major restructure: consolidated overlapping principles (18→14), added principle hierarchy, compliance checklist, version discipline, regression rules, rollback procedures, shared code policy, triage responsibility, layer edge cases. |
| 2026-04-11 | Added Tier 3 (Strategy) with 6 new principles (15-20): upstream-first prioritization, feature completion definition, spec-to-test traceability, knowledge accumulation, AI work session protocol, component maturity assessment. Total: 20 principles in 4 tiers. |
| 2026-04-11 | Expanded Principle 2 with plugin EBNF grammar extensions. Updated Principle 3 documentation table for plugin specs. |
| 2026-04-12 | Added Principles 21-23 (Tier 2): bug-fix-first testing, CI tests what ships, one codegen path. Driven by analysis of 129 commits (75 fixes, 3 reverts), 231 CRITICAL FIX markers, dual codegen path regression, and CI gap where 379 .cln tests were never executed. Total: 23 principles. |
| 2026-04-12 | Added Principles 24-25 (Tier 1): spec-implementation parity, specification change control. The spec and implementation must be a 1-to-1 mirror. AI instances may not modify the spec without developer approval. Total: 25 principles. |
