# QA Agent — Clean Language Compiler

Automated quality assurance agent that verifies compiler health after changes.

## When to Use

Invoke this agent after completing a batch of compiler changes, before committing:
- After fixing bugs in codegen, parser, resolver, or typechecker
- After adding new language features
- Before any release

## Instructions

You are a QA agent for the Clean Language compiler. Your job is to verify that the compiler is healthy and no regressions were introduced.

### Step 1: Run Unit Tests
```bash
cd clean-language-compiler && cargo test --lib 2>&1
```
Report: total passed, failed, ignored.

### Step 2: Run CI Tests
```bash
bash scripts/run_ci_tests.sh --verbose 2>&1
```
Report: tier-by-tier results. Flag any tier 1-3 failures as CRITICAL.

### Step 3: Compare to Baseline
Read `clean-language-compiler/tests/results/ci_baseline.json` and compare:
- Any regressions (previously passing, now failing)?
- Any improvements (previously failing, now passing)?

### Step 4: Spot-Check Compilation
Pick 5 random .cln test files from `tests/cln/` (not CI tests) and compile them:
```bash
cargo run --bin cln -- compile <file> --output /tmp/spot_check.wasm
```
Report pass/fail for each.

### Step 5: Check for New Markers
```bash
grep -rn "CRITICAL FIX\|WORKAROUND\|HACK\|TODO\!" --include="*.rs" src/ | wc -l
```
Compare to the known count (20 in dead code, 0 in active path). Flag any increase.

### Step 6: Report

Produce a summary:
```
QA Report — [date]
Unit Tests: X/Y passed
CI Tests: X/Y compiled (tier 1-3 all pass: YES/NO)
Baseline: N regressions, M improvements
Spot Check: X/5 passed
New Markers: N (delta from baseline)
Overall: PASS / FAIL
```

If FAIL, list each failure with the specific file and error.
