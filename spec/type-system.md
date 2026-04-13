# Clean Language Type System

**Authority:** This file is the single source of truth for type compatibility, precision, and conversions (Principle 3).
**Version:** 1.0.0
**Date:** 2026-04-12

---

## 1. Primitive Types

| Type | Description | WASM Representation | Default Value |
|------|-------------|---------------------|---------------|
| `integer` | Signed 32-bit integer | I32 | 0 |
| `number` | 64-bit floating point | F64 | 0.0 |
| `string` | Immutable UTF-8 text | I32 (pointer to `[len:i32][data:u8*]`) | "" |
| `boolean` | True or false | I32 (0=false, non-zero=true) | false |
| `void` | No value (function return only) | — | — |
| `any` | Dynamically typed value | I32 (pointer to `[tag:i32][v1:i32][v2:i32]`) | null |
| `null` | Absent value | I32 (0) | null |

---

## 2. Precision Modifiers

### Integer Precision

| Type | Bits | Range (signed) | Range (unsigned) | WASM |
|------|------|----------------|------------------|------|
| `integer:8` | 8 | -128 to 127 | — | I32 |
| `integer:8u` | 8 | — | 0 to 255 | I32 |
| `integer:16` | 16 | -32,768 to 32,767 | — | I32 |
| `integer:16u` | 16 | — | 0 to 65,535 | I32 |
| `integer:32` | 32 | -2^31 to 2^31-1 | — | I32 |
| `integer:32u` | 32 | — | 0 to 2^32-1 | I32 |
| `integer:64` | 64 | -2^63 to 2^63-1 | — | I64 |
| `integer:64u` | 64 | — | 0 to 2^64-1 | I64 |

Unqualified `integer` is equivalent to `integer:32`.

### Number Precision

| Type | Bits | Precision | WASM |
|------|------|-----------|------|
| `number:32` | 32 | ~7 decimal digits | F32 |
| `number:64` | 64 | ~15 decimal digits | F64 |

Unqualified `number` is equivalent to `number:64`.

---

## 3. Composite Types

| Type | Syntax | Element Access | WASM |
|------|--------|----------------|------|
| `list<T>` | `list<integer>` | `arr[index]` (integer index) | I32 (heap pointer) |
| `matrix<T>` | `matrix<number>` | `mat[row][col]` (integer indices) | I32 (heap pointer) |
| `pairs<K,V>` | `pairs<string, integer>` | `map[key]` (string key) | I32 (heap pointer) |

### List Behavior Modes

Lists support runtime behavior configuration:

| Mode | Behavior |
|------|----------|
| default | Ordered, duplicates allowed |
| `"line"` | FIFO queue |
| `"pile"` | LIFO stack |
| `"unique"` | Set (no duplicates) |
| `"line-unique"` | FIFO + unique |
| `"pile-unique"` | LIFO + unique |

---

## 4. Class and Function Types

### Class Types

```clean
class ClassName [is ParentClass]
```

Class types are nominal — two classes with identical fields are distinct types. Assignability follows the inheritance chain: a child class is assignable to its parent class type.

### Function Types

Functions have typed parameters and a return type:

```clean
integer add(integer a, integer b)
```

Function types support:
- **Parameter contravariance:** If function F1 accepts a supertype where F2 accepts a subtype, F1 is assignable to F2
- **Return covariance:** If F1 returns a subtype of F2's return type, F1 is assignable to F2

---

## 5. Type Compatibility Matrix

### Assignability Rules

A value of type A can be assigned to a variable of type B if:

| From (A) | To (B) | Allowed? | Rule |
|----------|--------|----------|------|
| Any type | Same type | YES | Identity |
| `integer` | `number` | YES | Implicit numeric widening |
| `integer:N` | `integer:M` (M >= N, same signedness) | YES | Integer widening |
| `integer:N` | `integer` | YES | Sized to unsized |
| `integer` | `integer:N` | YES | Unsized to sized |
| `integer:N` | `number` | YES | Integer to number widening |
| `integer:N` | `number:M` | YES | Integer to sized number |
| `number:32` | `number:64` | YES | Number widening |
| `number:64` | `number:32` | NO | Precision loss |
| `number:N` | `number` | YES | Sized to unsized |
| `number` | `number:N` | YES | Unsized to sized |
| `null` | Any type | YES | All types are nullable |
| `list<T1>` | `list<T2>` | YES if T1 → T2 | Covariant elements |
| `matrix<T1>` | `matrix<T2>` | YES if T1 → T2 | Covariant elements |
| Child class | Parent class | YES | Inheritance |
| Any type | `any` | YES | Any accepts all |
| `any` | Any type | YES | Dynamic dispatch |
| `unknown` | Any type | YES | Error recovery |

### Disallowed Assignments

| From | To | Why |
|------|-----|-----|
| `string` | `integer` | No implicit string-to-number |
| `boolean` | `integer` | No implicit bool-to-int |
| `integer:8` signed | `integer:8u` unsigned | Signedness mismatch |
| `number:64` | `number:32` | Precision loss |
| Unrelated class A | Class B | No structural typing for classes |

---

## 6. Implicit Conversions

The compiler performs these automatic conversions:

