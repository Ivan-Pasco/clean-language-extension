# Clean Language AST Reference

**Authority:** This file is the 1:1 reference for every public type in `src/ast/mod.rs`.
**Version:** 1.0.0
**Date:** 2026-04-19
**Source:** `clean-language-compiler/src/ast/mod.rs`

This document is the primary reference for compiler contributors and AI agents who need to understand or produce Clean Language AST nodes. It is kept in strict parity with the Rust source. When the two diverge, the Rust source is authoritative for behavior; this document should be updated to match.

Cross-references use the following notation:
- Grammar rules: `grammar.ebnf §N.N`
- Semantic rules: `semantic-rules.md §RULE`
- Type system: `type-system.md §N`

---

## 1. Program Structure

### Program

The root node of every compiled file. Produced by the `program` production in `grammar.ebnf §6`.

**Rust type:** `struct Program`

| Field | Type | Description |
|-------|------|-------------|
| `imports` | `Vec<ImportItem>` | Top-level import declarations |
| `plugins` | `Vec<String>` | Framework plugin names declared in the file (e.g., `"frame.ui"`, `"frame.data"`) |
| `statements` | `Vec<Statement>` | All top-level statements not captured by the dedicated fields below |
| `functions` | `Vec<Function>` | Functions declared in the top-level `functions:` block |
| `classes` | `Vec<Class>` | Class declarations |
| `start_function` | `Option<Function>` | The `start:` entry point, if present |
| `tests` | `Vec<TestCase>` | Top-level `tests:` block entries |
| `screens` | `Vec<Screen>` | Clean UI screen declarations (legacy form) |
| `state` | `Option<StateBlock>` | App-level `state:` block |
| `watch_blocks` | `Vec<WatchBlock>` | Top-level `watch` observers |
| `screen_blocks` | `Vec<Statement>` | Screen blocks that carry their own state scope (stored as `Statement::ScreenBlockStmt`) |
| `externals` | `Vec<ExternalFunction>` | External function declarations from `external:` blocks |
| `source_block` | `Option<Statement>` | AI metadata `source:` block, if present |
| `location` | `Option<SourceLocation>` | Source position of the file |

**Example:**
```clean
import:
	Math

start:
	print("Hello")
```

---

### SourceLocation

Carries the source position of an AST node for error reporting and debugging.

**Rust type:** `struct SourceLocation`

| Field | Type | Description |
|-------|------|-------------|
| `line` | `usize` | 1-based line number |
| `column` | `usize` | 1-based column number |
| `file` | `String` | Source file path |
| `byte_start` | `Option<usize>` | Byte offset of span start (optional) |
| `byte_end` | `Option<usize>` | Byte offset of span end (optional) |

`SourceLocation` implements `Display` as `file:line:column`.

---

## 2. Types

### Type

Represents a type annotation anywhere in Clean Language source. Covers all forms allowed by `grammar.ebnf §2`.

**Rust type:** `enum Type`

| Variant | Fields | Grammar rule | Description |
|---------|--------|--------------|-------------|
| `Boolean` | — | `core_type` | The `boolean` type |
| `Integer` | — | `core_type` | Unqualified `integer` (equivalent to `integer:32`) |
| `Number` | — | `core_type` | Unqualified `number` (equivalent to `number:64`) |
| `String` | — | `core_type` | The `string` type |
| `Void` | — | `core_type` | The `void` return type |
| `Null` | — | — | Represents the `null` value type |
| `Any` | — | `core_type` | The `any` escape-hatch type |
| `IntegerSized` | `bits: u8`, `unsigned: bool` | `sized_type` | Precision-qualified integer: `integer:8`, `integer:64u`, etc. |
| `NumberSized` | `bits: u8` | `sized_type` | Precision-qualified float: `number:32`, `number:64` |
| `List` | `Box<Type>` | `list_type` | `list<T>` |
| `Matrix` | `Box<Type>` | `matrix_type` | `matrix<T>` |
| `Pairs` | `Box<Type>`, `Box<Type>` | `pairs_type` | `pairs<K, V>` |
| `Generic` | `Box<Type>`, `Vec<Type>` | `generic_type` | User-defined generic: `Container<T>` |
| `TypeParameter` | `String` | `type_parameter` | A bare generic parameter name, e.g. `T` |
| `Object` | `String` | `identifier` | An unresolved named type (a class name before resolution) |
| `Class` | `name: String`, `type_args: Vec<Type>` | `class_name` | A resolved class type with optional type arguments |
| `Function` | `Vec<Type>`, `Box<Type>` | — | Function type: parameter types + return type |
| `Future` | `Box<Type>` | — | Background/async result type: `Future<T>` |

`Type` implements `Display`, which renders the type back to its Clean Language source form (e.g., `list<integer>`, `integer:64u`).

**Example:**
```clean
list<integer> scores = [1, 2, 3]
pairs<string, number> rates = {"USD": 1.0}
```

---

### ListBehavior

Specifies the runtime behavioral mode of a list. Applied as a dot-suffix on `list<T>` type annotations (grammar.ebnf `list_behavior`).

**Rust type:** `enum ListBehavior`

| Variant | Syntax | Behavior |
|---------|--------|----------|
| `Default` | *(none)* | Ordered list, duplicates allowed |
| `Line` | `.line` | FIFO queue |
| `Pile` | `.pile` | LIFO stack |
| `Unique` | `.unique` | Set — no duplicates |
| `LinePile` | `.line.pile` | Combined FIFO + LIFO |
| `LineUnique` | `.line.unique` | FIFO queue with uniqueness |
| `PileUnique` | `.pile.unique` | LIFO stack with uniqueness |
| `LineUniquePile` | `.line.unique.pile` | All three behaviors combined |

**Example:**
```clean
list<string>.unique tags = ["go", "rust", "clean"]
list<integer>.pile callStack = []
```

---

### PostfixOperator

Postfix operators applied after a primary expression. Defined by `grammar.ebnf §3.4 postfix_primary`.

**Rust type:** `enum PostfixOperator`

| Variant | Syntax | Description |
|---------|--------|-------------|
| `Required` | `expr!` | Non-null assertion. Traps at runtime if the value is null (see `type-system.md §8`). |

---

## 3. Values (Literals)

### Value

Represents a compile-time literal value. Used inside `Expression::Literal`.

**Rust type:** `enum Value`

