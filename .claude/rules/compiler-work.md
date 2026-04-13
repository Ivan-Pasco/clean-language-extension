---
description: Compiler-specific rules — active when working in clean-language-compiler/
globs: ["clean-language-compiler/**"]
alwaysApply: false
---

# Compiler Work Rules

## Maturity Level: Foundation
The compiler is at Foundation maturity. This means:
- Fix existing failures before adding new features.
- Upstream-first: fix parser bugs before codegen bugs.
- Every change must maintain or improve the test pass rate.

## Known Fragile Areas
Read `clean-language-compiler/KNOWLEDGE.md` before modifying:
- String heap pointer initialization order
- String comparison inversion logic
- Dual codegen paths (mod.rs vs mir_codegen.rs)
- Recursive function pre-registration
- Stack balance in type conversions

## Build Verification
After any change to `src/`:
```bash
cargo check
cargo test --lib
```

## Spec References
- Grammar: `spec/grammar.ebnf`
- Semantic rules: `spec/semantic-rules.md`
- Type system: `spec/type-system.md`
- Built-ins: `spec/stdlib-reference.md`
