# Cleen Manager - Add Plugin Management Features

## Context
The Clean Language ecosystem is implementing a new plugin architecture where:
- Plugins are written IN Clean Language itself (compiled to WASM)
- Plugins are installed to `~/.cleen/plugins/<name>/<version>/`
- Each plugin has: `plugin.toml` manifest + `plugin.wasm` binary
- The compiler loads plugins based on `import:` blocks in source files

## Your Mission
**EXTEND** the existing cleen manager (which already works for compiler version management) with plugin management commands. **DO NOT delete existing functionality.**

## STEP 1: Update Documentation First

Before writing any code, update these documents:

### 1.1 Update `clean-language-manager-spec.md`
Add a new section for plugin management:

```markdown
## 📦 Plugin Management Features (NEW)

### Plugin Commands

| Command | Description |
|---------|-------------|
| `cleen plugin install <name>` | Install plugin from registry |
| `cleen plugin install <name>@<ver>` | Install specific version |
| `cleen plugin create <name>` | Scaffold new plugin project |
| `cleen plugin build` | Build current plugin to WASM |
| `cleen plugin publish` | Publish to registry |
| `cleen plugin list` | List installed plugins |
| `cleen plugin remove <name>` | Remove installed plugin |

### Plugin Directory Structure

Plugins are installed to `~/.cleen/plugins/`:

```
~/.cleen/
├── versions/           # (existing) Compiler versions
│   └── 0.15.0/
│       └── cln
├── plugins/            # (new) Installed plugins
│   ├── frame.web/
│   │   └── 1.0.0/
│   │       ├── plugin.toml
│   │       └── plugin.wasm
│   └── frame.data/
│       └── 1.0.0/
│           ├── plugin.toml
│           └── plugin.wasm
├── bin/                # (existing) Shim directory
│   └── cln
└── config.toml         # (existing) Configuration
```

### Plugin Manifest Format (plugin.toml)

```toml
[plugin]
name = "frame.web"
version = "1.0.0"
description = "Web framework plugin for Clean Language"
author = "Clean Language Team"
license = "MIT"

[compatibility]
min_compiler_version = "0.15.0"

[exports]
expand = "expand_block"
validate = "validate_block"
```

### Plugin Scaffold Template

`cleen plugin create <name>` generates:

```
<name>/
├── plugin.toml
├── src/
│   └── main.cln      # Plugin source in Clean Language
├── tests/
│   └── test_expand.cln
└── README.md
```

With `src/main.cln` template:

```clean
// Plugin: <name>
// Expand framework blocks into Clean Language code

expand_block(block_name: string, attributes: string, body: string) -> string
    // TODO: Implement block expansion
    return body
```
```

### 1.2 Update `docs/functional-specification.md`
Add plugin command specifications with input/output examples.

### 1.3 Update `docs/user-guide.md`
Add user-facing documentation for plugin commands.

## STEP 2: Implementation (After Documentation)

### Keep Existing Structure:
- `src/main.rs` - Add plugin subcommand
- `src/commands/` - Keep existing, add `plugin.rs`

### Add New Files:
```
src/
├── main.rs              # (modify) Add plugin subcommand to CLI
├── commands/
│   ├── mod.rs           # (modify) Export plugin module
│   ├── install.rs       # (keep) Existing compiler install
│   ├── use_version.rs   # (keep) Existing version switching
│   └── plugin.rs        # (new) Plugin subcommands
├── plugin/
│   ├── mod.rs           # (new) Plugin management module
│   ├── manifest.rs      # (new) plugin.toml parsing
│   ├── scaffold.rs      # (new) Plugin project creation
│   ├── builder.rs       # (new) Plugin compilation
│   └── registry.rs      # (new) Registry client
└── paths.rs             # (modify) Add plugin paths
```

### CLI Structure

```
cleen
├── install <version>     # (existing) Install compiler
├── use <version>         # (existing) Switch compiler
├── list                  # (existing) List compilers
├── uninstall <version>   # (existing) Remove compiler
├── available             # (existing) List available versions
├── doctor                # (existing) Check environment
├── init                  # (existing) Initialize shell
└── plugin                # (new) Plugin management
    ├── install <name>[@version]
    ├── create <name>
    ├── build
    ├── publish
    ├── list
    └── remove <name>
```

## STEP 3: Key Implementation Details

### Plugin Install Flow
```
1. Parse plugin name and version (e.g., "frame.web@1.0.0")
2. Query registry for plugin metadata
3. Download plugin archive
4. Extract to ~/.cleen/plugins/<name>/<version>/
5. Verify plugin.toml exists
6. Verify plugin.wasm exists
7. Update local plugin index
```

### Plugin Create Flow
```
1. Create directory structure
2. Generate plugin.toml with metadata
3. Generate src/main.cln template
4. Generate README.md
5. Print next steps instructions
```

### Plugin Build Flow
```
1. Find plugin.toml in current directory
2. Parse manifest for entry point
3. Call `cln compile src/main.cln -o plugin.wasm`
4. Verify output
5. Print success message
```

## Important Rules
- **DO NOT delete existing functionality** - compiler management must keep working
- Binary name stays `cleen`
- Use existing path conventions (`~/.cleen/`)
- Plugin operations should work offline when possible
- Clear error messages for missing compiler or network issues

## Start by:
1. Read existing `clean-language-manager-spec.md`
2. Update the specification document with plugin features
3. Read existing code structure
4. Add plugin commands incrementally
5. Test that existing commands still work

Begin with the documentation update.
