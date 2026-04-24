# Clean Language Documentation Strategy

## Purpose

This document defines the documentation architecture for the Clean Language project. It exists so that developers and AI agents working in any component of the project share a single, consistent understanding of where each category of fact lives, who owns it, and how to keep everything in sync. Read this document before creating any new documentation file or deciding where to record a fact about the language, platform, or a specific component.

---

## The Two-Tier Model

Documentation in this project is divided into two tiers with distinct purposes and audiences.

**Tier 1 — Formal Specification (`spec/`)**

Machine-readable and authoritative. These files are consumed by the compiler, AI agents, test suites, and tooling. They define what is correct. Every fact in Tier 1 has exactly one home. Duplication is a bug. Tier 1 files require developer approval to modify (see Change Control below).

**Tier 2 — Per-Component Human Documentation (`documentation/` or `docs/` inside each component)**

Human-readable and example-rich. These files explain how a specific component implements the spec, how to build and test it, and how to navigate the codebase. They reference Tier 1 files instead of duplicating their content. Any contributor can update Tier 2 files without approval, provided the changes stay within the component's boundary.

**The governing rule:** Each fact lives in exactly one tier. A Tier 2 document that re-states a language rule is wrong — it should link to the relevant spec file instead. When the spec changes, Tier 2 documents should not require updates unless the implementation strategy also changed.

---

## Document Inventory

### Tier 1 — Formal Specification (`spec/`)

| File | What it covers | Owner | Change approval required |
|------|---------------|-------|--------------------------|
| `spec/grammar.ebnf` | Complete EBNF grammar for the Clean Language syntax | Compiler team | Yes — developer approval |
| `spec/semantic-rules.md` | Numbered semantic rules (SYN, SEM, SCOPE, FUNC, CLASS, etc.) and error codes | Compiler team | Yes — developer approval |
| `spec/type-system.md` | Type hierarchy, compatibility matrix, implicit and explicit conversions | Compiler team | Yes — developer approval |
| `spec/stdlib-reference.md` | Signatures and descriptions for all built-in functions across all namespaces | Compiler team | Yes — developer approval |
| `spec/ast.md` | AST node definitions — names, fields, and relationships | Compiler team | Yes — developer approval |
| `spec/error-codes.md` | Canonical error code registry (codes, messages, categories) | Compiler team | Yes — developer approval |
| `spec/plugins/grammar.ebnf` | Reserved — top-level plugin grammar extension entry point | Compiler team | Yes — developer approval |
| `spec/plugins/frame-server.ebnf` | Syntax for `endpoints:` blocks, routing, request/response | Framework team | Yes — developer approval |
| `spec/plugins/frame-data.ebnf` | Syntax for `data:` blocks, ORM models, queries, migrations | Framework team | Yes — developer approval |
| `spec/plugins/frame-ui.ebnf` | Syntax for `component:` blocks, HTML directives, styles | Framework team | Yes — developer approval |
| `spec/plugins/frame-auth.ebnf` | Syntax for sessions, JWT, roles, CSRF | Framework team | Yes — developer approval |
| `spec/plugins/frame-canvas.ebnf` | Syntax for canvas scenes, drawing, audio, input | Framework team | Yes — developer approval |
| `spec/plugins/plugin-contract.md` | Plugin authoring contract — how plugins declare bridge functions and folder ownership | Framework team | Yes — developer approval |

### Tier 2 — Per-Component Documentation

| Component | Docs folder | What it contains |
|-----------|-------------|------------------|
| `clean-language-compiler` | `documentation/` | Compilation pipeline, parser internals, AST reference, memory management, language server, testing strategy, development guide |
| `clean-server` | `system-documents/` | Host bridge integration, architecture compliance, WASM parse diagnostics, fix records |
| `clean-framework` | `documents/` | Frame overview, CLI guide, server/data/UI/auth/canvas/client specs, plugin guide, getting-started tutorial, API reference, project structure |
| `clean-manager` | `docs/` | Architecture, functional specification, API reference, user guide |
| `clean-extension` | `docs/` | Architecture design, development guides, deployment and publishing, API references |
| `clean-canvas` | (root-level markdown files) | Canvas syntax architecture and overview |
| `clean-ui` | (root-level markdown files) | UI elements specification, responsive design specification |
| `clean-llm` | (root-level markdown files) | LLM agent specification |
| `clean-cpanel-plugin` | `documents/` | cPanel plugin specification |
| `clean-node-server` | (root-level markdown files) | Node.js runtime guide |

### Platform Architecture (shared)

These files are shared across all components. They define the runtime contract that every component must honor. They are not part of `spec/` because they describe the platform, not the language.

