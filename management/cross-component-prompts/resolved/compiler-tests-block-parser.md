Component: clean-language-compiler
Issue Type: feature
Priority: critical
Description: Implement `tests:` block parser for Clean Language

The Frame framework needs a native test syntax so developers can write and run tests. The compiler must support a new `tests:` block type.

## Required Syntax

```clean
tests:
    test "user creation":
        User user = User.create(name: "Alice")
        assert user.name == "Alice"
        assert user.id > 0

    test "validation rejects short names":
        string error = User_validate("name", "A")
        assert error != ""

    test "empty email fails validation":
        string error = User_validate("email", "notanemail")
        assert error != ""
```

## Implementation Requirements

### 1. Grammar (grammar.pest)
- Add `tests_block` rule that matches `tests:` followed by indented `test "name":` entries
- Each test has a string name and an indented body of statements
- `assert` is a new keyword that evaluates a boolean expression

### 2. AST (src/ast/mod.rs)
- Add `TestBlock` node containing a list of `TestCase { name: String, body: Vec<Statement> }`
- Add `Assert` statement variant

### 3. Semantic Analysis
- Type-check test bodies the same as function bodies
- `assert` takes a boolean expression
- Tests have access to all module-level declarations

### 4. Code Generation
- Generate a WASM module with a `__run_tests` exported function
- Each test case becomes a function that:
  - Calls `_test_begin(test_name)` bridge function
  - Executes the body
  - On assert failure: calls `_test_fail(test_name, message)` with the failed expression as message
  - On success: calls `_test_pass(test_name)`
- `__run_tests` calls each test function sequentially
- After all tests: calls `_test_summary()` which returns pass/fail counts

### 5. Bridge Functions Required
```
_test_begin(string name) -> integer
_test_pass(string name) -> integer
_test_fail(string name, string message) -> integer
_test_summary() -> string   // Returns JSON: {"passed": N, "failed": N, "total": N}
```

## Context
Discovered while reviewing the Frame framework. All 5 framework plugins have test files in `tests/` but they're compiled and checked via shell scripts. A native test block would enable proper test-driven development with the `cleen test` command.

## Files Affected
- `src/parser/grammar.pest` — add `tests_block` and `test_case` rules
- `src/ast/mod.rs` — add TestBlock, TestCase, Assert nodes
- `src/semantic/` — type-check test bodies and assert expressions
- `src/codegen/` — generate test runner WASM with bridge function calls