| Variant | Rust Storage | Grammar rule | Description |
|---------|-------------|--------------|-------------|
| `Integer` | `i64` | `decimal_integer` | Default integer literal |
| `Number` | `f64` | `float_literal` | Default floating-point literal |
| `Boolean` | `bool` | `boolean_literal` | `true` or `false` |
| `String` | `String` | `string_literal` | String literal (without interpolations) |
| `List` | `Vec<Value>` | `list_literal` | List literal |
| `Matrix` | `Vec<Vec<Value>>` | `matrix_literal` | 2D matrix literal |
| `Pairs` | `Vec<(Value, Value)>` | `pairs_literal` | Key-value pairs literal |
| `Null` | — | `null_literal` | The `null` value |
| `Void` | — | — | Returned by void functions |
| `Integer8` | `i8` | `integer_literal` + `:8` | 8-bit signed integer |
| `Integer8u` | `u8` | `integer_literal` + `:8u` | 8-bit unsigned integer |
| `Integer16` | `i16` | `integer_literal` + `:16` | 16-bit signed integer |
| `Integer16u` | `u16` | `integer_literal` + `:16u` | 16-bit unsigned integer |
| `Integer32` | `i32` | `integer_literal` + `:32` | 32-bit signed integer |
| `Integer64` | `i64` | `integer_literal` + `:64` | 64-bit signed integer |
| `Number32` | `f32` | `float_literal` + `:32` | 32-bit float |
| `Number64` | `f64` | `float_literal` + `:64` | 64-bit float |

**Example:**
```clean
integer count = 0
number pi = 3.14159
boolean active = true
string name = "Alice"
list<integer> nums = [1, 2, 3]
pairs<string, integer> ages = {"Alice": 30, "Bob": 25}
```

---

## 4. Expressions

### Expression

The primary expression enum. Every expression in Clean Language maps to one of these variants. See `grammar.ebnf §3`.

**Rust type:** `enum Expression`

---

#### Expression::Literal

A compile-time constant value.

**Grammar rule:** `grammar.ebnf §1.4–1.7` (all literal productions)

| Field | Type | Description |
|-------|------|-------------|
| `0` | `Value` | The literal value |

**Example:**
```clean
42
"hello"
true
[1, 2, 3]
```

---

#### Expression::Variable

A reference to a declared variable or parameter by name.

**Grammar rule:** `grammar.ebnf §1.3 identifier`

| Field | Type | Description |
|-------|------|-------------|
| `0` | `String` | The variable name |

**Example:**
```clean
count
userName
```

---

#### Expression::Binary

A binary operator applied to two sub-expressions.

**Grammar rule:** `grammar.ebnf §3.3` (all operator levels)

| Field | Type | Description |
|-------|------|-------------|
| `0` | `Box<Expression>` | Left operand |
| `1` | `BinaryOperator` | The operator |
| `2` | `Box<Expression>` | Right operand |

**Example:**
```clean
a + b
x > 0 and y < 10
value default 0
```

---

#### Expression::Unary

A prefix unary operator applied to an expression.

**Grammar rule:** `grammar.ebnf §3.3 unary_expression`

| Field | Type | Description |
|-------|------|-------------|
| `0` | `UnaryOperator` | The operator |
| `1` | `Box<Expression>` | The operand |

**Example:**
```clean
not active
-count
```

---

#### Expression::Postfix

A postfix operator applied after a primary expression.

**Grammar rule:** `grammar.ebnf §3.4 postfix_primary`

| Field | Type | Description |
|-------|------|-------------|
| `operand` | `Box<Expression>` | The expression the operator is applied to |
| `operator` | `PostfixOperator` | The postfix operator (currently only `Required`) |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
getText()!
user.name!.toUpperCase()
```

---

#### Expression::Call

A direct function call by name.

**Grammar rule:** `grammar.ebnf §3.5 function_call`

| Field | Type | Description |
|-------|------|-------------|
| `0` | `String` | The function name |
| `1` | `Vec<Expression>` | The argument list |

**Example:**
```clean
add(1, 2)
toString(42)
```

---

#### Expression::NamespaceCall

A call to a function in a named namespace (`math.sqrt()`, `string.length()`).

**Grammar rule:** `grammar.ebnf §3.5 namespace_function_call`

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `String` | The namespace identifier (e.g., `"math"`, `"file"`) |
| `function` | `String` | The function name within the namespace |
| `arguments` | `Vec<Expression>` | The argument list |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
math.sqrt(16.0)
file.read("/etc/hosts")
```

---

#### Expression::PropertyAccess

Dot-notation access to a field on an object.

**Grammar rule:** `grammar.ebnf §3.6 property_access`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Box<Expression>` | The object being accessed |
| `property` | `String` | The property name |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
user.name
response.status
```

---

#### Expression::PropertyAssignment

Assignment to a property via dot notation (used internally by the assignment lowering pass).

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Box<Expression>` | The object whose property is being set |
| `property` | `String` | The property name |
| `value` | `Box<Expression>` | The new value |
| `location` | `SourceLocation` | Source position |

---

#### Expression::ListAssignment

Assignment to a list element by index (used internally by the assignment lowering pass).

| Field | Type | Description |
|-------|------|-------------|
| `list` | `Box<Expression>` | The list expression |
| `index` | `Box<Expression>` | The index expression |
| `value` | `Box<Expression>` | The new value |
| `location` | `SourceLocation` | Source position |

---

#### Expression::MethodCall

A single method call on an expression receiver.

**Grammar rule:** `grammar.ebnf §3.5 method_call`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `Box<Expression>` | The receiver expression |
| `method` | `String` | The method name |
| `arguments` | `Vec<Expression>` | The argument list |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
name.toUpperCase()
items.length()
```

---

#### Expression::ChainedMethodCall

One or more method calls chained on a receiver (function call, property access, or identifier).

**Grammar rule:** `grammar.ebnf §3.5 chained_method_call`

