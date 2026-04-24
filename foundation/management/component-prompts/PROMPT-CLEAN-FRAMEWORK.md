# Clean Framework - Restructure as Plugin-Based System

## Context

The Clean Language ecosystem is implementing a new plugin architecture where:
- Plugins are written IN Clean Language itself (compiled to WASM)
- The compiler calls plugin WASM functions to expand framework blocks
- Plugins return Clean Language source code (not AST)
- Host Bridge provides runtime capabilities (HTTP, DB, File I/O)

## Documentation Status

**The following documentation has already been updated for v2:**

| Document | Status | Description |
|----------|--------|-------------|
| `documents/ARCHITECTURE.md` | Updated | Complete architecture overview |
| `documents/specification/01_frame_overview.md` | Updated | Framework overview with v2 changes |
| `documents/specification/07_frame_plugins.md` | Updated | Plugin system specification |
| `documents/specification/10_compiler_plugins.md` | Created | New compiler plugin architecture |
| `documents/specification/02_frame_cli.md` | Deprecated | Frame CLI replaced by cln + cleen |

**Read these documents first** to understand the complete plugin architecture.

## Your Mission

Restructure the framework to focus on **Clean Language plugins** instead of Rust crates. Keep the host-bridge but replace the Rust plugin crates with Clean Language source.

## STEP 1: Review Existing Documentation

Before making ANY code changes, read the updated documentation:

```bash
# Read in this order:
1. documents/specification/01_frame_overview.md    # Overview of v2 architecture
2. documents/specification/10_compiler_plugins.md  # Compiler plugin details
3. documents/specification/07_frame_plugins.md     # Plugin API and examples
4. documents/ARCHITECTURE.md                       # Full architecture deep dive
```

## STEP 2: Directory Restructure

### What to DELETE
- `frame-cli/` - replaced by cleen manager
- `frame-server/` - logic moves to frame.web plugin
- `frame-data/` - logic moves to frame.data plugin
- `frame-ui/` - logic moves to frame.ui plugin
- `frame-auth/` - logic moves to frame.auth plugin
- `frame-plugins/` - old Rust plugin system
- `frame-compiler-plugins/` - old Rust plugin system

### What to KEEP
- `host-bridge/` - runtime system access (Rust crate)
- `examples/` - update with new plugin-based examples
- `documents/` - already updated design docs

### New Structure
```
clean-framework/
├── Cargo.toml                    # Points to host-bridge only
├── README.md                     # Updated overview
├── host-bridge/                  # KEEP - runtime imports
│   ├── Cargo.toml
│   └── src/
├── plugins/                      # NEW - Plugin sources
│   ├── frame.web/
│   │   ├── plugin.toml
│   │   ├── src/main.cln
│   │   ├── build.sh
│   │   └── README.md
│   ├── frame.data/
│   │   ├── plugin.toml
│   │   ├── src/main.cln
│   │   ├── build.sh
│   │   └── README.md
│   ├── frame.auth/
│   │   ├── plugin.toml
│   │   ├── src/main.cln
│   │   ├── build.sh
│   │   └── README.md
│   └── frame.ui/
│       ├── plugin.toml
│       ├── src/main.cln
│       ├── build.sh
│       └── README.md
├── examples/
│   ├── todo-app/
│   │   └── main.cln
│   ├── api-server/
│   │   └── main.cln
│   └── blog/
│       └── main.cln
├── documents/                    # ALREADY UPDATED
│   ├── ARCHITECTURE.md
│   └── specification/
│       ├── 01_frame_overview.md
│       ├── 02_frame_cli.md (deprecated)
│       ├── 07_frame_plugins.md
│       └── 10_compiler_plugins.md (new)
└── scripts/
    ├── build-all-plugins.sh
    └── install-plugins.sh
```

## STEP 3: Plugin Implementation Reference

See `documents/specification/07_frame_plugins.md` for complete plugin examples including:
- frame.web plugin (server, route, middleware)
- frame.data plugin (model, query, transaction)
- frame.auth plugin (auth, protected, login)
- frame.ui plugin (component, layout, page)

### Plugin Manifest (plugin.toml)

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

[blocks]
handles = ["server", "route", "middleware"]
```

### Plugin Entry Point

Every plugin must export an `expand_block` function:

```clean
expand_block(block_name: string, attributes: string, body: string) -> string
```

- `block_name`: The DSL block identifier (e.g., "server", "route", "model")
- `attributes`: JSON string of block attributes
- `body`: The raw content inside the block
- Returns: Clean Language source code to replace the block

## STEP 4: Build and Test

### Build Scripts

Create `scripts/build-all-plugins.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGINS_DIR="$SCRIPT_DIR/../plugins"

for plugin_dir in "$PLUGINS_DIR"/*/; do
    plugin_name=$(basename "$plugin_dir")
    echo "Building $plugin_name..."

    cd "$plugin_dir"
    if [ -f "build.sh" ]; then
        bash build.sh
    else
        cln compile src/main.cln -o plugin.wasm
    fi

    echo "✓ $plugin_name built successfully"
done

echo ""
echo "All plugins built successfully!"
```

### Testing

```bash
# Build plugins
./scripts/build-all-plugins.sh

# Install plugins
cleen plugin install ./plugins/frame.web/
cleen plugin install ./plugins/frame.data/

# Test with example
cln compile examples/todo-app/main.cln -o todo.wasm --plugins
```

## Important Notes

1. **Documentation is already updated** - Read the docs in `documents/` first
2. **Keep host-bridge** - It provides runtime capabilities
3. **Plugins in Clean Language** - All framework logic moves to .cln files
4. **Test each plugin** - Ensure expand_block works correctly
5. **Update root Cargo.toml** - Should only reference host-bridge

## Implementation Order

1. Read the updated documentation in `documents/`
2. Create the `plugins/` directory structure
3. Implement frame.web plugin first (simplest)
4. Test with compiler: `cln compile example.cln -o out.wasm --plugins`
5. Then implement frame.data, frame.auth, frame.ui
6. Update examples to use new plugin syntax
7. Delete old Rust crates (frame-cli, frame-server, etc.)

## Key APIs (from documentation)

### Host Bridge Functions

Plugins generate code that calls these at runtime:

**HTTP**: `_http_listen`, `_http_route`, `_http_middleware`, `_http_request`

**Database**: `_db_query`, `_db_query_one`, `_db_insert`, `_db_update`, `_db_delete`, `_db_begin_transaction`, `_db_commit`, `_db_rollback`

**Auth**: `_auth_create_token`, `_auth_verify_token`, `_auth_hash_password`, `_auth_verify_password`

**File**: `_file_read`, `_file_write`, `_file_exists`, `_file_delete`

---

**Start by reading the documentation, then create the plugins/ directory and implement frame.web first.**
