# Plugin Compiler Contract

**Authority:** This document defines the interface between a Clean Language plugin and the compiler. It is the authoritative reference for plugin authors and compiler implementors.
**Version:** 1.0.0
**Date:** 2026-04-19

Related documents:
- Plugin grammar extensions: `spec/plugins/frame-server.ebnf`, `frame-data.ebnf`, `frame-ui.ebnf`, `frame-auth.ebnf`, `frame-canvas.ebnf`
- Host bridge function signatures: `../platform-architecture/HOST_BRIDGE.md`
- Execution layer placement rules: `../platform-architecture/EXECUTION_LAYERS.md`
- Plugin architecture guide: `clean-language-compiler/documentation/Plugin-Architecture.md`

---

## 1. Plugin Manifest (`plugin.toml`)

Every external plugin must ship a `plugin.toml` manifest in its versioned directory:

```
~/.cleen/plugins/<plugin-name>/<version>/
├── plugin.toml    ← manifest (this section)
└── plugin.wasm    ← compiled plugin code
```

### 1.1 Required Fields

The following table lists every section and field the compiler reads from a plugin manifest. Fields marked **required** must be present or the compiler will reject the plugin with `PLUGIN001`.

```toml
[plugin]
name    = "frame.server"     # required — dot-separated identifier (see §6)
version = "2.1.0"            # required — semantic version X.Y.Z

# Optional metadata (not read by compiler; used by tooling)
description = "Server routing plugin"
author      = "Clean Language Team"
license     = "MIT"

[compatibility]
min_compiler_version = "0.15.0"   # required — minimum compiler version that can load this plugin

[handles]
# required if the plugin expands DSL blocks
blocks = ["endpoints"]            # list of block identifiers the plugin handles

# optional — expression-level patterns the plugin intercepts
expressions = [
  "*.find:",
  "Data.tx:",
]

[exports]
# required if blocks or expressions are declared
expand       = "expand"           # function name exported by plugin.wasm that expands a block
# optional
validate     = "validate"         # function name for pre-expansion validation (default: none)
get_keywords = "get_keywords"     # function name for LSP keyword list (default: none)

[bridge]
# optional — bridge function declarations this plugin makes available to Clean code
functions = [
  { name = "_my_func", params = ["string", "integer"], returns = "string", expand_strings = true },
]

[language]
# optional — LSP metadata for IDE support
blocks    = ["endpoints"]          # block-level keywords (same as handles.blocks)
keywords  = [
  { name = "GET",  description = "HTTP GET endpoint",  context = "block" },
]
types     = [
  { name = "Request", description = "HTTP request context" },
]
functions = [
  { name = "json", signature = "json(data)", description = "Return JSON response" },
]
completions = [
  { trigger = "endpoints:", insert = "endpoints:\n\t${1:GET} ${2:/path}:" },
]

[paths]
# optional — folder ownership rules for project scaffolding
owns          = ["app/backend/api"]
auto_create   = true
patterns      = ["*.cln"]
implicit_import = true

[templates]
# optional — starter files created when the plugin is added to a project
files = [
  { path = "app/backend/api/health.cln", template = "health.cln" },
]

[enforcement]
# optional — compiler warnings/errors for misuse of bridge functions
severity = "warn"
restricted_functions = [
  { name = "_http_route", use_instead = "endpoints:", message = "Use 'endpoints:' block" },
]
required_blocks = [
  { folder = "app/backend/api/", block = "endpoints", message = "API files should use 'endpoints:'" },
]
block_folder_rules = [
  { block = "endpoints", allowed_in = ["app/backend/"], message = "endpoints: must be in app/backend/" },
]
```

### 1.2 Validation Rules

When loading a plugin, the compiler applies the following checks. Failures produce `PLUGIN001` (not found) or `PLUGIN002` (conflict):

1. `[plugin].name` must be a valid plugin identifier (see §6.1).
2. `[plugin].version` must be a valid semantic version string.
3. `[compatibility].min_compiler_version` must be a valid semantic version. If the running compiler is older, the plugin is rejected.
4. If `[handles].blocks` is non-empty, `[exports].expand` must be present and the named function must exist in `plugin.wasm`.
5. No two loaded plugins may register the same block name in `[handles].blocks` (PLUGIN002).
6. No two loaded plugins may declare a bridge function with the same `name` in `[bridge].functions` (PLUGIN002).

