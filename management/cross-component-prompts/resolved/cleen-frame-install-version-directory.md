Component: clean-manager (cleen)
Issue Type: bug
Priority: critical
Description: `cleen frame install` extracts plugin files to the root of `~/.cleen/plugins/<plugin>/` but does NOT create a versioned subdirectory or update `.active-version`. The compiler resolves plugins via `.active-version` → `<version>/plugin.wasm`, so newly installed plugins are silently ignored.

Context: Discovered while fixing a frame.ui html: block regression. `cleen frame install latest` downloaded Frame v2.10.0 with a fixed plugin.wasm (98,417 bytes) but the compiler kept using the buggy `2.6.1/plugin.wasm` (94,592 bytes) because `.active-version` still pointed to `2.6.1`.

## Current Behavior

```
~/.cleen/plugins/frame.ui/
├── .active-version          # Contains "2.6.1" — never updated
├── 2.6.1/
│   └── plugin.wasm          # OLD buggy binary (94,592 bytes)
├── plugin.wasm              # NEW fixed binary (98,417 bytes) — extracted here, never used
├── plugin.toml              # NEW toml with version = "2.3.0" — never used
└── ...
```

The compiler reads `.active-version` → opens `2.6.1/plugin.wasm` → uses the buggy binary.

## Expected Behavior

After `cleen frame install latest`, the directory should look like:

```
~/.cleen/plugins/frame.ui/
├── .active-version          # Contains "2.3.0" (from plugin.toml in the archive)
├── 2.3.0/
│   └── plugin.wasm          # NEW fixed binary
│   └── plugin.toml          # version = "2.3.0"
├── 2.6.1/
│   └── plugin.wasm          # OLD binary (kept for rollback)
└── ...
```

## Suggested Fix

In the `frame install` command handler (likely in `src/commands/frame.rs` or similar):

1. After extracting the archive to a temp location, read `plugin.toml` from each extracted plugin to get its version
2. Create a versioned subdirectory: `~/.cleen/plugins/<plugin>/<version>/`
3. Copy/move the extracted files into that versioned directory
4. Update `.active-version` to the new version string
5. Keep the old versioned directory for rollback via `cleen plugin use <plugin> <version>`

## Impact

Without this fix, every `cleen frame install` silently fails to update the plugin binaries used by the compiler. Users must manually copy files into the versioned directory, which defeats the purpose of the package manager.

## Files Affected

- `src/commands/frame.rs` (or wherever `cleen frame install` is implemented)
- Plugin extraction/installation logic