| File | What it covers |
|------|---------------|
| `platform-architecture/EXECUTION_LAYERS.md` | Authoritative definition of which layer (0–5) executes which functions |
| `platform-architecture/HOST_BRIDGE.md` | Layer 2 portable host function signatures (console, math, string, DB, file, HTTP, crypto) |
| `platform-architecture/SERVER_EXTENSIONS.md` | Layer 3 HTTP server-specific function signatures |
| `platform-architecture/MEMORY_MODEL.md` | WASM memory layout, string format, bump allocator |
| `platform-architecture/MEMORY_POLICY.md` | Unified memory ownership policy across all components |
| `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md` | Language server as single source of truth for all IDE intelligence |
| `platform-architecture/IMPLEMENTING_HOST.md` | Guide for building new runtime host implementations |
| `platform-architecture/ERROR_REPORTING_SPECIFICATION.md` | Structured error reporting format and lifecycle |
| `platform-architecture/function-registry.toml` | Machine-readable registry of all Layer 2 and Layer 3 host function signatures |
| `platform-architecture/README.md` | Navigation index for the platform-architecture directory |

### Management and Governance

| File | What it covers |
|------|---------------|
| `management/ARCHITECTURE_BOUNDARIES.md` | What each component is and is not responsible for; boundary violation detection |
| `management/DOCUMENTATION_STRATEGY.md` | This file — documentation architecture and sync protocol |
| `management/PROJECT_MANAGEMENT_PRINCIPLES.md` | Development principles, workflow rules, and quality standards |
| `management/ERROR_REPORTING_WORKFLOW.md` | Error lifecycle from `report_error` through `/resolve-fix` |
| `management/CLAUDE_CODE_TOOLING_STRATEGY.md` | Strategy for AI agent tooling and automation |
| `management/README.md` | Navigation index for the management directory |
| `management/cross-component-prompts/` | Design proposals and architectural asks directed at other components |
| `management/reports/` | Periodic health, coverage, and triage reports |

---

## Sync Protocol

Whenever a change is made in any component, the developer or AI agent making the change is responsible for updating the relevant spec file in the same commit. The rule is: spec and implementation are never allowed to diverge.

| Change type | Spec file to update |
|-------------|---------------------|
| New language syntax | `spec/grammar.ebnf` |
| New semantic rule or error code | `spec/semantic-rules.md` + `spec/error-codes.md` |
| New or changed type rule | `spec/type-system.md` |
| New or changed built-in function | `spec/stdlib-reference.md` |
| New or changed AST node | `spec/ast.md` |
| New or changed plugin contract | `spec/plugins/plugin-contract.md` |
| New or changed host bridge function | `platform-architecture/HOST_BRIDGE.md` + `platform-architecture/function-registry.toml` |
| New or changed execution layer | `platform-architecture/EXECUTION_LAYERS.md` |
| New plugin grammar | `spec/plugins/<plugin-name>.ebnf` |

**How to verify sync before merging:**

1. Run `git diff --name-only HEAD~1` and check that every source-code change has a corresponding spec change in the same commit.
2. If a new built-in function was added in `src/builtins/registry.rs`, verify it appears in `spec/stdlib-reference.md`.
3. If a new AST variant was added in `src/ast/mod.rs`, verify it appears in `spec/ast.md`.
4. If a host bridge function signature changed, verify `platform-architecture/function-registry.toml` was updated and the compliance tests (`test_spec_compliance`, `test_layer3_spec_compliance`) still pass.
5. If a plugin EBNF changed, verify the corresponding plugin's `expand_block` output still matches the grammar.

---

## What Belongs Where

| Content type | Where it lives | Where it does NOT live |
|-------------|----------------|------------------------|
| Language syntax rule | `spec/grammar.ebnf` | Component docs |
| Semantic validation rule | `spec/semantic-rules.md` | Component docs |
| Error code definition | `spec/semantic-rules.md` + `spec/error-codes.md` | Component docs |
| Built-in function signature | `spec/stdlib-reference.md` | Component docs |
| AST node definition | `spec/ast.md` | Component docs |
| Plugin grammar extension | `spec/plugins/<name>.ebnf` | Component docs |
| Plugin authoring contract | `spec/plugins/plugin-contract.md` | Component docs |
| Execution layer definition | `platform-architecture/EXECUTION_LAYERS.md` | Component docs |
| Host bridge function signature | `platform-architecture/HOST_BRIDGE.md` | Component docs |
| Host function registry | `platform-architecture/function-registry.toml` | Component docs |
| Component architecture | `<component>/documentation/` or `<component>/docs/` | `spec/` |
| Implementation how-to | `<component>/documentation/` or `<component>/docs/` | `spec/` |
| Build and test instructions | `<component>/CLAUDE.md` or `<component>/docs/` | `spec/` |
| Component-specific error records | `<component>/system-documents/` or `<component>/docs/` | `spec/` |
| User-facing tutorial | `books and content/` | `spec/` |
| Cross-component proposals | `management/cross-component-prompts/` | `spec/` |
| Bug reports | `report_error` MCP tool (errors.cleanlanguage.dev) | Any markdown file |

