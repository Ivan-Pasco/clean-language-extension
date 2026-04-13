# KNOWLEDGE.md — Clean Extension (VS Code / Cursor)

Known fragile areas and architectural constraints. Read before modifying extension code.

---

## 1. Language Server is Single Source of Truth

**What:** The extension is a thin LSP client. ALL language intelligence — syntax highlighting (semantic tokens), completions, hover, diagnostics, plugin awareness — comes from the language server (bundled with the compiler). The extension does NOT hardcode keywords, types, or framework blocks.

**Where:** `src/extension.ts` (LSP client setup)

**Watch for:** Never add keyword lists, type definitions, or plugin-specific logic in the extension TypeScript code. If a language feature is missing from completions or highlighting, the fix belongs in the compiler's language server, not in the extension.

---

## 2. Hard Dependency on Compiler Installation

**What:** The extension requires the Clean Language compiler to be installed for the language server to function. There is no fallback mode — this is intentional to prevent stale/incorrect behavior from hardcoded fallbacks diverging from the compiler's actual behavior.

**Watch for:** If users report "extension not working," the first check is whether the compiler is installed and the language server binary is accessible.

---

## 3. TextMate Grammars Are Supplementary

**What:** The `syntaxes/clean.tmLanguage.json` and `clean-html.tmLanguage.json` provide baseline syntax coloring before the language server connects. They must NOT contradict or compete with the language server's semantic tokens. Keep them minimal.

**Where:** `syntaxes/*.tmLanguage.json`

**Watch for:** Adding detailed keyword lists to TextMate grammars that could conflict with semantic token classifications from the language server.
