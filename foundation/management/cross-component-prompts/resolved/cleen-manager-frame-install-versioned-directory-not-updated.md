Component: clean-manager
Issue Type: bug
Priority: high
Description: `cleen frame install latest` updates root-level plugin files but not the versioned subdirectory that the compiler actually loads from

Context: After running `cleen frame install latest` to install Frame v2.10.3, the updated `plugin.wasm` was placed at `~/.cleen/plugins/frame.ui/plugin.wasm` (root level) but NOT at `~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm` (versioned directory). The `.active-version` file contains `2.6.1`, and the compiler loads plugins from the versioned path. This means new releases have no effect until the user manually copies files.

## Evidence

After `cleen frame install latest` (Frame v2.10.3):

```
~/.cleen/plugins/frame.ui/plugin.wasm        → 86478 bytes (NEW, 61 imports) ✓
~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm  → 100424 bytes (OLD, 80 imports) ✗
~/.cleen/plugins/frame.ui/.active-version     → "2.6.1"
```

The compiler reads from the versioned path (`2.6.1/plugin.wasm`), so it was still loading the old broken WASM with `_session_create` imports that cause instantiation failure.

## Expected Behavior

`cleen frame install latest` should update ALL relevant locations:
1. The root-level `plugin.wasm` (currently works)
2. The versioned subdirectory matching `.active-version` (currently broken)
3. OR the compiler should read from the root-level path instead of the versioned subdirectory

## Suggested Fix

Either:
- **Option A**: When extracting the release tarball, also copy/overwrite files into the active versioned directory (`$PLUGIN_DIR/<active-version>/`)
- **Option B**: Have the compiler resolve plugin paths via the root-level files rather than the versioned subdirectory
- **Option C**: Create a new versioned directory matching the release version (e.g., `2.10.3/`) and update `.active-version` to point to it

Option C is the cleanest — each release gets its own versioned directory and the active-version pointer is updated.

## Files Affected
- Plugin installation logic in the cleen manager (the code that handles `cleen frame install`)
- Possibly the tarball extraction/placement logic

## Impact
Every `cleen frame install` silently fails to take effect. Users must manually copy files to the versioned directory. This blocked the frame.ui session import fix from being deployed.