---

## 2. Plugin Types

Clean Language supports four categories of plugins. A plugin may combine multiple capabilities (hybrid plugin).

### 2.1 Block Expansion Plugins

The most common plugin type. The plugin declares one or more block identifiers in `[handles].blocks` and provides an `expand` function that transforms raw DSL text into standard Clean Language statements.

**When used:** The compiler parser encounters an identifier followed by `:` that is not a core keyword and not a variable name. It creates a `Statement::FrameworkBlock` node and stores the raw indented content. The plugin expander later calls the plugin's `expand` function.

**Must provide:**
- `[handles].blocks` — at least one block name
- `[exports].expand` — name of the WASM export that performs expansion

**Examples:** `frame.server` (handles `endpoints:`), `frame.data` (handles `data`, `migrate`), `frame.ui` (handles `component`, `screen`, `page`).

### 2.2 Bridge Function Plugins

Expose additional host functions to Clean Language code without adding any new syntax. The plugin declares functions in `[bridge].functions`; the compiler generates WASM import declarations for them.

**When used:** Clean code calls a function name that the compiler doesn't know about in its built-in registry. The plugin system checks all `[bridge].functions` declarations and, if a matching name is found, generates the WASM import with the correct signature.

**Must provide:**
- `[bridge].functions` — at least one function declaration

**Examples:** Any plugin that wraps a new third-party service (payment gateway, email provider, etc.).

### 2.3 Type Plugins

Inject additional named types into the Clean Language type system, making them available as variable types, parameter types, and return types in user code.

**When used:** The compiler encounters a type name during semantic analysis that is not in the core type list. The plugin system checks `[language].types` for a match.

**Must provide:**
- `[language].types` — at least one type declaration

**Examples:** `frame.server` injects `Request` and `Response`; `frame.data` injects `Model`, `Query`, and `Transaction`.

### 2.4 Hybrid Plugins

Combine two or more of the above capabilities. All five built-in plugins are hybrid plugins: they handle DSL blocks, declare bridge functions, and inject types simultaneously.

---

## 3. Bridge Function Contract

### 3.1 Declaration Format

Each bridge function is declared as a TOML inline table inside `[bridge].functions`:

