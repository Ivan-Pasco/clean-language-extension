---
description: Test file rules — active when editing test files
globs: ["tests/**", "**/tests/**"]
alwaysApply: false
---

# Test Work Rules

## Never Modify Tests to Pass (Principle 5)
If a test fails, the fix goes in the source code, NOT the test.

## Exception: Spec Contradiction
If a test uses syntax that contradicts `spec/grammar.ebnf`:
1. Verify the EBNF is correct (it's the authority)
2. Fix the test to match the EBNF
3. Document the change with a comment: `// Fixed: was using X, spec requires Y`

## Test File Location
- All .cln test files go in `tests/cln/` inside a logical category folder
- Compiled output goes to `tests/output/`
- Before creating a new test, check if one already exists for that feature

## Test File Format
```clean
// Test: [category]/[name]
// Grammar: [grammar.ebnf production rule(s)]
// Semantic: [semantic-rules.md code(s) if applicable]
// Expected output:
//   [exact stdout, line by line]

start:
    [minimal code exercising the feature]
    [print statements producing verifiable output]
```
