#!/bin/bash
# full-quality-gate.sh — Comprehensive quality gate for Clean Language project
# Checks all components, runs all tests, verifies all metrics.
# Exit 0 = all pass, Exit 1 = failures found.
# Usage: bash scripts/full-quality-gate.sh [--quick]

set -euo pipefail

PROJECT_ROOT="/Users/earcandy/Documents/Dev/Clean Language"
QUICK=false
[[ "${1:-}" == "--quick" ]] && QUICK=true

PASS=0
FAIL=0
WARNINGS=""

check() {
    local name="$1"
    local result="$2"
    if [[ "$result" == "PASS" ]]; then
        echo "  [PASS] $name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $name — $result"
        FAIL=$((FAIL + 1))
        WARNINGS="${WARNINGS}\n  - $name: $result"
    fi
}

echo ""
echo "============================================"
echo "  Clean Language — Full Quality Gate"
echo "============================================"
echo ""

# 1. Compiler build
echo "--- Compiler ---"
if (cd "$PROJECT_ROOT/clean-language-compiler" && cargo check --quiet 2>/dev/null); then
    check "Compiler build" "PASS"
else
    check "Compiler build" "cargo check failed"
fi

# 2. Compiler unit tests
UNIT_RESULT=$(cd "$PROJECT_ROOT/clean-language-compiler" && cargo test --lib --quiet 2>&1 | grep "^test result:" || echo "FAILED")
if echo "$UNIT_RESULT" | grep -q "0 failed"; then
    PASSED=$(echo "$UNIT_RESULT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+')
    check "Compiler unit tests ($PASSED passed)" "PASS"
else
    check "Compiler unit tests" "$UNIT_RESULT"
fi

# 3. CI tests
if ! $QUICK; then
    CI_RESULT=$(cd "$PROJECT_ROOT" && bash scripts/run_ci_tests.sh 2>&1)
    CI_COMPILE=$(echo "$CI_RESULT" | grep "Compile:" | head -1)
    CI_EXIT=$(echo "$CI_RESULT" | grep "EXIT:" | head -1)
    if echo "$CI_EXIT" | grep -q "PASS"; then
        check "CI tests ($CI_COMPILE)" "PASS"
    else
        check "CI tests" "$CI_EXIT"
    fi
fi

# 4. Server build
echo "--- Server ---"
if (cd "$PROJECT_ROOT/clean-server" && cargo check --quiet 2>/dev/null); then
    check "Server build" "PASS"
else
    check "Server build" "cargo check failed"
fi

# 5. Extension build + tests
echo "--- Extension ---"
if (cd "$PROJECT_ROOT/clean-extension" && npm run compile --silent 2>/dev/null); then
    check "Extension build" "PASS"
else
    check "Extension build" "tsc failed"
fi

EXT_TESTS=$(cd "$PROJECT_ROOT/clean-extension" && node ./out/test/runTests.js 2>&1 | grep -E "passing|failing" | head -1)
if echo "$EXT_TESTS" | grep -q "0 failing"; then
    check "Extension tests (${EXT_TESTS## })" "PASS"
else
    check "Extension tests" "${EXT_TESTS:-no output}"
fi

# 6. Manager build
echo "--- Manager ---"
if (cd "$PROJECT_ROOT/clean-manager" && cargo check --quiet 2>/dev/null); then
    check "Manager build" "PASS"
else
    check "Manager build" "cargo check failed"
fi

# 7. cPanel build
echo "--- cPanel ---"
if (cd "$PROJECT_ROOT/clean-cpanel-plugin" && cargo check --quiet 2>/dev/null); then
    check "cPanel build" "PASS"
else
    check "cPanel build" "cargo check failed"
fi

# 8. Code quality markers
echo "--- Code Quality ---"
MARKERS=$(cd "$PROJECT_ROOT/clean-language-compiler/src" && { grep -rn "CRITICAL FIX\|WORKAROUND\|todo!()\|unimplemented!()" --include="*.rs" 2>/dev/null || true; } | wc -l | tr -d ' ')
if [[ "$MARKERS" == "0" ]]; then
    check "Quality markers (0 found)" "PASS"
else
    check "Quality markers" "$MARKERS markers found"
fi

# 9. Spec files
echo "--- Specification ---"
SPEC_MISSING=0
for f in foundation/spec/grammar.ebnf foundation/spec/semantic-rules.md foundation/spec/type-system.md foundation/spec/stdlib-reference.md foundation/spec/plugins/frame-server.ebnf foundation/spec/plugins/frame-data.ebnf foundation/spec/plugins/frame-ui.ebnf foundation/spec/plugins/frame-auth.ebnf foundation/spec/plugins/frame-canvas.ebnf; do
    [[ ! -f "$PROJECT_ROOT/$f" ]] && SPEC_MISSING=$((SPEC_MISSING + 1))
done
if [[ "$SPEC_MISSING" == "0" ]]; then
    check "Spec files (9/9 present)" "PASS"
else
    check "Spec files" "$SPEC_MISSING missing"
fi

# Summary
echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
if [[ "$FAIL" -gt 0 ]]; then
    echo -e "\n  Failures:$WARNINGS"
    echo ""
    exit 1
else
    echo "  All checks passed."
    echo ""
    exit 0
fi
