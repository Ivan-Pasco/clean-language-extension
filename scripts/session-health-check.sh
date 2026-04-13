#!/bin/bash
# Session Health Check — runs at session start to report build/test status
# Detects component from PWD and runs appropriate checks.
# Always exits 0 — informational only.

set -euo pipefail

PROJECT_ROOT="/Users/earcandy/Documents/Dev/Clean Language"
COMPONENT=""

# Detect component from PWD
case "$PWD" in
  *clean-language-compiler*) COMPONENT="compiler" ;;
  *clean-server*)            COMPONENT="server" ;;
  *clean-framework*)         COMPONENT="framework" ;;
  *clean-extension*)         COMPONENT="extension" ;;
  *clean-manager*)           COMPONENT="manager" ;;
  *clean-canvas*)            COMPONENT="canvas" ;;
  *clean-ui*)                COMPONENT="ui" ;;
  *clean-node-server*)       COMPONENT="node-server" ;;
  *clean-llm*)               COMPONENT="llm" ;;
  *"Clean Language"*)        COMPONENT="root" ;;
  *)                         COMPONENT="unknown" ;;
esac

result=""

case "$COMPONENT" in
  compiler)
    # Rust build check
    BUILD=$(cd "$PROJECT_ROOT/clean-language-compiler" && cargo check 2>&1 && echo "PASS" || echo "FAIL")
    BUILD_STATUS=$(echo "$BUILD" | tail -1)

    # Test count
    TEST_OUTPUT=$(cd "$PROJECT_ROOT/clean-language-compiler" && cargo test 2>&1 || true)
    PASSED=$(echo "$TEST_OUTPUT" | grep -oE 'test result: ok\. ([0-9]+) passed' | grep -oE '[0-9]+' || echo "?")
    FAILED=$(echo "$TEST_OUTPUT" | grep -oE '([0-9]+) failed' | grep -oE '[0-9]+' || echo "0")

    result="Component: compiler | Build: $BUILD_STATUS | Tests: $PASSED passed, $FAILED failed"
    ;;

  server)
    BUILD=$(cd "$PROJECT_ROOT/clean-server" && cargo check 2>&1 && echo "PASS" || echo "FAIL")
    BUILD_STATUS=$(echo "$BUILD" | tail -1)
    result="Component: server | Build: $BUILD_STATUS"
    ;;

  framework)
    result="Component: framework | Status: plugin-based (no standalone build)"
    ;;

  extension)
    BUILD=$(cd "$PROJECT_ROOT/clean-extension" && npm run compile 2>&1 && echo "PASS" || echo "FAIL")
    BUILD_STATUS=$(echo "$BUILD" | tail -1)
    result="Component: extension | Build: $BUILD_STATUS"
    ;;

  manager)
    BUILD=$(cd "$PROJECT_ROOT/clean-manager" && cargo check 2>&1 && echo "PASS" || echo "FAIL")
    BUILD_STATUS=$(echo "$BUILD" | tail -1)
    result="Component: manager | Build: $BUILD_STATUS"
    ;;

  root)
    result="Component: root (multi-component) | Use /health <component> for detailed checks"
    ;;

  *)
    result="Component: unknown | Cannot determine component from PWD: $PWD"
    ;;
esac

# Output as JSON for hook consumption
cat <<EOF
{"systemMessage": "Health Check: $result", "suppressOutput": true}
EOF

exit 0
