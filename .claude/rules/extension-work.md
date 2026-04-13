---
description: Extension-specific rules — active when working in clean-extension/
globs: ["clean-extension/**"]
alwaysApply: false
---

# Extension Work Rules

## Thin Client Architecture (Principle 6)
The VS Code extension is a thin LSP client. It does NOT:
- Hardcode keywords, types, or framework blocks
- Provide completions, hover, or diagnostics directly
- Load plugins or parse Clean Language files

ALL language intelligence comes from the language server (bundled with the compiler).

## What You CAN Do
- Configure the LSP client connection
- Register TextMate grammars (minimal, supplementary only)
- Add UI elements (status bar, commands, tree views)
- Configure extension settings

## What You MUST NOT Do
- Add keyword lists to TypeScript code
- Add type definitions that duplicate the language server
- Add plugin-specific logic in the extension
- Add fallback syntax highlighting that could conflict with semantic tokens
