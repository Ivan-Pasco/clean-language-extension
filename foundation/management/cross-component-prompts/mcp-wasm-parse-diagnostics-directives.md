# Cross-Component Prompt: MCP Directives + Tool for Local WASM Parse Diagnostics

## Component
Clean MCP (primary)

## Related Components
- clean-server (already implemented the on-disk diagnostic format described below)
- clean-language-compiler (consumes reports forwarded via `report_error`)

## Issue Type
Feature — AI discoverability of runtime diagnostics

## Priority
Medium — without MCP directives, the newly added `clean-server errors`
workflow is invisible to AI instances. Developers would have to teach
every AI about it manually, defeating the "good UX" goal.

## Context

`clean-server` now writes structured diagnostic reports to
`./diagnostics/pending/<sha>/report.json` whenever
`wasmtime::Module::new` rejects a compiled WASM module (error code
`RUNTIME_WASM_PARSE`). Each report contains: full wasmtime error,
SHA-256 fingerprint, wasmparser second-opinion validation, compiler
version (when stamped), plugin manifest snapshot, and the originating
WASM file path. The broken `.wasm` bytes are cached alongside the
JSON.

Developers interact with these via a new CLI:

```
clean-server errors list
clean-server errors show <SHA> [--json]
clean-server errors publish <SHA> | --all
clean-server errors resolve <SHA>
```

Files on disk look like:

```
./diagnostics/
├── pending/<sha256>/{report.json, module.wasm, count.txt}
├── published/<sha256>/{report.json, module.wasm, count.txt}
└── resolved/<sha256>/report.json    # heavy fields stripped
```

**The problem this prompt solves:** AI instances working in a Clean app
have no reason to look at that directory. When a user says "my server
crashed on startup", the AI currently asks for the error message
instead of looking for the already-captured structured report.

## Change Required

### Part 1 — Session-start directive

Extend the MCP server instructions block (currently the preamble that
says "call `get_quick_reference` first") with a bullet along the lines
of:

> If the user reports a server runtime failure or a WASM load error,
> call `list_server_diagnostics` BEFORE asking them for reproduction
> details. The clean-server runtime auto-captures structured
> diagnostics for `RUNTIME_WASM_PARSE` failures; they contain the full
> wasmtime error, a SHA fingerprint, and plugin state. Publishing one
> is a one-call operation (`report_error` with the report payload as
> the body).

Add to `BEST PRACTICES FOR AI ASSISTANTS`:

> Use `list_server_diagnostics` to surface pending compiler bugs the
> user may not even realize are on disk. Treat each pending report as
> an unreported bug — publish it with `report_error` unless the user
> says otherwise.

### Part 2 — New MCP tool: `list_server_diagnostics`

**Signature:**

```
list_server_diagnostics(
  diag_dir?: string,           // defaults to "./diagnostics" (matches CLEAN_DIAG_DIR)
  status?: "pending" | "published" | "resolved" | "all",  // defaults to "pending"
) -> {
  reports: [
    {
      sha: string,             // full SHA-256
      short: string,           // first 12 hex chars
      status: string,
      reported_at: string,     // RFC3339
      server_version: string,
      compiler_version: string | null,
      compiler_version_source: string,
      occurrences: number,
      wasmparser_validates: bool,
      wasmtime_error_first_line: string,
      module_path: string | null,
      report_path: string,     // absolute path to report.json
    }
  ],
  diag_dir_exists: bool,
  total: number,
}
```

**Implementation notes:**
- Just `fs::read_dir` the three subdirs and parse each `report.json`.
- The payload is already stable (serialized from
  `clean_server::error_reporting::WasmParseReport` — see
  `clean-server/src/error_reporting.rs`).
- Do NOT shell out to `clean-server errors list` — parse the JSON
  directly. Avoids dependency on the binary being installed in the
  MCP server's environment.

### Part 3 — New MCP tool: `show_server_diagnostic`

**Signature:**

```
show_server_diagnostic(
  sha: string,                 // accepts prefix ≥ 4 chars
  diag_dir?: string,
) -> WasmParseReport            // full JSON, ready to hand to report_error
```

Returns the full report. The AI then calls `report_error` with the
report as the `context` / `payload` field.

### Part 4 — Documented flow in MCP instructions

Add a short section to the MCP instructions:

> ## REPORTING RUNTIME_WASM_PARSE BUGS
> 1. `list_server_diagnostics` → identify pending reports
> 2. `show_server_diagnostic(sha)` → load the full payload
> 3. `report_error` with the payload's fields mapped into the
>    standard error-report schema
> 4. Tell the user to run
>    `clean-server errors publish <sha>` locally to mark it as
>    forwarded (updates on-disk status so the same bug isn't
>    re-published next session).

### Part 5 — `check_reported_fixes` integration

When `check_reported_fixes` finds a fix that matches a local
`diagnostics/pending/<sha>/` report by compiler version bump, surface
that in the return payload:

```json
{
  "fix": { ... existing fields ... },
  "matching_local_diagnostics": [
    { "sha": "5f78c33274e4", "reported_at": "..." }
  ]
}
```

This lets the AI suggest `clean-server errors resolve <sha>` after
`/resolve-fix` completes, closing the loop defined in
`tier1-foundations.md` Principle 1.1 (stage 4 → stage 5).

## Out of Scope

- Changes to `report_error` tool schema. It should remain
  payload-agnostic.
- HTTP or network transport from `clean-server` to the dashboard.
  `clean-server` writes to disk only; the MCP server is the bridge.
- Cross-machine diagnostic sharing. `list_server_diagnostics` reads
  the local filesystem only.

## Files Affected

**Clean MCP**
- MCP server instructions block (the preamble currently listing
  `GETTING STARTED` and `BEST PRACTICES`)
- New tool definitions: `list_server_diagnostics`,
  `show_server_diagnostic`
- `check_reported_fixes` implementation — augment with local
  diagnostic cross-reference

## Reference: report.json schema

Produced by `clean-server` at
`clean-server/src/error_reporting.rs`. Example (from a smoke test
where 0xDEADBEEF was fed to the server):

```json
{
  "error_code": "RUNTIME_WASM_PARSE",
  "reported_at": "2026-04-16T16:24:03.938355+00:00",
  "server_version": "1.9.2",
  "wasmtime_error": "input bytes aren't valid utf-8",
  "wasm_bytes_len": 4,
  "wasm_sha256": "5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953",
  "wasm_header_hex": "deadbeef",
  "wasmparser_validates": false,
  "wasmparser_error": "magic header not detected: ...",
  "compiler_version_source": "unknown",
  "plugin_manifest": [
    { "name": "frame.server", "version": "2.1.0", "path": "...", "bridge_functions": [...] }
  ],
  "module_path": "./broken.wasm",
  "status": "pending"
}
```
