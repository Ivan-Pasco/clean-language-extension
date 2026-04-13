# Claude Code Prompt — Add Contracts (`require` and `rules:`)

You are working on the **Clean Language** project. The **Clean Language Specification is the single point of truth**.

Your task is to **add and formalize the specification for Contracts: `require` (preconditions) and `rules:` (state invariants)**, and then update the compiler to match the specification.

---

## Current State

Currently, Clean Language has:
- A `state:` block for declaring global state variables
- Functions and class methods
- No mechanism for runtime precondition checks
- No mechanism for state invariants

The goal is to add:
1. `require` - local preconditions in functions/methods (always checked)
2. `rules:` - persistent invariants in `state:` block (configurable via `settings.cln`)

---

## A. Approval Workflow (MUST FOLLOW)

### Step 1 — Locate current spec sections
Find in `documentation/Clean_Language_Specification.md`:
- The `state:` block section (for `rules:`)
- Functions section (for `require`)
- Class methods section (for `require`)

Also examine:
- `src/parser/grammar.pest` - current grammar rules
- `src/ast/mod.rs` - current AST definitions

### Step 2 — Propose a spec diff (do not apply yet)
Produce a **diff-style proposal** showing:
- Where new sections will be inserted
- The exact specification text
- Proposed grammar rules in PEG format

**Do NOT apply changes yet.**

### Step 3 — Ask for approval
Stop and ask:

**"Approve these specification changes? (yes/no)"**

### Step 4 — After approval
1. Apply the approved changes to the specification
2. Update the grammar (`grammar.pest`)
3. Update the parser to handle new syntax
4. Update semantic analysis for validation
5. Implement code generation
6. Add comprehensive tests

---

## B. Specification Content to Add

### 5. Contracts: `require` and `rules:`

#### `require`

- Declares a local precondition.
- Appears only inside functions or class methods.
- Evaluated immediately at runtime.
- If false, execution traps with a contract failure.
- **Always checked** (cannot be disabled).

**Syntax:**
```clean
require <boolean_expression>
```

**Example:**
```clean
functions:
    integer divide(integer a, integer b)
        require b != 0
        return a / b

    void setAge(integer age)
        require age >= 0
        require age <= 150
        // implementation
```

**Error on violation:**
```
Contract violation: require failed at divide:2
  Expression: b != 0
```

---

#### `rules:`

- Declares persistent invariants.
- Appears inside `state:`.
- Evaluated after initialization and on state changes.
- Intended for long-term correctness guarantees.
- **Requires `settings.cln`** to configure when invariants are checked.

**Syntax:**
```clean
state:
    integer balance
    integer limit

    rules:
        balance >= 0
        limit > 0
```

**Example:**
```clean
state:
    integer count = 0
    integer maxCount = 100

    rules:
        count >= 0
        count <= maxCount

start:
    count = 50          // rules checked after this
    count = count + 10  // rules checked after this
```

**Error on violation:**
```
Rule violation: rule failed in state block
  Rule: balance >= 0
  Actual: balance = -50
```

---

### 6. Project Configuration (`settings.cln`)

When using `rules:` (state invariants), a `settings.cln` file is **required** in the project root.

**Purpose:** Controls build behavior including when invariants are checked.

**Syntax:**
```clean
// settings.cln - Project configuration

project:
    name = "my-app"
    version = "1.0.0"

build:
    rules = true   // Check rules: at runtime
```

**Rules options:**
| Value | Behavior |
|-------|----------|
| `true` | Always check rules |
| `false` | Never check rules (production optimization) |
| `"development"` | Check only in development builds |

**Example for production apps:**
```clean
// settings.cln

project:
    name = "my-api"
    version = "2.1.0"

build:
    rules = "development"  // Skip in --release builds
```

**CLI behavior:**
```bash
cln compile app.cln              # Development: rules ON
cln compile app.cln --release    # Production: follows settings.cln
```

**Compiler behavior:**
- If `rules:` is used but no `settings.cln` exists → **Compile error**
- Error message: "State invariants require a settings.cln file. Create one with: cln init"

---

## C. Compiler Changes (After Spec Approval)

### C1. Grammar Changes (`grammar.pest`)

