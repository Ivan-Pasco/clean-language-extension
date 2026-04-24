Component: clean-manager
Issue Type: feature
Priority: critical
Description: Implement `cleen test` command for running Clean Language tests

The compiler will support `tests:` blocks (see companion prompt: compiler-tests-block-parser.md). The clean-manager needs a `cleen test` command that discovers, compiles, and runs these tests.

## Command Syntax

```bash
# Run all tests
cleen test

# Run tests in a specific file
cleen test app/data/models/User.cln

# Run tests matching a pattern
cleen test --filter "user"

# Run with verbose output
cleen test --verbose

# Run and show timing
cleen test --timing
```

## Implementation Requirements

### 1. Test Discovery

Scan the project for files containing `tests:` blocks:
- `app/**/*.cln`
- `tests/**/*.cln`
- Any `.cln` file in the project

### 2. Compilation

For each file with tests:
1. Compile with the Clean compiler: `cln compile <file> -o <temp>.wasm --test-mode`
2. The `--test-mode` flag tells the compiler to include test functions in the output
3. The compiled WASM exports a `__run_tests` function

### 3. Execution

For each compiled test WASM:
1. Instantiate in a WASM runtime with test bridge functions:
   - `_test_begin(name)` — record test start
   - `_test_pass(name)` — record success
   - `_test_fail(name, message)` — record failure with message
   - `_test_summary()` — return JSON summary
2. Call `__run_tests`
3. Collect results

### 4. Output Format

```
Running tests...

  app/data/models/User.cln
    ✓ user creation (2ms)
    ✓ validation rejects short names (1ms)
    ✗ empty email fails validation
      Expected: error != ""
      Got: error == ""
      at User.cln:45

  app/backend/api/users.cln
    ✓ list users returns array (3ms)
    ✓ create user requires auth (1ms)

Results: 4 passed, 1 failed, 5 total
Time: 0.23s
```

### 5. Exit Codes

- `0` — all tests passed
- `1` — one or more tests failed
- `2` — compilation error (tests couldn't run)

### 6. Filter Support

`--filter "pattern"` matches against:
- File paths
- Test names (the string in `test "name":`)

### 7. Bridge Functions to Provide

The test runner WASM runtime must provide these host functions:
```
_test_begin(string name) -> integer
_test_pass(string name) -> integer
_test_fail(string name, string message) -> integer
_test_summary() -> string
```

Plus all standard bridge functions (console, math, string) so test code can use the full language.

## Context
The Frame framework has 105+ test files in `tests/` but they're run via shell scripts that compile and check WASM validity. A proper `cleen test` command enables TDD workflows, CI integration, and developer productivity. This depends on the compiler implementing `tests:` block parsing first.

## Dependencies
- `compiler-tests-block-parser.md` must be implemented first

## Files Affected
- `cleen` CLI — add `test` subcommand
- Test runner — WASM runtime with test bridge functions
- Output formatting — terminal colors, timing, summaries
