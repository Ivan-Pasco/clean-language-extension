# Clean Language Semantic Rules

**Authority:** This file is the single source of truth for semantic rules (Principle 3).
**Version:** 1.1.0
**Date:** 2026-04-19

Every rule has a numbered code. When the compiler rejects code for a semantic reason, the error message must include the rule code. A diagnostic without a code is incomplete (Principle 4).

---

## Error Code Ranges

| Range | Category | Phase |
|-------|----------|-------|
| SYN001–SYN008 | Syntax (parser) | Parsing |
| SEM001–SEM009 | Semantic (type, scope, access) | HIR validation, resolver, type checker |
| SCOPE001–SCOPE005 | Scope rules | Resolver |
| FUNC001–FUNC007 | Function rules | HIR validation |
| CLASS001–CLASS004 | Class rules | HIR validation |
| IDX001–IDX004 | Index access rules | Type checker |
| STATE001–STATE005 | State rules | HIR validation, runtime |
| IMPORT001–IMPORT004 | Import rules | Module resolver |
| PLUGIN001–PLUGIN002 | Plugin rules | Plugin loader |
| COM001–COM006 | Compilation (codegen, module) | Code generation |
| RUN001–RUN005 | Runtime (execution) | WASM execution |

---

## Syntax Rules (SYN)

### SYN001 — Invalid Token
The lexer encountered a character that is not valid in any context.

### SYN002 — Unexpected Token
A token appears where the grammar does not allow it.

### SYN003 — Invalid Indentation
Indentation uses spaces instead of tabs, or the nesting level is inconsistent with the enclosing block.

### SYN004 — Unterminated Construct
A string literal, comment, or block was opened but not closed before end of file.

### SYN005 — Malformed Construct
A syntax structure is partially correct but missing required elements.

### SYN006 — Indentation Error
Tab/space mixing detected, or indentation does not match the expected level for the current block.

### SYN007 — Section Out of Order
The 5 core top-level sections must appear in the order defined by
`Clean_Language_Specification.md` §"File Structure":

```
import:  →  start:  →  state:  →  class  →  functions:
```

Each section is optional, but when present they must follow this order.  Auxiliary
sections (`tests:`, `external:`, `watch:`, `screen:`, framework blocks, `apply`,
`private:`) may appear at any position and are not subject to this rule.

**Example (fails — SYN007):**
```clean
functions:
    integer add(integer a, integer b)
        return a + b

start:                              // error: 'start:' must appear before 'functions:'
    print(add(2, 3))
```

**Exception:** Parsers invoked with lenient section ordering (used for plugin-
generated code) skip this rule.  User-written `.cln` source always has the rule
applied.

### SYN008 — Invalid Print Block

A `print:` block contains no expressions, or contains non-expression statements.

**Condition:** A `print:` block is parsed but the indented body contains no
expressions, or one of the items in the body is not a valid expression.

**Example (fails — SYN008):**
```clean
print:
    // no expressions here
```

**Message:** `"print: block must contain at least one expression"`

---

## Semantic Rules (SEM)

### SEM001 — Type Mismatch
The type of an expression does not match what the context requires.

**Applies to:**
- Variable assignment: RHS type must be assignable to LHS declared type
- Function return: return value type must match declared return type
- Function argument: argument type must match parameter type
- State variable initializer: initializer type must match declared state type
- Computed state body: computed body must return the declared type

**Example (passes):**
```clean
integer x = 42
string name = "Alice"
```

**Example (fails — SEM001):**
```clean
integer x = "hello"     // string is not assignable to integer
```

### SEM002 — Undefined Symbol
A variable, function, class, or module is referenced but has not been declared.

**Applies to:**
- Variable use before declaration
- Function call to undefined function
- Class instantiation of undefined class
- Import of undefined module or symbol
- Method call on undefined method

**Example (fails — SEM002):**
```clean
start:
    print(x)    // x not declared
```

### SEM003 — Symbol Redefinition
A symbol (variable, function, class) is declared more than once in the same scope.

**Applies to:**
- Variable declared twice in same scope
- Function defined twice at top level
- Class defined twice
- Duplicate import items

**Example (fails — SEM003):**
```clean
functions:
    integer add(integer a, integer b)
        return a + b
    integer add(integer x, integer y)    // redefinition
        return x + y
```

### SEM004 — Invalid Operation for Type
An operator or operation is applied to a type that does not support it.

**Example (fails — SEM004):**
```clean
string result = "hello" - "world"    // subtraction not valid for strings
```

### SEM005 — Access Violation

A private member is accessed from outside its allowed scope.

