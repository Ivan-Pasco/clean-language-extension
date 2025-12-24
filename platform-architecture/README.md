# Clean Language Platform Architecture

This document describes the runtime architecture for Clean Language, explaining how WASM modules interact with different host environments.

## Quick Links

- [Host Bridge Specification](./HOST_BRIDGE.md) - Portable host functions
- [Memory Model](./MEMORY_MODEL.md) - WASM memory layout and allocation
- [Server Extensions](./SERVER_EXTENSIONS.md) - HTTP server-specific functions
- [Implementing a New Host](./IMPLEMENTING_HOST.md) - Guide for new runtime implementations

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Clean Language WASM Module                    │
│                   (compiled .wasm from .cln source)               │
└──────────────────────────────────────────────────────────────────┘
                                 │
                    imports host functions
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                          host-bridge                              │
│                    (portable to ANY host)                         │
├──────────────────────────────────────────────────────────────────┤
│  Console I/O   │  Math         │  String Ops   │  Memory         │
│  Database      │  File I/O     │  HTTP Client  │  Crypto         │
└──────────────────────────────────────────────────────────────────┘
                                 │
                 implemented by host runtime
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       ┌───────────┐      ┌───────────┐      ┌───────────┐
       │   Rust    │      │  Node.js  │      │    Go     │
       │clean-server│      │  (future) │      │  (future) │
       ├───────────┤      ├───────────┤      ├───────────┤
       │ HTTP Srv  │      │ HTTP Srv  │      │ HTTP Srv  │
       │ _req_*    │      │ _req_*    │      │ _req_*    │
       │ _auth_*   │      │ _auth_*   │      │ _auth_*   │
       └───────────┘      └───────────┘      └───────────┘
```

## Design Principles

### 1. Portability First

The `host-bridge` library contains all functions that should work identically across ANY host environment:
- Console I/O (print, input)
- Math functions (sin, cos, pow, sqrt, etc.)
- String operations (concat, substring, trim, etc.)
- Memory management (alloc, retain, release)
- Database operations (query, execute, transactions)
- File I/O (read, write, exists, delete)
- HTTP client (get, post, put, delete, etc.)
- Cryptography (password hashing, SHA256, random bytes)

### 2. Server-Specific Extensions

Only functions that truly require server context remain in server implementations:
- HTTP routing (`_http_listen`, `_http_route`)
- Request context (`_req_param`, `_req_query`, `_req_body`)
- Session authentication (`_auth_get_session`, `_auth_require_role`)

### 3. Trait-Based Abstraction

The `WasmStateCore` trait allows any host to use host-bridge functions:

```rust
pub trait WasmStateCore: Send + 'static {
    fn memory(&self) -> &WasmMemory;
    fn memory_mut(&mut self) -> &mut WasmMemory;
    fn db_bridge(&self) -> Option<SharedDbBridge> { None }
    fn set_error(&mut self, error: String) {}
    fn last_error(&self) -> Option<&str> { None }
}
```

### 4. Same WASM, Any Host

A compiled `.wasm` file runs on any compliant host:
- Rust server (clean-server)
- Node.js runtime (future)
- Go runtime (future)
- Browser (with appropriate polyfills)

## Function Categories

| Category | Count | Location | Description |
|----------|-------|----------|-------------|
| Console I/O | 14 | host-bridge | print, input, console.* |
| Math | 30+ | host-bridge | sin, cos, tan, pow, sqrt, etc. |
| String Ops | 25+ | host-bridge | concat, substring, trim, etc. |
| Memory | 5 | host-bridge | alloc, retain, release, scope |
| Database | 5 | host-bridge | query, execute, transactions |
| File I/O | 5 | host-bridge | read, write, exists, delete, append |
| HTTP Client | 20+ | host-bridge | get, post, put, delete, etc. |
| Crypto | 4 | host-bridge | hash, verify, random, sha256 |
| HTTP Server | 3 | server-only | listen, route, route_protected |
| Request Context | 6 | server-only | param, query, body, header, method, path |
| Session Auth | 5 | server-only | get_session, require_auth, require_role |

## String Memory Layout

All strings in WASM memory use length-prefixed format:

```
┌─────────────────┬─────────────────────────────────┐
│ 4 bytes (LE)   │ UTF-8 string data               │
│ length prefix  │ (no null terminator)            │
└─────────────────┴─────────────────────────────────┘
```

Example: "Hello" (5 bytes) stored as:
```
[05 00 00 00] [48 65 6C 6C 6F]
   length          H  e  l  l  o
```

## Getting Started

### For Compiler Developers

See [Memory Model](./MEMORY_MODEL.md) for details on how the compiler should generate WASM code.

### For Runtime Developers

See [Implementing a New Host](./IMPLEMENTING_HOST.md) for how to create a new runtime.

### For Server Developers

See [Server Extensions](./SERVER_EXTENSIONS.md) for HTTP server integration details.

## Testing

All host-bridge functions are tested in the `host-bridge` crate:

```bash
cd clean-server/host-bridge && cargo test
```

Server-specific functions are tested in clean-server:

```bash
cd clean-server && cargo test
```

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| host-bridge | 0.1.0 | Core portable functions |
| clean-server | 0.1.0 | Rust HTTP server |
| clean-language-compiler | 0.17.x | Compatible compiler versions |
