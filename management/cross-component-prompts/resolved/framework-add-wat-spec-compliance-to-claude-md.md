Component: clean-framework
Issue Type: enhancement
Priority: high
Description: |
  Add WAT spec compliance information to the framework's CLAUDE.md configuration file.

  The clean-server now has a machine-checkable WAT spec compliance guard at
  `clean-server/host-bridge/tests/spec_compliance.wat` that declares ALL host function
  imports with their exact WASM signatures. The framework generates or interacts with
  WASM modules and must be aware of these exact signatures.

  The framework's CLAUDE.md should include guidance about:
  1. Host function signatures are enforced by the WAT spec at `clean-server/host-bridge/tests/spec_compliance.wat`
  2. ALL string parameters use raw `(ptr: i32, len: i32)` pairs (NOT length-prefixed single pointers)
  3. Integer values use `i64` for: `print_integer`, `int_to_string`, `string_to_int`
  4. When the framework generates or references host function calls, signatures must match the WAT spec
  5. The authoritative reference is `platform-architecture/HOST_BRIDGE.md`

Context: |
  During a comprehensive spec compliance audit of clean-server, we found ~24 functions had
  WASM-level signature mismatches. All have been fixed and a WAT spec compliance guard now
  prevents future drift. The framework needs to know about this guard so any WASM-related
  code it generates or manages stays aligned with the host bridge.

Suggested Fix: |
  Add a section to the framework's CLAUDE.md similar to:

  ## WAT Spec Compliance (Host Function Signatures)

  **IMPORTANT: Host function signatures are enforced by a machine-checkable WAT contract.**

  The clean-server enforces all host function signatures via `clean-server/host-bridge/tests/spec_compliance.wat`.
  This file declares every host function import with its exact WASM signature.

  ### Key Conventions

  1. ALL string input parameters use raw `(ptr: i32, len: i32)` pairs
  2. Return strings use length-prefixed format: `[4-byte LE length][UTF-8 data]`
  3. Integer values use `i64` (not `i32`) for: `print_integer`, `int_to_string`, `string_to_int`
  4. Reference: `clean-server/host-bridge/tests/spec_compliance.wat` and `platform-architecture/HOST_BRIDGE.md`

Files Affected:
  - CLAUDE.md (add WAT spec compliance section)
