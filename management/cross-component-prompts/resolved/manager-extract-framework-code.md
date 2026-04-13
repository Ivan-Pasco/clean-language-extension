Component: clean-manager
Issue Type: enhancement
Priority: critical
Description: The clean-manager contains ~2,900 lines of framework-level code that violates the architectural boundary between manager and framework. This code must be extracted and the manager must delegate to frame-cli instead of reimplementing the framework build pipeline.

Context: Architecture audit revealed that codegen, discovery, and build logic have been embedded in the manager instead of living in clean-framework/frame-cli where they belong. This is the root cause of the website project's structural issues — the manager's embedded framework logic doesn't follow the framework spec properly.

## Files That Must Be Extracted

### 1. `src/core/codegen.rs` (1,491 lines) — REMOVE ENTIRELY

This file implements a complete Clean Language code generator inside the manager:
- `parse_project_config()` — parses `config.cln` files
- `parse_config_route_line()` — parses route DSL syntax
- `extract_component_props()` — parses `props:` blocks
- `extract_component_helpers()` — parses helper functions from `component:` blocks
- `extract_component_render_body()` — parses `html:` blocks
- `extract_page_data_block()` — parses `<script type="text/clean">` blocks
- `extract_page_layout()` — parses `<page layout="X">` directives
- `escape_html_line()` — transforms interpolation syntax
- `convert_html_to_clean()` — HTML-to-Clean transpiler
- `expand_component_tags()` — component tag expansion
- `generate_code()` — main entry assembling `main.cln`
- `generate_imports()` — emits `plugins:` and `import:` blocks
- `generate_start_function()` — emits `start:` block with `_http_route()` calls
- `generate_page_handler()` — emits route handler functions for pages
- `generate_api_handler()` — emits route handler functions for API
- `generate_component_render_function()` — emits component render functions
- `apply_layout()` — implements layout inheritance via `<slot>` replacement

**Action:** Delete `src/core/codegen.rs` entirely. This logic belongs in `clean-framework/frame-cli/src/codegen.rs`. Until frame-cli exists as a standalone binary, the manager's `build_project()` should fail with a message like: "Frame CLI not installed. Run: cleen frame install <version>"

### 2. `src/core/discovery.rs` (745 lines) — REMOVE ENTIRELY

This file implements framework-specific project scanning:
- `discover_project()` — knows Frame directory structure
- `discover_ui()` — scans `pages/`, `components/`, `layouts/`, `public/`
- `discover_server()` — scans `api/`, `models/`, `middleware/`
- `discover_shared()` — scans `lib/`
- `is_page_file()` — knows page file extensions
- `file_to_route_path()` — maps files to URL routes
- `file_to_api_route_path()` — maps API files to routes
- `extract_component_tag()` — reads component source
- `class_name_to_tag()` — PascalCase → kebab-case conversion
- `pascal_to_snake()` — model → table name convention
- Framework structs: `PageRoute`, `ApiRoute`, `Component`, `Layout`, `Model`, `Middleware`, `DiscoveredProject`

**Action:** Delete `src/core/discovery.rs` entirely. Same destination as codegen.

### 3. `src/core/frame.rs` — EXTRACT ~663 lines (keep ~1,052)

**KEEP these functions (appropriate for manager):**
- `install_frame()` — downloads Frame CLI binary
- `list_frame_versions()` — lists installed versions
- `use_frame_version()` — switches active version
- `uninstall_frame_version()` — removes a version
- `serve_application()` — delegates to frame-runtime binary (thin wrapper)
- `stop_server()` — kills server process by PID

**REMOVE these functions:**
- `create_project()` and ALL template functions (`create_api_template()`, `create_web_template()`, `create_minimal_template()`) — these embed hardcoded Clean Language DSL syntax that should come from frame-cli's scaffolding. Replace with delegation: shell out to `frame-cli new <name> --template=<type>`
- `build_project()` — calls `codegen::generate_code()` and `discovery::discover_project()` directly. Replace with delegation: shell out to `frame-cli build`
- `scan_project()` — calls `discovery::discover_project()`. Replace with delegation: shell out to `frame-cli scan`
- `find_entry_file()` — knows frame entry point conventions, belongs in frame-cli

**Additional fix:** `create_web_template()` contains `<script src="/app.js">` which references a nonexistent JS file and violates the framework's no-JavaScript rule.

### 4. `src/plugin/scaffold.rs` — FIX SYNTAX

The generated `.cln` files use incorrect Clean Language syntax:
- Uses `->` for return types (should use Clean syntax)
- Uses `:` for parameter types (should match spec)
- Uses `result: string = "..."` instead of `string result = "..."`
- References functions like `contains()`, `assert()` not in the language spec

**Action:** Update generated `.cln` templates to match the Clean Language Specification exactly. This is appropriate to keep in the manager (scaffolding is a manager concern), but the generated syntax must be spec-compliant.

## Migration Strategy

### Phase 1: Create frame-cli stub
Create `clean-framework/frame-cli/` with the extracted code as a proper Rust binary that can be invoked by the manager.

### Phase 2: Manager delegates
Replace the manager's direct codegen/discovery/build calls with shell-outs to the `frame-cli` binary:
```rust
// Instead of:
codegen::generate_code(&project);
// Do:
Command::new("frame-cli").args(["build"]).status()?;
```

### Phase 3: Clean up
Remove `codegen.rs`, `discovery.rs`, and the framework portions of `frame.rs` from the manager.

## Verification

After extraction:
- `src/core/codegen.rs` should not exist
- `src/core/discovery.rs` should not exist
- `src/core/frame.rs` should only contain install/list/use/uninstall/serve/stop
- `cargo test` should pass
- `cleen frame build` should delegate to `frame-cli build`
- `cleen frame new` should delegate to `frame-cli new`
- `cleen frame scan` should delegate to `frame-cli scan`

Files Affected:
- src/core/codegen.rs (delete entirely)
- src/core/discovery.rs (delete entirely)
- src/core/frame.rs (remove ~663 lines, keep ~1,052)
- src/core/mod.rs (remove codegen and discovery module declarations)
- src/plugin/scaffold.rs (fix generated syntax)
- Any files that import from codegen or discovery modules
