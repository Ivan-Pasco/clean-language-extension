Component: Compiler
Issue Type: bug (NOT FIXED in v0.30.33)
Priority: critical
Description: v0.30.33 responds with protocolVersion "2025-03-26" but Claude Code v2.1.90 requires "2025-11-25". The connection STILL times out. This was verified on 2026-04-01 at 23:20 UTC — see exact log lines below.

Context: Found in VS Code Claude Code extension logs at:
`~/Library/Application Support/Code/logs/20260401T095551/window13/exthost/Anthropic.claude-code/Claude VSCode.log`

EXACT LOG from Claude Code (window13, 2026-04-01 23:20 UTC, v0.30.33):

```
[DEBUG] MCP server "clean-language": Connection timeout triggered after 30003ms (limit: 30000ms)
[ERROR] MCP server "clean-language" Server stderr:
  [MCP] <- {"method":"initialize","params":{"protocolVersion":"2025-11-25",...},"jsonrpc":"2.0","id":0}
  [MCP] Client requested protocol 2025-11-25, responding with 2025-03-26
  [MCP] -> {"jsonrpc":"2.0","id":0,"result":{"protocolVersion":"2025-03-26",...}}
[DEBUG] MCP server "clean-language": Connection failed after 30012ms: connection timed out after 30000ms
[ERROR] MCP server "clean-language" Connection failed: connection timed out after 30000ms
```

WHAT HAPPENS:
1. Claude Code sends initialize with protocolVersion "2025-11-25"
2. Server responds with protocolVersion "2025-03-26"
3. Claude Code STALLS — never sends notifications/initialized or tools/list
4. 30 seconds later → timeout, no tools registered

v0.30.33 DID NOT FIX THIS. "2025-03-26" is not accepted by Claude Code.

THE FIX: Change the protocolVersion in the initialize response to "2025-11-25". Just the string. The actual protocol behavior is already working — only the version string needs to match what Claude Code expects.

In the Rust code, find where the initialize response is built and change:
  "protocolVersion": "2025-03-26"
to:
  "protocolVersion": "2025-11-25"

Reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle

Files Affected: MCP server initialization handler (likely `src/mcp/server.rs` or `src/mcp/handler.rs`)
