# Cross-Component Prompt: Parse `[memory]` Section from plugin.toml

## Target
Component: **clean-language-compiler**
Run from: `/Users/earcandy/Documents/Dev/Clean Language/clean-language-compiler/`

## Issue Type
Feature — unblocks Wave 4 of the MEMORY_POLICY.md rollout.

## Priority
Medium — gates frame.canvas / frame.ui / frame.server plugin metadata. Nothing currently breaks without it, but the memory tier system cannot be "driven by plugins" (MEMORY_POLICY.md §3.1 rule 3) until the compiler reads plugin.toml.

## Context

MEMORY_POLICY.md §11 splits work into four waves. Wave 1 (compiler) shipped the `MemoryTier` enum, `--memory-tier` CLI flag, and target-based defaults in commit `2046014`. Wave 3 (framework JS) shipped in `frame-framework@v2.10.14` — the canvas and UI loaders now read declared memory from the WASM binary at runtime.

Wave 4 — adding `[memory] tier = "canvas"` to `plugins/frame.canvas/plugin.toml` and `tier = "heavy"` / `"standard"` to `plugins/frame.ui/plugin.toml` — is gated on the compiler learning to read those fields. Right now:

- `src/plugins/plugin_abi.rs::PluginManifest` (line 9) has fields: `plugin`, `compatibility`, `handles`, `exports`, `bridge`, `language`, `ai`, `paths`, `enforcement`. **No `memory` field.**
- `src/lib.rs:1456` `compile_multi_file_with_memory_tier()` accepts a `MemoryTier` parameter but only `src/bin/cln.rs:505` feeds it — always from `--memory-tier` flag or target default. Plugin input is never consulted.

## Specification Reference
MEMORY_POLICY.md §3.1 — Tier Selection Rules:

> 3. **Plugin override:** A plugin's `plugin.toml` MAY declare `[memory] tier = "canvas"` to set the default for projects using that plugin. **The highest tier among all active plugins wins.**
> 4. **Operator override:** Server CLI flags `--memory-initial-pages` and `--memory-max-pages` override everything.

Precedence: explicit `--memory-tier` flag > `max(active plugins' tiers)` > target default > `standard`.

## Scope of Changes

### 1. Extend `PluginManifest`

In `src/plugins/plugin_abi.rs`, add a new struct and field:

```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginMemory {
    /// Memory tier this plugin expects. One of:
    /// "embedded", "minimal", "standard", "heavy", "canvas".
    /// Parsed via MemoryTier::from_str; unknown values produce a build error.
    #[serde(default)]
    pub tier: Option<String>,
}

pub struct PluginManifest {
    // ... existing fields ...
    #[serde(default)]
    pub memory: PluginMemory,
}
```

`#[serde(default)]` keeps backward compatibility — existing plugin.toml files without `[memory]` continue to parse.

### 2. Add tier-ordering helper on `MemoryTier`

In `src/lib.rs` near the existing `MemoryTier` impl, add `Ord`/`PartialOrd` (or an explicit `rank()` method) so "canvas" > "heavy" > "standard" > "minimal" > "embedded" can be compared. Order must match the max-pages table in MEMORY_POLICY.md §3.

### 3. Resolve effective tier from active plugins

In `src/bin/cln.rs` around line 505 (the `memory_tier` resolution site):

```rust
let memory_tier = config.memory_tier.unwrap_or_else(|| {
    // Gather tiers from active plugins' manifests.
    let plugin_tier = plugin_discovery
        .active_manifests()
        .iter()
        .filter_map(|m| m.memory.tier.as_deref())
        .filter_map(MemoryTier::from_str)
        .max();

    let target_default = MemoryTier::default_for_target(&config.target);

    plugin_tier
        .map(|p| std::cmp::max(p, target_default))
        .unwrap_or(target_default)
});
```

Exact wiring depends on how `PluginDiscovery` is currently invoked in `cln.rs`; the intent is: explicit flag wins, else `max(plugin tiers + target default)`.

### 4. Diagnostic for unknown tier string

If a plugin.toml declares `tier = "gigantic"` (or any string not accepted by `MemoryTier::from_str`), emit a build-time error referencing the plugin name and the valid values. Don't silently fall back.

### 5. Verbose output

`src/bin/cln.rs:514` prints `Memory tier: {}`. When the tier came from a plugin rather than CLI or target default, also print which plugin contributed it (`Memory tier: canvas (from plugin frame.canvas)`). Helps operators debug surprising tier selection.

## Tests

Add tests in `src/plugins/plugin_abi.rs`:
- Parses `[memory]\ntier = "canvas"` correctly.
- Rejects unknown tier string with a specific error.
- Absent `[memory]` section parses with `PluginMemory::default()` (tier = None).

Add an integration test:
- Compile a small project with `frame.canvas` mock manifest containing `[memory] tier = "canvas"`. Verify the emitted WASM declares 256 initial / 1024 max pages.
- Same project with `--memory-tier standard` on the CLI overrides to 32/512.

## Files Affected
- `src/plugins/plugin_abi.rs` — add `PluginMemory` struct + field on `PluginManifest`
- `src/lib.rs` — add `Ord` on `MemoryTier` (or `rank()` helper)
- `src/bin/cln.rs` — tier resolution merges plugin tiers
- `tests/` — new tests for the parsing + resolution paths

## What Happens After

Once shipped, Wave 4 is a trivial follow-up in clean-framework:

```toml
# plugins/frame.canvas/plugin.toml
[memory]
tier = "canvas"

# plugins/frame.ui/plugin.toml
[memory]
tier = "heavy"  # or "standard" — decide per SSR vs client-only
```

A separate framework PR bumps those plugin.toml files, tags a release, and users' `cleen frame install latest` picks up the declarations automatically.

## Non-Goals
- WASM `clean:memory` custom section emission — separate task in MEMORY_POLICY.md §11, already tracked.
- Per-plugin memory isolation at runtime — still a single linear memory per instance.
- Allowing plugins to *reduce* the tier below the target default — policy says highest wins.
