Component: clean-language-compiler
Issue Type: enhancement
Priority: medium
Description: When loading a plugin, the compiler should warn if the root-level `plugin.wasm` (at `~/.cleen/plugins/<name>/plugin.wasm`) has a different size or modification date than the one in the active version directory (`~/.cleen/plugins/<name>/<version>/plugin.wasm`). This catches cases where `cleen frame install` updated the root files but didn't update the versioned directory.

Context: Discovered while debugging a frame.ui html: block regression. `cleen frame install` placed a fixed plugin.wasm (98,417 bytes) at the root level but the compiler silently loaded the buggy one (94,592 bytes) from the `2.6.1/` subdirectory via `.active-version`. There was no warning that a newer binary existed.

## Suggested Implementation

In the plugin loading code (likely `src/plugins/wasm_adapter.rs` or plugin resolution):

1. After resolving the active version path (`<plugin>/<version>/plugin.wasm`), check if a root-level `<plugin>/plugin.wasm` also exists
2. If both exist and differ in size or mtime, emit a warning:
   ```
   warning: plugin 'frame.ui' root plugin.wasm (98417 bytes) differs from active version 2.6.1 (94592 bytes)
   hint: run `cleen plugin use frame.ui <version>` or reinstall the plugin
   ```
3. This is a warning only — the compiler should still use the active version to maintain predictability

## Impact

Low-risk enhancement. Prevents silent use of stale plugin binaries, which caused all SSR pages to break with empty content.

## Files Affected

- `src/plugins/wasm_adapter.rs` or plugin resolution module
- Plugin loading/initialization code
