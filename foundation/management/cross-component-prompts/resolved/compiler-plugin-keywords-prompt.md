# Compiler Enhancement: Plugin Keyword Support

## Task

Update the Clean Language compiler to support plugin-defined keywords that don't require colons.

Currently, the parser only accepts framework blocks with colons:
```clean
endpoints:     // Works - has colon
    GET /users -> listUsers
```

But plugins like `frame.data` need to support:
```clean
data User      // Doesn't work - no colon
    integer id : pk, auto
    string email : unique
```

## Current Architecture

### Compilation Flow
```
1. extract_imports(source)     → Get plugin names from import: block
2. loader.load_plugins()       → Load plugin WASM and manifests
3. SpecificationParser::new()  → Create parser (NO plugin info passed!)
4. parser.parse_program()      → Parse fails on "data User"
5. PluginExpander::expand()    → Never reached
```

### Key Files
- `src/lib.rs` - Main compilation entry points
- `src/parser/token_parser.rs` - Token-based parser (lines 146-174 handle top-level identifiers)
- `src/parser/grammar.pest` - Pest grammar (line 164: `framework_block` rule)
- `src/plugins/plugin_abi.rs` - Plugin manifest structs
- `src/plugins/wasm_loader.rs` - Loads external WASM plugins
- `src/plugins/registry.rs` - Plugin registry with `handles()` method

### Current Parser Logic (token_parser.rs:146-174)
```rust
TokenKind::Identifier(name) => {
    let is_framework_block = match self.peek_kind() {
        Some(&TokenKind::Colon) => true,  // "identifier:"
        Some(&TokenKind::StringLiteral(_)) | Some(&TokenKind::Identifier(_)) => {
            matches!(self.look_ahead(2).kind, TokenKind::Colon)  // "identifier identifier:"
        }
        _ => false,
    };

    if is_framework_block {
        // Parse as framework block (requires colon)
        match self.parse_framework_block() { ... }
    } else {
        // ERROR: "Unexpected identifier at top level"
        self.errors.push(CompilerError::parse_error(...));
    }
}
```

### Plugin Manifest (plugin.toml)
```toml
[handles]
blocks = ["data"]  # Keywords this plugin handles
```

## Required Changes

### 1. Pass Plugin Keywords to Parser

**File: `src/lib.rs`**

In `compile_with_external_plugins_and_opt_level()`:
```rust
// Current flow:
let imports = extract_imports(source);
let registry = loader.load_plugins(&imports)?;
compile_with_plugins_and_opt_level(source, file_path, &registry, opt_level)

// New flow:
let imports = extract_imports(source);
let registry = loader.load_plugins(&imports)?;
let plugin_keywords = registry.get_all_block_keywords(); // NEW
compile_with_plugins_and_keywords(source, file_path, &registry, &plugin_keywords, opt_level)
```

**File: `src/plugins/registry.rs`**

Add method to get all plugin keywords:
```rust
impl PluginRegistry {
    /// Get all block keywords from registered plugins
    pub fn get_all_block_keywords(&self) -> Vec<String> {
        self.handlers.keys().cloned().collect()
    }
}
```

### 2. Update Parser to Accept Plugin Keywords

**File: `src/parser/token_parser.rs`**

Add plugin keywords field:
```rust
pub struct SpecificationParser<'a> {
    tokens: &'a [Token],
    position: usize,
    file_path: String,
    errors: Vec<CompilerError>,
    plugin_keywords: HashSet<String>,  // NEW
}

impl<'a> SpecificationParser<'a> {
    pub fn new(tokens: &'a [Token], file_path: String) -> Self { ... }

    // NEW: Constructor with plugin keywords
    pub fn with_plugin_keywords(
        tokens: &'a [Token],
        file_path: String,
        plugin_keywords: Vec<String>
    ) -> Self {
        Self {
            tokens,
            position: 0,
            file_path,
            errors: Vec::new(),
            plugin_keywords: plugin_keywords.into_iter().collect(),
        }
    }
}
```

Update the identifier handling (around line 146):
```rust
TokenKind::Identifier(name) => {
    // Check if this is a plugin keyword (like "data")
    let is_plugin_keyword = self.plugin_keywords.contains(name);

    let is_framework_block = match self.peek_kind() {
        Some(&TokenKind::Colon) => true,
        Some(&TokenKind::StringLiteral(_)) | Some(&TokenKind::Identifier(_)) => {
            // "identifier identifier:" OR plugin keyword followed by identifier
            if is_plugin_keyword {
                true  // "data User" - plugin keyword followed by identifier
            } else {
                matches!(self.look_ahead(2).kind, TokenKind::Colon)
            }
        }
        _ => false,
    };

    if is_framework_block || is_plugin_keyword {
        match self.parse_framework_block_or_plugin_declaration(is_plugin_keyword) {
            Ok(stmt) => statements.push(stmt),
            Err(e) => self.errors.push(e),
        }
    } else {
        // Error: unexpected identifier
    }
}
```

### 3. Add Plugin Declaration Parser

**File: `src/parser/token_parser.rs`**