| Conversion | Context | Example |
|-----------|---------|---------|
| `integer` → `number` | Arithmetic with mixed types | `3 + 2.5` → number |
| `integer:8` → `integer:32` | Assignment to wider integer | `integer:32 x = small_val` |
| `number:32` → `number:64` | Assignment to wider number | `number y = float32_val` |
| `integer` → `number:32/64` | Assignment to any number type | `number x = 42` |
| `null` → any type | Nullable assignment | `string x = null` |

**No other implicit conversions exist.** All other type changes require explicit conversion methods.

---

## 7. Explicit Conversions

### Method-Style Conversion

| Method | Input Type | Output Type | Behavior |
|--------|-----------|-------------|----------|
| `.toString()` | integer, number, boolean | string | Decimal string representation |
| `.toInteger()` | string, number, boolean | integer | Parse or truncate |
| `.toNumber()` | string, integer | number | Parse or widen |
| `.toBoolean()` | string, integer | boolean | "true"/"false" or non-zero |

### WASM-Level Conversions

| Operation | From | To | WASM Instruction |
|-----------|------|-----|------------------|
| Float to int | F64 | I32 | `i32.trunc_f64_s` |
| Int to float | I32 | F64 | `f64.convert_i32_s` |
| Unsigned int to float | I32 | F64 | `f64.convert_i32_u` |

---

## 8. Null Handling

### All Types Are Nullable

Every type accepts `null`. There is no non-nullable type annotation (except via the `!` operator at use-sites).

### The `default` Operator (Null Coalescing)

```clean
value default fallback
```

Returns `value` if non-null, otherwise returns `fallback`. Both sides must have the same type.

### The `!` Operator (Required/Non-Null Assertion)

```clean
value!
```

Postfix operator. Asserts at runtime that `value` is not null. If null, execution traps. The expression type is unchanged — this is a runtime check, not a type transformation.

---

## 9. The `any` Type

### Memory Layout

```
[tag:i32][value1:i32][value2:i32]   // 12 bytes on heap
```

### Type Tags

| Tag | Value | Type |
|-----|-------|------|
| 0 | Null | null |
| 1 | Integer | integer |
| 2 | Boolean | boolean |
| 3 | Number | number |
| 4 | String | string |
| 5 | List | list |
| 6 | Object | pairs/class |

### Rules

- Any type can be assigned to `any` (boxing with type tag)
- `any` can be assigned to any type (unboxing with runtime type check)
- `any[string_key]` → `any` (object field access)
- `any[integer_index]` → `any` (array element access)
- `any.toString()` → `string`
- Other method calls on `any` return `any`

---

## 10. Generic Types and Constraint Resolution

### Type Parameters

```clean
class Container<T>
    T value
```

Type parameters are resolved at compile time using Hindley-Milner constraint solving.

### Constraint Types

| Constraint | Meaning |
|-----------|---------|
| Equality | Two types must be the same |
| Subtype | One type must be assignable to another |
| HasMember | A type must have a specific field or method |

### Resolution Order

1. Apply current type substitutions
2. Check exact type match
3. Handle type variables and bounds
4. Resolve container types recursively (covariant elements)
5. Resolve function types (contravariant parameters, covariant return)
6. Resolve class inheritance
7. Apply implicit numeric widening
8. Allow null compatibility
9. Allow `any` to unify with anything
10. Reject if no rule matches (SEM001)

---

## 11. Primitive Type Methods

### Integer Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.toString()` | string | Decimal string representation |
| `.toInteger()` | integer | Identity |
| `.toNumber()` | number | Widen to float |
| `.toBoolean()` | boolean | 0 → false, non-zero → true |
| `.abs()` | number | Absolute value |

### Number Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.toString()` | string | Decimal string representation |
| `.toInteger()` | integer | Truncate to integer |
| `.abs()` | number | Absolute value |
| `.sqrt()` | number | Square root |
| `.sin()` | number | Sine |
| `.cos()` | number | Cosine |

### String Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.length()` | integer | Character count |
| `.substring(start, end)` | string | Extract substring |
| `.charAt(index)` | string | Character at position |
| `.indexOf(search)` | integer | First occurrence (-1 if not found) |
| `.contains(search)` | boolean | Contains substring |
| `.replace(old, new)` | string | Replace all occurrences |
| `.split(delimiter)` | list\<string\> | Split by delimiter |
| `.trim()` | string | Remove leading/trailing whitespace |
| `.toUpperCase()` | string | Convert to uppercase |
| `.toLowerCase()` | string | Convert to lowercase |
| `.startsWith(prefix)` | boolean | Starts with prefix |
| `.endsWith(suffix)` | boolean | Ends with suffix |
| `.isEmpty()` | boolean | Length is zero |
| `.isNotEmpty()` | boolean | Length is non-zero |
| `.toString()` | string | Identity |

### Boolean Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.toString()` | string | "true" or "false" |

### List Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.length()` | integer | Element count |
| `.push(item)` | list | Add to end |
| `.pop()` | element type | Remove from end |
| `.get(index)` | element type | Element at index |
| `.contains(item)` | boolean | Contains element |
| `.isEmpty()` | boolean | Length is zero |
| `.isNotEmpty()` | boolean | Length is non-zero |
| `.toString()` | string | String representation |
