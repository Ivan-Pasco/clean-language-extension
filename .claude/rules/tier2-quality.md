---
description: Quality rules — active when writing code. Honest code, testing, single codegen path.
globs: ["**/*.rs", "**/*.ts", "**/*.cln"]
alwaysApply: false
---

# Tier 2 — Quality Rules

## Honest Code (Principle 4)
- No placeholder implementations (return 0, return false, todo!()).
- No `CRITICAL FIX` / `WORKAROUND` / `HACK` markers without a TASKS.md entry.
- Error handling must produce error codes, not silent defaults.

## Testing (Principle 5)
- Never modify a test to make it pass. Fix the code instead.
- Exception: if the test contradicts `foundation/spec/grammar.ebnf`, fix the test and document why.

## Bug Fixes Start with Tests (Principle 21)
- Before fixing a bug, write a failing test that reproduces it.
- The fix is complete when the test passes.

## One Codegen Path (Principle 23)
- Changes to code generation must only touch the active codegen path.
- Do not add to the legacy path (`instruction_generator.rs`, `expression_generator.rs`, `statement_generator.rs`).

## CI Tests What Ships (Principle 22)
- End-to-end .cln tests must compile and execute correctly.
- If a test fails after your change, your change caused a regression.