Add new parsing method for plugin keywords without colons:
```rust
/// Parse a framework block or plugin declaration
/// Framework blocks: "identifier:" or "identifier arg:"
/// Plugin declarations: "keyword identifier" (no colon, e.g., "data User")
fn parse_framework_block_or_plugin_declaration(
    &mut self,
    is_plugin_keyword: bool
) -> Result<Statement, CompilerError> {
    let start_location = self.current().location.clone();

    // Get the keyword/block name
    let block_name = if let TokenKind::Identifier(name) = self.current_kind() {
        name.clone()
    } else {
        return Err(CompilerError::parse_error(...));
    };
    self.bump();
    self.skip_whitespace();

    // For plugin keywords, the next token is the declaration name (no colon)
    if is_plugin_keyword {
        // Parse: "data User" -> block_name="data", decl_name="User"
        let decl_name = match self.current_kind() {
            TokenKind::Identifier(name) => {
                let n = name.clone();
                self.bump();
                n
            }
            _ => {
                return Err(CompilerError::parse_error(
                    format!("Expected identifier after '{}'", block_name),
                    Some(self.current().location.clone()),
                    None,
                ));
            }
        };

        let full_block_name = format!("{} {}", block_name, decl_name);

        // Expect newline then indented content
        self.skip_whitespace();
        self.eat(&TokenKind::Newline);

        // Collect indented content
        let content = self.collect_indented_content()?;

        return Ok(Statement::FrameworkBlock {
            name: full_block_name,
            content,
            location: Some(start_location),
        });
    }

    // Otherwise, parse as normal framework block (with colon)
    // ... existing parse_framework_block logic ...
}
```

### 4. Update lib.rs Compilation Functions

**File: `src/lib.rs`**

Update `compile_with_plugins_and_opt_level` to pass keywords to parser:
```rust
pub fn compile_with_plugins_and_opt_level(
    source: &str,
    file_path: &str,
    registry: &plugins::PluginRegistry,
    opt_level: u8,
) -> Result<Vec<u8>, Vec<CompilerError>> {
    // ... lexing ...

    // Get plugin keywords for parser
    let plugin_keywords = registry.get_all_block_keywords();

    // Stage 2: Parsing with plugin keywords
    let mut parser = SpecificationParser::with_plugin_keywords(
        tokens,
        file_path.to_string(),
        plugin_keywords
    );
    let parsed_ast = parser.parse_program().map_err(|e| vec![e])?;

    // ... rest of compilation ...
}
```

## Test Cases

Create `tests/cln/plugins/plugin_keywords.cln`:
```clean
// Test: Plugin keywords without colons should be accepted
// Requires frame.data plugin to be loaded

import:
    frame.data

// Plugin keyword "data" followed by identifier
data User
    integer id : pk, auto
    string email : unique
    string name
    datetime created_at : default=now()

data Post
    integer id : pk, auto
    string title
    string content
    User author
    datetime created_at : default=now()

// Regular framework block with colon (should still work)
functions:
    void printUsers()
        print("Users")

start()
    printUsers()
```

Create `tests/cln/plugins/mixed_syntax.cln`:
```clean
// Test: Mix of colon and non-colon syntax

import:
    frame.data
    frame.httpserver

// Plugin keyword without colon
data User
    integer id : pk, auto
    string email : unique

// Framework block with colon
endpoints:
    GET /users:
        handle:
            return json([])

start()
    print("Server ready")
```

## Verification Steps

1. **Compile test files:**
```bash
cargo run --bin cln -- compile tests/cln/plugins/plugin_keywords.cln \
    --output tests/output/plugin_keywords.wasm --plugins
```

2. **Validate WASM:**
```bash
wasm-validate tests/output/plugin_keywords.wasm
```

3. **Run existing tests to ensure no regression:**
```bash
cargo test
```

4. **Verify plugin expansion works:**
```bash
cargo run --bin cln -- compile tests/cln/plugins/plugin_keywords.cln \
    --output tests/output/plugin_keywords.wasm --plugins -vvv 2>&1 | grep -i "expand"
```

## Success Criteria

1. `data User` syntax parses successfully when frame.data plugin is imported
2. Existing `endpoints:` syntax continues to work
3. All existing tests pass
4. Plugin expansion receives the correct block name (e.g., "data User")
5. Error messages are clear when plugin keyword is used without import

## Notes

- The parser needs plugin keywords BEFORE parsing, so they must be extracted from the registry
- Plugin keywords should only be accepted when the plugin is imported
- The `FrameworkBlock` AST node already supports names like "data User" (with space)
- Plugin expansion already handles blocks by extracting the first word for dispatch

## Files to Modify

1. `src/lib.rs` - Pass plugin keywords to parser
2. `src/parser/token_parser.rs` - Accept plugin keywords, new parsing logic
3. `src/plugins/registry.rs` - Add `get_all_block_keywords()` method
4. `tests/cln/plugins/` - Add test files

## Estimated Scope

- ~50-100 lines of new code
- ~20-30 lines of modified code
- Low risk of regression (additive change)
