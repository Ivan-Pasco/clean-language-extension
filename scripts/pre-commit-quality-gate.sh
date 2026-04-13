#!/bin/bash
# pre-commit-quality-gate.sh — Quality gate before commits
#
# Detects which components have staged changes and runs build+test for each.
# Outputs JSON for hook consumption.

set -euo pipefail

PROJECT_ROOT="/Users/earcandy/Documents/Dev/Clean Language"
ERRORS=""
CHECKS=0
PASSES=0

# Get staged files
STAGED=$(git diff --cached --name-only 2>/dev/null || true)

if [[ -z "$STAGED" ]]; then
    echo '{"suppressOutput": true}'
    exit 0
fi

# Check which components are affected
HAS_COMPILER=$(echo "$STAGED" | grep -c "^clean-language-compiler/" || true)
HAS_SERVER=$(echo "$STAGED" | grep -c "^clean-server/" || true)
HAS_EXTENSION=$(echo "$STAGED" | grep -c "^clean-extension/" || true)
HAS_MANAGER=$(echo "$STAGED" | grep -c "^clean-manager/" || true)

# Compiler checks
if [[ "$HAS_COMPILER" -gt 0 ]]; then
    CHECKS=$((CHECKS + 1))
    if (cd "$PROJECT_ROOT/clean-language-compiler" && cargo check --quiet 2>/dev/null && cargo test --lib --quiet 2>/dev/null); then
        PASSES=$((PASSES + 1))
    else
        ERRORS="${ERRORS}compiler build/test failed; "
    fi
fi

# Server checks
if [[ "$HAS_SERVER" -gt 0 ]]; then
    CHECKS=$((CHECKS + 1))
    if (cd "$PROJECT_ROOT/clean-server" && cargo check --quiet 2>/dev/null); then
        PASSES=$((PASSES + 1))
    else
        ERRORS="${ERRORS}server build failed; "
    fi
fi

# Extension checks
if [[ "$HAS_EXTENSION" -gt 0 ]]; then
    CHECKS=$((CHECKS + 1))
    if (cd "$PROJECT_ROOT/clean-extension" && npm run compile --silent 2>/dev/null); then
        PASSES=$((PASSES + 1))
    else
        ERRORS="${ERRORS}extension build failed; "
    fi
fi

# Manager checks
if [[ "$HAS_MANAGER" -gt 0 ]]; then
    CHECKS=$((CHECKS + 1))
    if (cd "$PROJECT_ROOT/clean-manager" && cargo check --quiet 2>/dev/null); then
        PASSES=$((PASSES + 1))
    else
        ERRORS="${ERRORS}manager build failed; "
    fi
fi

if [[ -n "$ERRORS" ]]; then
    echo "{\"continue\": false, \"stopReason\": \"Quality gate failed: ${ERRORS}\"}"
    exit 0
fi

if [[ "$CHECKS" -gt 0 ]]; then
    echo "{\"systemMessage\": \"Quality gate: $PASSES/$CHECKS components passed\", \"suppressOutput\": true}"
fi

exit 0
