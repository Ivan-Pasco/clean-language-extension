# Clean Language — Validator Module Specification

**Authority:** This document is the single source of truth for the `validator` namespace.
**Status:** Specification — implementation must match this document exactly.
**Version:** 1.0.0
**Date:** 2026-04-20

---

## Overview

The `validator` module provides declarative, field-level input validation with a Clean Language native DSL. It is designed for validating structured data at system boundaries: form submissions, API request bodies, configuration files, and user input.

The design follows Clean Language's one-way-to-do-things principle: one syntax for defining rules, one type for results, one way to inspect failures. No magic, no implicit coercion, no exceptions.

**What it is:**
- A rules engine for structured data validation
- A DSL for declaring field constraints in a readable, indented style
- A result type that forces the caller to handle the error case

**What it is not:**
- A regular expression engine — use built-in `string.match` for arbitrary patterns
- A schema language for type generation — types are defined in `class:` blocks
- An ORM validator — use `frame.data` model constraints for database-level validation

---

## Concepts

### ValidationResult

Every validation operation returns a `ValidationResult`. It is an opaque value with two states: success and failure. The caller must branch on `result.ok` before accessing the value.

```clean
result: validator.run rules input
if result.ok:
    process result.value
else:
    print result.firstError
```

A `ValidationResult` is never null. `validator.run` always returns a result — it never halts on invalid input.

### ValidationRules

A `ValidationRules` object is an opaque container built by `validator.create:`. It holds a list of field rules. Once built, it is immutable and safe to reuse across multiple calls to `validator.run`.

### Patterns

A pattern is a named string constraint used in `match:` rules. Patterns match the entire field value — the match must cover the full string, not just a substring.

Built-in pattern names:

| Name | Matches |
|------|---------|
| `emailPattern` | RFC 5321 email address |
| `urlPattern` | HTTP or HTTPS URL |
| `phonePattern` | International phone number with optional country code |
| `uuidPattern` | UUID v1–v5 (8-4-4-4-12 hex format) |
| `integerPattern` | Optional sign, one or more digits, no decimal |
| `numberPattern` | Integer or decimal, optional sign |
| `alphanumericPattern` | Letters and digits only, no spaces or symbols |
| `slugPattern` | Lowercase letters, digits, and hyphens only |
| `datePattern` | ISO 8601 date: `YYYY-MM-DD` |
| `timePattern` | ISO 8601 time: `HH:MM` or `HH:MM:SS` |
| `ipv4Pattern` | IPv4 address in dotted-decimal notation |
| `hexColorPattern` | CSS hex color: `#RGB` or `#RRGGBB` |

Custom patterns are plain strings interpreted as glob-style patterns:
- `*` matches any sequence of characters
- `?` matches exactly one character
- All other characters match literally

```clean
field: "code"
    match: "INV-???-*"
```

The pattern `"INV-???-*"` matches `"INV-ABC-2026"` but not `"INV-AB-2026"` (too short) or `"abc"`.

---

## DSL Block Syntax

Rules are declared using a `validator.create:` block. This is the canonical way to define validators — function-call style is available but not preferred.

```clean
rules: validator.create:
    field: "name"
        required: true
        type: string
        minLength: 1
        maxLength: 100
    field: "email"
        required: true
        type: string
        match: emailPattern
        maxLength: 254
    field: "age"
        required: false
        type: integer
        range: 0, 150
    field: "website"
        required: false
        type: string
        match: urlPattern
```

Each `field:` block applies rules to one named field of the input. Rules within a field block are ANDed — all must pass for the field to be valid. Fields not declared in the rules are passed through without validation.

---

## Function Reference

### Creation

#### `validator.create() → ValidationRules`

Creates an empty rules container. Used as the return value of a `validator.create:` block; also callable directly.

**Layer:** 1 (WASM native)
**Error semantics:** Never fails. Always returns a valid rules object.

```clean
rules: validator.create:
    field: "username"
        required: true
```

---

#### `validator.createWithName(name: string) → ValidationRules`

Creates a named rules container. The name is included in error messages to identify which validator failed.

**Layer:** 1 (WASM native)

```clean
rules: validator.createWithName "UserRegistration":
    field: "email"
        required: true
        match: emailPattern
```

---

### Execution

#### `validator.run(rules: ValidationRules, input: pairs) → ValidationResult`