```pest
// Add require statement
require_stmt = { "require" ~ " "+ ~ expression }

// Add to statement rule
statement = {
    // ... existing ...
    | require_stmt
}

// Add rules block inside state
rules_block = {
    "rules" ~ ":" ~ NEWLINE ~
    (INDENT ~ INDENT ~ expression ~ NEWLINE)+
}

// Update state_block to include optional rules
state_block = {
    "state" ~ ":" ~ NEWLINE ~
    (INDENT ~ state_declaration ~ NEWLINE)* ~
    (INDENT ~ rules_block)?
}

// Settings file grammar
settings_file = {
    SOI ~
    (project_block | build_block)* ~
    EOI
}

project_block = {
    "project" ~ ":" ~ NEWLINE ~
    (INDENT ~ setting_assignment ~ NEWLINE)*
}

build_block = {
    "build" ~ ":" ~ NEWLINE ~
    (INDENT ~ setting_assignment ~ NEWLINE)*
}

setting_assignment = { identifier ~ "=" ~ setting_value }
setting_value = { string_literal | boolean_literal | identifier }
```

### C2. AST Changes (`src/ast/mod.rs`)

```rust
// Add RequireStatement
pub struct RequireStatement {
    pub condition: Expression,
    pub location: Option<SourceLocation>,
}

// Add RulesBlock
pub struct RulesBlock {
    pub rules: Vec<Expression>,
    pub location: Option<SourceLocation>,
}

// Update Statement enum
pub enum Statement {
    // ... existing ...
    Require(RequireStatement),
}

// Update StateBlock
pub struct StateBlock {
    pub variables: Vec<StateVariable>,
    pub rules: Option<RulesBlock>,
    pub location: Option<SourceLocation>,
}

// Settings structures
pub struct ProjectSettings {
    pub name: Option<String>,
    pub version: Option<String>,
}

pub struct BuildSettings {
    pub rules: RulesMode,
}

pub enum RulesMode {
    Always,           // true
    Never,            // false
    DevelopmentOnly,  // "development"
}
```

### C3. Semantic Validation
- Error if `require` appears outside a function or method
- Error if `rules:` appears outside `state:` block
- Error if expression is not boolean type
- **Error if `rules:` used but no `settings.cln` exists**

### C4. Code Generation

**For `require`:**
```wat
;; Evaluate condition
<compile expression>
;; Trap if false
i32.eqz
if
    unreachable
end
```

**For `rules:`:**
- Check `settings.cln` to determine if rules should be generated
- If enabled: Generate `$__check_rules` function, call it:
  1. At end of `_start` (after state init)
  2. After each assignment to a state variable
- If disabled: Skip rules code generation entirely

### C5. Error Messages
- "`require` can only be used inside a function or method."
- "`rules:` can only appear inside a `state:` block."
- "Contract violation: `{expr}` was false."
- "Rule violation: `{expr}` failed."
- "State rules require a settings.cln file. Create one with: `cln init`"

### C6. Tests
Create in `tests/cln/contracts/`:

**Valid:**
- `require_basic.cln` + no settings needed
- `require_multiple.cln`
- `rules_basic.cln` + `settings.cln`
- `rules_multiple.cln` + `settings.cln`

**Runtime failures:**
- `require_fails.cln`
- `rules_violation.cln` + `settings.cln`

**Compile errors:**
- `require_outside_function.cln`
- `rules_outside_state.cln`
- `rules_no_settings.cln` (rules: without settings.cln)

---

## D. Stop Point

**You MUST stop after proposing the specification diff and ask for approval before modifying any files.**

---

## E. Implementation Order (After Approval)

1. Update specification document
2. Add `settings.cln` parsing support
3. Update grammar for `require` and `rules:`
4. Update AST definitions
5. Update parser
6. Add semantic validation (including settings.cln check)
7. Implement code generation for `require`
8. Implement conditional code generation for `rules:` based on settings
9. Add `cln init` command to generate settings.cln
10. Add test files
11. Run full test suite

---

## F. Summary: Contract Behavior

| Contract | Checked When | Can Disable? | Requires Settings? |
|----------|--------------|--------------|-------------------|
| `require` | Always at runtime | No | No |
| `rules:` | Based on settings | Yes | **Yes** |

---

End of prompt.
