Component: clean-framework
Issue Type: feature
Priority: critical
Description: Create `frame-cli` as a standalone Rust binary within `clean-framework/` that handles project creation, building (codegen + discovery + compilation), and scanning. The clean-manager now delegates all framework operations to `frame-cli` via shell-outs instead of embedding framework logic directly.
Context: Architecture audit revealed that codegen (~2,000 lines), discovery (~745 lines), and project template/build/scan logic (~663 lines) were incorrectly embedded in the clean-manager. These have now been removed from the manager, and the manager's `create_project()`, `build_project()`, and `scan_project()` functions delegate to `frame-cli` via `Command::new("frame-cli")`.

---

## What the Manager Now Expects

The manager shells out to `frame-cli` with these commands:

### `frame-cli new <name> --template <type> --port <port>`
Create a new Frame project with scaffolding.

Templates: `api`, `web`, `minimal`

### `frame-cli build <input> --output <output> --optimize <level>`
Build a Frame project:
1. Read `config.cln` for project settings and `server.entry` path
2. Read the server entry file for `plugins:`, `import:`, `routes:` sections
3. Discover project files (pages, components, layouts)
4. Generate `dist/.generated/main.cln` with:
   - Merged plugins (entry file plugins + `frame.ui`)
   - Resolved import paths (relative to entry file dir, prefixed with `../../`)
   - `start:` block with sequential `_http_route()` calls (backend routes first, then page routes)
   - `functions:` block with `__route_handler_N()` wrappers for backend routes, component render functions, page handlers
5. Compile the generated file to WASM using the Clean Language compiler (`cln`)

### `frame-cli scan <project_dir> --format <text|json> [--verbose]`
Scan and discover project files (dry-run, no compilation).

---

## Named Routes Architecture