Runs all rules in `rules` against `input` and returns a `ValidationResult`. If all fields pass, `result.ok` is `true` and `result.value` holds `input`. If any field fails, `result.ok` is `false` and `result.errors` holds the list of error messages.

**Layer:** 1 (WASM native)
**Error semantics:** Never halts. Always returns a `ValidationResult`.

`validator.validate` is a synonym — identical behaviour.

```clean
result: validator.run rules formData
if result.ok:
    saveUser result.value
else:
    each result.errors as err:
        print err
```

---

#### `validator.runField(rules: ValidationRules, fieldName: string, value: string) → ValidationResult`

Validates a single field by name against the matching rule in `rules`. Useful for real-time field validation.

**Layer:** 1 (WASM native)

```clean
emailResult: validator.runField rules "email" inputEmail
if emailResult.ok:
    showValid
else:
    showError emailResult.firstError
```

---

### Result Inspection

#### `validator.isOk(result: ValidationResult) → boolean`

Returns `true` if validation passed.

#### `validator.isError(result: ValidationResult) → boolean`

Returns `true` if validation failed.

#### `validator.getValue(result: ValidationResult) → pairs`

Returns the validated input value. Only meaningful when `result.ok` is `true`. Returns null if validation failed.

#### `validator.getErrors(result: ValidationResult) → list<string>`

Returns the list of error messages. Only meaningful when `result.ok` is `false`. Returns an empty list if validation passed.

#### `validator.getFirstError(result: ValidationResult) → string`

Returns the first error message, or an empty string if validation passed.

**Preferred access:** Use property syntax on the result:

| Property | Equivalent function |
|----------|---------------------|
| `result.ok` | `validator.isOk(result)` |
| `result.value` | `validator.getValue(result)` |
| `result.errors` | `validator.getErrors(result)` |
| `result.firstError` | `validator.getFirstError(result)` |

---

### Result Construction

These functions are used when writing custom validators with `validator.custom`.

#### `validator.ok(value: pairs) → ValidationResult`

Creates a successful result carrying `value`.

#### `validator.error(errors: list<string>) → ValidationResult`

Creates a failed result with the given error list.

---

### Rule Builders

These are used inside `validator.create:` blocks. They are also callable as functions for dynamic rule construction.

#### `validator.field(rules: ValidationRules, name: string) → ValidationRules`

Adds a new field rule to `rules` and sets it as the current field for subsequent constraint calls. Returns `rules` for chaining.

#### `validator.required(rules: ValidationRules, isRequired: boolean) → ValidationRules`

Marks the current field as required (`true`) or optional (`false`). Default is optional.

#### `validator.optional(rules: ValidationRules) → ValidationRules`

Marks the current field as optional. Equivalent to `validator.required rules false`.

#### `validator.type(rules: ValidationRules, typeName: string) → ValidationRules`

Constrains the field value to a Clean Language type: `"string"`, `"integer"`, `"number"`, `"boolean"`. Type checking happens before other constraints — a field that fails a type constraint skips remaining constraints.

#### `validator.match(rules: ValidationRules, pattern: string) → ValidationRules`

Constrains the field to match a named pattern or glob pattern string. See the Patterns section.

#### `validator.range(rules: ValidationRules, min: integer, max: integer) → ValidationRules`

Constrains a numeric field to fall within `[min, max]` inclusive. Applied after type checking.

#### `validator.minLength(rules: ValidationRules, min: integer) → ValidationRules`

Constrains a string field to have at least `min` characters.

#### `validator.maxLength(rules: ValidationRules, max: integer) → ValidationRules`

Constrains a string field to have at most `max` characters.

#### `validator.message(rules: ValidationRules, msg: string) → ValidationRules`

Sets a custom error message for the most recently declared constraint. Overrides the default error message generated for that constraint.

```clean
field: "email"
    required: true
        message: "Email is required"
    match: emailPattern
        message: "Must be a valid email address"
```

#### `validator.custom(rules: ValidationRules, fn: function) → ValidationRules`

Adds a custom validation function for the current field. The function receives the field value as a string and returns a `ValidationResult`.

```clean
string isStrongPassword(value):
    if value.length() < 8:
        return validator.error ["Password must be at least 8 characters"]
    return validator.ok value

field: "password"
    required: true
    custom: isStrongPassword
```

---

## Error Semantics