| Field | Type | Description |
|-------|------|-------------|
| `receiver` | `Box<Expression>` | The starting expression |
| `chain` | `Vec<(String, Vec<Expression>)>` | Ordered list of `(method_name, args)` pairs |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
getName().trim().toUpperCase()
```

---

#### Expression::MultipleMethodCall

Structurally identical to `ChainedMethodCall` but produced by the `multiple_method_call` grammar rule (two or more `.method()` segments on a base receiver). Kept as a distinct variant to preserve spec fidelity; both map to the same WASM codegen path.

**Grammar rule:** `grammar.ebnf §3.5 multiple_method_call`

| Field | Type | Description |
|-------|------|-------------|
| `receiver` | `Box<Expression>` | The base receiver |
| `chain` | `Vec<(String, Vec<Expression>)>` | Two or more `(method_name, args)` pairs |
| `location` | `SourceLocation` | Source position |

---

#### Expression::ThreeLevelMethodCall

A call of the form `a.b.method(args)` where all three parts are identifiers.

**Grammar rule:** `grammar.ebnf §3.5 three_level_method_call`

| Field | Type | Description |
|-------|------|-------------|
| `first` | `String` | First identifier |
| `second` | `String` | Second identifier |
| `method` | `String` | Method name |
| `arguments` | `Vec<Expression>` | Argument list |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
user.profile.getName()
```

---

#### Expression::PropertyMethodCall

A property chain of three or more identifiers ending in a method call.

**Grammar rule:** `grammar.ebnf §3.5 property_method_call`

| Field | Type | Description |
|-------|------|-------------|
| `object` | `String` | Root object name |
| `path` | `Vec<String>` | Intermediate property segments (may be empty for three-level case) |
| `method` | `String` | The final method name |
| `arguments` | `Vec<Expression>` | Argument list |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
app.config.database.getConnection()
```

---

#### Expression::StaticMethodCall

A call on a static class or namespace (e.g., `Math.sqrt()`, `StringUtils.trim()`).

**Grammar rule:** `grammar.ebnf §3.5 static_method_call`

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `Vec<String>` | Outer namespace segments (empty for two-level calls like `Math.sqrt`) |
| `class_name` | `String` | The class/namespace name |
| `method` | `String` | The method name |
| `arguments` | `Vec<Expression>` | Argument list |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
Math.sqrt(16.0)
StringUtils.trim(name)
```

---

#### Expression::ListAccess

Bracket access on a list or any indexable value.

**Grammar rule:** `grammar.ebnf §3.6 list_access`

| Field | Type | Description |
|-------|------|-------------|
| `0` | `Box<Expression>` | The collection expression |
| `1` | `Box<Expression>` | The index expression (must be `integer`) |

**Example:**
```clean
items[0]
scores[i]
```

---

#### Expression::MatrixAccess

Double-bracket access on a matrix.

**Grammar rule:** `grammar.ebnf §3.6 list_access` (nested)

| Field | Type | Description |
|-------|------|-------------|
| `0` | `Box<Expression>` | The matrix expression |
| `1` | `Box<Expression>` | The row index |
| `2` | `Box<Expression>` | The column index |

**Example:**
```clean
grid[row][col]
```

---

#### Expression::StringInterpolation

A string literal that contains one or more `{expression}` interpolations.

**Grammar rule:** `grammar.ebnf §1.6 string_literal` (when parts contain `string_interpolation`)

| Field | Type | Description |
|-------|------|-------------|
| `0` | `Vec<StringPart>` | Ordered sequence of text and expression parts |

**Example:**
```clean
"Hello, {name}! You have {count} messages."
```

---

#### Expression::ObjectCreation

Constructor call to instantiate a class.

**Grammar rule:** `grammar.ebnf §3.5 constructor_call`

| Field | Type | Description |
|-------|------|-------------|
| `class_name` | `String` | The class to instantiate |
| `arguments` | `Vec<Expression>` | Constructor arguments |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
User("Alice", 30)
Point(0, 0)
```

---

#### Expression::OnError

Inline error recovery: evaluates the main expression and returns the fallback if it raises.

**Grammar rule:** `grammar.ebnf §3.3 on_error_expression`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Box<Expression>` | The expression to evaluate |
| `fallback` | `Box<Expression>` | Value to use if the expression errors |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
parseNumber(input) onError 0
```

---

#### Expression::OnErrorBlock

Error recovery with a full statement block handler.

**Grammar rule:** `grammar.ebnf §3.3 on_error_block`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Box<Expression>` | The expression to evaluate |
| `error_handler` | `Vec<Statement>` | Statements to execute if the expression errors |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
readFile(path) onError:
	print("File not found")
	""
```

---

#### Expression::ErrorVariable

References the implicit `error` variable inside an `onError` handler block.

**Grammar rule:** `grammar.ebnf §3.4 primary` → `"error"`

| Field | Type | Description |
|-------|------|-------------|
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
fetch(url) onError:
	print(error)
```

---

#### Expression::Conditional

Inline ternary: `if condition then value else value`.

**Grammar rule:** `grammar.ebnf §3.3 conditional_expression`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Box<Expression>` | The boolean condition |
| `then_expr` | `Box<Expression>` | Value when condition is true |
| `else_expr` | `Box<Expression>` | Value when condition is false |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
if x > 0 then "positive" else "non-positive"
```

---

#### Expression::BaseCall

Call to the parent class constructor from within a constructor body.

**Grammar rule:** `grammar.ebnf §3.5 base_call`

| Field | Type | Description |
|-------|------|-------------|
| `arguments` | `Vec<Expression>` | Arguments forwarded to the parent constructor |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
class Dog is Animal
	constructor(string name)
		base(name)
```

---

#### Expression::StartExpression

Launches an expression asynchronously in the background.

**Grammar rule:** `grammar.ebnf §3.5 start_expression`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Box<Expression>` | The expression to start |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
start fetchData(url)
```

---

#### Expression::LaterAssignment

Assigns a value to a variable after an async expression completes.

**Grammar rule:** `grammar.ebnf §4.9 later_assignment`

| Field | Type | Description |
|-------|------|-------------|
| `variable` | `String` | The variable to assign to |
| `expression` | `Box<Expression>` | The async expression |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
later result = fetchData(url)
```

---

#### Expression::Input

Console input prompt expression.

