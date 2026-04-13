Component: clean-extension
Issue Type: enhancement
Priority: critical
Description: Refactor extension to thin LSP client — remove all hardcoded language knowledge

## Context

The architecture has been formally defined in `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md`: the language server (in the compiler) is the single source of truth for all language intelligence. The extension must be refactored to a thin client.

**PREREQUISITE:** This work should be done AFTER the compiler's language server implements semantic tokens, completions, and hover (see `cross-component-prompts/compiler-language-server-semantic-tokens.md`).

## Required Changes

### 1. Strip TextMate Grammar to Minimal Lexical Tokens

File: `syntaxes/clean.tmLanguage.json`

Keep ONLY:
- `comments` — `//` line comments and `/* */` block comments
- `strings` — double-quoted strings with interpolation
- `numbers` — integers and floats
- `operators` — arithmetic, comparison, assignment

Remove ALL of:
- `framework-blocks` — all keyword patterns (these come from semantic tokens now)
- `keywords` — all keyword patterns
- `types` — all type patterns
- `http-methods` — HTTP method patterns
- `function-definitions` — function keyword patterns
- `class-definitions` — class keyword patterns
- `method-calls` — method call patterns
- `apply-blocks` — apply block patterns
- `booleans` — boolean literals
- `identifiers` — generic identifier pattern

The language server's semantic tokens will handle highlighting for all of these.

### 2. Strip clean-html Grammar Similarly

File: `syntaxes/clean-html.tmLanguage.json`

Keep:
- HTML tag structure (opening, closing, self-closing tags)
- Standard HTML attributes
- Interpolation (`{{ }}` and `{{{ }}}`)
- Comments

The `cl-*` directives and `data-on-*` events will be handled by the language server.

### 3. Delete plugin-loader.ts

File: `src/services/plugin-loader.ts`

Remove entirely. The language server loads plugin.toml and provides all plugin-aware features.

Remove any references to `PluginLoader` from `src/extension.ts` and other files.

### 4. Add Setup/Onboarding Flow

When the extension activates and cannot find the language server:

1. Show a status bar item: "Clean Language: Setup Required" (warning color)
2. Show an information message: "Clean Language compiler not found. Install it to enable language features."
3. Provide a command: "Clean Language: Install Compiler" that:
   - Checks if `cleen` is available
   - If not, shows instructions or runs the install script
   - If yes but language server binary missing, runs `cleen install latest`
4. Watch for `cleen` installation and auto-connect when the binary becomes available

When the language server IS connected:
1. Status bar shows: "Clean Language: Ready" (normal color)
2. All language features come from the server

### 5. Update Snippets

File: `snippets/clean.code-snippets`

Snippets can stay in the extension — they are user-facing templates, not language intelligence. However, consider whether the language server should also provide snippet completions from plugin.toml (it should, for plugin-specific snippets). Core language snippets can remain in the extension.

### 6. Update package.json

- Remove any grammar contributions that reference removed patterns
- Ensure semantic token support is enabled in the LSP client configuration
- Update extension description to reflect thin client architecture

## Files Affected
- `syntaxes/clean.tmLanguage.json` — strip to minimal
- `syntaxes/clean-html.tmLanguage.json` — strip to minimal
- `src/services/plugin-loader.ts` — DELETE
- `src/extension.ts` — remove plugin-loader, add onboarding flow
- `package.json` — update as needed

## Architecture Reference
See `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md` for the complete specification.
See `system-documents/ARCHITECTURE_BOUNDARIES.md` for boundary definitions.
