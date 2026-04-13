#!/bin/bash
# run_ci_tests.sh — CI test runner for Clean Language compiler
#
# Compiles all CI test files and compares results against baseline.
# Reports regressions, improvements, and failures.
#
# Usage:
#   ./scripts/run_ci_tests.sh                    # Run and compare to baseline
#   ./scripts/run_ci_tests.sh --update-baseline  # Run and save new baseline
#   ./scripts/run_ci_tests.sh --verbose          # Show per-test results
#   ./scripts/run_ci_tests.sh --tier 1           # Run only tier 1 tests

set -euo pipefail

# Use gtimeout on macOS, timeout on Linux
if command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_CMD="gtimeout"
elif command -v timeout >/dev/null 2>&1; then
    TIMEOUT_CMD="timeout"
else
    # No timeout available — run without
    TIMEOUT_CMD=""
fi

run_with_timeout() {
    local secs="$1"; shift
    if [[ -n "$TIMEOUT_CMD" ]]; then
        "$TIMEOUT_CMD" "$secs" "$@"
    else
        "$@"
    fi
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPILER_DIR="$PROJECT_ROOT/clean-language-compiler"
CI_DIR="$COMPILER_DIR/tests/cln/ci"
OUTPUT_DIR="$COMPILER_DIR/tests/output"
BASELINE_FILE="$COMPILER_DIR/tests/results/ci_baseline.json"
COMPILE_TIMEOUT=30
EXECUTE_TIMEOUT=10

# Parse arguments
UPDATE_BASELINE=false
VERBOSE=false
TIER_FILTER=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --update-baseline) UPDATE_BASELINE=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        --tier) TIER_FILTER="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Build compiler first
echo "Building compiler..."
if ! (cd "$COMPILER_DIR" && cargo build --bin cln --release 2>/dev/null); then
    echo "FATAL: Compiler build failed"
    exit 1
fi
CLN="$COMPILER_DIR/target/release/cln"

# Collect test files
declare -a TEST_FILES=()
for tier_dir in "$CI_DIR"/tier*/; do
    tier_num=$(basename "$tier_dir" | sed 's/tier//')
    if [[ -n "$TIER_FILTER" && "$tier_num" != "$TIER_FILTER" ]]; then
        continue
    fi
    while IFS= read -r -d '' f; do
        TEST_FILES+=("$f")
    done < <(find "$tier_dir" -name "*.cln" -print0 | sort -z)
done