**Applies to:**
- A function listed in a `private:` block is called from an importing module
- A screen-local state variable is referenced outside its screen block
- Any other out-of-scope member access

**Example (fails — SEM005):**
```clean
// file: mymodule.cln
functions:
    integer helperFunc()
        return 42

private:
    helperFunc

// file: main.cln
import:
    mymodule

start:
    integer x = helperFunc()    // error: helperFunc is private to mymodule
```

**Message:** `"'{name}' is private and cannot be accessed from outside '{module}'"`

### SEM006 — Inheritance Error
A class inheritance declaration is invalid.

**Applies to:**
- Parent class does not exist
- Parent is not a class type (e.g., trying to inherit from a primitive)

**Example (fails — SEM006):**
```clean
class Child is NonExistentParent    // parent not defined
    integer x
```

### SEM007 — Generic Type Error
A generic or polymorphic type operation is invalid.

**Applies to:**
- Incompatible type arguments
- Tuple size mismatch
- Union type incompatibility

### SEM008 — Inheritance Cycle
A class inherits from itself directly or indirectly, creating a cycle.

**Example (fails — SEM008):**
```clean
class A is B
class B is A    // circular
```

### SEM009 — Invalid Type Specification
A type name does not refer to a valid type.

**Example (fails — SEM009):**
```clean
FooBar x = 42    // FooBar is not a defined type
```

---

## Scope Rules

### SCOPE001 — Variable Must Be Declared Before Use
Variables must be declared with an explicit type before being referenced in expressions or statements.

### SCOPE002 — Variable Cannot Be Redeclared in Same Scope
A variable name that already exists in the current scope cannot be redeclared.

### SCOPE003 — Maximum Scope Depth Exceeded
The scope nesting depth has exceeded the implementation limit. This indicates deeply nested code that should be refactored.

### SCOPE004 — Watch Target Must Reference State Variable
Watch block target identifiers must reference variables declared in a `state:` block.

### SCOPE005 — Screen State Access

Screen-local state is accessed outside the screen that declared it.

**Condition:** A state variable declared inside a `screen:` block is referenced
in a context that is not lexically contained within that `screen:` block. Each
screen's state is its own namespace and cannot be accessed by other screens or
by top-level code.

**Example (fails — SCOPE005):**
```clean
screen Home:
    state:
        integer homeCount = 0

start:
    integer x = homeCount    // error: homeCount is local to screen Home
```

**Message:** `"State variable '{name}' is local to screen '{screen}' and cannot be accessed here"`

---

## Function Rules

### FUNC001 — Function Must Be Defined Before Use
Functions must be defined (in a `functions:` block or as a class method) before being called.

### FUNC002 — Argument Count Must Match Parameter Count
The number of arguments in a function call must match the number of parameters in the function signature.

**Example (fails — FUNC002):**
```clean
functions:
    integer add(integer a, integer b)
        return a + b

start:
    integer result = add(1, 2, 3)    // expects 2 args, got 3
```

### FUNC003 — Cannot Call Non-Function Type
Only function-typed symbols can be invoked with parentheses.

### FUNC004 — Missing Return in Non-Void Function
A function with a non-void return type must have a return statement on all execution paths. (Warning)

### FUNC005 — Empty Return in Non-Void Function
A return statement in a function with a non-void return type must provide a value. (Warning)

### FUNC006 — Start Block Cannot Have Parameters
The `start:` entry point block does not accept parameters.

### FUNC007 — Start Block Should Return Void
The `start:` entry point should not return a value. (Warning)

---

## Class Rules

### CLASS001 — Parent Class Must Exist
When a class uses `is ParentName` for inheritance, the parent class must be defined.

### CLASS002 — Duplicate Field in Class
Field names within a class must be unique.

### CLASS003 — Duplicate Method in Class
Method names within a class must be unique.

### CLASS004 — Constructor Must Exist for Instantiation
A class that is instantiated must have a constructor (explicit or implicit).

---

## Index Access Rules

### IDX001 — Array Index Must Be Integer
Array/list bracket access requires an integer index.

### IDX002 — Matrix Index Must Be Integer
Matrix bracket access requires an integer index.

### IDX003 — Pairs Key Must Be String
Pairs/map bracket access requires a string key.

### IDX004 — Cannot Index Non-Indexable Type
Only list, matrix, pairs, and any types support bracket access.

---

## State Rules

### STATE001 — Guard Condition Must Be Pure Boolean

A guard expression on a state variable is not a pure boolean expression, or contains side effects.

