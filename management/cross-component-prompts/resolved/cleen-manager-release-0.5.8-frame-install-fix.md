Component: clean-manager
Issue Type: release
Priority: critical
Description: Release cleen v0.5.8 to ship the frame install fix (commit b7e4905) that has been in source since April 2 but never released. The installed binary (v0.5.7, built Feb 28) still uses the old code that extracts plugins directly to `~/.cleen/plugins/` without updating versioned subdirectories or `.active-version`, making every `cleen frame install` silently fail to take effect.

## Context

Discovered while working in clean-framework. After `cleen frame install latest`, the compiler still loaded the old plugin.wasm because:

1. The v0.5.7 binary extracts the tarball directly to `~/.cleen/plugins/` (root level only)
2. The compiler loads from `~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm` (versioned subdirectory)
3. The versioned subdirectory is never updated, `.active-version` is never written
4. Result: every framework release is silently ignored

The fix already exists in source (commit `b7e4905` — "fix: install plugins to versioned subdirectories and update .active-version") but was never released. There are 11 unreleased commits since v0.5.7.

## Unreleased Commits (v0.5.7..HEAD)

```
e312fe2 fix: apply cargo fmt and update tar crate for security vulnerabilities
b7e4905 fix: install plugins to versioned subdirectories and update .active-version
f8c06dd fix: resolve clippy collapsible_if warnings in test command
0d9fbee fix: apply cargo fmt formatting to test command
2e03157 feat: add cleen test command for running Clean Language tests
32f5a84 fix: resolve 'latest' before compatibility check, support plugin tarballs
41d8eec fix: frame install compatibility check and plugin build compiler flag
0d98c7e refactor: extract framework code, delegate to frame-cli
4759640 fix: resolve clippy useless_vec warning in test
0ff2372 fix: apply cargo fmt formatting
59fdf7c feat(codegen): support inline route definitions in config routes: section
```

## Steps to Execute

### Step 1: Bump version to 0.5.8

In `Cargo.toml`, change:
```toml
version = "0.5.7"
```
to:
```toml
version = "0.5.8"
```

### Step 2: Commit, tag, and push

```bash
git add Cargo.toml Cargo.lock
git commit -m "chore: bump version to 0.5.8"
git tag -a v0.5.8 -m "Release v0.5.8 - fix frame plugin installation to versioned directories"
git push && git push --tags
```

### Step 3: Wait for CI and Release workflows

Two workflows will trigger:
- **CI** (on push to main): runs tests on Linux, Windows, macOS — typically passes in ~5 min
- **Release** (on v* tag): builds platform binaries and creates GitHub release — typically ~8 min

Monitor both:
```bash
# Check CI
gh run list --workflow=CI --limit=1 --json conclusion,status,number

# Check Release
gh run list --workflow=Release --limit=1 --json conclusion,status,number
```

Both MUST pass. If either fails:
1. Get logs: `gh run view <run-number> --log-failed`
2. Fix the issue
3. Do NOT re-tag — instead delete the failed tag, fix, bump to 0.5.9, and re-tag

### Step 4: Verify the release artifacts exist

```bash
gh release view v0.5.8 --json assets --jq '.assets[].name'
```

Expected assets (at minimum):
- `cleen-macos-aarch64.tar.gz` (Apple Silicon)
- `cleen-macos-x86_64.tar.gz` (Intel Mac)
- `cleen-linux-x86_64.tar.gz` (Linux)
- `cleen-windows-x86_64.zip` (Windows)

### Step 5: Install locally with self-update

```bash
cleen self-update
cleen --version
# Should show: cleen 0.5.8
```

If `self-update` doesn't pick up the new version, install manually:
```bash
# Download the release asset for the current platform
gh release download v0.5.8 --pattern "cleen-macos-aarch64.tar.gz" --dir /tmp/cleen-update
cd /tmp/cleen-update && tar xzf cleen-macos-aarch64.tar.gz
cp cleen ~/.cleen/bin/cleen
chmod +x ~/.cleen/bin/cleen
cleen --version
# Should show: cleen 0.5.8
```

### Step 6: Verify the frame install fix works end-to-end

```bash
# Install the latest framework
cleen frame install latest

# Check that the versioned directory was updated
cat ~/.cleen/plugins/frame.ui/.active-version
# Should show the plugin version from plugin.toml (e.g., 2.4.0 or whatever the tarball contains)

ls -la ~/.cleen/plugins/frame.ui/$(cat ~/.cleen/plugins/frame.ui/.active-version)/plugin.wasm
# Should exist and match the root-level plugin.wasm size

# Compare sizes — they should be identical
wc -c ~/.cleen/plugins/frame.ui/plugin.wasm ~/.cleen/plugins/frame.ui/$(cat ~/.cleen/plugins/frame.ui/.active-version)/plugin.wasm
# Both should show the same byte count

# Test compilation with a plugin
cat > /tmp/test_frame_install.cln << 'TESTEOF'
plugins:
	frame.ui

start:
	print(test_fn())

functions:
	string test_fn()
		string name = "World"
		html:
			<h1>Hello {name}</h1>
TESTEOF

cln compile --plugins -o /tmp/test_frame_install.wasm /tmp/test_frame_install.cln
# Should compile successfully without "unknown import" or "unterminated string" errors
```

### Step 7: Clean up test files

```bash
rm -f /tmp/test_frame_install.cln /tmp/test_frame_install.wasm
rm -rf /tmp/cleen-update
```

## Known Issue: plugin.toml version mismatch

The `plugin.toml` in the framework repo declares `version = "2.4.0"` for frame.ui, which is outdated relative to the framework release version (v2.10.x). This means:
- The versioned subdirectory will be created as `2.4.0/` (not `2.10.6/`)
- `.active-version` will be set to `2.4.0`
- This works correctly — the compiler will load from `2.4.0/plugin.wasm`

However, to avoid confusion, a follow-up task should update `plugin.toml` versions in the framework repo to match release versions. This is NOT a blocker for this release.

## Success Criteria

1. `cleen --version` returns `0.5.8`
2. `cleen frame install latest` updates BOTH root-level AND versioned subdirectory plugin files
3. `.active-version` is updated to match the plugin.toml version from the tarball
4. Compiler loads the correct (new) plugin.wasm without manual file copying
5. CI and Release workflows both pass without errors

## Files Affected

- `Cargo.toml` — version bump only
- No code changes needed — the fix is already in source at commit b7e4905
