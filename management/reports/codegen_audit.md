# Codegen Path Audit — 2026-04-12

## Active Compilation Pipeline

```
lib.rs compile_with_plugins_and_opt_level()
  Stage 1: SpecificationLexer → tokens
  Stage 2: SpecificationParser → AST
  Stage 2.5a: Plugin Enforcement
  Stage 2.5b: Plugin Expansion (PluginExpander)
  Stage 3: HirBuilder → HIR
  Stage 4: Resolver → Resolved HIR
  Stage 5: TypeChecker → TAST
  Stage 6: lower_tast_to_mir → MIR
  Stage 7: MirCodeGenerator → WASM    ← ACTIVE CODEGEN
```

**Active codegen:** `src/codegen/mir_codegen.rs` (6,696 lines)
**Dead codegen:** `src/codegen/mod.rs::CodeGenerator` (9,575 lines) — NOT called from any compile function

## Dead Code Analysis

### Files in the Dead Path

| File | Lines | Status |
|------|-------|--------|
| `mod.rs` (CodeGenerator struct) | ~9,000 | Dead — not called from lib.rs |
| `expression_generator.rs` | 1,846 | Dead — used only by CodeGenerator |
| `instruction_generator.rs` | 1,718 | Dead — used only by CodeGenerator |
| `statement_generator.rs` | 843 | Dead — used only by CodeGenerator |
| `stdlib/` (18+ files) | ~3,000+ | Dead — import CodeGenerator, not MirCodeGenerator |

### Files Used by Both Paths (shared infrastructure)

| File | Lines | Status |
|------|-------|--------|
| `mod.rs` (constants, re-exports) | ~50 | Active — exports MirCodeGenerator, constants |
| `memory.rs` | 902 | Used by mod.rs only (MemoryUtils) |
| `const_eval.rs` | 588 | Public module, used by mod.rs |
| `native_stdlib/` | varies | Used by mod.rs only |
| `binary_operations.rs` | 619 | Used by mod.rs only |
| `type_conversion.rs` | 323 | Used by mod.rs only |
| `type_manager.rs` | 136 | Used by mod.rs only |
| `binaryen_optimizer.rs` | 507 | Used by mod.rs only |
| `wasm_module_builder.rs` | 189 | Used by mod.rs only |

### Files in Active Path Only

| File | Lines | Status |
|------|-------|--------|
| `mir_codegen.rs` | 6,696 | Active — sole codegen |
| `function_generator.rs` | 642 | Used by MirCodeGenerator |
| `builtin_generator.rs` | 863 | Used by MirCodeGenerator |
| `stdlib_generator.rs` | 333 | Used by MirCodeGenerator |

## Marker Audit

**Total markers across compiler:** 271
**By type:** CRITICAL FIX: 231, CRITICAL: 39, WORKAROUND: 1

### Active Path (mir_codegen.rs): 87 CRITICAL FIX markers

| Category | Count | Action |
|----------|-------|--------|
| Design Documentation | 45 | Rename to `// NOTE:` or `// DESIGN:` |
| Resolved Fixes | 31 | Rename to `// FIXED:` or remove |
| Active Workarounds | 11 | Track in TASKS.md, keep marker |

### Dead Path: 11 markers
All will be removed when dead code is deleted.

### Other Active Code: 173 markers
- `mir/`: 100 markers (MIR lowering — active path)
- `resolver/`: 15 markers (active path)
- `stdlib/`: 14 markers (dead — only used by CodeGenerator)
- `codegen/` other: 8 markers (function_generator, builtin_generator)
- `typechecker/`: 8 markers (active path)
- `parser/`: 5 markers (active path)
- `hir/`: 4 markers (active path)

## Top 5 Active Workarounds (mir_codegen.rs)

1. **SymbolId→index collision avoidance** (line ~2634): Direct SymbolId lookup to avoid name collisions for constructors/methods with same names
2. **Hardcoded void function list** (line ~2904): list.set, list.clear, list.push hardcoded as void due to incomplete signature tracking
3. **Stdlib return type fallback** (line ~2979): Fallback lookup by function name when signature unavailable
4. **Ptr(Void) type ambiguity** (lines ~2925, ~3004): Ptr(Void) treated as "Any that can hold values" — type system issue
5. **Name conversion fallback** (line ~2666): Underscore/dot conversion for function lookups — naming inconsistency between MIR and function_map

## Recommendations

### Phase 4.3 — Safe to Delete Now
The dead codegen path can be safely removed without affecting any compilation:
- `CodeGenerator` struct and all its impl blocks in `mod.rs` (keep constants, re-exports)
- `expression_generator.rs` (entirely dead)
- `instruction_generator.rs` (entirely dead)
- `statement_generator.rs` (entirely dead)
- `stdlib/` files that ONLY reference CodeGenerator
- Supporting files used only by CodeGenerator: `binary_operations.rs`, `type_conversion.rs`, `type_manager.rs`, `wasm_module_builder.rs`, `binaryen_optimizer.rs`

**Estimated deletion:** ~15,000+ lines of dead code

### Phase 4.3 — Requires Care
- `mod.rs` cannot be fully deleted — it re-exports `MirCodeGenerator`, defines constants
- `memory.rs` — check if MirCodeGenerator uses any of its utilities
- `native_stdlib/` — check if MirCodeGenerator uses any of it

### Phase 4.5 — Active Workaround Cleanup
Track each of the 5 active workarounds in TASKS.md as individual tasks for proper resolution.

### Marker Rename
For the 45 "design documentation" markers: rename `CRITICAL FIX:` to `NOTE:` to reduce noise. For the 31 "resolved fixes": either remove the comment or rename to a non-alarming prefix.
