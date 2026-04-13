---
description: Server-specific rules — active when working in clean-server/
globs: ["clean-server/**"]
alwaysApply: false
---

# Server Work Rules

## Bridge Contract
The server implements host bridge functions that WASM modules import.
- Function signatures MUST match what the compiler generates as WASM imports.
- Check `platform-architecture/HOST_BRIDGE.md` and plugin.toml `[bridge]` sections.
- String parameters use length-prefix format: 4 bytes length + content bytes.

## Contract Tests (Principle 9)
When modifying bridge function signatures:
1. Update `platform-architecture/HOST_BRIDGE.md`
2. Update the relevant plugin.toml
3. Verify the compiler still generates matching imports
4. Create a cross-component prompt if compiler changes are needed