> `validator.run` and `validator.runField` never halt — they always return a `ValidationResult`. The result always has a defined state (`ok` or error). An empty input (null or missing) is treated as an empty string for string fields and as absent for required checks.

> `validator.ok` and `validator.error` never fail. They produce values only — they do not perform I/O.

> Accessing `result.value` when `result.ok` is `false` returns null. Accessing `result.firstError` when `result.ok` is `true` returns an empty string. Neither halts.

---

## Default Error Messages

When no `message:` is set, the validator generates a message in this form:

| Constraint | Default message |
|------------|-----------------|
| `required: true` | `"<field> is required"` |
| `type: string` | `"<field> must be a string"` |
| `type: integer` | `"<field> must be a whole number"` |
| `type: number` | `"<field> must be a number"` |
| `type: boolean` | `"<field> must be true or false"` |
| `match: emailPattern` | `"<field> must be a valid email address"` |
| `match: urlPattern` | `"<field> must be a valid URL"` |
| `match: phonePattern` | `"<field> must be a valid phone number"` |
| `match: uuidPattern` | `"<field> must be a valid UUID"` |
| `match: integerPattern` | `"<field> must contain only digits"` |
| `match: alphanumericPattern` | `"<field> must contain only letters and digits"` |
| `match: slugPattern` | `"<field> must contain only lowercase letters, digits, and hyphens"` |
| `match: datePattern` | `"<field> must be a date in YYYY-MM-DD format"` |
| `match: <glob>` | `"<field> does not match the required format"` |
| `range: min, max` | `"<field> must be between <min> and <max>"` |
| `minLength: n` | `"<field> must be at least <n> characters"` |
| `maxLength: n` | `"<field> must be at most <n> characters"` |

---

## Memory Layout

`ValidationRules` structure (WASM linear memory):
```
Offset  Size  Field
0       4     field_count (number of declared fields)
4       4     capacity (allocated field slots)
8       4     fields_ptr (pointer to field array)
12      4     name_ptr (optional name, 0 if unnamed)
```

Each field entry in the field array (16 bytes):
```
Offset  Size  Field
0       4     field_name_ptr
4       4     required flag (0 or 1)
8       4     pattern_ptr (0 if no match rule)
12      4     range_rule_ptr (0 if no range rule)
```

`ValidationResult` structure (WASM linear memory):
```
Offset  Size  Field
0       4     is_ok (1 = success, 0 = failure)
4       4     value_or_errors_ptr
8       4     field_name_ptr (set on runField, 0 on run)
```

**Type IDs:**
- `ValidationResult`: 20
- `ValidationRules`: 21
- `ValidationError`: 22

---

## Complete Examples

### Form Validation

```clean
start:
    rules: validator.create:
        field: "username"
            required: true
            type: string
            minLength: 3
            maxLength: 30
            match: alphanumericPattern
                message: "Username can only contain letters and digits"
        field: "email"
            required: true
            type: string
            match: emailPattern
        field: "age"
            required: true
            type: integer
            range: 13, 120
                message: "You must be between 13 and 120 years old"
        field: "website"
            required: false
            type: string
            match: urlPattern

    formData: pairs:
        username: "alice99"
        email: "alice@example.com"
        age: "28"

    result: validator.run rules formData
    if result.ok:
        print "Registration successful"
    else:
        print "Please fix the following:"
        each result.errors as err:
            print "  - " + err
```

### Reusable Validators

```clean
functions:
    ValidationRules makeUserRules():
        return validator.create:
            field: "email"
                required: true
                match: emailPattern
            field: "password"
                required: true
                minLength: 8

    ValidationRules makeAddressRules():
        return validator.create:
            field: "street"
                required: true
                maxLength: 200
            field: "city"
                required: true
                maxLength: 100
            field: "postcode"
                required: true
                match: alphanumericPattern
                maxLength: 10

start:
    userRules: makeUserRules
    addressRules: makeAddressRules

    userResult: validator.run userRules userData
    addrResult: validator.run addressRules addressData
    if userResult.ok and addrResult.ok:
        createAccount userResult.value addrResult.value
```

### Custom Validator

```clean
functions:
    ValidationResult validatePassword(value):
        if value.length() < 8:
            return validator.error ["Password must be at least 8 characters"]
        if value.contains(" "):
            return validator.error ["Password must not contain spaces"]
        return validator.ok value

start:
    rules: validator.create:
        field: "password"
            required: true
            custom: validatePassword

    result: validator.run rules input
    if result.ok:
        setPassword result.value
    else:
        print result.firstError
```

