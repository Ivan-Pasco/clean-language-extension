Component: Compiler
Issue Type: bug
Priority: critical
Description: The MCP server rejects JSON-RPC notifications (messages without an `id` field) and writes error responses to stdout. Per JSON-RPC 2.0 spec, notifications are messages where the client does not expect a response. The server MUST NOT reply to notifications — it should process them silently.

Context: This is a follow-up to the Content-Length framing fix in v0.30.31. The framing is now correct, but the server still rejects the `notifications/initialized` message that Claude Code sends after `initialize`. This error response appears on stdout between the `initialize` response and the `tools/list` response, causing Claude Code to fail tool registration.

Observed behavior (v0.30.31):
```
← Client sends: initialize (id=1)
→ Server responds: {"jsonrpc":"2.0","id":1,"result":{...}}   ✅ correct

← Client sends: notifications/initialized (NO id field — this is a notification)
→ Server responds: {"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error: missing field `id` at line 1 column 54"}}   ❌ WRONG

← Client sends: tools/list (id=2)  
→ Server responds: {"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}   ✅ correct
```

Expected behavior: The server should silently accept `notifications/initialized` (and any other notification) without writing any response to stdout. Per JSON-RPC 2.0:
- A Request object that is a Notification has no `id` member
- The Server MUST NOT reply to a Notification
- Reference: https://www.jsonrpc.org/specification#notification

Impact: Claude Code cannot register any MCP tools. All 17 tools (get_quick_reference, list_plugins, check, compile, etc.) are unavailable because the error response between initialize and tools/list corrupts the response stream.

Suggested Fix: In the MCP server's message dispatcher:
1. After parsing a JSON-RPC message, check if it has an `id` field
2. If it does NOT have an `id` field, it is a notification — process it but do NOT write any response
3. If it DOES have an `id` field, it is a request — process it and write the response
4. Specifically handle `notifications/initialized` as a known notification method

Files Affected: The MCP server message handler (likely `src/mcp/server.rs` or `src/mcp/handler.rs`)
