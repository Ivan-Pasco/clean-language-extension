# IDE Extension Architecture — Language Server as Single Source of Truth

**Status:** AUTHORITATIVE — This document defines the architecture for IDE extension and language server interaction. All components MUST follow this specification.

## Core Principle

**The Language Server is the single source of truth for ALL language intelligence.**

The IDE extension (VS Code, Cursor, etc.) is a **thin client**. It does NOT contain language knowledge. It does NOT hardcode keywords, types, functions, or syntax patterns for completions or highlighting. All language intelligence comes from the language server via LSP.

## Why This Architecture

1. **No fallback needed:** If the compiler (which includes the language server) is not installed, the developer cannot compile or run Clean Language code. Providing syntax highlighting on code that cannot be compiled is meaningless.
2. **Single source of truth:** Language keywords, types, framework blocks, plugin functions — all defined once in the language server. No duplication, no drift.
3. **Plugin-aware:** The language server loads `plugin.toml` files and knows about all framework features. New plugins automatically get full IDE support without extension updates.
4. **Version-consistent:** The language server ships with the compiler. The IDE always reflects the exact capabilities of the installed compiler version.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     IDE Extension (Thin Client)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ LSP Client   │  │ UI Commands  │  │ Setup/Onboarding       │ │
│  │ (vscode-     │  │ (run, build, │  │ (detect cleen, guide   │ │
│  │ languageclient)│ │ compile)     │  │  installation)         │ │
│  └──────┬───────┘  └──────────────┘  └────────────────────────┘ │
│         │                                                        │
│  ┌──────┴───────────────────────────────────────────────────┐   │
│  │ Minimal TextMate Grammar (ONLY basic lexical tokens)     │   │
│  │ strings, comments, numbers, operators                    │   │
│  │ NO keywords, NO types, NO framework blocks               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ LSP (stdio)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Language Server (in Compiler)                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Language Intelligence                    │   │
│  │                                                          │   │
│  │  Semantic Tokens  → syntax highlighting (overrides TM)   │   │
│  │  Completions      → autocomplete for all keywords        │   │
│  │  Hover            → documentation on hover               │   │
│  │  Diagnostics      → errors and warnings                  │   │
│  │  Go to Definition → navigation                           │   │
│  │  Formatting       → code formatting                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Knowledge Sources                        │   │
│  │                                                          │   │
│  │  Core Language  → keywords, types, built-in functions    │   │
│  │  Plugin TOMLs   → framework blocks, functions, types     │   │
│  │  Project Context → variables, classes, imports            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### IDE Extension (`clean-extension/`)

**IS responsible for:**
- Starting and communicating with the language server via LSP
- Detecting whether `cleen` (compiler/language server) is installed
- Guiding users through installation and setup when not installed
- Providing UI commands (run, compile, build)
- Providing a **minimal** TextMate grammar for basic lexical tokens only (strings, comments, numbers, operators)
- Distributing via VS Code Marketplace and Open VSX Registry

**is NOT responsible for:**
- Hardcoding language keywords, types, or framework blocks
- Loading or parsing `plugin.toml` files
- Providing completions, hover, or diagnostics
- Syntax highlighting of language-specific tokens (that's semantic tokens from the server)
- Maintaining keyword lists that need updating with each framework release

**Boundary test:** If you are adding a keyword, type, function name, or framework block to the extension → STOP. It belongs in the language server.

### Language Server (in `clean-language-compiler/`)

**IS responsible for:**
- Providing semantic tokens for syntax highlighting (all keywords, types, framework blocks)
- Providing completions for all language features (core + plugins)
- Providing hover documentation
- Providing diagnostics (errors, warnings)
- Loading `plugin.toml` files and incorporating plugin-defined language features
- Knowing the complete vocabulary of the language at the installed version

**is NOT responsible for:**
- VS Code-specific UI (commands, status bar, menus)
- Extension packaging or distribution
- User onboarding or setup wizards

## What the Minimal TextMate Grammar Contains

The TextMate grammar exists ONLY for basic lexical tokenization that doesn't require language knowledge:

```json
{
  "comments": "// and /* */",
  "strings": "double-quoted with interpolation",
  "numbers": "integers and floats",
  "operators": "arithmetic, comparison, assignment"
}
```

Everything else — keywords (`if`, `function`, `class`), types (`integer`, `string`), framework blocks (`endpoints`, `data`, `component`), framework functions, plugin-defined tokens — comes from the language server's semantic tokens.

## Extension Behavior When Language Server is Unavailable

When the compiler/language server is not detected:

1. **DO NOT** provide degraded syntax highlighting with hardcoded keywords
2. **DO** show a clear status indicator: "Clean Language: Setup Required"
3. **DO** provide a setup command/wizard that guides installation of `cleen`
4. **DO** show an information message with installation instructions on first activation
5. **DO** watch for `cleen` installation and auto-connect when available

## LSP Capabilities Required from Language Server

The language server MUST implement these LSP capabilities:

| Capability | Purpose |
|------------|---------|
| `textDocument/semanticTokens` | Syntax highlighting for all language tokens |
| `textDocument/completion` | Autocomplete for keywords, types, functions, variables |
| `textDocument/hover` | Documentation on hover |
| `textDocument/publishDiagnostics` | Error and warning reporting |
| `textDocument/definition` | Go to definition |
| `textDocument/formatting` | Code formatting |

## Migration Path

### Phase 1: Language Server Enhancement (Compiler)
1. Implement semantic token provider with full token vocabulary
2. Load `plugin.toml` files for framework-aware tokens
3. Implement completions for core language + plugins
4. Implement hover with documentation from plugin.toml

### Phase 2: Extension Simplification (Extension)
1. Remove `plugin-loader.ts` entirely
2. Strip TextMate grammar to minimal lexical tokens only
3. Remove all hardcoded keyword lists from grammar
4. Add setup/onboarding flow for missing language server
5. Add status bar indicator for language server connection state

### Phase 3: Verification
1. All syntax highlighting works via semantic tokens
2. All completions come from language server
3. Extension has zero hardcoded language keywords
4. New plugin features work without extension updates

## Rules

- **NEVER** add language keywords, types, or function names to the extension's TextMate grammar
- **NEVER** create a plugin loader or keyword provider in the extension
- **NEVER** duplicate language knowledge between the extension and language server
- **ALWAYS** add new language features to the language server
- **ALWAYS** keep the extension as a thin LSP client