---

## Files Removed (History)

The following documentation files were removed during Phase 3b of the project stabilization effort. They were deleted because their content was either duplicated in the formal spec files, contained in per-component documentation that was their more appropriate home, or represented stale drafts superseded by authoritative sources. This table exists so future developers understand why these files are absent and do not recreate them.

| File removed | Reason for deletion |
|--------------|---------------------|
| `clean-language-compiler/DOCUMENTATION-OVERVIEW.md` | Duplicated navigation already in `documentation/README.md` and `CLAUDE.md` |
| `clean-language-compiler/SPEC-COVERAGE.md` | Replaced by the `/coverage` skill and the automated spec-coverage report in `management/reports/` |
| `clean-language-compiler/COMPILER-ARCHITECTURE-NOTES.md` | Content consolidated into `documentation/compilation-pipeline.md` |
| `clean-language-compiler/TYPE-SYSTEM-NOTES.md` | Content is authoritative only in `spec/type-system.md` |
| `clean-language-compiler/STDLIB-NOTES.md` | Content is authoritative only in `spec/stdlib-reference.md` |
| `clean-language-compiler/AST-NOTES.md` | Content is authoritative only in `spec/ast.md` |
| `clean-framework/documents/ARCHITECTURE-OVERVIEW.md` | Superseded by `platform-architecture/EXECUTION_LAYERS.md` and component CLAUDE.md |
| `clean-framework/documents/HOST-BRIDGE-NOTES.md` | Content is authoritative only in `platform-architecture/HOST_BRIDGE.md` |
| `clean-server/ARCHITECTURE.md` | Consolidated into `system-documents/HOST_BRIDGE_INTEGRATION.md` |
| `clean-extension/ARCHITECTURE-NOTES.md` | Content moved to `docs/architecture/` subfolder with proper structure |
| `management/DOCUMENTATION-AUDIT.md` | Transient working document; its conclusions are captured in this file |

---

## Change Control

**Who can approve changes to `spec/` files:**
Only the developer (project owner). No AI agent may modify spec files without an explicit instruction from the developer in the current session. If an agent discovers a gap between spec and implementation, it must report it and ask for a decision — it must not self-approve a spec change.

**Who can approve changes to component documentation:**
Any contributor. Component `documentation/` and `docs/` files describe implementation, not language rules. They can be updated freely as long as the update stays within the component's boundary.

**How to propose a spec change:**

1. Identify the specific gap or missing rule in the current spec.
2. Write a concrete proposal: the exact EBNF production, semantic rule, or function signature to add or change.
3. Present the proposal to the developer with a rationale.
4. Wait for explicit approval before writing any code that depends on the new spec text.
5. Once approved, update the spec file and the implementation in a single commit with a `spec(...)` commit type prefix.

**Spec version tracking:**
Spec files do not carry their own version numbers. They track with the compiler version. The canonical version of the spec at any point in time is the version shipped with the `cln` binary at that version. Use `cln --version` to identify the compiler version and cross-reference with git tags to find the corresponding spec state.

---

## Document Health Checks

An AI agent or developer can run the following checklist to verify documentation health before a release or after a significant refactor:

- [ ] No duplicate definitions of the same fact across files — each rule, error code, function signature, and AST node has exactly one home
- [ ] Every error code referenced in the compiler source (`src/`) appears in `spec/error-codes.md` with a definition
- [ ] Every error code in `spec/error-codes.md` has a corresponding entry in `spec/semantic-rules.md` explaining when it is emitted
- [ ] Every AST node variant in `src/ast/mod.rs` is documented in `spec/ast.md`
- [ ] Every built-in function registered in `src/builtins/registry.rs` has a matching entry in `spec/stdlib-reference.md` with correct type signature
- [ ] Every plugin grammar in `spec/plugins/*.ebnf` is consistent with what the plugin's `expand_block` function actually produces
- [ ] Every host function in `platform-architecture/HOST_BRIDGE.md` has a matching entry in `platform-architecture/function-registry.toml` with matching WASM types
- [ ] The `test_spec_compliance` test (clean-server host-bridge) passes against the current `function-registry.toml`
- [ ] The `test_layer3_spec_compliance` test (clean-server) passes against the current `function-registry.toml`
- [ ] No component documentation file re-states a language rule that belongs in `spec/` — it links instead
- [ ] All CLAUDE.md files include the Documentation Sync Protocol section pointing to the correct spec files for that component