TOTAL=${#TEST_FILES[@]}
COMPILE_PASS=0
COMPILE_FAIL=0
EXECUTE_PASS=0
EXECUTE_FAIL=0
EXECUTE_SKIP=0

declare -a COMPILE_FAILURES=()
declare -a EXECUTE_FAILURES=()
declare -a RESULTS=()

echo "Running $TOTAL CI tests..."
echo ""

for test_file in "${TEST_FILES[@]}"; do
    rel_path="${test_file#$CI_DIR/}"
    tier=$(echo "$rel_path" | cut -d/ -f1)
    name=$(basename "$test_file" .cln)
    wasm_file="$OUTPUT_DIR/ci_${name}.wasm"

    # Compile
    compile_status="FAIL"
    if run_with_timeout "$COMPILE_TIMEOUT" "$CLN" compile "$test_file" --output "$wasm_file" >/dev/null 2>&1; then
        compile_status="PASS"
        COMPILE_PASS=$((COMPILE_PASS + 1))
    else
        COMPILE_FAIL=$((COMPILE_FAIL + 1))
        COMPILE_FAILURES+=("$rel_path")
    fi

    # Execute (only if compile passed and wasmtime_runner exists)
    execute_status="SKIP"
    EXECUTE_SKIP=$((EXECUTE_SKIP + 1))
    # NOTE: Execution requires full host bridge (clean-server stack).
    # The standalone wasmtime_runner cannot execute these files.
    # When runtime integration exists, uncomment the block below.
    #
    # if [[ "$compile_status" == "PASS" ]]; then
    #     expected_file="$CI_DIR/expected/${name}.expected"
    #     if [[ -f "$expected_file" ]]; then
    #         actual=$(timeout "$EXECUTE_TIMEOUT" "$COMPILER_DIR/target/release/wasmtime_runner" "$wasm_file" 2>/dev/null | grep -v "^wasmtime" || true)
    #         expected=$(cat "$expected_file")
    #         if [[ "$actual" == "$expected" ]]; then
    #             execute_status="PASS"
    #             EXECUTE_PASS=$((EXECUTE_PASS + 1))
    #             EXECUTE_SKIP=$((EXECUTE_SKIP - 1))
    #         else
    #             execute_status="FAIL"
    #             EXECUTE_FAIL=$((EXECUTE_FAIL + 1))
    #             EXECUTE_SKIP=$((EXECUTE_SKIP - 1))
    #             EXECUTE_FAILURES+=("$rel_path")
    #         fi
    #     fi
    # fi

    RESULTS+=("${tier}|${name}|${compile_status}|${execute_status}")

    if $VERBOSE; then
        if [[ "$compile_status" == "PASS" ]]; then
            echo "  PASS  $rel_path"
        else
            echo "  FAIL  $rel_path"
        fi
    fi
done

echo ""
echo "============================================"
echo "  CI Test Results"
echo "============================================"
echo ""
echo "  Compile: $COMPILE_PASS passed, $COMPILE_FAIL failed (total: $TOTAL)"
echo "  Execute: $EXECUTE_PASS passed, $EXECUTE_FAIL failed, $EXECUTE_SKIP skipped"
echo ""

if [[ ${#COMPILE_FAILURES[@]} -gt 0 ]]; then
    echo "  Compile failures:"
    for f in "${COMPILE_FAILURES[@]}"; do
        echo "    - $f"
    done
    echo ""
fi

if [[ ${#EXECUTE_FAILURES[@]} -gt 0 ]]; then
    echo "  Execute failures:"
    for f in "${EXECUTE_FAILURES[@]}"; do
        echo "    - $f"
    done
    echo ""
fi

# Compare to baseline
if [[ -f "$BASELINE_FILE" && "$UPDATE_BASELINE" == "false" ]]; then
    prev_compile_pass=$(jq -r '.compile_pass // 0' "$BASELINE_FILE")
    prev_compile_fail=$(jq -r '.compile_fail // 0' "$BASELINE_FILE")

    if [[ "$COMPILE_PASS" -lt "$prev_compile_pass" ]]; then
        regressions=$((prev_compile_pass - COMPILE_PASS))
        echo "  *** REGRESSION: $regressions tests that previously compiled now fail ***"
        echo ""
    elif [[ "$COMPILE_PASS" -gt "$prev_compile_pass" ]]; then
        improvements=$((COMPILE_PASS - prev_compile_pass))
        echo "  IMPROVEMENT: $improvements more tests now compile"
        echo ""
    else
        echo "  No change from baseline ($prev_compile_pass/$((prev_compile_pass + prev_compile_fail)) compiled)"
        echo ""
    fi
fi

# Save baseline
if $UPDATE_BASELINE; then
    # Build JSON
    if [[ ${#COMPILE_FAILURES[@]} -gt 0 ]]; then
        failures_json=$(printf '%s\n' "${COMPILE_FAILURES[@]}" | jq -R . | jq -s .)
    else
        failures_json="[]"
    fi
    cat > "$BASELINE_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "total": $TOTAL,
  "compile_pass": $COMPILE_PASS,
  "compile_fail": $COMPILE_FAIL,
  "execute_pass": $EXECUTE_PASS,
  "execute_fail": $EXECUTE_FAIL,
  "execute_skip": $EXECUTE_SKIP,
  "compile_failures": $failures_json
}
EOF
    echo "  Baseline saved to: $BASELINE_FILE"
    echo ""
fi

# Exit with failure if any tier 1-3 compile failures
tier4_failures=0
if [[ ${#COMPILE_FAILURES[@]} -gt 0 ]]; then
    for f in "${COMPILE_FAILURES[@]}"; do
        if [[ "$f" == tier4/* ]]; then
            tier4_failures=$((tier4_failures + 1))
        fi
    done
fi

non_tier4_failures=$((COMPILE_FAIL - tier4_failures))
if [[ $non_tier4_failures -gt 0 ]]; then
    echo "  EXIT: FAIL ($non_tier4_failures tier 1-3 compile failures)"
    exit 1
else
    echo "  EXIT: PASS (all tier 1-3 tests compile)"
    exit 0
fi