**Grammar rule:** `grammar.ebnf §3.5 input_expression`

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | `Option<String>` | The prompt string (if known at compile time) |
| `input_type` | `InputType` | Expected input type |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
string name = input("Enter your name: ")
integer age = input.integer("Enter your age: ")
```

---

#### Expression::Range

A range expression used in iterate statements.

**Grammar rule:** `grammar.ebnf §3.3 range_expression`

| Field | Type | Description |
|-------|------|-------------|
| `start` | `Box<Expression>` | Start of the range |
| `end` | `Box<Expression>` | End of the range |
| `inclusive` | `bool` | Whether the end value is included (keyword `inclusive`) |
| `location` | `SourceLocation` | Source position |

**Example:**
```clean
iterate i in 1 to 10
iterate i in 1 to 10 inclusive
```

---

### BinaryOperator

All binary operators supported by Clean Language. The operator appears as the middle field of `Expression::Binary`.

**Rust type:** `enum BinaryOperator`

| Variant | Clean syntax | Category |
|---------|-------------|----------|
| `Add` | `+` | Arithmetic |
| `Subtract` | `-` | Arithmetic |
| `Multiply` | `*` | Arithmetic |
| `Divide` | `/` | Arithmetic |
| `Modulo` | `%` | Arithmetic |
| `Power` | `^` | Arithmetic (right-associative) |
| `Equal` | `==` | Comparison |
| `NotEqual` | `!=` | Comparison |
| `Less` | `<` | Comparison |
| `Greater` | `>` | Comparison |
| `LessEqual` | `<=` | Comparison |
| `GreaterEqual` | `>=` | Comparison |
| `Is` | `is` | Type/identity check |
| `Not` | `not` (binary context) | Logical |
| `And` | `and` | Logical |
| `Or` | `or` | Logical |
| `Default` | `default` | Null coalescing |

Grammar reference: `grammar.ebnf §3.2`.

---

### UnaryOperator

Prefix unary operators. Applied as the first field of `Expression::Unary`.

**Rust type:** `enum UnaryOperator`

| Variant | Clean syntax | Description |
|---------|-------------|-------------|
| `Negate` | `-` | Arithmetic negation |
| `Not` | `not` | Logical complement |

Grammar reference: `grammar.ebnf §3.2 unary_op`.

---

### StringPart

A single segment of a string interpolation. Strings with no interpolations produce a single `Text` part; strings with `{expr}` placeholders produce interleaved `Text` and `Interpolation` parts.

**Rust type:** `enum StringPart`

| Variant | Fields | Description |
|---------|--------|-------------|
| `Text` | `String` | A literal text segment |
| `Interpolation` | `Expression` | An embedded expression |

Grammar reference: `grammar.ebnf §1.6 string_part`.

---

### InputType

Specifies what type of value a console `input()` expression returns.

**Rust type:** `enum InputType`

| Variant | Clean syntax | Returns |
|---------|-------------|---------|
| `String` | `input("prompt")` | `string` |
| `Integer` | `input.integer("prompt")` | `integer` |
| `Number` | `input.number("prompt")` | `number` |
| `Boolean` | `input.yesNo("prompt")` | `boolean` |

---

## 5. Statements

### Statement

Every statement in Clean Language maps to one of these variants. See `grammar.ebnf §4`.

**Rust type:** `enum Statement`

---

#### Statement::Require

A precondition assertion that must be true at runtime. Can only appear inside functions or class methods. Always checked regardless of build configuration.

**Grammar rule:** `grammar.ebnf §4.8 require_statement`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Expression` | The boolean expression that must be true |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
require age >= 0
require name.isNotEmpty()
```

---

#### Statement::VariableDecl

A typed variable declaration with an optional initializer.

**Grammar rule:** `grammar.ebnf §4.1 variable_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | The variable name |
| `type_` | `Type` | The declared type |
| `initializer` | `Option<Expression>` | The initial value expression |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
integer count = 0
string name
list<number> values = [1.0, 2.5]
```

---

#### Statement::FunctionsBlock

A `functions:` block containing one or more function declarations.

**Grammar rule:** `grammar.ebnf §6.2 functions_block`

| Field | Type | Description |
|-------|------|-------------|
| `functions` | `Vec<Function>` | The declared functions |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::TypeApplyBlock

An apply block that assigns values to typed variables in batch.

**Grammar rule:** `grammar.ebnf §6.12 type_apply_block`

| Field | Type | Description |
|-------|------|-------------|
| `type_` | `Type` | The type shared by all assignments |
| `assignments` | `Vec<VariableAssignment>` | The variable assignments |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
integer:
	x = 10
	y = 20
```

---

#### Statement::FunctionApplyBlock

An apply block that passes multiple expressions as arguments to a function.

**Grammar rule:** `grammar.ebnf §6.12 function_apply_block`

| Field | Type | Description |
|-------|------|-------------|
| `function_name` | `String` | The function to call for each expression |
| `expressions` | `Vec<Expression>` | The expressions |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
print:
	"First line"
	"Second line"
```

---

#### Statement::MethodApplyBlock

An apply block that calls a method chain on multiple expressions.

**Grammar rule:** `grammar.ebnf §6.12 method_apply_block`

| Field | Type | Description |
|-------|------|-------------|
| `object_name` | `String` | The root object name |
| `method_chain` | `Vec<String>` | The chain of property/method names |
| `expressions` | `Vec<Expression>` | The expressions |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::ConstantApplyBlock

A `constant:` block that declares typed immutable values.

**Grammar rule:** `grammar.ebnf §6.12 constant_apply_block`

| Field | Type | Description |
|-------|------|-------------|
| `constants` | `Vec<ConstantAssignment>` | The constant declarations |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
constant:
	number PI = 3.14159
	integer MAX_SIZE = 100
```

---

#### Statement::Assignment

An assignment to a variable, list index, or object property.

**Grammar rule:** `grammar.ebnf §4.2 assignment`

| Field | Type | Description |
|-------|------|-------------|
| `target` | `AssignmentTarget` | The assignment target |
| `value` | `Expression` | The new value |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
count = count + 1
items[0] = "first"
user.name = "Alice"
```

---

#### Statement::Print

A single `print()` statement.

**Grammar rule:** `grammar.ebnf §4.4 print_parenthesized_statement`, `print_newline_statement`, `print_bare_statement`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | The value to print |
| `newline` | `bool` | Whether to append a newline (`print(...) +` syntax) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
print("Hello")
print("Hello") +
print "Hello"
```

---

#### Statement::PrintBlock

A `print:` block that prints multiple expressions, each on its own line.

**Grammar rule:** `grammar.ebnf §4.4 print_block_statement`

| Field | Type | Description |
|-------|------|-------------|
| `expressions` | `Vec<Expression>` | The expressions to print |
| `newline` | `bool` | Whether each line has a trailing newline (always `true` for block form) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
print:
	"Name: " + name
	"Age: " + age.toString()
```

---

#### Statement::Return

A return statement, with or without a value.

**Grammar rule:** `grammar.ebnf §4.3 return_statement`

| Field | Type | Description |
|-------|------|-------------|
| `value` | `Option<Expression>` | The return value; `None` for bare `return` |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
return result
return
```

