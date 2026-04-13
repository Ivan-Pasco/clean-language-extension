# Fix json.dataToText() Data Serialization Bug

## Components Affected
- **Primary**: `clean-language-compiler` (code generation for json.dataToText)
- **Secondary**: `clean-server` (host bridge implementation if json functions are bridge calls)
- **Secondary**: `clean-node-server` (same bridge functions)

## Issue Type
Bug - Critical

## Priority
Critical - Blocks full-stack demo applications from returning structured JSON data

## Description

`json.dataToText()` returns an empty string (or causes UTF-8 errors) when converting `any`-typed data back to JSON text. This breaks any workflow where database query results need to be re-serialized to JSON for API responses.

### Symptoms

1. **Empty output**: `json.dataToText(someAnyValue)` returns `""` (empty string)
2. **UTF-8 errors**: When the empty/corrupt result is concatenated into a larger JSON response, the server returns a UTF-8 decode error

### Reproduction

Using `examples/complete-demo/app/api/users.cln`:

```clean
// This code demonstrates the bug:
string result = _db_query(sql, "[]")
// result = '{"ok":true,"data":{"count":3,"rows":[...]}}'  ← CORRECT raw string

any data = json.tryTextToData(result)
// data != null  ← WORKS, parsing succeeds

any dataObj = data.data
any rows = dataObj.rows
// rows is accessible, not null  ← WORKS, property access works

string text = json.dataToText(rows)
// text = ""  ← BUG: should be '[{"id":1,"email":"alice@test.com",...},...]'
```

### What Works

- `json.tryTextToData(jsonString)` - Successfully parses JSON text into `any` type
- Property access on `any` type (`data.data`, `data.count`, `data.rows`) - Works
- `.toString()` on `any` fields - Works (returns the raw value as string)
- `.toInteger()` on `any` fields - Works

### What Doesn't Work

- `json.dataToText(anyValue)` - Returns empty string for any `any`-typed value
- `json.dataToText(rows)` where `rows` is an array from parsed JSON - Empty
- `json.dataToText(user)` where `user` is an object from `list.get(rows, 0)` - Empty

### Workaround

The current workaround (used in `users-simple.cln`) is to skip `json.dataToText()` entirely and directly use the raw string from `_db_query()`:

```clean
string result = _db_query(sql, "[]")
string resp = "{\"ok\":true,\"data\":" + result + "}"
return resp
```

This works but defeats the purpose of having structured data access.

## Context

Discovered while testing the complete-demo application with SQLite database. The `users.cln` file uses `json.tryTextToData()` to parse DB results, accesses individual fields (which works), but then `json.dataToText()` fails when trying to serialize data back to JSON.

## Investigation Steps

### 1. Determine where json.dataToText is implemented

Check whether `json.dataToText` is:
- A compiler built-in (generated as WASM instructions)
- A standard library function (in `src/stdlib/`)
- A host bridge function (imported from `env.*`)

Search the compiler codebase:
```bash
grep -r "dataToText" src/
grep -r "json.*dataToText\|json_dataToText\|json\.dataToText" src/
```

### 2. Check the any type representation in WASM

The `any` type needs to store:
- Type tag (integer, string, boolean, null, array, object)
- Value data (varies by type)

For `json.dataToText()` to work, it needs to traverse the `any` type structure and reconstruct JSON text. Verify:
- How `any` values are stored in WASM memory
- Whether arrays and objects in `any` type preserve their structure
- Whether the serialization code can access nested structures

### 3. Check json.tryTextToData implementation

This function WORKS, but understanding it is key:
- How does it store parsed JSON in WASM memory?
- What memory layout does it use for arrays and objects?
- Does it store the original JSON text alongside the parsed structure?

### 4. Verify list.get() with any type

`list.get(rows, 0)` is also used in the failing code. Check:
- Does `list.get` return a proper `any` value?
- Is the returned value a full copy or a reference?
- Does the returned value maintain its internal structure?

### 5. Check host bridge JSON functions (if applicable)

If these are bridge functions, check the server implementation:
```bash
# In clean-server:
grep -r "dataToText\|data_to_text" src/
grep -r "tryTextToData\|text_to_data" src/
```

## Suggested Fix

The most likely issues:

1. **json.dataToText doesn't exist or is a stub** - The function may not be fully implemented, returning an empty string or 0-length string pointer
2. **any type loses structure** - When `any` holds an array or object, the internal structure (needed for serialization) may not be preserved in WASM memory
3. **Memory pointer issue** - The function may be reading from the wrong memory offset, getting 0-length data

## Files Likely Affected

### In clean-language-compiler:
- `src/codegen/` - WASM code generation for json functions
- `src/stdlib/` - Standard library json implementations
- `src/semantic/` - Type analysis for `any` type
- `src/parser/grammar.pest` - If json.dataToText needs grammar support

### In clean-server (if bridge functions):
- `host-bridge/src/wasm_linker/` - Bridge function implementations
- `host-bridge/src/wasm_linker/json_ops.rs` (or similar)

### In clean-node-server (if bridge functions):
- `src/bridge/` or equivalent - Node.js bridge implementations

## Test Cases

After fixing, these should all work:

```clean
// Test 1: Round-trip simple object
string json = "{\"name\":\"alice\",\"age\":30}"
any data = json.tryTextToData(json)
string back = json.dataToText(data)
// back should be '{"name":"alice","age":30}' (key order may vary)

// Test 2: Round-trip array
string json = "[1,2,3]"
any data = json.tryTextToData(json)
string back = json.dataToText(data)
// back should be '[1,2,3]'

// Test 3: Nested access then serialize
string json = "{\"data\":{\"count\":1,\"rows\":[{\"id\":1,\"name\":\"alice\"}]}}"
any data = json.tryTextToData(json)
any rows = data.data.rows
string back = json.dataToText(rows)
// back should be '[{"id":1,"name":"alice"}]'

// Test 4: Single element from list
any row = list.get(rows, 0)
string back = json.dataToText(row)
// back should be '{"id":1,"name":"alice"}'
```

## Related Issues

- Compiler lexer bug: `{ ... : ... }` inside string literals is parsed as block syntax (separate issue)
- String comparison bug: Fixed in server v1.7.11 (resolved)
