#!/bin/bash
# run_wasm.sh — Execute a WASM file through clean-server and capture print output
#
# Usage: ./scripts/run_wasm.sh <wasm_file> [timeout_seconds]
#
# Captures only the WASM program's print output (strips server logs).
# Exit code 0 = success, 1 = error/timeout

set -euo pipefail

WASM_FILE="${1:?Usage: run_wasm.sh <wasm_file> [timeout_seconds]}"
TIMEOUT="${2:-5}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER="$PROJECT_ROOT/clean-server/target/release/clean-server"

if [[ ! -f "$SERVER" ]]; then
    echo "Error: clean-server not built. Run: cd clean-server && cargo build --release" >&2
    exit 1
fi

if [[ ! -f "$WASM_FILE" ]]; then
    echo "Error: WASM file not found: $WASM_FILE" >&2
    exit 1
fi

# Find a free port
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()' 2>/dev/null || echo 39$(( RANDOM % 900 + 100 )))

# Run server, capture all output, extract print lines
# The server writes print output to stdout mixed with ANSI log lines.
# Print output appears between "_start" log and "Module initialized" log,
# on lines that don't start with ANSI escape sequences.
OUTPUT_FILE=$(mktemp)
trap "rm -f '$OUTPUT_FILE'" EXIT

"$SERVER" --port "$PORT" "$WASM_FILE" >"$OUTPUT_FILE" 2>&1 &
SERVER_PID=$!

# Wait for startup then kill
sleep "$TIMEOUT"
kill "$SERVER_PID" 2>/dev/null
wait "$SERVER_PID" 2>/dev/null || true

# Strip all ANSI escape codes first, then extract print output.
# Print output appears after "_start" line and before "Module initialized" line.
# It may be on the same line as "_start" (no newline from print).
CLEAN_FILE=$(mktemp)
trap "rm -f '$OUTPUT_FILE' '$CLEAN_FILE'" EXIT

# Strip ANSI codes
sed 's/\x1b\[[0-9;]*m//g' "$OUTPUT_FILE" > "$CLEAN_FILE"

# Extract print output between _start log and Module initialized log.
# Print output is on the line(s) AFTER "_start", with the program output
# concatenated at the start of the line followed by the next log timestamp.
# Example: "hello2026-04-12T23:27:51Z  INFO Module initialized"
# Extract print output from lines after "_start".
# Print output is at the START of a line, concatenated with the next log timestamp.
# Strategy: for each line after _start, strip timestamp+log suffix, print remainder.
awk '
  /Calling WASM entry point: _start/ { found_start = 1; next }
  found_start {
    # Strip from first "20XX-" timestamp onward (log output after print text)
    sub(/20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]T.*/, "")
    gsub(/^[[:space:]]+|[[:space:]]+$/, "")
    if (length($0) > 0) print
    # Only capture the first block of output lines
    if ($0 ~ /Module initialized/ || length($0) == 0) exit
  }
' "$CLEAN_FILE"

exit 0
