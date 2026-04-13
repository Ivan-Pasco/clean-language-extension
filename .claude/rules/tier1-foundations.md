---
description: Foundational rules — always active. Component isolation, execution layers, spec authority.
globs: ["**/*"]
alwaysApply: true
---

# Tier 1 — Foundational Rules

## Component Isolation (Principle 1)
- Each component lives in its own folder. Do NOT edit files in other components.
- If you discover a bug in another component, create a prompt in `management/cross-component-prompts/`.
- Exception: `spec/`, `management/`, `platform-architecture/` are shared.

## Execution Layers (Principle 1)
- Before implementing any function, check `platform-architecture/EXECUTION_LAYERS.md`.
- Layer 0 (Compiler): Parse, analyze, generate WASM imports — NOT implementations.
- Layer 2+ (Host Bridge): Anything needing I/O belongs in the server, not the compiler.

## Specification Authority (Principle 2)
- `spec/grammar.ebnf` is the authoritative syntax definition.
- When resolving ambiguity, EBNF takes precedence over prose documentation.
- Update EBNF before implementing new syntax. Never implement syntax not in the EBNF.

## Spec-Implementation Parity (Principle 24)
- Everything in the spec MUST be implemented. A spec feature without working code is a violation.
- Everything implemented MUST be in the spec. Unauthorized syntax must be added to spec (with approval) or removed.
- If a feature is planned but not implemented, it belongs in TASKS.md, NOT in the spec.

## Specification Change Control (Principle 25)
- NEVER modify spec files (grammar.ebnf, semantic-rules.md, type-system.md, stdlib-reference.md, plugins/*.ebnf) without developer approval.
- You CAN fix compiler bugs to match the spec (spec is authoritative).
- You CANNOT add syntax to the compiler that isn't in the spec — propose a spec change first.
- When you find a gap between spec and implementation, report it and ask the developer for a decision.
