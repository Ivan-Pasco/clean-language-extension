# /feature-status — Feature Completion Tracking

Track completion status of language features against the spec.

## Usage
- `/feature-status` — full feature status report
- `/feature-status classes` — status of a specific feature area

## Instructions

1. **Read `foundation/spec/grammar.ebnf`** and extract major feature areas:
   - Variables and assignments
   - Types (integer, number, string, boolean, list, matrix, pairs)
   - Expressions and operators
   - Control flow (if/else, while, for, match)
   - Functions (declaration, calls, recursion)
   - Classes (fields, methods, inheritance, constructors)
   - Modules and imports
   - Error handling (onError)
   - Async operations
   - Plugin blocks (endpoints, data, component, auth, canvas)

2. **For each feature, check completion stage** (Principle 16):
   - **Spec'd**: Defined in grammar.ebnf
   - **Parsed**: Compiler can parse it without errors
   - **Type-checked**: Semantic analysis passes
   - **Compiled**: WASM generation succeeds
   - **Executed**: Runtime produces correct output
   - **Tested**: Has a passing test in tests/cln/

3. **Report as a matrix:**
   ```
   Feature          | Spec | Parse | Type | Codegen | Execute | Test
   -----------------+------+-------+------+---------+---------+-----
   Variables        |  Y   |   Y   |  Y   |    Y    |    Y    |  Y
   If/Else          |  Y   |   Y   |  Y   |    Y    |    ?    |  N
   Classes          |  Y   |   Y   |  P   |    P    |    N    |  N
   ```
   (Y=yes, P=partial, N=no, ?=unknown)

4. **Highlight** features that are spec'd but not yet implemented.
