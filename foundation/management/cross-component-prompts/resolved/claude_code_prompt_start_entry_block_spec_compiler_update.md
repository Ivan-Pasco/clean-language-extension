# Claude Code Prompt — Update Spec + Compiler (Start as Entry Block)

You are working on the **Clean Language** project. The **Clean Language Specification is the single point of truth**. Your task is to:

1) Propose (show) the required **spec changes** (diff-style) for approval.
2) After approval, **rewrite the updated spec sections** in **simple, friendly language**.
3) Then **update the Clean Language compiler** (Rust → WASM) to implement the approved definitions.


---

## A. What Changed (High-Level)

We are changing `start()` from a **function syntax** to a **block syntax** (`start:`).

This aligns `start:` with Clean Language's block-oriented design pattern used by `functions:`, `state:`, `import:`, `tests:`, etc.

**Rationale:**
- Entry points are not regular functions - they're declarative lifecycle hooks
- `start()` parentheses suggest parameters could be passed (they can't)
- Block syntax is consistent with the rest of the language
- Clearer semantic meaning: "This is where execution begins"

**IMPORTANT: `start` for Async is UNCHANGED**

The `start` keyword has TWO distinct uses in Clean Language:

| Context | Syntax | Status |
|---------|--------|--------|
| Entry point (this change) | `start:` | **NEW** (replaces `start()`) |
| Async expression | `start fetchData()` | **UNCHANGED** |

The async `start` expression remains valid:
```clean
// Async usage - STILL VALID
later data = start fetchData("url")
start backgroundTask()
```

Only the entry point syntax changes from `start()` to `start:`.

---

## B. Approval Workflow (MUST FOLLOW)

Before coding, you must follow this exact workflow:

### Step 1 — Locate Current Spec Sections
- Find the sections in the Clean Language Specification that describe:
  - file/module structure
  - functions and entrypoints
  - blocks syntax
  - any mention of `start()` or `functions:` containing `start`

### Step 2 — Produce a Proposed Spec Diff
- Output a **diff-style proposal** with:
  - old text (as short excerpts)
  - new replacement text
  - any new section headings

Do NOT apply changes yet. Just propose.

### Step 3 — Ask for Approval
- Stop and ask: "Approve these spec changes? (yes/no)".

### Step 4 — After Approval
- Update the spec with the approved changes.
- Rewrite the updated sections in **simple, friendly language**.
- Then implement compiler changes.

---

## C. Specification Changes to Propose (Content Requirements)

Your proposed spec update must define all of the following clearly.

### C1. `start:` is an Entry Block

- `start:` is a **top-level entry block**, not a function
- Entry blocks use block syntax (colon + indented body), not parentheses
- `start:` is the program's entry point - execution begins here

✅ Correct:
```clean
start:
    print("Hello, World!")
    integer x = 42
    print(x)
```

❌ Incorrect (deprecated):
```clean
start()
    print("Hello, World!")

// Also incorrect:
functions:
    void start()
        print("Hello, World!")
```

### C2. Top-Level Section Order (Enforced)

A `.cln` file is composed of top-level sections. Sections may be omitted, but if present, they **MUST** appear in this order:

1. `import:`
2. `start:` (entry block)
3. `state:`
4. type declarations: `class ...`
5. `functions:` (helper functions)

**The compiler MUST error if sections appear out of order.**

Example error messages:
- `"'state:' must appear after 'start:' block"`
- `"'import:' must be the first section in the file"`
- `"'functions:' must appear after class declarations"`


### C3. No Top-Level Executable Statements

At the top level, only the allowed sections may appear. No free-standing executable statements (assignments, calls, loops, ifs) are allowed outside blocks.

### C4. Clarify `functions:` Purpose

- `functions:` holds helper functions
- Entry blocks (`start:`) do NOT belong inside `functions:`
- `start:` is a peer to `functions:`, not a child of it


---

## D. Compiler Changes (After Spec Approval)

After the spec is updated, implement the new definitions in the compiler.

### D1. Grammar (grammar.pest)

Update the grammar to recognize `start:` as a top-level entry block:

**Current:**
```pest
start_function = { ("void" ~ " "+)? ~ "start" ~ "(" ~ ")" ~ indented_block }
```

**New:**
```pest
start_block = { "start" ~ ":" ~ simple_indented_block }
```

- Remove `start_function` and `implicit_start_function` rules
- Add `start_block` to `program_item`
- Remove `start` from function-related rules

### D2. Parser / AST

- Add `StartBlock` AST node (similar to existing block nodes)
- Update parser to emit `StartBlock` instead of treating start as a function
- Ensure `start:` cannot appear inside `functions:` blocks

### D3. Semantic Analysis

**Entry Block Validation:**
- Validate that `start:` appears at most once per file
- Validate that `start:` is at the top level, not nested
- Emit helpful error messages:
  - `"Use 'start:' block syntax instead of 'start()'"` when parentheses form detected
  - `"'start:' must be at the top level, not inside functions:"` if nested

**Section Order Enforcement:**
- Track the order of top-level sections as they are parsed
- Validate sections appear in the required order: `import:` → `start:` → `state:` → `class` → `functions:`
- Emit clear error messages when sections are out of order:
  - `"'import:' must be the first section in the file. Found after 'start:'"`
  - `"'state:' must appear after 'start:' block. Found before 'start:'"`
  - `"'functions:' must appear after class declarations. Found before 'class'"`

**Async `start` Expression:**
- Ensure `start expression` (async) parsing is NOT affected by this change
- `start fetchData()` must continue to work as an async expression
- Only `start()` with empty parentheses at top level should trigger the migration error

### D4. Code Generation

- Ensure `start:` compiles into an exported WASM function named `start`
- The generated function should have no parameters and return void
- Existing WASM consumers should see no change in the exported interface

### D5. Error Messages

Provide clear migration guidance:

```
Error: 'start()' function syntax is no longer supported.

  Change this:
    start()
        ...

  To this:
    start:
        ...
```

### D6. Tests

**Entry Block Tests:**
- `start:` block compiles successfully
- `start:` exports as WASM `start` function
- `start()` (parentheses form) produces helpful error message
- `functions: void start()` produces helpful error message
- `start:` inside `functions:` produces error
- Multiple `start:` blocks produce error
- Program without `start:` compiles (for library modules)

**Section Order Tests:**
- Valid order (`import:` → `start:` → `state:` → `class` → `functions:`) compiles
- `state:` before `start:` produces error
- `functions:` before `class` produces error
- `import:` after any other section produces error
- Omitting sections is allowed (e.g., no `state:` is valid)
- Multiple classes in correct position compiles

**Async `start` Expression Tests:**
- `start fetchData()` inside `start:` block works
- `later data = start asyncCall()` works
- `start` async expression is not confused with `start:` block
- Async `start` works inside `functions:` blocks

---

## E. Migration Notes

### For Existing Code

The migration is simple find-and-replace:

| Before | After |
|--------|-------|
| `start()` | `start:` |
| `void start()` | `start:` |

### For Tooling

- Update syntax highlighting to recognize `start:` as entry block
- Update code formatters
- Update LSP completions

---

## F. Output Requirements

When working:
- Prefer minimal changes that match existing architecture
- Provide clear file paths, diffs, and reasoning
- Keep spec text friendly and non-technical
- Follow existing code patterns in the compiler

---

## G. Stop Points

You MUST stop after Step 2 (spec diff proposal) and request approval before modifying any files.

---

## H. Out of Scope

The following are explicitly OUT OF SCOPE for this prompt:

- `frame:` or other framework-specific entry points (belongs to clean-framework)
- CLI commands (`cleen framework new`, etc.) (belongs to clean-manager)
- Plugin system changes
- New language features beyond `start:` syntax change
- Async `start expression` syntax (unchanged - continues to work as-is)

---

End of prompt.