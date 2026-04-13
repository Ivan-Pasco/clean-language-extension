Component: Compiler
Issue Type: bug
Priority: critical
Description: The MCP server writes debug/log lines (prefixed with `[MCP]`) to stdout, corrupting the JSON-RPC protocol stream. All log output MUST go to stderr. Only Content-Length framed JSON-RPC messages should go to stdout.

Context: This is the root cause of why Claude Code cannot register MCP tools. The previous fixes (Content-Length framing in v0.30.31, notification handling in v0.30.32) were correct, but the log lines on stdout have been masking the fix.

Observed behavior (v0.30.32):
```
stdout: [MCP] Starting Clean Language Compiler MCP server v0.30.32     ← WRONG
stdout: [MCP] Protocol: JSON-RPC 2.0                                    ← WRONG
stdout: [MCP] Reading from stdin, writing to stdout                      ← WRONG
stdout: [MCP] <- {"jsonrpc":"2.0","id":1,"method":"initialize",...}      ← WRONG
stdout: [MCP] -> {"jsonrpc":"2.0","id":1,"result":{...}}                ← WRONG
stdout: Content-Length: 1667\r\n\r\n{"jsonrpc":"2.0","id":1,...}         ← correct
```

Claude Code reads the first line `[MCP] Starting...`, fails to parse it as JSON-RPC or Content-Length header, and drops the connection.

Expected behavior: ALL `[MCP]` log/debug lines go to stderr. ONLY `Content-Length: N\r\n\r\n{json}` messages go to stdout. This is per the MCP specification: https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio

> "The server SHOULD only write MCP protocol messages to stdout"
> "Servers MAY write UTF-8 strings to stderr for logging purposes"

Suggested Fix: In the MCP server code, change all `println!("[MCP]...")` or equivalent log statements to `eprintln!("[MCP]...")`. Specifically:
- Startup banner → stderr
- `[MCP] <-` request logging → stderr
- `[MCP] ->` response logging → stderr  
- `[MCP] Notification:` → stderr
- `[MCP] Client initialized` → stderr
- `[MCP] EOF detected` → stderr

Only the actual `Content-Length: N\r\n\r\n{json-rpc-message}` output should go to stdout.

Files Affected: MCP server I/O code (likely `src/mcp/server.rs` or `src/mcp/transport.rs`)
