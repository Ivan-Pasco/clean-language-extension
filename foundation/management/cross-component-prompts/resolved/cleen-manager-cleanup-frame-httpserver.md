Component: clean-manager
Issue Type: bug/enhancement
Priority: high
Description: Remove stale `frame.httpserver` plugin folder during framework installation. The plugin was renamed to `frame.server` in the framework repo, but the old `frame.httpserver/` folder (including its `2.6.1/` versioned subdirectory) remains in `~/.cleen/plugins/` and is never cleaned up.

## Context

Discovered while inspecting `~/.cleen/plugins/` after a framework install. The current state is:

```
~/.cleen/plugins/
├── frame.httpserver/           # STALE — old name, root plugin.toml says v2.0.0
│   ├── plugin.toml             # name = "frame.httpserver", version = "2.0.0"
│   ├── 2.6.1/                  # Mismatched version dir, contains frame.server v2.1.0
│   │   └── plugin.toml         # name = "frame.server", version = "2.1.0"
│   └── ...
├── frame.server/               # CORRECT — current name
│   ├── plugin.toml             # name = "frame.server", version = "2.1.0"
│   ├── 2.1.0/
│   └── ...
```

The `frame.httpserver/` folder is completely stale. The framework tarball no longer contains it — the plugin is now `frame.server`. However, the old folder was never removed, and confusingly its `2.6.1/` subdirectory contains a `frame.server` v2.1.0 plugin (likely from a previous install that wrote into the wrong directory).

## What Needs to Happen

### Option A: Automatic cleanup during `cleen frame install`

When installing framework plugins, after extracting the tarball:

1. Read each plugin's `plugin.toml` to get the canonical `name`
2. If the folder name doesn't match the plugin name, rename the folder
3. If there's a stale folder with the old name that isn't in the tarball, remove it
4. Specifically: if `frame.httpserver/` exists and `frame.server/` also exists, remove `frame.httpserver/`

### Option B: Known rename map (simpler)

Add a known rename map to the install logic:

```rust
let renames = vec![
    ("frame.httpserver", "frame.server"),
];

for (old_name, new_name) in &renames {
    let old_path = plugins_dir.join(old_name);
    if old_path.exists() {
        // Remove stale plugin folder
        std::fs::remove_dir_all(&old_path)?;
        println!("Removed stale plugin: {}", old_name);
    }
}
```

### Option C: Manual cleanup command

Add a `cleen plugins cleanup` or `cleen frame cleanup` command that removes plugin folders not present in the latest framework tarball.

## Suggested Fix

Option A or B. Option A is more robust long-term but Option B is simpler and handles this specific case immediately.

## Files Affected

- Wherever `cleen frame install` extracts plugins (likely `src/frame.rs` or similar)
- Possibly a new cleanup step after tarball extraction

## Verification

After the fix:

```bash
cleen frame install latest
ls ~/.cleen/plugins/ | grep httpserver
# Should return nothing — frame.httpserver/ should be gone
ls ~/.cleen/plugins/frame.server/
# Should exist with current plugin files
```
