# Claude Code Prompt — Update Spec + Compiler (Contracts, Classes, Free Functions)

You are working on the **Clean Language** project. The **Clean Language Specification is the single point of truth**.

Your task is to **add and formalize the specification for Contracts, Classes & Domain Behavior, and Free Functions**, and then update the compiler to match the specification.

---

## A. Approval workflow (MUST FOLLOW)
You must follow this exact workflow:

### Step 1 — Locate current spec sections
Locate where the specification currently discusses:
- contracts, guards, invariants, or assertions (if any)
- classes and how behavior is structured
- the `functions:` section or free functions

### Step 2 — Propose a spec diff (do not apply yet)
Produce a **diff-style proposal** showing:
- where new sections will be inserted
- the exact text to be added or replaced
- wording that is friendly, simple, and non-technical

Do NOT apply changes yet.

### Step 3 — Ask for approval
Stop and ask:

**“Approve these specification changes? (yes/no)”**

### Step 4 — After approval
1) Apply the approved changes to the specification.
2) Ensure the final wording is friendly and simple.
3) Update the compiler and tests to match the specification.

---

## B. Specification content to add

### 5. Contracts: `require` and `rules:`

#### `require`
- Declares a local precondition.
- Appears only inside functions or class methods.
- Evaluated immediately at runtime.
- If false, execution traps with a contract failure.

Syntax:
```clean
require <boolean_expression>
```

Example:
```clean
require value > 0
```

#### `rules:`
- Declares persistent invariants.
- Appears inside `state:`.
- Evaluated at **operation boundaries** (simple, predictable):
  - after `start:` finishes
  - after each `frame:` finishes (if present)
  - after a handler finishes (e.g., endpoint/job/command handler, when those concepts exist)
- If a rule becomes false, execution traps with a contract failure.
- Intended for long-term correctness guarantees.

Syntax:
```clean
state:
    ...

    rules:
        <boolean_expression>
```

---

### 6. Classes and Domain Behavior
- Classes are the primary mechanism for expressing domain behavior and responsibility.
- Long-lived behavior and stateful logic should be expressed as class methods.
- Application behavior (update, render, interaction, IO coordination) is expected to live in classes.
- Entry blocks should delegate to classes rather than implement domain logic directly.
- Clean does not require all logic to be object-oriented, but encourages classes as the natural home for complex or evolving behavior.

---

### 7. Free Functions (`functions:`)
- The `functions:` section exists for pure helper logic.
- Functions should be stateless and side-effect free where possible.
- Intended for math, construction helpers, and reusable algorithms.
- Not intended for application orchestration or domain flow.

---

## C. Compiler changes (after spec approval)

### C1. Parser / AST
- Parse `require <expr>` as a statement allowed only inside functions or methods.
- Parse `rules:` as a nested block allowed only inside `state:`.

### C2. Semantic validation
- Error if `require` appears outside a function or method.
- Error if `rules:` appears outside `state:`.

### C3. Code generation
- `require` must compile to:
  - evaluate the boolean expression
  - trap immediately if the expression is false

- `rules:` must compile to invariant checks at **operation boundaries**:
  - after `start:` finishes
  - after each `frame:` finishes (if present)
  - after a handler finishes (when handlers exist)

Implementation note (keep it simple):
- Generate a single internal function (e.g. `__check_rules`) that evaluates all `state.rules`.
- Insert a call to `__check_rules` at the end of `start` and at the end of `frame`.
- If handlers exist in the current codebase, add `__check_rules` at the end of each handler function.

### C4. Diagnostics
Add clear, friendly error messages, for example:
- “`require` can only be used inside a function or method.”
- “`rules:` can only be used inside `state:`.”
- “Rule failed: <expression>.”

### C5. Tests
Add tests covering:
- valid and failing `require`
- invalid placement of `require`
- valid and failing `rules:`
- invalid placement of `rules:`

---

## D. Stop point
You MUST stop after proposing the specification diff and ask for approval before modifying any files.

---

End of prompt.

