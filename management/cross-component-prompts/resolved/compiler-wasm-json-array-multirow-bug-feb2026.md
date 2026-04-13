# Cross-Component Issue: WASM JSON Multi-Element Array Parsing Returns Field Names

**Component**: clean-language-compiler
**Issue Type**: bug
**Priority**: CRITICAL
**Created**: 2026-02-21
**Source Component**: clean-server (debugging `_db_query` response handling)

---

## Summary

When Clean Language WASM code parses a JSON array with more than one element (returned from `_db_query`), accessing any element beyond index 0 returns a field name string instead of the expected object pointer. This crashes any application that iterates over database query results.

---

## Symptoms

```clean
string result = _db_query("SELECT * FROM articles", "[]")
any data = json.tryTextToData(result)
any rows = data.data.rows

any item0 = rows.get(0)  // ✅ Returns correct object pointer (e.g. 26976)
any item1 = rows.get(1)  // ❌ Returns "read_time" (a field NAME from item0, NOT an object!)
```

Debug output observed:
```
DEBUG: In loop, i = 0
DEBUG: Got article, article = 26976      ← Correct pointer to object
DEBUG: slug = renaissance-of-analog      ← Field access works

DEBUG: In loop, i = 1
DEBUG: Got article, article = read_time  ← WRONG: this is a field name string
DEBUG: About to access article.slug...
[CRASH]
```

---

## Key Evidence

**The server returns correct JSON.** The `_db_query` host function writes this to WASM memory:

```json
{
  "ok": true,
  "data": {
    "count": 4,
    "rows": [
      {"slug": "renaissance-of-analog", "read_time": 5, "title": "..."},
      {"slug": "designing-next-billion", "read_time": 8, "title": "..."},
      {"slug": "battery-revolution", "read_time": 3, "title": "..."},
      {"slug": "architecture-solitude", "read_time": 12, "title": "..."}
    ]
  }
}
```

**Hardcoded JSON works fine.** When the same JSON structure is a string literal in the code, `rows.get(1)` returns the correct object pointer. The bug only occurs when JSON comes from `_db_query`.

This means the bug is **not in the server** — it is in the WASM-side JSON parser (`json.tryTextToData` / `__json_parse_array`).

---

## Root Cause Hypothesis

The WASM JSON parser (`__json_parse_array`) appears to use the heap pointer from WASM memory at the time of parsing. When JSON comes from `_db_query`, the host has already called WASM `malloc` to allocate the JSON string — advancing the heap pointer. The WASM parser then allocates objects for subsequent array elements at addresses that collide with the key strings of the first element.

Specifically:

1. `_db_query` calls WASM `malloc(N)` to allocate space for the JSON string → returns ptr `407624`, advances `__heap_ptr` to `409128`
2. WASM's `json.tryTextToData` parses the array:
   - Element 0 object: allocated correctly at `409128+`
   - The key strings of element 0 (`"slug"`, `"read_time"`, `"title"`) are stored in memory
   - Element 1 object: allocated at an address that overlaps with key strings of element 0
3. `rows.get(1)` returns the address of the "read_time" key string instead of the element 1 object

When JSON is a hardcoded literal, the heap pointer starts much lower (e.g. `25336`) and there is no large allocation gap, so the overlap doesn't occur.

---

## Files to Investigate

### Primary suspect — WASM JSON class:
```
clean-language-compiler/src/stdlib/json_class.rs
clean-language-compiler/src/codegen/native_stdlib/json.rs  (if exists)
```

Look for `__json_parse_array`, `__json_parse_object`, or the `tryTextToData` implementation.

### Memory allocator:
```
clean-language-compiler/src/codegen/native_stdlib/memory.rs
```

The `malloc` function uses `GlobalGet(0)/GlobalSet(0)` for `__heap_ptr`. Verify that after parsing each array element's object, `__heap_ptr` is advanced past ALL allocated data (including key strings) before allocating the next element's object.

### WASM global:
```
clean-language-compiler/src/codegen/mir_codegen.rs
```

Confirms `__heap_ptr` is exported as global index 0. The parser must use this global consistently — not a cached local copy from before the host allocated the JSON string.

---

## Debugging Steps

### 1. Inspect generated WASM
```bash
# Compile a minimal test
cat > /tmp/test_array.cln << 'EOF'
functions:
    string __route_handler_0()
        string result = _db_query("SELECT slug, read_time FROM articles LIMIT 4", "[]")
        any data = json.tryTextToData(result)
        any rows = data.data.rows
        any item0 = rows.get(0)
        any item1 = rows.get(1)
        string slug0 = item0.slug.toString()
        string slug1 = item1.slug.toString()
        return slug0 + "|" + slug1
start()
    _http_route("GET", "/test", 0)
    _http_listen(3000)
EOF

cln compile /tmp/test_array.cln -o /tmp/test_array.wasm

# Disassemble to see memory layout
wasm2wat /tmp/test_array.wasm > /tmp/test_array.wat
grep -A 20 "json_parse_array\|tryTextToData" /tmp/test_array.wat
```

### 2. Add heap pointer tracing to the JSON parser
In the WASM JSON array parser, after allocating each element, print the value of `__heap_ptr` to verify it's advancing correctly between elements.

### 3. Minimal reproduction without server
```clean
// This should reveal if the bug is heap-state-dependent
string json1 = _some_host_func_that_allocates_memory()  // forces heap advance
string result = "{\"ok\":true,\"data\":{\"rows\":[{\"slug\":\"a\",\"x\":1},{\"slug\":\"b\",\"x\":2}]}}"
any data = json.tryTextToData(result)
any rows = data.data.rows
printl(rows.get(0).slug.toString())  // should print "a"
printl(rows.get(1).slug.toString())  // should print "b" — does it?
```

---

## Expected Fix

The WASM JSON array parser must:
1. Read `__heap_ptr` (global 0) **fresh** at the start of each element allocation — never use a cached value
2. After allocating an object and all its key strings, advance `__heap_ptr` past the entire allocation before beginning the next element
3. Ensure that object pointers stored in the array point to the object struct, not to adjacent key string memory

---

## Test to Verify Fix

After fix, this must work end-to-end:

```bash
DATABASE_URL="sqlite://./blog.db" clean-server /tmp/app-db.wasm --port 3030
curl http://localhost:3030/articles
# Must return all 4 articles with correct slug values, not crash on rows.get(1)
```

---

## Related Prompts

- `fix-json-data-serialization.md` — `json.dataToText()` returning empty string (separate issue)
- `COMPILER_WASM_STRING_BUGS.md` — older string corruption bugs (some resolved)
- `compiler-json-get-import-feb2026.md` — `_json_get` import issue (resolved server-side in v1.8.3)