---

#### Statement::Break

Exits the innermost loop.

**Grammar rule:** `grammar.ebnf §4.6 break_statement`

| Field | Type | Description |
|-------|------|-------------|
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Continue

Skips to the next iteration of the innermost loop.

**Grammar rule:** `grammar.ebnf §4.6 continue_statement`

| Field | Type | Description |
|-------|------|-------------|
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::If

Conditional branching with an optional else clause.

**Grammar rule:** `grammar.ebnf §4.6 if_statement`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Expression` | The condition to test |
| `then_branch` | `Vec<Statement>` | Statements to execute when true |
| `else_branch` | `Option<Vec<Statement>>` | Statements to execute when false (may begin with another `If` for `else if`) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
if count > 0
	print("positive")
else
	print("zero or negative")
```

---

#### Statement::Iterate

A collection `iterate` loop.

**Grammar rule:** `grammar.ebnf §4.6 iterate_statement`

| Field | Type | Description |
|-------|------|-------------|
| `iterator` | `String` | The loop variable name |
| `collection` | `Expression` | The collection to iterate over |
| `body` | `Vec<Statement>` | The loop body |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
iterate item in items
	print(item)
```

---

#### Statement::RangeIterate

A numeric range `iterate` loop with optional step.

**Grammar rule:** `grammar.ebnf §4.6 range_iterate_statement`

| Field | Type | Description |
|-------|------|-------------|
| `iterator` | `String` | The loop variable name |
| `start` | `Expression` | Range start (inclusive) |
| `end` | `Expression` | Range end (exclusive by default) |
| `step` | `Option<Expression>` | Step size; `None` defaults to 1 |
| `body` | `Vec<Statement>` | The loop body |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
iterate i in 1 to 10
iterate i in 0 to 100 step 5
```

---

#### Statement::While

A while loop.

**Grammar rule:** `grammar.ebnf §4.6 while_statement`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Expression` | The loop condition |
| `body` | `Vec<Statement>` | The loop body |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
while running
	processEvent()
```

---

#### Statement::Test

An inline test block (not a top-level `tests:` block).

**Grammar rule:** `grammar.ebnf §6.11 test`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | The test description string |
| `body` | `Vec<Statement>` | The test body |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::TestsBlock

A top-level `tests:` block containing assertion test cases.

**Grammar rule:** `grammar.ebnf §6.11 tests_block`

| Field | Type | Description |
|-------|------|-------------|
| `tests` | `Vec<TestCase>` | The test case list |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Expression

An expression used as a statement (e.g., a function call whose return value is discarded).

**Grammar rule:** `grammar.ebnf §4 statement` → `function_call` | `method_call`

| Field | Type | Description |
|-------|------|-------------|
| `expr` | `Expression` | The expression |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Error

Raises a runtime error with a message.

**Grammar rule:** `grammar.ebnf §4.5 error_statement`

| Field | Type | Description |
|-------|------|-------------|
| `message` | `Expression` | The error message expression |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
error("Value out of range")
```

---

#### Statement::Import

Module or file import.

**Grammar rule:** `grammar.ebnf §6.6 import_block` / `import_statement`

| Field | Type | Description |
|-------|------|-------------|
| `imports` | `Vec<ImportItem>` | The items to import |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::LaterAssignment

Assigns the resolved value of a background expression to a variable.

**Grammar rule:** `grammar.ebnf §4.9 later_assignment`

| Field | Type | Description |
|-------|------|-------------|
| `variable` | `String` | Target variable name |
| `expression` | `Expression` | The async expression |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Background

Fires an expression in the background without waiting for its result.

**Grammar rule:** `grammar.ebnf §4.9 background_statement`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | The expression to run asynchronously |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::OnErrorBlock

Attaches an error handler block to an expression statement.

**Grammar rule:** `grammar.ebnf §3.3 on_error_block`

| Field | Type | Description |
|-------|------|-------------|
| `expression` | `Expression` | The expression that may raise |
| `error_block` | `Vec<Statement>` | Statements executed on error |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::PrivateBlock

Declares identifiers or functions as private to the module.

**Grammar rule:** `grammar.ebnf §6.7 private_block`

| Field | Type | Description |
|-------|------|-------------|
| `items` | `Vec<Statement>` | The private declarations |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::StandaloneErrorHandler

A top-level `onError:` handler that applies to the preceding statements.

**Grammar rule:** `grammar.ebnf §4.7 standalone_on_error`

| Field | Type | Description |
|-------|------|-------------|
| `body` | `Vec<Statement>` | The error handler body |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::ClassDefinition

A class declaration embedded as a statement.

**Grammar rule:** `grammar.ebnf §6.4 class_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `class` | `Class` | The class definition |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Description

A `description` metadata string associated with a function.

**Grammar rule:** `grammar.ebnf §6.3 description_block`

| Field | Type | Description |
|-------|------|-------------|
| `text` | `String` | The description text |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Spec

AI metadata: links a function to a specification document.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `String` | Path to the specification document |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::Intent

AI metadata: describes a function's purpose in natural language.

| Field | Type | Description |
|-------|------|-------------|
| `description` | `String` | Natural language description |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::SourceBlock

Top-level AI metadata block that marks the file as generated from a specification.

| Field | Type | Description |
|-------|------|-------------|
| `spec_path` | `String` | Path to the specification |
| `version` | `Option<String>` | Optional version string |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::BuildBlock

Top-level build configuration block. Controls compiler behavior such as rules checking.

| Field | Type | Description |
|-------|------|-------------|
| `rules_enabled` | `Expression` | Whether state rules checking is enabled (`true`, `false`, or `"development"`) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
build:
	rules = "development"
```

---

#### Statement::FrameworkBlock

A raw DSL block produced by a plugin extension point. The compiler stores the block name and raw text content, then passes it to the registered plugin for expansion before HIR transformation.

**Grammar rule:** `grammar.ebnf §6.13 framework_block`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | The block identifier (e.g., `"endpoints"`, `"data"`, `"component"`) |
| `content` | `String` | The raw unparsed DSL text |
| `attributes` | `Vec<FrameworkAttribute>` | Optional `@attr` annotations preceding the block |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
@auth
endpoints:
	GET /users:
		return json(users)
```

---

#### Statement::ScreenBlock

A Clean UI `screen` definition with its own state scope.

**Grammar rule:** `grammar.ebnf §6.10 screen_block`

