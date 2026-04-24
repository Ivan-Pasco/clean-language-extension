# Cleen Manager: Frame Plugin Installation Chain Broken

Component: clean-manager (cleen)
Issue Type: bug
Priority: critical
Description: Three remaining issues in the cleen manager prevent installing framework plugins locally.
Context: Discovered while trying to install the frame.ui plugin after fixing the html: block expansion bug. The release workflow now includes compiled plugin.wasm files in the tarball (as of v2.7.2), but cleen can't install them.

---

## Issue 1: `cleen frame install latest` — "latest" not resolved before compatibility check

### Status: OPEN

### Command:
```bash
cleen frame install latest
```

### Error:
```
Error: Frame CLI latest requires compiler >= unknown, but current compiler is 0.30.22
```

### Root Cause:
The string "latest" is passed directly to `check_frame_compatibility()` without first resolving it to an actual version number. `get_required_compiler_version("latest")` calls `is_version_gte("latest", "2.0.0")` which parses "latest" as `[0, 0, 0]`, fails the check, and returns `None` → "unknown".

### Fix:
Resolve "latest" to the actual version number (e.g., by fetching the GitHub release) BEFORE calling the compatibility check.

### File:
`src/core/frame.rs` — the `install_frame()` function, around line 75-80.

---

## Issue 2: `cleen frame install 2.7.2` — looks for platform-specific binary that doesn't exist

### Status: OPEN

### Command:
```bash
cleen frame install 2.7.2
```

### Error:
```
✓ Compatible with compiler 0.30.22
Fetching Frame CLI releases...
Looking for asset matching platform: macos-aarch64
Available assets:
  • frame-plugins-2.7.2.tar.gz
  • frame-plugins-2.7.2.tar.gz.sha256
  • version-manifest.json
Error: Binary not found: Frame CLI asset for platform macos-aarch64
```

### Root Cause:
The install command looks for a platform-specific binary (e.g., `frame-cli-macos-aarch64.tar.gz`) but the framework release only contains a generic `frame-plugins-X.Y.Z.tar.gz` tarball. Frame plugins are platform-independent (WASM + source + toml).

### Fix:
Change the asset lookup to match `frame-plugins-{version}.tar.gz` instead of looking for platform-specific binaries. Extract the tarball to `~/.cleen/plugins/`.

### File:
`src/core/frame.rs` — the asset download/matching logic.

---

## Issue 3: `cleen plugin build` — uses compiler 0.30.22 which has a regression

### Status: FIXED (flag issue) / BLOCKED (compiler regression)

The `-i` flag issue is fixed. `cleen plugin build` now correctly invokes `cln compile <INPUT> -o <OUTPUT>`. However, it uses the active compiler (0.30.22) which has a regression where `string var = "literal"` fails to parse (see `compiler-string-literal-assignment-regression.md`).

This will self-resolve when the compiler regression is fixed.

---

## Summary

| Issue | Status | Blocker |
|-------|--------|---------|
| `latest` not resolved | OPEN | cleen manager |
| Platform-specific asset lookup | OPEN | cleen manager |
| Plugin build compiler flag | FIXED | — |
| Plugin build compiler regression | BLOCKED | compiler 0.30.22 |