```toml
{ name = "_my_func", params = ["string", "integer"], returns = "string", expand_strings = true, description = "What this does" }
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | yes | string | The WASM import name (must match the host runtime export exactly) |
| `params` | yes | array of strings | Parameter types in order (`"string"`, `"integer"`, `"number"`, `"boolean"`, `"handler"`) |
| `returns` | yes | string | Return type (`"string"`, `"integer"`, `"number"`, `"boolean"`, `"void"`) |
| `expand_strings` | no | bool | If `true`, the compiler expands each `string` parameter into a `(ptr: i32, len: i32)` pair at the WASM level (see §3.2). Default: `false` |
| `description` | no | string | Human-readable description for IDE tooling |

### 3.2 String Encoding Convention

All strings cross the WASM boundary in length-prefixed format:

```
[length: i32 little-endian][data: u8 × length]
```

At the WASM import level, a string parameter is passed as two `i32` values: a pointer to the length-prefixed data and the length in bytes.

When `expand_strings = true` is set, the compiler automatically rewrites the call site: a single Clean Language `string` argument becomes `(ptr: i32, len: i32)` in the generated WASM import signature. Plugin authors declare the Clean-facing type (`"string"`) and the compiler handles the expansion transparently.

When `expand_strings = false` (or omitted), the caller is responsible for passing pointers correctly. This is only appropriate for internal bridge functions that handle their own memory layout.

**Example — declaration with string expansion:**
```toml
{ name = "_req_param", params = ["string"], returns = "string", expand_strings = true }
```

**Generated WASM import:**
```wat
(import "env" "_req_param" (func (param i32 i32) (result i32)))
```

**Caller in Clean Language:**
```clean
string value = _req_param("id")
```

**Generated WASM call sequence:**
1. Compiler writes the string `"id"` to WASM linear memory with a 4-byte length prefix.
2. Compiler emits a call with `(ptr, len)` as the two arguments.
3. The host runtime reads `len` bytes starting at `ptr` to recover the string.

### 3.3 Integer and Number Types

| Clean type | WASM type | Notes |
|-----------|----------|-------|
| `integer` | `i32` | Unqualified integer — 32-bit signed |
| `integer:64` | `i64` | 64-bit signed integer |
| `number` | `f64` | Unqualified number — 64-bit float |
| `number:32` | `f32` | 32-bit float |
| `boolean` | `i32` | `0` = false, `1` = true |

The `print_integer` and `int_to_string` host bridge functions use `i64` for their integer parameters (per `../platform-architecture/HOST_BRIDGE.md`). Plugin bridge functions that operate on integer values should generally use `"integer"` (i32) unless they specifically need 64-bit range, in which case they must declare their parameter in the `[bridge].functions` entry with any required precision annotation.

### 3.4 Return Value Conventions

| Return type | WASM return | Error return |
|------------|------------|-------------|
| `string` | `i32` (pointer to length-prefixed string) | Empty string (`""`) — pointer to a zero-length string |
| `integer` | `i32` | `0` or `-1` (function-specific) |
| `number` | `f64` | `0.0` or `NaN` (function-specific) |
| `boolean` | `i32` | `0` (false) |
| `void` | — | — |

Functions that can fail should set an internal error state via the host's `set_error()` mechanism. The caller may check `last_error()` after any bridge call. Hosts must not halt the WASM module on recoverable errors; they must set the error state and return the documented error sentinel.

### 3.5 Handler Parameters

The `"handler"` parameter type declares that the function accepts a function reference (WASM `funcref` or an index into the indirect call table). This is used for route registration:

```toml
{ name = "_http_route", params = ["string", "string", "handler"], returns = "integer", expand_strings = true }
```

At the call site, the compiler resolves the function reference argument to a WASM function table index and passes it as an `i32`.

---

## 4. Type Exposure Contract

### 4.1 Declaring Plugin Types

Types are declared in `[language].types`:

```toml
[language]
types = [
  { name = "Request",     description = "HTTP request context object" },
  { name = "Response",    description = "HTTP response builder" },
  { name = "Transaction", description = "Database transaction handle" },
]
```

Each declared type becomes available as a Clean Language type name anywhere a `type` production is valid (see `grammar.ebnf §2`).

### 4.2 Naming Rules

- Type names must start with an uppercase letter and contain only alphanumeric characters and underscores — matching the `class_name` production in `grammar.ebnf §1.3`.
- A plugin may not declare a type name that conflicts with a core type (`boolean`, `integer`, `number`, `string`, `void`, `any`, `null`) or with a type already declared by a loaded plugin (PLUGIN002).

### 4.3 Inheritance

Plugin-declared types behave as opaque class types in the Clean Language type system. User code may declare variables of the plugin type and pass them to functions, but:
- Users **cannot** subclass plugin types (`class MyRequest is Request` will be rejected if `Request` is a plugin type without a publicly defined class body).
- Plugin types are not assignable to each other unless both are declared in the same plugin and the plugin explicitly establishes an inheritance relationship by generating appropriate class definitions during block expansion.

### 4.4 Conflict Resolution

If two plugins declare a type with the same name, the second plugin to be loaded is rejected with `PLUGIN002`. The load order is determined by the order of entries in the file's `import:` block (or the plugins: auto-detection order for path-matched plugins).

---

## 5. Block Expansion Contract

### 5.1 Compiler-to-Plugin Call

When the compiler's plugin expander encounters a `Statement::FrameworkBlock` whose `name` matches a registered plugin, it calls the plugin's `expand` WASM export:

**WASM export signature:**
```wat
(export "expand" (func (param i32 i32) (result i32)))
```

- **Parameter 1 (`i32`):** Pointer to a length-prefixed JSON string representing the `FrameworkBlock` structure.
- **Parameter 2 (`i32`):** Length of the JSON string in bytes.
- **Return (`i32`):** Pointer to a length-prefixed JSON string representing the expansion result (see §5.3).

The JSON encoding of the input block:
```json
{
  "name": "endpoints",
  "content": "GET /users:\n\treturn json(users)",
  "attributes": [
    { "name": "auth", "value": null }
  ]
}
```

### 5.2 Validation Call (Optional)

If `[exports].validate` is declared, the compiler calls the validation export before calling `expand`. The signature is identical to `expand`. A validation failure prevents expansion and surfaces the error to the developer.

**Return on validation success:** pointer to an empty JSON string `""`.  
**Return on validation failure:** pointer to a JSON string containing the error message (a plain string, not an object).

### 5.3 Expansion Output Format

The `expand` function must return a JSON string in one of two forms:

**Success:**
```json
{
  "statements": "<Clean Language source code>"
}
```

The `statements` value is a complete snippet of valid Clean Language code. The compiler re-parses this snippet and inserts the resulting statements at the block's source location. The generated code goes through the full compilation pipeline — HIR transformation, type checking, and WASM emission — exactly as if the developer had written it by hand.

**Error:**
```json
{
  "error": "Descriptive error message",
  "line": 3,
  "column": 1
}
```

`line` and `column` are 1-based offsets within the block's `content` string. The compiler uses them to produce a source location for the diagnostic. Both are optional; omit them if line information is not available.

### 5.4 Source Location Preservation

The compiler maps all locations in the expanded code back to the original block's source location. Error messages from type checking or code generation of expanded code should reference the original `.cln` file, not a synthetic source string.

Plugin authors should not embed absolute line numbers in generated code comments. If line numbers are needed for debugging, use relative offsets from the block start.

### 5.5 Nested Blocks

The plugin expander makes multiple passes until no unexpanded `Statement::FrameworkBlock` nodes remain. This means a plugin's expansion output may itself contain framework blocks that will be expanded by other plugins on the next pass. Cycles are detected by the expander (maximum 8 passes); a plugin that produces its own block name on every pass will be rejected.

---

## 6. Naming Rules

### 6.1 Plugin Identifiers

A plugin identifier is a dot-separated name:

```
plugin_identifier = segment, { "." , segment } ;
segment           = LOWER_ALPHA, { ALPHANUMERIC | "_" } ;
```

Examples: `frame.server`, `frame.data`, `mycompany.payments`.

Rules:
- All segments must start with a lowercase letter.
- Segments may contain digits and underscores but not hyphens.
- The `frame.` prefix is reserved for official Clean Language plugins.
- Third-party plugins must not use the `frame.` prefix.

### 6.2 Bridge Function Names

Bridge functions names are unrestricted in content, but the following conventions apply:

- Official host bridge functions (Layer 2, `../platform-architecture/HOST_BRIDGE.md`) use snake_case without a leading underscore: `file_read`, `math_sin`, `string_concat`.
- Server extension functions (Layer 3) use a leading underscore: `_http_route`, `_req_param`, `_auth_get_session`.
- Plugin-declared functions should use a leading underscore plus a plugin-specific prefix to avoid collision: `_myplugin_send_email`.

### 6.3 Type Names

Plugin-declared types follow the `class_name` production — one or more words in `UpperCamelCase`:

```
class_name = UPPER_ALPHA, { ALPHANUMERIC | "_" } ;
```

Examples: `Request`, `Response`, `PaymentIntent`, `DbTransaction`.

### 6.4 Reserved Names

The compiler reserves the following names. Plugins may not register them as block names, bridge functions, or type names:

**Reserved block names:** `import`, `start`, `state`, `functions`, `tests`, `constant`, `private`, `external`, `watch`, `screen`, `class`, `build`, `source`, `print`

**Reserved type names:** `boolean`, `integer`, `number`, `string`, `void`, `any`, `null`, `handler`, `list`, `matrix`, `pairs`, `future`

**Reserved function prefixes:** `__frame_` (generated by the compiler and built-in plugins; must not be used by third-party plugins)

---

## 7. Versioning

### 7.1 Plugin Version Format

Plugin versions follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR:** Incremented when the plugin's DSL syntax, bridge function signatures, or type names change in a breaking way.
- **MINOR:** Incremented when new blocks, functions, or types are added in a backward-compatible way.
- **PATCH:** Incremented for bug fixes with no interface changes.

### 7.2 Compiler Compatibility

The `[compatibility].min_compiler_version` field declares the minimum compiler version required to load the plugin. The compiler rejects plugins whose `min_compiler_version` is higher than the running compiler version.

There is no `max_compiler_version` field. Plugins are expected to work with all compiler versions equal to or greater than `min_compiler_version` until the next MAJOR version bump.

### 7.3 Breaking Changes in the Plugin Contract

The following changes constitute a **breaking change** in the plugin contract and require a MAJOR version bump of the affected plugin:

- Renaming or removing a bridge function declared in `[bridge].functions`.
- Changing the parameter types or count of an existing bridge function.
- Changing the return type of an existing bridge function.
- Renaming or removing a handled block name from `[handles].blocks`.
- Renaming or removing a type from `[language].types`.
- Changing the expansion output format returned by the `expand` export.
- Changing the WASM export name for `expand`, `validate`, or `get_keywords`.

The following changes are **non-breaking** and may appear in MINOR or PATCH releases:

- Adding new bridge functions.
- Adding new handled block names.
- Adding new types.
- Adding or updating `[language]` metadata (completions, keywords, etc.).
- Adding or updating `[enforcement]` rules.
- Adding new optional fields to the expansion output JSON.

### 7.4 Plugin Contract Versioning

This document itself is versioned. Compilers implement a specific contract version. The contract version is embedded in the compiler binary and is checked against the `min_compiler_version` declared in plugin manifests:

| Contract Version | Compiler Range | Key Changes |
|-----------------|----------------|-------------|
| 1.0 | 0.15.0+ | Initial plugin system — block expansion, bridge functions, type injection |

---

## 8. Built-in Plugins

Built-in plugins are compiled into the compiler binary and are always available without installation. They differ from external (user-installed) plugins in the following ways:

- They do not require a `plugin.toml` or `plugin.wasm` file on disk.
- They are registered by the compiler's `lib.rs` initialization code, not by the `WasmPluginLoader`.
- They have access to the full Rust `FrameworkPlugin` trait, not the WASM ABI.
- They ship with the compiler release and are versioned with the compiler.
- They may use the `frame.` prefix, which is reserved for official plugins.

### 8.1 frame.server

**Purpose:** HTTP server routing and request/response handling.

**Handled blocks:** `endpoints`

**Bridge functions:** Route registration (`_http_route`, `_http_route_protected`), request context (`_req_param`, `_req_query`, `_req_body`, `_req_header`, `_req_form`, `_req_method`, `_req_path`, `_req_ip`), response helpers (`_http_respond`, `_http_redirect`, `_http_set_header`), JSON utilities (`_json_encode`, `_json_decode`, `_json_get`), authentication (`_auth_get_session`, `_auth_require_auth`, `_auth_require_role`, `_auth_can`, `_auth_has_any_role`), cache headers (`_http_set_cache`, `_http_no_cache`), HTTP client (`http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`, `http_post_json`, `http_put_json`, `http_post_form`, `http_get_with_headers`, `http_post_with_headers`).

**Injected types:** `Request`, `Response`

**Layer:** 3 — Server Extensions (see `../platform-architecture/EXECUTION_LAYERS.md §Layer 3`). Functions declared by this plugin are only available in a server context. Emitting them in a client-only build violates the Import Minimality Rule.

**Grammar extension:** `spec/plugins/frame-server.ebnf`

### 8.2 frame.data

**Purpose:** ORM models, database queries, mutations, migrations, and transactions.

**Handled blocks:** `data`, `migrate`

**Intercepted expressions:** `*.find:`, `*.first:`, `*.count:`, `*.insert:`, `*.update:`, `*.delete:`, `Data.tx:`, `db.query:`, `db.queryAs`

**Bridge functions:** `_db_query`, `_db_execute`, `_db_begin`, `_db_commit`, `_db_rollback`, `_db_configure`, `_db_register_migration`, `_db_migration_diff`, `_db_run_migrations`, `_db_rollback_migration`, `_db_migration_status`

**Injected types:** `Model`, `Query`, `Transaction`

**Layer:** 2 — Host Bridge for database functions.

**Grammar extension:** `spec/plugins/frame-data.ebnf`

### 8.3 frame.ui

**Purpose:** Reactive UI components, screens, pages, HTML templates, and design-token style sheets.

**Handled blocks:** `component`, `screen`, `page`, `styles`, `html`, `ui`

**Injected types:** `Component`, `Props`, `State`

**Layer:** 5 — Application Layer. No bridge functions; all UI rendering is handled by the framework runtime.

**Grammar extension:** `spec/plugins/frame-ui.ebnf`

### 8.4 frame.auth

**Purpose:** Session management, JWT, role-based access control, and CSRF protection.

**Handled blocks:** `auth`, `roles`, `protected`, `login`

**Injected functions:** `session_create`, `session_get`, `session_destroy`, `jwt_sign`, `jwt_verify`, `hashPassword`, `verifyPassword`, `can`, `hasRole`, `currentUser`, `loginUser`, `logoutUser`

**Injected types:** `Session`, `User`, `Role`, `Permission`

**Layer:** 3 — Server Extensions. Session and JWT functions are only available in a server context.

**Grammar extension:** `spec/plugins/frame-auth.ebnf`

### 8.5 frame.canvas

**Purpose:** 2D canvas scenes, sprite sheets, audio, input, animation, collision detection, camera control, easing, and scene management.

**Handled blocks:** `canvasScene`

**Injected API objects:** `canvas.*` (drawing), `sprite.*` (sprite sheets), `audio.*` (sound and music), `input.*` (mouse and keyboard), `collision.*` (hit detection), `camera.*` (viewport), `ease.*` (easing functions), `scene.*` (scene navigation)

**Injected types:** `Canvas`, `Sprite`, `Sound`, `Music`, `Image`

**Layer:** 4 — Plugin Layer. Canvas functions are implemented by the frame.canvas plugin runtime and are available in browser and native hosts that support canvas rendering.

**Grammar extension:** `spec/plugins/frame-canvas.ebnf`

---

## 9. Plugin Auto-Detection

The compiler automatically detects and loads plugins based on the source file's path within the project. This allows files in conventional project directories to use plugin DSL without an explicit `import:` declaration.

| File path pattern | Auto-detected plugins |
|-------------------|-----------------------|
| `/api/`, `/backend/api/`, `/server/api/`, `/endpoints/` | `frame.server`, `frame.data`, `frame.auth` |
| `/data/`, `/models/`, `/server/models/` | `frame.data` |
| `/auth/`, `/config/auth/` | `frame.auth` |
| `/canvas/` | `frame.canvas` |
| `/ui/`, `/components/`, `/screens/` | `frame.ui` |

Auto-detected plugins are merged with any plugins explicitly declared in the file's `import:` block. Duplicate registrations are silently deduplicated; no `PLUGIN002` error is raised for a plugin that appears in both the auto-detection list and the explicit import list.

Auto-detection can be suppressed by adding a `# no-auto-plugins` comment at the top of the file (before any declarations).

