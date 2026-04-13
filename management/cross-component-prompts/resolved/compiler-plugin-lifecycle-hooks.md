Component: clean-language-compiler
Issue Type: feature
Priority: critical
Description: Implement additional plugin lifecycle hooks beyond expand/validate/get_keywords

The Frame plugin system currently supports three exports: `expand`, `validate`, `get_keywords`. The spec (07_frame_plugins.md) defines additional lifecycle hooks that plugins need to register server middleware, CLI commands, data hooks, and build pipeline extensions.

## Required Hooks

### 1. registerServer
Called when the server starts. Lets plugins register middleware, routes, or startup logic.

```toml
# plugin.toml
[exports]
register_server = "register_server"
```

```clean
// In plugin src/main.cln
functions:
    string register_server()
        // Return JSON describing middleware, startup hooks, etc.
        return "{\"middleware\": [\"cors\", \"logging\"], \"startup\": \"on_server_start\"}"
```

### 2. registerCLI
Lets plugins add custom CLI commands to `cleen`.

```toml
[exports]
register_cli = "register_cli"
```

```clean
functions:
    string register_cli()
        return "{\"commands\": [{\"name\": \"db:seed\", \"description\": \"Seed the database\", \"handler\": \"handle_seed\"}]}"
```

### 3. registerData
Lets plugins add custom data types, validation rules, or query extensions.

### 4. registerBuild
Lets plugins hook into the build pipeline (pre-build, post-build, asset processing).

## Implementation Requirements

### Compiler Changes

1. **Plugin manifest parsing** (`src/plugins/` or plugin loading code):
   - Read additional export keys from `plugin.toml`: `register_server`, `register_cli`, `register_data`, `register_build`
   - These are optional — plugins that don't export them are unchanged

2. **WASM function resolution**:
   - When loading a plugin WASM, check for additional exported functions
   - Call them during the appropriate lifecycle phase
   - Each returns a JSON string describing what the plugin registers

3. **Registration forwarding**:
   - Collect all plugin registrations
   - Emit them as metadata in the compiled output (e.g., a `__plugin_registrations` section)
   - The server reads this metadata at startup to wire up middleware, routes, etc.

### Plugin.toml Schema Extension

```toml
[exports]
expand = "expand_block"          # existing
validate = "validate_block"      # existing
get_keywords = "get_keywords"    # existing
register_server = "..."          # NEW - optional
register_cli = "..."             # NEW - optional
register_data = "..."            # NEW - optional
register_build = "..."           # NEW - optional
```

## Context
Without lifecycle hooks, plugins are limited to DSL expansion. They cannot add server middleware (CORS, rate limiting), CLI commands (db:seed, generate), or build steps (asset optimization). This blocks the plugin marketplace vision described in the roadmap.

## Files Affected
- Plugin loading code (wherever `plugin.toml` is parsed)
- WASM module loading (wherever plugin exports are resolved)
- Compiled output metadata generation