| Field | Type | Description |
|-------|------|-------------|
| `screen` | `Screen` | The parsed screen definition |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::UiBlock

A UI widget used as a statement (typically inside event handler bodies or screen render sections).

| Field | Type | Description |
|-------|------|-------------|
| `node` | `Box<UiNode>` | The UI node (boxed to break the recursive cycle with `UiNode::ExpressionStatement`) |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::StateBlockStmt

A `state:` block declaring persistent state variables.

**Grammar rule:** `grammar.ebnf §6.8 state_block`

| Field | Type | Description |
|-------|------|-------------|
| `state_block` | `StateBlock` | The state block definition |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::WatchBlockStmt

A `watch` block that reacts to state changes.

**Grammar rule:** `grammar.ebnf §6.9 watch_block`

| Field | Type | Description |
|-------|------|-------------|
| `watch_block` | `WatchBlock` | The watch block definition |
| `location` | `Option<SourceLocation>` | Source position |

---

#### Statement::ResetStmt

Resets one or all state variables to their initial values.

**Grammar rule:** `grammar.ebnf §4.8 reset_statement`

| Field | Type | Description |
|-------|------|-------------|
| `target` | `ResetTarget` | What to reset |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
reset count
reset state
```

---

#### Statement::ScreenBlockStmt

A `screen` block that carries its own state scope and associated functions.

**Grammar rule:** `grammar.ebnf §6.10 screen_block`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Screen name |
| `state` | `Option<StateBlock>` | Screen-local state |
| `watch_blocks` | `Vec<WatchBlock>` | Screen-local watch observers |
| `functions` | `Vec<Function>` | Screen-local functions |
| `location` | `Option<SourceLocation>` | Source position |

---

## 6. Functions and Parameters

### Function

A function declaration. Used for top-level functions, class methods, and the `start` entry point.

**Rust type:** `struct Function`

**Grammar rule:** `grammar.ebnf §6.2 function_in_block`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Function name |
| `type_parameters` | `Vec<String>` | Generic type parameter names |
| `type_constraints` | `Vec<TypeConstraint>` | Constraints on type parameters |
| `parameters` | `Vec<Parameter>` | Parameter list |
| `return_type` | `Type` | Declared return type (`Type::Void` for no return) |
| `body` | `Vec<Statement>` | Function body |
| `description` | `Option<String>` | Optional `description` metadata |
| `syntax` | `FunctionSyntax` | How this function was syntactically defined |
| `visibility` | `Visibility` | Public or private |
| `modifier` | `FunctionModifier` | None or Background |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
functions:
	integer add(integer a, integer b)
		return a + b
```

---

### FunctionSyntax

Distinguishes between the different syntactic forms a function can take.

**Rust type:** `enum FunctionSyntax`

| Variant | Description |
|---------|-------------|
| `Simple` | Declared with `function returnType name()` |
| `Detailed` | Declared with `description` or `input` sub-blocks |
| `Block` | Declared inside a `functions:` block |
| `Standalone` | The `start:` entry point |
| `Background` | Declared with the `background` modifier |

---

### FunctionModifier

Modifiers that change function execution semantics.

**Rust type:** `enum FunctionModifier`

| Variant | Description |
|---------|-------------|
| `None` | Normal synchronous function |
| `Background` | Executes asynchronously |

---

### Visibility

Access control for functions and fields.

**Rust type:** `enum Visibility`

| Variant | Description |
|---------|-------------|
| `Public` | Accessible from outside the module |
| `Private` | Accessible only within the declaring module (listed in `private:` block) |

---

### Parameter

A function parameter with type, name, and optional default value.

**Rust type:** `struct Parameter`

**Grammar rule:** `grammar.ebnf §6.2 parameter`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Parameter name |
| `type_` | `Type` | Parameter type |
| `default_value` | `Option<Expression>` | Default value expression (evaluated lazily per call; see `semantic-rules.md §SEM`) |

**Example:**
```clean
functions:
	string greet(string name = "World")
		return "Hello, " + name
```

---

### AssignmentTarget

The left-hand side of an assignment statement.

**Rust type:** `enum AssignmentTarget`

**Grammar rule:** `grammar.ebnf §4.2 assignment_target`

| Variant | Fields | Description |
|---------|--------|-------------|
| `Variable` | `String` | Simple variable: `name = value` |
| `Index` | `collection: String`, `index: Box<Expression>` | List element: `list[index] = value` |
| `Property` | `object: String`, `path: Vec<String>` | Property chain: `obj.prop = value` or `obj.a.b = value` |

---

### TypeConstraint

A constraint binding a generic type parameter to a specific type.

**Rust type:** `struct TypeConstraint`

| Field | Type | Description |
|-------|------|-------------|
| `type_parameter` | `String` | The parameter name being constrained |
| `constraint_type` | `Type` | The type the parameter must satisfy |

---

### VariableAssignment

A name-value pair used inside `TypeApplyBlock`.

**Rust type:** `struct VariableAssignment`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Variable name |
| `initializer` | `Option<Expression>` | Value expression |

---

### ConstantAssignment

A typed constant declaration used inside `ConstantApplyBlock`.

**Rust type:** `struct ConstantAssignment`

| Field | Type | Description |
|-------|------|-------------|
| `type_` | `Type` | The constant's type |
| `name` | `String` | The constant name |
| `value` | `Expression` | The constant value |

---

## 7. Classes

### Class

A class declaration with optional inheritance, fields, methods, and constructor.

**Rust type:** `struct Class`

**Grammar rule:** `grammar.ebnf §6.4 class_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Class name (must start with uppercase) |
| `type_parameters` | `Vec<String>` | Generic type parameter names |
| `description` | `Option<String>` | Optional documentation string |
| `base_class` | `Option<String>` | Parent class name (`is ParentName`) |
| `base_class_type_args` | `Vec<Type>` | Type arguments for the parent class |
| `fields` | `Vec<Field>` | Instance field declarations |
| `methods` | `Vec<Function>` | Method declarations |
| `constructor` | `Option<Constructor>` | Constructor definition |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
class Animal
	string name
	integer age

	constructor(string name, integer age)
		this.name = name
		this.age = age

	functions:
		string describe()
			return name + " is " + age.toString()

class Dog is Animal
	string breed

	constructor(string name, integer age, string breed)
		base(name, age)
		this.breed = breed
```

---

### Field

An instance field declaration inside a class body.