### Real-Time Field Validation

```clean
start:
    rules: validator.create:
        field: "email"
            required: true
            match: emailPattern

    emailCheck: validator.runField rules "email" userInput
    if emailCheck.ok:
        showGreenIndicator
    else:
        showError emailCheck.firstError
```

---

## WASM Import Signatures

The validator module runs at **Layer 1 (WASM native)** — all functions execute within the WASM module itself using direct memory operations. There are no host bridge imports for the validator namespace.

Type IDs 20–22 are reserved for `ValidationResult`, `ValidationRules`, and `ValidationError` respectively.

---

---

# Proposed Enhancements

The following additions are proposed to make the validator module more complete and more useful as a first-class part of the language. These are not yet implemented. Each proposal maintains the Clean Language style: one way to do things, readable, no magic.

---

## P1 — `allowedValues:` Constraint

Constrains a field to one of a fixed set of accepted strings. Useful for enums, status codes, and controlled vocabulary.

```clean
field: "role"
    required: true
    allowedValues: "admin", "editor", "viewer"

field: "status"
    required: true
    allowedValues: "active", "inactive", "pending"
```

**Rationale:** The `match:` constraint with glob patterns cannot express a fixed set of choices cleanly. This constraint is common enough in form and API validation to deserve first-class support.

**Default error message:** `"<field> must be one of: <values>"`

---

## P2 — `minValue:` and `maxValue:` Constraints

One-sided numeric bounds. `range:` requires both a min and a max, which is awkward for "at least" or "at most" constraints.

```clean
field: "quantity"
    required: true
    type: integer
    minValue: 1

field: "discount"
    required: false
    type: number
    maxValue: 100.0
```

**Rationale:** `range: 1, 999999` is a workaround. Explicit one-sided bounds express intent clearly.

---

## P3 — `trim: true` Automatic Whitespace Trimming

Applies `string.trim()` to the field value before running other constraints. This is so common in form handling that requiring the caller to pre-trim every field is unnecessary friction.

```clean
field: "username"
    required: true
    trim: true
    minLength: 3
```

When `trim: true`, the trimmed value is what gets stored in `result.value`, not the original.

**Rationale:** Form inputs almost always have accidental leading/trailing whitespace. Making trim opt-in per field avoids surprising data transformation while being explicit about intent.

---

## P4 — `default:` Value for Optional Fields

Sets a fallback value for optional fields that are absent or empty. The default is placed into `result.value` when the field is not present.

```clean
field: "theme"
    required: false
    default: "light"
    allowedValues: "light", "dark"

field: "pageSize"
    required: false
    type: integer
    default: "20"
    range: 1, 100
```

**Rationale:** Validators that also provide defaults eliminate a common boilerplate pattern (`if value is "" then value: "default"`). The validator becomes the single point of normalization for input.

---

## P5 — `validator.merge` Combinator

Combines two `ValidationRules` objects into one. Fields from both are merged — if both define the same field name, the second overrides the first.

```clean
baseRules: validator.create:
    field: "email"
        required: true
        match: emailPattern

adminRules: validator.create:
    field: "adminCode"
        required: true
        match: "ADM-*"

fullRules: validator.merge baseRules adminRules

result: validator.run fullRules input
```

**Rationale:** Encourages composition. A base set of rules can be shared and extended for different contexts without duplication.

---

## P6 — `validator.shape` for Nested Object Validation

Validates the shape of a nested `pairs` value. The nested validator is run against the sub-object.

```clean
addressRules: validator.create:
    field: "street"
        required: true
    field: "city"
        required: true

userRules: validator.create:
    field: "name"
        required: true
    field: "address"
        required: true
        shape: addressRules
```

When a `shape:` field fails, its errors are prefixed with the field name: `"address.street is required"`.

**Rationale:** Real-world data is hierarchical. Without `shape:`, callers must run separate validators and manually combine error messages, which breaks the single-result contract.

---

## P7 — `validator.each` for List Validation

Validates every element of a list field against a rule. Reports errors per-index.

```clean
tagRules: validator.create:
    field: "tag"
        required: true
        match: slugPattern
        maxLength: 32

postRules: validator.create:
    field: "title"
        required: true
    field: "tags"
        required: false
        each: tagRules
```

Errors from list items are prefixed: `"tags[2] does not match the required format"`.

