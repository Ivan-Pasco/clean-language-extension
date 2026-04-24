Component: Compiler
Issue Type: bug
Priority: high
Description: The MCP server's stdin reader does not properly handle Content-Length header framing per the MCP protocol specification. When Claude Code (or any MCP client) sends messages with `Content-Length: N\r\n\r\n{json}` framing, the server attempts to parse the `Content-Length` header line as JSON, which produces parse errors that are written to stdout before the actual valid response.

Context: Discovered while working in the Web Site Clean project. Claude Code connects to the MCP server via `.mcp.json` config. The server starts correctly, returns valid `initialize` responses (instructions are received), but the `tools/list` response gets mixed with error frames on stdout, causing Claude Code to fail silently when registering tools. The result is that all 17 MCP tools are unavailable despite the server being functional.

Observed behavior:
```
# Server outputs these errors to stdout when receiving Content-Length framed messages:
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: expected value at line 1 column 1"}}
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: trailing characters at line 1 column 152"}}

# Then the valid response follows:
{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{}},...}}
```

Expected behavior: The MCP server should parse Content-Length headers as transport framing (per MCP spec), extract the JSON body, and only output valid JSON-RPC responses to stdout. No parse errors should be emitted for well-formed framed messages.

Impact: All MCP tools (get_quick_reference, list_plugins, check, compile, etc.) are unavailable to AI assistants using Claude Code, VS Code extension, or any MCP-compliant client that uses Content-Length framing. This completely breaks the AI-assisted development workflow.

Suggested Fix: In the MCP server's stdin reading loop (likely in `src/mcp/` or similar), implement proper Content-Length header parsing:
1. Read lines until you find `Content-Length: N`
2. Read the blank line separator (`\r\n`)
3. Read exactly N bytes as the JSON-RPC message body
4. Parse only the body as JSON — never attempt to parse header lines as JSON
5. Reference: https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio

Files Affected: The MCP server transport/stdin reader in the compiler codebase (likely `src/mcp/server.rs` or `src/mcp/transport.rs`)