---

## 10. Compiler Guarantees to Plugins

The compiler guarantees the following behaviors that plugin authors may rely upon:

1. **Source location preservation:** The `location` field of a `FrameworkBlock` always reflects the position of the block identifier in the original `.cln` source file, not a synthetic location.

2. **Single-pass calling:** The compiler calls `validate` (if declared) exactly once per block, followed by exactly one call to `expand` (if validation succeeds). There is no retry or caching of expansion results within a single compilation run.

3. **Ordered expansion:** Blocks are expanded in source order (top to bottom within a file). If a block's expansion output contains another framework block handled by a different plugin, that nested block is expanded on the next pass in the same top-to-bottom order relative to all blocks at the same nesting level.

4. **Type checking after expansion:** The compiler does not type-check raw DSL content. Type checking happens only after expansion, on the generated Clean Language code. Plugin authors are responsible for generating type-correct code.

5. **Import Minimality:** The compiler emits WASM import declarations only for bridge functions that are actually reachable from the compiled module's exports. A bridge function declared in `[bridge].functions` but never called in the expanded code will not appear in the output `.wasm` import section (see `../platform-architecture/EXECUTION_LAYERS.md` — Import Minimality Rule).

6. **No bridge function implementation in the compiler:** The compiler generates WASM import declarations for bridge functions. Implementations are provided entirely by the host runtime (Layer 2 or Layer 3). The compiler never executes bridge function bodies.