**Rust type:** `struct Field`

**Grammar rule:** `grammar.ebnf §6.4 class_field`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Field name |
| `type_` | `Type` | Field type |
| `visibility` | `Visibility` | Public or private |
| `is_static` | `bool` | Whether this is a static (class-level) field |
| `default_value` | `Option<Expression>` | Optional default value |

---

### Constructor

The constructor definition of a class.

**Rust type:** `struct Constructor`

**Grammar rule:** `grammar.ebnf §6.4 constructor`

| Field | Type | Description |
|-------|------|-------------|
| `parameters` | `Vec<Parameter>` | Constructor parameters |
| `body` | `Vec<Statement>` | Constructor body (may call `base(...)`) |
| `location` | `Option<SourceLocation>` | Source position |

---

## 8. State Management

### StateBlock

A `state:` block declaring persistent reactive state. App-level state appears at the top level; screen-level state appears inside a `screen:` block.

**Rust type:** `struct StateBlock`

**Grammar rule:** `grammar.ebnf §6.8 state_block`

| Field | Type | Description |
|-------|------|-------------|
| `declarations` | `Vec<StateDeclaration>` | State variable declarations |
| `computed` | `Vec<ComputedDeclaration>` | Computed (derived) state declarations |
| `rules` | `Option<RulesBlock>` | State invariant rules |
| `scope` | `StateScope` | `App` (top-level) or `Screen` (screen-local) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
state:
	integer count = 0
	string message = ""
```

---

### StateScope

Where a state block's variables are visible.

**Rust type:** `enum StateScope`

| Variant | Description |
|---------|-------------|
| `App` | Application lifetime; visible everywhere |
| `Screen` | Screen lifetime; visible only within the declaring `screen:` block (see `semantic-rules.md §SCOPE005`) |

---

### StateDeclaration

An individual state variable with type, initial value, and optional guard.

**Rust type:** `struct StateDeclaration`

**Grammar rule:** `grammar.ebnf §6.8 state_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Variable name |
| `type_` | `Type` | Declared type |
| `initializer` | `Expression` | Initial value (required for state variables) |
| `guard` | `Option<GuardClause>` | Optional validation guard |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
state:
	integer count = 0
		guard value >= 0 else "Count cannot be negative"
```

---

### GuardClause

A validation rule attached to a state variable that rejects invalid mutations at runtime.

**Rust type:** `struct GuardClause`

**Grammar rule:** `grammar.ebnf §6.8 guard_clause`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Expression` | Boolean predicate (may reference `value` for the proposed new value) |
| `error_message` | `String` | Message emitted when the guard rejects the mutation |
| `location` | `Option<SourceLocation>` | Source position |

Semantic rule: `semantic-rules.md §STATE001`, `§STATE002`.

---

### ComputedDeclaration

A derived state variable whose value is recomputed when its dependencies change.

**Rust type:** `struct ComputedDeclaration`

**Grammar rule:** `grammar.ebnf §6.8 computed_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Variable name |
| `type_` | `Type` | Declared type |
| `body` | `Vec<Statement>` | Statements computing the value (must end with `return`) |
| `location` | `Option<SourceLocation>` | Source position |

Computed state is read-only; assignments raise `semantic-rules.md §STATE004`.

**Example:**
```clean
state:
	string firstName = ""
	string lastName = ""
	computed:
		string fullName
			return firstName + " " + lastName
```

---

### WatchBlock

A reactive observer that runs its body whenever one or more watched state variables change.

**Rust type:** `struct WatchBlock`

**Grammar rule:** `grammar.ebnf §6.9 watch_block`

| Field | Type | Description |
|-------|------|-------------|
| `targets` | `Vec<String>` | State variable names to watch (must reference `state:` variables per `semantic-rules.md §SCOPE004`) |
| `body` | `Vec<Statement>` | Code to execute on change |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
watch count:
	print("Count changed to " + count.toString())

watch (firstName, lastName):
	print("Name changed")
```

---

### ResetTarget

The target of a `reset` statement.

**Rust type:** `enum ResetTarget`

**Grammar rule:** `grammar.ebnf §4.8 reset_statement`

| Variant | Fields | Description |
|---------|--------|-------------|
| `Variable` | `String` | Reset a single named state variable to its initial value |
| `AllState` | — | Reset all state variables in the current scope (`reset state`) |

---

### RulesBlock

A set of boolean invariant expressions declared inside `state:`. All rules are checked according to the `build:` block configuration.

**Rust type:** `struct RulesBlock`

**Grammar rule:** `grammar.ebnf §6.8 rules_block`

| Field | Type | Description |
|-------|------|-------------|
| `rules` | `Vec<Expression>` | Boolean expressions that must always be true |
| `location` | `Option<SourceLocation>` | Source position |

Each expression must evaluate to `boolean` (see `semantic-rules.md §STATE005`).

**Example:**
```clean
state:
	integer count = 0
	integer max = 10

	rules:
		count >= 0
		count <= max
```

---

## 9. Screen and UI

### Screen

A Clean UI screen definition (legacy structured form). Newer code uses `Statement::ScreenBlockStmt`.

**Rust type:** `struct Screen`

**Grammar rule:** `grammar.ebnf §6.10 screen_block`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Screen name |
| `state` | `Option<Vec<StateVariable>>` | Screen-local state variables |
| `body` | `Vec<UiNode>` | UI node tree |
| `location` | `Option<SourceLocation>` | Source position |

---

### StateVariable

A state variable declared inside a legacy `Screen`.

**Rust type:** `struct StateVariable`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Variable name |
| `type_name` | `String` | Type as a string (`"integer"`, `"string"`, etc.) |
| `default_value` | `Option<Expression>` | Initial value |
| `location` | `Option<SourceLocation>` | Source position |

---

### UiNode

A node in the Clean UI widget tree.

**Rust type:** `enum UiNode`

