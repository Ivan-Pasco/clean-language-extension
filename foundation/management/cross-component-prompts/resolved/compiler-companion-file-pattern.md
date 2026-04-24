Component: clean-language-compiler
Issue Type: feature
Priority: critical
Description: Implement the companion file pattern — change HTML page discovery from `.html.cln` files to `.html` + companion `.cln` pairing. The frame.ui plugin has been updated to accept companion metadata; the compiler must now discover, pair, and pass this information during compilation.
Context: The companion file pattern was formalized across all framework specs (05_frame_ui.md, 03_frame_server.md, etc.) and the frame.ui plugin has been updated. The compiler is the last piece — it still discovers `.html.cln` files instead of `.html` + `.cln` pairs.

## What Changed in the Plugin

The `frame.ui` plugin's `process_html()` now accepts 4 parameters:

```
process_html(html, path, registry_json, companion_json)
```

Where `companion_json` is either:
- `""` — no companion file
- `{"has_companion":true,"has_guard":true,"has_load":true,"module_name":"pages_dashboard"}` — companion metadata

The plugin uses this to generate page classes that call `{module_name}_guard()` and `{module_name}_load()` inside `render()`.

## Changes Needed in `src/compilation/multi_file_compiler.rs`

### 1. Change file discovery from `.html.cln` to `.html`

**`is_html_cln_file()` (line ~471):**
```rust
// BEFORE:
fn is_html_cln_file(path: &Path) -> bool {
    path.to_str().map_or(false, |s| s.ends_with(".html.cln"))
}

// AFTER:
fn is_html_page_file(path: &Path) -> bool {
    path.extension().map_or(false, |ext| ext == "html")
}
```

**`discover_html_pages()` / `scan_html_files()` (line ~400-465):**
Change from scanning for `.html.cln` to scanning for `.html` files.

### 2. Add `CompanionFile` struct and pairing logic

```rust
pub struct CompanionFile {
    pub file_path: PathBuf,
    pub source: String,
    pub has_guard: bool,
    pub has_load: bool,
    pub module_name: String,
}
```

Add companion field to `HtmlPage`:
```rust
pub struct HtmlPage {
    pub file_path: PathBuf,
    pub route_path: String,
    pub html_content: String,
    pub metadata: HtmlPageMetadata,
    pub companion: Option<CompanionFile>,  // NEW
}
```

**Pairing logic** in the discovery function:
```rust
// For each .html file found:
let companion_path = html_path.with_extension("cln");
let companion = if companion_path.exists() {
    let source = fs::read_to_string(&companion_path)?;
    let has_guard = source.contains("any guard(") || source.contains("guard()");
    let has_load = source.contains("any load(") || source.contains("load()");
    // Module name from path: app/pages/blog/[slug].cln → pages_blog_slug
    let module_name = derive_module_name(&companion_path, pages_dir);
    Some(CompanionFile { file_path: companion_path, source, has_guard, has_load, module_name })
} else {
    None
};
```

### 3. Module name derivation

Companion functions need unique names in the WASM module. Derive from path:

```rust
fn derive_module_name(path: &Path, base_dir: &Path) -> String {
    let relative = path.strip_prefix(base_dir).unwrap_or(path);
    let stem = relative.to_str().unwrap_or("")
        .trim_end_matches(".cln")
        .replace('/', "_")
        .replace('[', "")
        .replace(']', "");
    stem.to_string()
}
```

Examples:
- `app/pages/dashboard.cln` → `pages_dashboard`
- `app/pages/blog/[slug].cln` → `pages_blog_slug`
- `app/pages/index.cln` → `pages_index`

### 4. Compile companion files

In `process_html_pages_to_clean()` (line ~919), include companion source as a module prefix. The companion's `load()` and `guard()` functions must be renamed to avoid conflicts:

```rust
if let Some(ref companion) = page.companion {
    // Rename functions to include module prefix
    let prefixed_source = prefix_companion_functions(
        &companion.source,
        &companion.module_name,
    );
    combined.push_str(&prefixed_source);
    combined.push_str("\n\n");
}
```

The `prefix_companion_functions` should transform:
```clean
functions:
    any guard()
        ...
    any load()
        ...
```
Into:
```clean
functions:
    any pages_dashboard_guard()
        ...
    any pages_dashboard_load()
        ...
```

### 5. Pass companion_json to plugin's `process_html()`

When calling the plugin to process HTML, include the 4th parameter:

```rust
let companion_json = match &page.companion {
    Some(c) => format!(
        r#"{{"has_companion":true,"has_guard":{},"has_load":{},"module_name":"{}"}}"#,
        c.has_guard, c.has_load, c.module_name
    ),
    None => String::new(),
};

// Call plugin: process_html(html, path, registry_json, companion_json)
plugin.call("process_html", &[
    &page.html_content,
    &page.route_path,
    &registry_json,
    &companion_json,
])?;
```

### 6. Route handler generation stays simple

The route handler just calls `page.render()`. All guard/load wiring is inside the generated page class (done by the plugin). No changes needed to route handler generation.

### 7. Update route path derivation

**`file_path_to_route()` (line ~506):**

```rust
// BEFORE:
if name_str == "index.html.cln" { continue; }
let name_str = name_str.trim_end_matches(".html.cln");

// AFTER:
if name_str == "index.html" { continue; }
let name_str = name_str.trim_end_matches(".html");
```

### 8. Update `compile_html_first()` public API in `src/lib.rs`

The `HtmlFirstConfig` and public API functions should reference `.html` instead of `.html.cln`.

### 9. Update tests

All tests referencing `.html.cln` files (lines ~1554-1604) must be updated:
- Create `.html` test files instead of `.html.cln`
- Add companion `.cln` test files
- Test cases:
  1. Page with no companion (pure static)
  2. Page with companion that has only `load()`
  3. Page with companion that has only `guard()`
  4. Page with companion that has both `load()` and `guard()`
  5. Page with dynamic route segment `[id].html` + `[id].cln`

## Companion File Contract

From the framework spec (05_frame_ui.md):

```clean
// app/pages/profile.cln
functions:
    any guard()
        integer user_id = _auth_user_id()
        if user_id == 0
            _res_redirect(302, "/login")
            return "redirect"
        return null

    any load()
        integer id = _req_param_int("id")
        User user = User.find(id)
        return { user: user }
```

- `guard()` — runs first; calls `_res_redirect()` and returns non-null to block, returns `null` to allow
- `load()` — returns data object; its properties become template variables via `data.` prefix
- Both are optional. Pages without companions are static.
- Companion functions use Host Bridge calls directly (`_req_param`, `_auth_user_id`, etc.)

## Files Affected

- `src/compilation/multi_file_compiler.rs` — main changes (discovery, pairing, module name derivation)
- `src/lib.rs` — public API updates
- `tests/` — new test cases for companion file pattern
