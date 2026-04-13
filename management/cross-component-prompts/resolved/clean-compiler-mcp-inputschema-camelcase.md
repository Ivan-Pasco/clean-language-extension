Component: Compiler
Issue Type: bug
Priority: critical
Description: The MCP server sends tool definitions with `input_schema` (snake_case) but the MCP specification requires `inputSchema` (camelCase). Claude Code validates the tools/list response and rejects ALL 18 tools because `inputSchema` is undefined.

Context: The connection now succeeds (initialize + notifications work, protocol version matches). But tools/list fails validation. This is the LAST remaining issue preventing MCP tools from working.

Evidence from Claude Code logs (v0.30.36, 2026-04-02 01:09):
```
[ERROR] MCP server "clean-language" Failed to fetch tools: [
  {"expected":"object","code":"invalid_type","path":["tools",0,"inputSchema"],
   "message":"Invalid input: expected object, received undefined"},
  ... (same for all 18 tools)
]
```

Verified by direct test:
```
Tool name: check
Has input_schema: True    ← server sends this (WRONG)
Has inputSchema: False    ← Claude Code expects this (MISSING)
Keys: ['description', 'input_schema', 'name']
```

The Fix: In the tools/list response, rename `input_schema` to `inputSchema` for every tool.

Before:
```json
{"name":"check","description":"...","input_schema":{"type":"object","properties":{...}}}
```

After:
```json
{"name":"check","description":"...","inputSchema":{"type":"object","properties":{...}}}
```

In Rust, this is likely a serde rename:
```rust
#[serde(rename = "inputSchema")]
pub input_schema: serde_json::Value,
```

Or if building JSON manually, change the key string from `"input_schema"` to `"inputSchema"`.

Reference: https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-definition

Files Affected: MCP server tool listing (likely `src/mcp/tools.rs` or `src/mcp/server.rs`)
