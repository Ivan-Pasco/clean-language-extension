Component: clean-language-compiler
Issue Type: enhancement
Priority: high
Description: |
  Add WAT spec compliance information to the compiler's CLAUDE.md configuration file.

  The clean-server now has a machine-checkable WAT spec compliance guard at
  `clean-server/host-bridge/tests/spec_compliance.wat` that declares ALL host function
  imports with their exact WASM signatures. If the compiler generates WASM imports with
  wrong parameter counts or types, the WASM module will fail to instantiate at runtime.

  The compiler's CLAUDE.md should include guidance about:
  1. The compiler MUST generate WASM imports matching the exact signatures in the WAT spec file
  2. ALL string parameters use raw `(ptr: i32, len: i32)` pairs (NOT length-prefixed single pointers)
  3. Integer values use `i64` for: `print_integer`, `int_to_string`, `string_to_int`
  4. The authoritative reference for host function signatures is `clean-server/host-bridge/tests/spec_compliance.wat`
  5. When adding new built-in function imports, check the WAT spec file for the correct signature
  6. The cross-component prompt `compiler-host-bridge-signature-update-feb2026.md` lists all
     the OLD vs NEW signatures that changed in the February 2026 audit

Context: |
  During a comprehensive spec compliance audit of clean-server, we found ~24 functions had
  WASM-level signature mismatches. All have been fixed and a WAT spec compliance guard now
  prevents future drift. The compiler needs to know about this guard so it generates matching
  imports. Adding this to CLAUDE.md ensures any AI instance working on the compiler will
  always check the WAT spec before generating or modifying WASM import signatures.

Suggested Fix: |
  Add a section to the compiler's CLAUDE.md similar to:

  ## WAT Spec Compliance (Host Function Signatures)

  **CRITICAL: The compiler must generate WASM imports that exactly match the host bridge signatures.**

  The clean-server enforces host function signatures via a machine-checkable WAT contract at
  `clean-server/host-bridge/tests/spec_compliance.wat`. This file declares every host function
  import with its exact WASM signature. If the compiler generates imports with wrong parameter
  counts or types, WASM module instantiation will fail at runtime.

  ### Rules for Generating WASM Imports

  1. ALL string input parameters use raw `(ptr: i32, len: i32)` pairs — NOT length-prefixed single pointers
  2. Integer values use `i64` (not `i32`) for: `print_integer`, `int_to_string`, `string_to_int`
  3. When adding or modifying built-in function codegen, check the WAT spec file for the correct signature
  4. Reference: `clean-server/host-bridge/tests/spec_compliance.wat` and `platform-architecture/HOST_BRIDGE.md`
  5. The cross-component prompt `compiler-host-bridge-signature-update-feb2026.md` documents all signature changes

Files Affected:
  - CLAUDE.md (add WAT spec compliance section)