The server entry file (pointed to by `config.cln`'s `server: entry` field) contains:

```clean
plugins:
	frame.httpserver
	frame.data

import:
	"helpers.cln"
	"api.cln"
	"static.cln"

routes:
	GET /api/health = api_health
	POST /api/v1/reports = reports_create
	GET /errors = errors_dashboard
```

### Route Format
```
METHOD /path = function_name
```

The framework:
1. Parses each route line: split on ` = ` for function name, split left side on first space for method and path
2. Auto-assigns sequential indices starting from 0
3. Page routes (from discovered HTML pages) continue the sequence after backend routes
4. Generates `__route_handler_N()` wrapper functions that delegate to named functions:

```clean
string __route_handler_0()
	return api_health()

string __route_handler_1()
	return reports_create()
```

### Import Path Resolution
Entry file imports are relative to the entry file directory. Generated file is at `dist/.generated/main.cln`, so imports get prefixed:
```
entry_dir = "app/server/"
"helpers.cln" -> "../../app/server/helpers.cln"
```

---

## Page File Architecture

Each dynamic page is a single `.html` file in `app/pages/` that contains both the HTML template and embedded Clean Language logic.

### Page Structure

```
app/pages/
├── index.html          # Home page (template + data logic)
├── docs.html           # Docs page
├── get-started.html    # Getting started page
├── modules.html        # Modules page
├── syntax.html         # Syntax page
└── test.html           # Test page
```

### Page File Format

Each `.html` page has three sections:

**1. Layout directive** (first line):
```html
<page layout="main"></page>
```
References a layout template from `app/ui/layouts/` (e.g., `main.html`).

**2. HTML template** (middle):
```html
<main>
	<section class='hero'>
		<h1>{{hero_title}}</h1>
		<p>{{hero_subtitle}}</p>
		<div>{{features_html}}</div>
	</section>
</main>
```
Pure HTML with `{{ variable }}` interpolation. Variables are populated by the data logic block below.

**3. Data logic block** (bottom):
```html
<script type="text/clean">
	string lang = _req_query("lang")
	string sql = "SELECT ... WHERE p.slug = 'home' AND l.code = ?"
	string params = "[\"" + lang + "\"]"
	string result = _db_query(sql, params)
	string hero_title = json_get(result, "hero_title")
	string hero_subtitle = json_get(result, "hero_subtitle")
	string nav_html = build_nav(lang, "home")
	string footer_html = build_footer(lang)
</script>
```
Clean Language code that fetches data and sets the template variables. Uses `_req_query()`, `_db_query()`, `json_get()`, and imported helper functions.

### Layout System

Layouts are `.html` files in `app/ui/layouts/`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<title>{{page_title}} - Clean Language</title>
	{{jsonld}}
</head>
<body>
	{{nav_html}}
	<slot></slot>          <!-- Page content injected here -->
	{{footer_html}}
</body>
</html>
```

The `<slot></slot>` tag is replaced with the page's `<main>` section content.

### How Codegen Processes Pages

For each discovered `.html` page, the codegen must:

1. **Extract layout** — parse `<page layout="X">` to find the layout file
2. **Extract HTML body** — everything between layout directive and `<script>` block
3. **Extract data block** — parse `<script type="text/clean">` content
4. **Apply layout** — replace `<slot></slot>` in the layout with the page HTML
5. **Convert HTML to Clean** — transform the combined HTML into Clean string concatenation with `{{ }}` variables replaced by variable references
6. **Generate page handler** — create `__route_handler_N()` that executes the data block, then returns the HTML string with interpolated values

Example generated handler:
```clean
string __route_handler_17()
	// Data logic from <script type="text/clean"> block
	string lang = _req_query("lang")
	string sql = "SELECT ..."
	string result = _db_query(sql, params)
	string hero_title = json_get(result, "hero_title")
	// ...

	// HTML template converted to string concatenation
	string html = "<!DOCTYPE html><html><head><title>" + page_title + " - Clean Language</title>"
	html = html + "</head><body>" + nav_html + "<main><section class='hero'><h1>" + hero_title + "</h1>"
	// ... rest of HTML with variables interpolated
	html = html + "</body></html>"
	return _http_respond(200, "text/html", html)
```

### Component Tags in Pages

Pages can use custom component tags like `<site-nav>`, `<footer-block>`. Discovery finds components in `app/components/` (or `app/ui/components/`), and codegen expands these tags into calls to component render functions.

### Route Discovery for Pages

Pages are auto-discovered by scanning `app/pages/`:
- `app/pages/index.html` → route `GET /`
- `app/pages/docs.html` → route `GET /docs`
- `app/pages/get-started.html` → route `GET /get-started`

Page route indices start after all backend routes from the server entry file's `routes:` section.

---

## Code to Extract

The following code was previously in the manager and should be the starting point for `frame-cli`:

### From `src/core/codegen.rs` (deleted from manager)
- `ConfigRoute { method, path, handler }` struct
- `ProjectConfig { port, entry }` struct
- `ServerEntryConfig { plugins, imports, routes }` struct
- `parse_project_config()` — reads `config.cln` for port and server entry path
- `parse_config_route_line()` — parses `METHOD /path = function_name`
- `parse_server_entry()` — reads entry file for plugins/imports/routes sections
- `generate_code()` — main codegen orchestrator
- `generate_imports()` — emits `plugins:` and `import:` blocks
- `generate_start_function()` — emits `start:` block with `_http_route()` calls
- `generate_backend_route_wrappers()` — emits `__route_handler_N()` functions
- `generate_page_handler()` — emits page route handler functions
- `generate_component_render_function()` — emits component render functions
- `expand_component_tags()` — component tag expansion in HTML
- `convert_html_to_clean()` — HTML-to-Clean transpiler
- `apply_layout()` — layout inheritance via `<slot>` replacement
- `write_generated_code()` — writes output to `dist/.generated/`

### From `src/core/discovery.rs` (deleted from manager)
- `discover_project()` — scans project directory structure
- `discover_ui()` — scans `pages/`, `components/`, `layouts/`, `public/`
- `discover_server()` — scans `api/`, `models/`, `middleware/`
- `discover_shared()` — scans `lib/`
- File-to-route mapping functions
- Project structure structs: `PageRoute`, `ApiRoute`, `Component`, `Layout`, `Model`, `Middleware`, `DiscoveredProject`

### From `src/core/frame.rs` (removed from manager)
- `create_api_template()`, `create_web_template()`, `create_minimal_template()` — project scaffolding templates
- `build_project()` — build orchestration (discovery + codegen + compilation)
- `scan_project()` — project scanning with text/JSON output
- `find_entry_file()`, `parse_entry_from_config()` — entry point resolution
- `copy_dir_recursive()` — public asset copying

---

## Suggested Structure

```
clean-framework/
  frame-cli/
    Cargo.toml
    src/
      main.rs          # CLI entry point (clap)
      codegen.rs       # Code generation (from manager's codegen.rs)
      discovery.rs     # Project scanning (from manager's discovery.rs)
      templates.rs     # Project scaffolding templates
      config.rs        # Config parsing
```

## CLI Interface

```bash
# Project creation
frame-cli new my-project --template web --port 3000

# Build (codegen + compile)
frame-cli build . --output dist --optimize 1

# Scan (dry-run)
frame-cli scan . --format text --verbose
```

## Binary Distribution

The `frame-cli` binary should be distributed alongside `frame-runtime` in Frame version releases. The manager looks for it in:
1. Active frame version directory: `~/.cleen/frame-versions/<version>/frame-cli`
2. System PATH

Files Affected:
- clean-framework/frame-cli/ (new directory, new crate)
- clean-framework/Cargo.toml (workspace member if applicable)