| Variant | Key Fields | Description |
|---------|-----------|-------------|
| `Container` | `kind: UiContainerKind`, `props: UiProps`, `children: Vec<UiNode>` | Layout containers: `ui.column`, `ui.row`, `ui.stack` |
| `Text` | `content: Expression`, `props: UiProps` | Text widget: `ui.text "Hello"` |
| `Button` | `label: Expression`, `props: UiProps`, `events: Vec<UiEvent>` | Button widget: `ui.button "Click"` |
| `TextField` | `props: UiProps`, `events: Vec<UiEvent>` | Single-line text input: `ui.textField` |
| `TextArea` | `props: UiProps`, `events: Vec<UiEvent>` | Multi-line text input: `ui.textArea` |
| `Checkbox` | `props: UiProps`, `events: Vec<UiEvent>` | Checkbox: `ui.checkbox` |
| `Switch` | `props: UiProps`, `events: Vec<UiEvent>` | Toggle switch: `ui.switch` |
| `Select` | `props: UiProps`, `events: Vec<UiEvent>` | Dropdown: `ui.select` |
| `Image` | `props: UiProps` | Image widget: `ui.image` |
| `Divider` | `props: UiProps` | Horizontal divider: `ui.divider` |
| `Card` | `props: UiProps`, `children: Vec<UiNode>` | Card container: `ui.card` |
| `Link` | `props: UiProps`, `events: Vec<UiEvent>` | Link widget: `ui.link` |
| `Spacer` | — | Flexible spacer: `ui.spacer` |
| `Region` | `props: UiProps`, `children: Vec<UiNode>` | Canvas region: `ui.region target "canvas"` |
| `CanvasScene` | `draw: Vec<Statement>`, `events: Vec<UiEvent>` | Canvas scene: `ui.canvasScene` |
| `ForLoop` | `iterator: String`, `collection: Expression`, `body: Vec<UiNode>` | Conditional rendering loop: `for item in items:` |
| `IfBlock` | `condition: Expression`, `then_branch: Vec<UiNode>`, `else_branch: Option<Vec<UiNode>>` | Conditional rendering: `if state.show:` |
| `ExpressionStatement` | `statement: Box<Statement>` | A statement inside a UI event handler (boxed to break the recursive type cycle) |

---

### UiContainerKind

Layout direction for container UI nodes.

**Rust type:** `enum UiContainerKind`

| Variant | Description |
|---------|-------------|
| `Column` | Vertical stacking |
| `Row` | Horizontal stacking |
| `Stack` | Absolute positioned layering |

---

### UiProps

Common visual and behavioral properties shared by all UI widgets.

**Rust type:** `struct UiProps`

All fields are `Option<Expression>` unless noted.

| Field | Description |
|-------|-------------|
| `gap` | Spacing between children |
| `padding` | Inner padding |
| `visible` | Conditional visibility |
| `disabled` | Whether the widget is disabled |
| `label` | Text label |
| `value` | Bound value (for inputs) |
| `placeholder` | Placeholder text |
| `size` | Font or widget size |
| `weight` | Font weight |
| `tone` | Color tone (semantic: `"primary"`, `"danger"`, etc.) |
| `color` | Text or foreground color |
| `background` | Background color |
| `radius` | Border radius |
| `align` | Text or content alignment |
| `justify` | Cross-axis justification |
| `target` | `Option<String>` — Canvas target name (for `Region`) |
| `height` | Explicit height |
| `width` | Explicit width |
| `options` | Options list (for `Select`) |

---

### UiEvent

An event handler attached to a UI widget.

**Rust type:** `struct UiEvent`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Event name (`"onClick"`, `"onChange"`, `"onFocus"`, `"onBlur"`, `"draw"`) |
| `params` | `Vec<String>` | Parameter names injected into the handler body (e.g., `["value"]` for `onChange`, `["dt"]` for `draw`) |
| `body` | `Vec<Statement>` | Handler statements |
| `location` | `Option<SourceLocation>` | Source position |

---

## 10. Top-level Items

### ImportItem

A single item in an `import:` block.

**Rust type:** `struct ImportItem`

**Grammar rule:** `grammar.ebnf §6.6 import_item`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Module name (e.g., `"Math"`, `"math.sqrt"`) or file path (e.g., `"app/data/models.cln"`) |
| `alias` | `Option<String>` | Optional `as` alias |
| `is_file_import` | `bool` | `true` for file path imports (`import "path/to/file.cln"`), `false` for module imports |

**Example:**
```clean
import:
	Math
	math.sqrt as sqrt
	"app/data/models.cln"
```

---

### ExternalFunction

An external host function declared in an `external:` block. These generate WASM `import` entries without a Clean Language implementation.

**Rust type:** `struct ExternalFunction`

**Grammar rule:** `grammar.ebnf §6.5 external_function_declaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Function name as it appears in the WASM import |
| `parameters` | `Vec<Parameter>` | Parameter list |
| `return_type` | `Type` | Return type (`Type::Void` for no return) |
| `module` | `String` | WASM import module name (defaults to `"env"`) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
external "env":
	void _db_query(string sql, string params)
```

---

### TestCase

A single test case inside a `tests:` block.

**Rust type:** `struct TestCase`

**Grammar rule:** `grammar.ebnf §6.11 test_case`

| Field | Type | Description |
|-------|------|-------------|
| `description` | `Option<String>` | Test name; `None` for anonymous tests |
| `test_expression` | `Expression` | The expression under test |
| `expected_value` | `Expression` | The expected value to compare against |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
tests:
	"addition": add(2, 3) = 5
	multiply(3, 4) = 12
```

---

### FrameworkAttribute

An `@attribute` annotation on a framework block.

**Rust type:** `struct FrameworkAttribute`

**Grammar rule:** `grammar.ebnf §6.13 framework_attribute`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Attribute name (e.g., `"auth"`, `"cache"`, `"version"`) |
| `value` | `Option<String>` | Optional string value (e.g., `@default("value")`) |
| `location` | `Option<SourceLocation>` | Source position |

**Example:**
```clean
@version("v2")
@auth
endpoints:
	GET /users:
		return json(users)
```

---

### FrameworkBlock (struct)

The structured form passed to plugins during DSL block expansion. Distinct from `Statement::FrameworkBlock` (which is the statement form); this struct is the value handed to `FrameworkPlugin::expand()`.

**Rust type:** `struct FrameworkBlock`

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Block identifier (`"endpoints"`, `"data"`, `"component"`, etc.) |
| `content` | `String` | Raw unparsed DSL content |
| `attributes` | `Vec<FrameworkAttribute>` | `@attr` annotations |
| `location` | `Option<SourceLocation>` | Source position |

---

### RequireStatement

A standalone `require` precondition struct (used in contract tracking; the statement form is `Statement::Require`).

**Rust type:** `struct RequireStatement`

| Field | Type | Description |
|-------|------|-------------|
| `condition` | `Expression` | The boolean condition that must hold |
| `location` | `Option<SourceLocation>` | Source position |