**Rationale:** API requests frequently contain arrays of structured items (tags, addresses, line items). Without `each:`, list validation requires imperative loops.

---

## P8 — `result.fieldErrors(name: string) → list<string>`

Returns the errors for a specific field name from a failed result. Useful for displaying errors inline next to the failing field rather than as a flat list.

```clean
result: validator.run rules input
if result.ok is false:
    emailErrors: result.fieldErrors "email"
    if emailErrors.length() > 0:
        showFieldError "email" emailErrors[0]
```

**Rationale:** `result.errors` is a flat list. Form UIs need per-field error display. Without `fieldErrors`, callers must scan the error list for field-name prefixes — fragile and error-prone.

---

## P9 — `requiredIf:` Conditional Requirement

Marks a field as required only when another named field has a specific value.

```clean
field: "companyName"
    requiredIf: "accountType", "business"

field: "vatNumber"
    requiredIf: "accountType", "business"
```

If `accountType` is `"business"`, then `companyName` and `vatNumber` become required. If `accountType` is any other value, they are optional.

**Rationale:** Conditional requirements are extremely common in forms. Encoding them in the validator definition rather than in branching logic keeps validation rules readable and in one place.

---

## P10 — Error Message Interpolation

Allows `{field}`, `{min}`, `{max}`, and `{value}` placeholders in custom error messages.

```clean
field: "age"
    required: true
    type: integer
    range: 13, 120
        message: "{field} must be between {min} and {max}, got {value}"
```

**Rationale:** Custom error messages often need to include the constraint values for clarity. Without interpolation, developers either hardcode the values (brittle) or use the default messages (not customisable enough).

---

## Implementation Priority

| Priority | Proposal | Effort | Value |
|----------|-----------|--------|-------|
| High | P1 — `allowedValues:` | Low | Very high — common pattern |
| High | P2 — `minValue:` / `maxValue:` | Low | High — ergonomic improvement |
| High | P3 — `trim: true` | Low | High — reduces boilerplate |
| High | P8 — `result.fieldErrors` | Medium | Very high — essential for form UIs |
| Medium | P4 — `default:` | Medium | High — reduces caller boilerplate |
| Medium | P5 — `validator.merge` | Medium | High — enables composition |
| Medium | P10 — message interpolation | Medium | Medium |
| Medium | P9 — `requiredIf:` | Medium | High — conditional logic |
| Low | P6 — `validator.shape` | High | High — needed for nested data |
| Low | P7 — `validator.each` | High | High — needed for list data |

---

## Spec-Implementation Parity Checklist

| Feature | Specified | Implemented | Status |
|---------|-----------|-------------|--------|
| `validator.create` | ✓ | ✓ | Parity |
| `validator.createWithName` | ✓ | ✓ | Parity |
| `validator.run` | ✓ | Partial | Loop scaffold only — actual field checks missing |
| `validator.validate` | ✓ | ✓ | Alias wired |
| `validator.runField` | ✓ | Partial | Always returns ok — rule lookup missing |
| `validator.ok` | ✓ | ✓ | Parity |
| `validator.error` | ✓ | ✓ | Parity |
| `validator.isOk` | ✓ | ✓ | Parity |
| `validator.isError` | ✓ | ✓ | Parity |
| `validator.getValue` | ✓ | ✓ | Parity |
| `validator.getErrors` | ✓ | ✓ | Parity |
| `validator.getFirstError` | ✓ | ✓ | Parity |
| `validator.field` | ✓ | ✓ | Parity |
| `validator.required` | ✓ | ✓ | Parity |
| `validator.optional` | ✓ | ✓ | Parity |
| `validator.type` | ✓ | ✗ | Not implemented |
| `validator.match` (function) | ✓ | ✓ | Parity |
| Built-in named patterns | ✓ | ✗ | Not implemented |
| Glob pattern matching | ✓ | ✗ | Not implemented |
| `validator.range` | ✓ | ✓ | Parity |
| `validator.minLength` | ✓ | Stub | Returns input unchanged |
| `validator.maxLength` | ✓ | Stub | Returns input unchanged |
| `validator.message` | ✓ | Stub | Returns input unchanged |
| `validator.custom` | ✓ | Stub | Returns input unchanged |
| Default error messages | ✓ | ✗ | Not implemented |
| `result.ok` property syntax | ✓ | ✗ | Needs compiler property access |
