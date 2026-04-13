# Cross-Component Issue: JSON/String Corruption in clean-server

**Component**: clean-server
**Issue Type**: bug
**Priority**: high
**Created**: 2026-01-26
**Updated**: 2026-01-26
**Source Component**: clean-framework (complete-demo example testing)

## Update

The `_req_param()` issue has been resolved - it was actually working correctly. The problem was a **compiler bug** with string comparison to empty strings (see `compiler-string-empty-comparison-bug.md`).

This prompt now only covers the JSON/string corruption issues.

## Bug: JSON/String Corruption

### Symptoms

1. **UTF-8 Error on GET /api/users**:
```json
{"error":{"code":500,"message":"Invalid UTF-8 in string: invalid utf-8 sequence of 1 bytes from index 29"},"ok":false}
```

2. **Data Corruption in Response**:
```json
{"ok":true,"count":1,"users":X   }
```
The `users` array shows `X` followed by spaces instead of actual data.

3. **Empty User Object on Login**:
```json
{"ok":true,"user":}
```

### Clean Code

```clean
string __route_handler_0()
    string sql = "SELECT id, email, username, created_at, is_active FROM users ORDER BY id DESC LIMIT 50"
    string result = _db_query(sql, "[]")
    printl("Query result: " + result)

    any data = json.tryTextToData(result)
    // ... processing

    resp = resp + json.dataToText(rows)
```

### Expected Behavior

- `_db_query` should return valid JSON with rows
- String concatenation should work without corruption
- `json.dataToText()` should return valid JSON string

### Investigation Areas

1. Check `_db_query` return value - is it properly JSON formatted?
2. Check string memory allocation in WASM
3. Check if the `json.tryTextToData()` and `json.dataToText()` plugin functions work correctly
4. Verify bump allocator isn't overwriting data
5. Check if there's a memory corruption issue with long strings

### Server Logs During Test

```
[ERROR] string.concat: ptr1=6828 ('Table created: '), ptr2=7344 ('0'), result_len=16
[ERROR] string.concat: output_ptr=7352, total_size=20
```

The `string.concat` logs show it's working for short strings, but there may be an issue with larger strings or specific character sequences from database queries.

## Test Case

```bash
# 1. Compile the test file
cd /Users/earcandy/Documents/Dev/Clean\ Language/clean-framework
cln compile examples/complete-demo/app/api/users.cln -o /tmp/users-api.wasm

# 2. Run server with database
rm -f /tmp/test-users.db && touch /tmp/test-users.db
DATABASE_URL="sqlite:///tmp/test-users.db" ./target/release/clean-server /tmp/users-api.wasm --port 3002

# 3. Create a user first
curl -X POST http://localhost:3002/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"secret123"}'
# Returns: {"ok":true,"id":1,...} - Works!

# 4. List users - this shows corruption
curl http://localhost:3002/api/users
# Returns: {"ok":true,"count":1,"users":X   } - Corrupted!
```

## Files to Investigate

- `src/bridge.rs` - `_db_query` return value handling
- `src/wasm/memory.rs` or equivalent - String memory management
- Check how `json.tryTextToData` and `json.dataToText` are implemented in the frame.data plugin

## Possible Causes

1. **Memory overlap**: Long strings from database queries may be overwriting other memory
2. **Encoding issue**: Database results may contain characters that cause encoding problems
3. **Plugin JSON functions**: The `json.dataToText()` function may have bugs
4. **Heap pointer management**: The bump allocator may not be properly tracking allocations

## Priority

**HIGH** - This bug prevents listing data from the database, which is a core functionality.
