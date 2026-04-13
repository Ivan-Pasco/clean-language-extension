---
description: Specification rules — active when editing spec files
globs: ["spec/**", "Language-Specification.md"]
alwaysApply: false
---

# Spec Work Rules

## Developer Approval Required (Principle 25)
- **NEVER modify spec files without developer approval.**
- This includes: grammar.ebnf, semantic-rules.md, type-system.md, stdlib-reference.md, plugins/*.ebnf
- If you find a gap or inconsistency, REPORT it and ASK the developer what to do.
- Exception: fixing typos, comments, and formatting does not require approval.

## EBNF Before Implementation (Principle 2)
- New syntax must be defined in `spec/grammar.ebnf` BEFORE implementing it in the compiler.
- The EBNF is the single source of truth for what syntax is valid.

## Spec-Implementation Parity (Principle 24)
- Everything in the spec must be implemented. Everything implemented must be in the spec.
- If parity is broken, either fix the implementation OR update the spec (with approval).
- Unimplemented features belong in TASKS.md, not in the spec.

## Change Propagation (Principle 12)
When changing the specification (after developer approval):
1. Update `spec/grammar.ebnf` (or plugin EBNF)
2. Update `spec/semantic-rules.md` if semantic behavior changes
3. Update `spec/type-system.md` if type rules change
4. Update `Language-Specification.md` prose to match
5. File a cross-component prompt for compiler implementation

## Documentation Has One Home (Principle 3)
- Each fact is documented in exactly one place
- `grammar.ebnf` = syntax rules
- `semantic-rules.md` = type checking and scope rules
- `type-system.md` = type hierarchy and conversions
- `stdlib-reference.md` = built-in function signatures
- Don't duplicate information across these files
