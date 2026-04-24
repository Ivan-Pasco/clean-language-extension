# /coverage — Spec Coverage Report

Measure test coverage against the formal specification.

## Usage
- `/coverage` — full coverage report
- `/coverage grammar` — grammar production coverage only
- `/coverage types` — type system coverage only

## Instructions

1. **Read the spec files:**
   - `foundation/spec/grammar.ebnf` — extract all production rule names
   - `foundation/spec/semantic-rules.md` — extract all rule codes (SYN*, SEM*, SCOPE*, etc.)
   - `foundation/spec/type-system.md` — extract type categories

2. **Read the test files:**
   - Scan `tests/cln/` recursively for all .cln test files
   - For each test, identify which grammar productions and semantic rules it exercises
   - Check test file headers for `// Grammar:` and `// Semantic:` annotations

3. **Classify each spec item:**
   - **Covered + Passing**: A test exists and passes
   - **Covered + Failing**: A test exists but fails (known gap)
   - **Not Covered**: No test exercises this spec item

4. **Report coverage percentages:**
   ```
   Grammar Productions: X/Y covered (Z%)
     - Covered + Passing: A
     - Covered + Failing: B
     - Not Covered: C
   
   Semantic Rules: X/Y covered (Z%)
     ...
   
   Type System: X/Y covered (Z%)
     ...
   ```

5. **List uncovered areas** grouped by importance:
   - Core (variables, types, expressions, functions) — must cover
   - Control flow (if, while, for, match) — must cover
   - OOP (classes, inheritance, methods) — should cover
   - Advanced (async, plugins, modules) — can defer

6. **Suggest tests to write** for the highest-priority uncovered areas.
