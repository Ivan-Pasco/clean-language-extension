Component: clean-language-compiler
Issue Type: feature
Priority: critical
Description: Language Server must become the single source of truth for all IDE language intelligence

## Context

The IDE extension currently has three independent systems for language knowledge:
1. Hardcoded keywords in TextMate grammar (syntax highlighting)
2. A `plugin-loader.ts` that reads plugin.toml for completions/hover
3. The language server (diagnostics only currently)

This creates duplication and maintenance burden — every new keyword must be added to both the extension grammar AND plugin.toml. The architecture has been formally defined in `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md`: the language server is the single source of truth.

## Required Changes

### 1. Implement Semantic Token Provider

The language server must provide `textDocument/semanticTokens/full` and `textDocument/semanticTokens/range`.

Token types to provide (at minimum):
- **Keywords**: `if`, `else`, `then`, `iterate`, `in`, `to`, `step`, `while`, `for`, `return`, `error`, `onError`, `later`, `background`, `function`, `class`, `constructor`, `is`, `and`, `or`, `not`, `test`, `constant`, `private`, `base`, `import`, `from`, `as`, `start`
- **Types**: `integer`, `number`, `boolean`, `string`, `void`, `any`, `list`, `matrix`, `pairs`
- **Framework blocks**: `plugins`, `data`, `migrate`, `endpoints`, `server`, `component`, `screen`, `page`, `styles`, `ui`, `auth`, `protected`, `login`, `roles`, `canvasScene`, `draw`, `onFrame`, `onPointerDown`, `onPointerMove`, `onKeyDown`
- **Sub-blocks**: `where`, `order`, `limit`, `offset`, `guard`, `returns`, `cache`, `handle`, `state`, `props`, `render`, `handlers`, `session`, `jwt`, `up`, `down`, `tenant`, `theme`, `colors`, `spacing`, `maxAge`, `noCache`
- **HTTP methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- **Framework functions**: all functions from loaded plugins
- **Framework classes**: `Data`, `Auth`, `req`, `res`, `canvas`, `sprite`, `audio`, `input`, `collision`, `camera`, `ease`, `db`, `ctx`, `session`, `tenant`
- **Built-in classes**: `Math`, `String`, `List`, `File`, `Http`

### 2. Load plugin.toml in Language Server

The language server must:
- Detect the project's `app.cln` or equivalent to find which plugins are active
- Load each plugin's `plugin.toml` from `~/.cleen/plugins/{name}/{version}/`
- Extract `[language]` section: blocks, keywords, types, functions, completions
- Include plugin-defined tokens in semantic token responses
- Include plugin-defined functions in completion responses
- Include plugin-defined documentation in hover responses

### 3. Implement Completions

The language server must provide `textDocument/completion` for:
- Core language keywords
- Core types
- Plugin-defined blocks, keywords, types, functions
- Variables and functions in scope (from semantic analysis)
- Plugin-defined snippet-style completions

### 4. Implement Hover

The language server must provide `textDocument/hover` for:
- Core keywords with descriptions
- Plugin-defined functions with signatures and descriptions (from plugin.toml `functions[]`)
- Plugin-defined types with descriptions
- Variables with their inferred types

## Files Likely Affected
- Language server source (wherever `tower-lsp` handlers are defined)
- New module for plugin.toml loading in the language server
- New module for semantic token generation
- LSP capability registration (server capabilities)

## Architecture Reference
See `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md` for the complete specification.
The extension will be simplified to a thin client after this work is complete.
