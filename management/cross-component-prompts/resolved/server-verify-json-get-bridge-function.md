# Server — Verify `_json_get` Bridge Function Works at Runtime

Component: clean-server
Issue Type: compatibility
Priority: medium
Description: The `_json_get(json, path)` bridge function from frame.httpserver compiles correctly, but its runtime behavior needs verification — specifically how it handles the `_db_query` return format and what dot-path syntax it expects.

Context: The website project uses a manual `json_get()` helper (string manipulation) to extract values from `_db_query` results. If `_json_get` works correctly at runtime, it could replace 17 lines of manual parsing with a single bridge function call.

---

## What Compiles (verified v0.30.20)

```clean
string test_json = "{\"status\":\"ok\",\"version\":\"1.0\"}"
string ver = _json_get(test_json, "version")
```

## Questions for Runtime Testing

1. **Simple key extraction:** Does `_json_get("{\"key\":\"val\"}", "key")` return `"val"`?
2. **Nested paths:** Does `_json_get(db_result, "data.rows.0.title")` work with `_db_query` format?
3. **Missing keys:** Does it return `""` for missing keys (like our manual json_get)?
4. **Dot-path syntax:** Is it `"data.rows.0.field"` or `"data.rows[0].field"` or something else?

## Current `_db_query` Return Format

```json
{"data":{"count":1,"rows":[{"title":"Home","meta_description":"..."}]},"ok":true}
```

If `_json_get` can navigate this, it eliminates our 17-line `json_get` helper and provides a more robust solution (our manual version breaks on keys that appear at multiple nesting levels).

## Test Plan

Add a test endpoint or modify `api_health` temporarily:
```clean
string sql = "SELECT 'test' as val"
string result = _db_query(sql, "[]")
string direct = _json_get(result, "val")
string nested = _json_get(result, "data.rows.0.val")
return json_ok("{\"direct\":\"" + direct + "\",\"nested\":\"" + nested + "\"}")
```

Then hit `/api/health` and see which path format returns the value.