**Condition:** The expression after `guard` must be a pure boolean expression.
It may reference `value` (the proposed new value) and any currently-in-scope
identifiers, but must not contain side-effecting operations such as function
calls that perform I/O or mutate state.

**Example (fails — STATE001):**
```clean
state:
    integer count = 0
        guard print("checking") else "no side effects allowed"
```

**Message:** `"Guard condition must be a pure boolean expression"`

**Runtime behavior:** If the guard condition evaluates to `false` at runtime,
the state update is rejected and the state variable retains its previous value.
The error message from the `else` clause is reported (STATE002).

### STATE002 — Guard Rejection (Runtime)

A state update is rejected at runtime because a guard condition evaluated to false.

**Condition:** This is a runtime rule, not a compile-time error. It is raised
when an assignment to a guarded state variable evaluates the guard expression
and receives `false`.

**Example (triggers — STATE002 at runtime):**
```clean
state:
    integer count = 0
        guard value >= 0 else "Count cannot be negative"

functions:
    void decrement()
        count = count - 1    // runtime rejection if count is already 0
```

**Message:** `"State update rejected: {guard_message}"`

### STATE003 — Computed State Return Type Must Match

The body of a computed state declaration must produce a value matching the declared type.

**Applies to:**
- The last expression (or explicit `return`) in a computed state body must be
  assignable to the computed variable's declared type.
- Circular dependencies between computed state variables are also detected here.

**Example (fails — STATE003, type mismatch):**
```clean
state:
    computed:
        integer total    // declared integer
            return "not an integer"    // error: string is not assignable to integer
```

**Example (fails — STATE003, circular dependency):**
```clean
state:
    computed:
        string a
            return b    // a depends on b
        string b
            return a    // b depends on a — circular
```

**Message (type mismatch):** `"Computed state '{name}' body returns {actual_type}, expected {declared_type}"`

**Message (circular dependency):** `"Circular dependency in computed state: '{name}' depends on itself"`

### STATE004 — Computed State Assignment

Code attempts to assign a value directly to a computed state variable.

**Condition:** Computed state is read-only. Any assignment statement whose
left-hand side is a computed state variable is rejected at compile time.

**Example (fails — STATE004):**
```clean
state:
    string firstName = ""
    string lastName = ""
    computed:
        string fullName
            return firstName + " " + lastName

functions:
    void badAssign()
        fullName = "Alice Smith"    // error: fullName is computed, cannot assign
```

**Message:** `"Cannot assign to computed state variable '{name}': it is read-only"`

### STATE005 — Rules Expression Must Be Boolean

An expression inside a `state: rules:` block does not evaluate to a boolean.

**Condition:** Every expression listed under `rules:` must be a boolean
expression. Non-boolean expressions (e.g., integer arithmetic with no
comparison) are a compile-time error.

**Example (fails — STATE005):**
```clean
state:
    integer count = 0

    rules:
        count + 1    // error: not a boolean expression
```

**Message:** `"State rule expression must be a boolean expression, got {type}"`

---

## Import Rules

### IMPORT001 — Circular Dependency
Modules cannot have circular import dependencies.

### IMPORT002 — Module Not Found
The imported module does not exist in any search path.

### IMPORT003 — Symbol Not Found in Module
The specific symbol imported from a module is not exported by that module.

### IMPORT004 — Duplicate Import Item
The same item appears more than once in an import list.

---

## Plugin Rules

### PLUGIN001 — Plugin Not Found
A referenced plugin is not installed. Install with `cleen plugin add <name>`.

### PLUGIN002 — Plugin Registration Conflict
A plugin attempts to register a function or block handler that conflicts with an existing registration.

---

## Compilation Rules (COM)

### COM001 — WASM Generation Error
The code generator failed to produce valid WASM for a construct.

### COM002 — Optimization Error
An optimization pass produced invalid code.

### COM003 — Memory Layout Error
Memory allocation or layout calculation failed.

### COM004 — Module Resolution Error
Multi-file compilation failed to resolve module dependencies.

### COM005 — Target-Specific Error
The compilation target does not support a required feature.

### COM006 — Function Not Found During Compilation
A function that passed semantic analysis could not be located during code generation.

---

## Runtime Rules (RUN)

### RUN001 — Memory Violation
WASM execution attempted to access memory outside allocated bounds.

### RUN002 — Stack Error
WASM stack overflow or underflow during execution.

### RUN003 — Arithmetic Error
Division by zero or other invalid arithmetic operation at runtime.

### RUN004 — Reference Error
A null or invalid reference was accessed at runtime.

### RUN005 — Assertion Failure
A `require` statement evaluated to false at runtime.
