# Cross-Component Prompt: Enrich `RUNTIME_WASM_PARSE` Reports + Lifecycle-Tiered Retention

## Component
clean-server (primary)

## Related Components
- Web Site Clean (error dashboard — retention policy, schema)
- Clean MCP (`report_error` transport — payload size limits)

## Issue Type
Bug — diagnostic data loss + storage policy

## Priority
Medium-High — current `RUNTIME_WASM_PARSE` reports cannot be diagnosed. The error surfaces in clean-server but originates in the compiler, so without a reproduction artifact the compiler team cannot fix it.

## Context

`RUNTIME_WASM_PARSE` errors are raised at [clean-server/src/wasm.rs:443-444](clean-server/src/wasm.rs#L443-L444) when `wasmtime::Module::new` rejects the WASM bytes produced by the compiler:

```rust
let module = Module::new(&engine, wasm_bytes)
    .map_err(|e| RuntimeError::wasm(format!("Failed to compile WASM module: {}", e)))?;
```

The dashboard report for these errors currently contains only the formatted error string. There is no:
- `.cln` source that produced the broken module
- Compiler version that emitted it
- WASM byte length / hash (for dedupe)
- Wasmtime offset/reason details (often truncated by `format!`)
- Plugin manifest snapshot

Without these, the compiler team cannot reproduce or bisect the bug. The user-facing symptom is "we know it's broken, we can't fix it."

There is also no retention policy: every occurrence of the same broken WASM is stored in full, even after the bug is resolved.

## Change Required

### Part A — Enrich the report payload (clean-server)

At the call site in `wasm.rs:443`, before raising `RuntimeError::wasm`, assemble a structured diagnostic payload and pass it to `report_error`:

**Required fields**
| Field | Source | Notes |
|---|---|---|
| `error_code` | constant | `RUNTIME_WASM_PARSE` |
| `wasmtime_error` | `e.to_string()` (full, untruncated) | Include offset + reason. Don't `format!` it into a sentence. |
| `wasm_bytes_len` | `wasm_bytes.len()` | |
| `wasm_sha256` | hash of `wasm_bytes` | Dedupe key. |
| `compiler_version` | embedded in WASM custom section `clean:build` | Available since compiler 0.30.54. Payload: `{"compiler_version": "X.Y.Z", "build_profile": "debug\|release"}`. If missing (older WASM), report `"unknown"` and flag. |
| `wasmparser_validation` | run `wasmparser::validate(wasm_bytes)` first | Separates encoder bugs (fails validate) from validator-vs-runtime mismatches (passes validate, fails wasmtime). |

**Highly useful fields**
| Field | Source |
|---|---|
| `wasm_header_hex` | first 256 bytes of `wasm_bytes` as hex |
| `plugin_manifest` | snapshot of `[bridge]` declarations from loaded plugins |
| `module_path` | path to the .wasm file on disk, if known |
| `cln_source_hash` | if a `.cln` source map / build manifest is available |

**Source upload (deferred)**
Do NOT upload `.cln` source automatically. Instead, record `wasm_sha256` and let the developer request the artifact via `/request-artifact <sha256>` from the dashboard. Server holds the bytes locally for N hours after the error (configurable, default 24h).

### Part B — Lifecycle-tiered retention (website + clean-server)

Storage policy keyed off the lifecycle stage already defined in `tier1-foundations.md` Principle 1.1:

| Stage | Storage |
|---|---|
| 1-2 (`reported` → `fix_committed`) | Full payload retained. Dedupe by `(error_code, wasm_sha256)` — store sample once, increment count for repeats. |
| 3-4 (`fix_released` → `fix_installed`) | Full payload retained until N consecutive days with zero new occurrences on a fixed-version client. Confirms the fix works in production. |
| 5 (`resolved`) | Strip heavy fields. Keep only: `error_code`, occurrence_count, first_seen, last_seen, version_range, `wasm_sha256` (set), `fix_commit`, `resolved_version`. |

**Regression trigger:** if an error with status `resolved` reappears with either:
- a `wasm_sha256` not previously seen, OR
- a `compiler_version` ≥ the resolved version

…auto-promote back to `reported`, restore full-payload collection, and notify the resolving developer.

**Dedupe before resolution:** even pre-resolution, dedupe by `(error_code, wasm_sha256)`. 1000 reports of the same broken file should not store 1000 copies of the source.

## Files Affected

**clean-server**
- `src/wasm.rs` (call site, payload assembly)
- `src/error.rs` (extend `RuntimeError::wasm` to accept structured payload)
- New: `src/error_reporting.rs` or similar (sha256, hex dump, validation pass, MCP call)
- `Cargo.toml` (add `sha2`, `wasmparser` if not already present)

**Compiler (clean-language-compiler)** — DONE in 0.30.54
- Emits `clean:build` custom section at [src/codegen/mir_codegen/utilities.rs](clean-language-compiler/src/codegen/mir_codegen/utilities.rs) (active MIR codegen path).
- Payload: `{"compiler_version": "X.Y.Z", "build_profile": "debug|release"}` (~65 bytes).
- Future enhancement: add git commit hash via build script (`vergen` or equivalent). Not blocking — version alone enables bisection.

**Website (Web Site Clean)**
- `app/data/migrations/00X_wasm_parse_payload.sql` — add columns: `wasm_sha256`, `wasm_bytes_len`, `wasmtime_error_full`, `wasm_header_hex`, `wasmparser_validates`, `plugin_manifest_json`
- `app/server/errors_api.cln` — accept enriched payload, apply dedupe, implement stage-based field stripping on transition to `resolved`
- New endpoint: `POST /api/v1/request-artifact/<sha256>` — triggers the originating server to upload the held `.wasm` / `.cln` bytes
- Background job: regression scan on incoming reports against resolved fingerprints

## Suggested Fix (clean-server side)

Sketch:

```rust
let module = Module::new(&engine, wasm_bytes).map_err(|e| {
    let report = WasmParseReport::new(wasm_bytes, &e, /* plugins */, /* path */);
    report.send_to_dashboard();   // fire-and-forget
    RuntimeError::wasm(format!("Failed to compile WASM module: {}", e))
})?;
```

Where `WasmParseReport::new` does the sha256, validation pass, header extraction, and version lookup; `send_to_dashboard` calls the MCP `report_error` transport with the structured payload.

The local artifact cache (held bytes for `/request-artifact`) belongs in the server's data dir, not in the report itself, to keep payloads small.

## Out of Scope

- Changes to `report_error` MCP tool signature beyond accepting an opaque structured payload. The MCP transport should be payload-agnostic.
- Changes to other runtime error codes — this prompt is scoped to `RUNTIME_WASM_PARSE` only, but the same pattern (enriched payload + lifecycle-tiered retention) applies to all `RUNTIME_*` and `COMPILE_*` codes and should be generalized in a follow-up.
