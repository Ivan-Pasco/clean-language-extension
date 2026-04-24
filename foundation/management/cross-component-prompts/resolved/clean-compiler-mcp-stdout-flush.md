Component: Compiler
Issue Type: bug
Priority: critical
Description: The MCP server does not flush stdout after writing responses. The Content-Length header and JSON body are written in separate system calls, and the body remains in the stdout buffer until the next write triggers a flush. This causes a multi-second delay between the header and body reaching the client, which makes the handshake too slow for Claude Code's 30-second timeout.

Evidence (v0.30.34, tested 2026-04-02):
- protocolVersion negotiation is now correct ("2025-11-25" ✅)
- Notification handling is correct (no error responses ✅)
- Logs go to stderr only ✅)
- BUT: the initialize response body arrives 3 seconds after the Content-Length header

Timing test:
```
[00:03:02] Content-Length: 1686     ← header written immediately  
[00:03:02]                          ← blank separator
[00:03:05] {"jsonrpc":"2.0",...}    ← body arrives 3 SECONDS LATER (buffered)
```

Claude Code waits for the body after reading the Content-Length header. With buffering delays, the full handshake (initialize → notification → tools/list) takes too long and times out at 30 seconds.

UPDATE (v0.30.35): The flush was added but connections STILL time out.

Root cause identified: The JSON body does NOT end with a newline `\n`. The pipe reader on the client side (Claude Code / Node.js) uses a buffered reader that waits for `\n` to deliver the current chunk. Without it, the body sits undelivered in the pipe buffer.

Proof:
```
echo -ne "Content-Length: 11\r\n\r\n{\"test\":42}\n"  → reader gets body ✅
echo -ne "Content-Length: 10\r\n\r\n{\"test\":42}"    → reader NEVER gets body ❌
```

The Fix: Add `\n` after the JSON body in each response. The format should be:

```
Content-Length: {N}\r\n\r\n{json_body}\n
```

Note: The Content-Length should count only the JSON body bytes (NOT the trailing \n). The `\n` is a transport separator, not part of the message.

In Rust:
```rust
let body = serde_json::to_string(&response)?;
write!(stdout, "Content-Length: {}\r\n\r\n{}\n", body.len(), body)?;
stdout.flush()?;
```

Files Affected: MCP server response writer (likely `src/mcp/server.rs` — the `write_response` function)
