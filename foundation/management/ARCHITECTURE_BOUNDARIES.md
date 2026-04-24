# Architecture Boundaries — Clean Language Ecosystem

This document defines the **authoritative responsibility boundaries** for every component in the Clean Language ecosystem. Every component's CLAUDE.md MUST reference this document. Any AI instance working in any component MUST check this document before implementing new functionality.

## Purpose

This document exists to prevent responsibility drift — where one component gradually absorbs logic that belongs in another. This has happened before (the manager absorbed ~2,900 lines of framework code) and this document is the enforcement mechanism to prevent it from recurring.

## Component Boundary Definitions

### Compiler (`clean-language-compiler/`)

**IS responsible for:**
- Parsing `.cln` source files into AST (Pest grammar)
- Loading plugin `.wasm` files and calling `expand_block()`
- Semantic analysis (type checking, scope resolution, inference)
- Generating `.wasm` binary output via `wasm-encoder`
- Generating WASM import declarations for host bridge functions
- Error recovery and diagnostic messages

**is NOT responsible for:**
- Implementing any I/O (console, file, HTTP, DB)
- Running WASM modules
- Knowing about project folder structure
- HTTP routing or server behavior
- Framework-specific DSL semantics (that's plugins)

**Boundary test:** If a function needs to access the filesystem, network, or any external resource at runtime → it does NOT belong in the compiler.

---

### Plugins (`clean-framework/plugins/`)

**IS responsible for:**
- Defining DSL blocks (`endpoints:`, `data`, `auth:`, `component:`, `canvasScene:`)
- Expanding DSL blocks into standard Clean Language code at compile time
- Declaring host bridge function imports in `plugin.toml`
- Declaring folder conventions for auto-detection in `plugin.toml`
- Validating DSL block syntax

**is NOT responsible for:**
- Implementing host bridge functions (that's the server)
- Parsing non-Clean files (HTML, CSS, SQL)
- Running at runtime (plugins are compile-time only)
- Project scaffolding or file generation
- Direct filesystem operations

**Boundary test:** If a function runs after compilation is complete → it does NOT belong in a plugin.

---

### Manager (`clean-manager/`)

**IS responsible for:**
- Installing/switching/listing compiler versions
- Installing/listing/creating/building plugins
- Downloading and managing binaries (compiler, server, frame-cli)
- Shell PATH configuration
- Delegating to other binaries (frame-cli, clean-server)
- Plugin scaffolding (directory creation, `plugin.toml` generation)
- Environment diagnostics (`doctor`)

**is NOT responsible for:**
- Parsing or understanding Clean Language syntax
- Code generation of any kind
- Knowing framework project folder conventions
- Discovering/scanning project files for routes, components, models
- Template expansion or HTML transformation
- Build pipeline execution (that's frame-cli)
- HTTP routing, server behavior, or runtime concerns

**Boundary test:** If a function reads, parses, transforms, or generates `.cln` source code → it does NOT belong in the manager. If a function knows about `pages/`, `components/`, `api/`, `data/` conventions → it does NOT belong in the manager.

**Delegation pattern:** For any framework operation, the manager must shell out to the appropriate binary:
```rust
// CORRECT — delegate to frame-cli
Command::new("frame-cli").args(["build"]).status()?;
Command::new("frame-cli").args(["new", name, "--template", template]).status()?;
Command::new("frame-cli").args(["scan"]).status()?;

// WRONG — do it directly
codegen::generate_code(&project);
discovery::discover_project(&path);
```

---

### Framework CLI (`clean-framework/frame-cli/`)

**IS responsible for:**
- Project scaffolding (`frame new`)
- Project scanning and validation (`frame scan`)
- Build pipeline: discovery → codegen → compile (`frame build`)
- Development server orchestration (`frame serve`)
- Database migration management (`frame db:*`)
- Knowing framework folder conventions
- HTML template processing
- Component discovery and route mapping

**is NOT responsible for:**
- Version management (that's the manager)
- Plugin installation (that's the manager)
- Binary downloads (that's the manager)
- Compiler internals (parsing, AST, WASM generation)
- Runtime host bridge implementations (that's the server)

**Boundary test:** If a function manages binary versions or installations → it does NOT belong in frame-cli.

---

### IDE Extension (`clean-extension/`)

**IS responsible for:**
- Starting and communicating with the language server via LSP (thin client)
- Detecting whether `cleen` (compiler/language server) is installed
- Guiding users through installation and setup when compiler is not available
- Providing UI commands (run, compile, build)
- Providing a **minimal** TextMate grammar for basic lexical tokens only (strings, comments, numbers, operators)
- Distributing via VS Code Marketplace and Open VSX Registry

**is NOT responsible for:**
- Hardcoding language keywords, types, framework blocks, or function names
- Loading or parsing `plugin.toml` files (that's the language server)
- Providing completions, hover, or diagnostics (that's the language server)
- Syntax highlighting of language-specific tokens (that's semantic tokens from the language server)
- Maintaining keyword lists that need updating with each framework or language release

**Boundary test:** If you are adding a keyword, type, function name, or framework block to the extension → STOP. It belongs in the language server. See [IDE Extension Architecture](../platform-architecture/IDE_EXTENSION_ARCHITECTURE.md).

**Architectural rule:** The language server is the **single source of truth** for all language intelligence. The extension is a thin client. No fallback grammar needed — if the compiler isn't installed, the user can't code anyway. Guide them to install it instead.

---

### Server (`clean-server/`)

**IS responsible for:**
- Loading and executing `.wasm` modules via Wasmtime
- HTTP server (Axum) for incoming requests
- Route matching and handler dispatch
- Host Bridge implementations (all `_*` functions)
- Database connections and query execution
- Authentication runtime (session storage, JWT validation)
- Serving static files

**is NOT responsible for:**
- Compilation or code generation
- Parsing Clean Language syntax
- Project scaffolding or file discovery
- Plugin management
- Version management

**Boundary test:** If a function runs before the `.wasm` file exists → it does NOT belong in the server.

---

### Website / Frame Applications (`Web Site Clean/`, etc.)

**IS responsible for:**
- Following the correct Frame project structure exactly
- Using correct file extensions (`.html` for pages, `.cln` for logic, `.css` for styles)
- Placing files in the correct folders for auto-detection
- Separating concerns: pages = templates, api = logic, data = models

**MUST follow these rules:**
- Pages in `app/pages/` with `.html` extension only
- Components in `app/components/` with `.cln` extension
- API endpoints in `app/api/` with `.cln` extension
- Data models in `app/data/` with `.cln` extension
- Styles in `public/css/` with `.css` extension only
- No explicit `plugins:` blocks (auto-detected by folder)
- No `<script>` tags (no JavaScript)
- No inline `<style>` tags (all CSS in external files)
- No `<script type="text/clean">` blocks in pages
- No business logic in page templates
- No duplicate config files

---

## Boundary Violation Detection Checklist

Before implementing ANY new function or file, ask:

| Question | If YES → |
|----------|----------|
| Does this function parse `.cln` syntax? | Only belongs in compiler or plugins |
| Does this function generate `.cln` code? | Only belongs in frame-cli or plugins |
| Does this function know about `pages/`, `api/`, `data/` folders? | Only belongs in frame-cli |
| Does this function download or install binaries? | Only belongs in manager |
| Does this function implement a `_*` host function? | Only belongs in server |
| Does this function run at runtime after compilation? | Only belongs in server |
| Does this function transform DSL blocks? | Only belongs in plugins |
| Does this function manage version switching? | Only belongs in manager |
| Does this add a keyword/type/function to the IDE extension? | Only belongs in language server (in compiler) |
| Does this load plugin.toml for IDE features? | Only belongs in language server (in compiler) |
| Does this function know about HTML tags, attributes, or template syntax? | Only belongs in plugins (frame.ui) |
| Does this function replicate logic that already exists in a plugin? | **STOP — fix the plugin or the compiler bug that breaks the plugin** |

## The Workaround Trap (CRITICAL)

**When a plugin produces incorrect output, the fix is NEVER to reimplement the plugin's logic in the compiler.** This is the most common form of boundary violation.

The correct response when plugin output is broken:

1. **Identify WHY the plugin output is wrong** — is it a plugin source bug or a compiler codegen bug?
2. **If compiler codegen bug:** Fix the codegen so the plugin WASM executes correctly. Then recompile the plugin.
3. **If plugin source bug:** Report via cross-component prompt. Do not duplicate the logic in the compiler.
4. **NEVER copy plugin logic into the compiler** as a "workaround" — even temporarily. Workarounds become permanent, create maintenance burden, and violate the execution layer model.

**Real example (2026-04-15):** The frame.ui plugin's `html_block_to_code` produced corrupted attribute names due to a compiler codegen bug (substring results in multi-part string concatenation produced null bytes). The WRONG fix was to reimplement `html_block_to_code` in Rust inside the compiler's `wasm_adapter.rs` (~300 lines of HTML parsing). The RIGHT fix was to find and fix the codegen bug so the plugin's own WASM executes correctly.

## What To Do When You Discover a Boundary Violation

1. **Do NOT fix it in the wrong component** — even if it's "quick"
2. Create a cross-component prompt in `system-documents/cross-component-prompts/`
3. Document exactly what code is misplaced and where it should go
4. Continue working within your component's boundaries

## History of Violations

| Date | Component | Violation | Status |
|------|-----------|-----------|--------|
| 2026-02-23 | clean-manager | ~2,900 lines of framework codegen/discovery/build logic | Documented — pending extraction |
| 2026-02-23 | Web Site Clean | 16 structural violations against Frame spec | Documented — pending restructure |
| 2026-03-23 | clean-extension | Hardcoded language keywords in TextMate grammar + plugin-loader.ts duplicates language server responsibility | Documented — pending refactor to thin client (see IDE_EXTENSION_ARCHITECTURE.md) |
| 2026-04-15 | clean-language-compiler | ~300 lines of HTML template parsing (html_block_to_code_rust) added to wasm_adapter.rs — duplicates frame.ui plugin logic | Reverted — root cause was codegen bug, not plugin logic |

When a violation is found and documented, add it to this table for tracking.
