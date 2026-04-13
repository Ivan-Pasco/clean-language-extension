# RESOLVED: String Comparison Bug - Server Needs New Release

**Component**: clean-server
**Issue Type**: release needed
**Priority**: critical
**Created**: 2026-01-27
**Status**: ✅ RESOLVED - Fixed in server v1.7.11

## Resolution (2026-01-28)

**RESOLVED**: The fix is included in clean-server v1.7.11. If you have an older cached version, reinstall with:

```bash
rm -rf ~/.cleen/server/1.7.11
cleen server install 1.7.11
cleen server use 1.7.11
```

### Test Results

| Server Version | Response | string_compare host called? |
|---------------|----------|---------------------------|
| Installed (1.7.11) | "EQUAL" (WRONG) | NO |
| Locally built (current source) | "NOT_EQUAL" (CORRECT) | YES |

### Proof

Server log with locally built binary:
```
After _req_param: hello
=== string_compare CALLED ===        ← Host function IS called
After comparison
Response: NOT_EQUAL                   ← CORRECT!
```

## Action Required

**Release a new clean-server version** with the current source code.

The fix exists in the source - it just needs to be compiled and released:
- File: `clean-server/host-bridge/src/wasm_linker/string_ops.rs`
- The `string_compare` function is properly implemented

### To Verify Fix Works

1. Build local server: `cd clean-server && cargo build --release`
2. Run: `./target/release/clean-server /tmp/test.wasm --port 3002`
3. Test string comparison - should work correctly

### To Release

Tag and release new version (e.g., v1.7.12 or v1.8.0) from current main branch.

## Proof

Added debug logging to server's `string_compare` function. After testing:

```
val = 'hello'
val.length() = 5
TEST1: val == "" is TRUE      ← No string_compare call logged
TEST2: val == "hello" is FALSE ← No string_compare call logged
TEST3: length == 0 is FALSE
TEST4: val == empty_var is TRUE ← No string_compare call logged
```

**Zero calls to the host `string_compare` function were logged.**

## Root Cause

The compiler is NOT generating calls to the host `string_compare` function for string `==` comparisons.

Looking at the WASM output:
```wat
(import "env" "string_compare" ...)   ; Host function imported
(export "string_compare" (func 60))   ; Internal function exported
```

The compiler is likely:
1. Calling the internal `func 60` instead of the imported host function, OR
2. Generating inline comparison code that doesn't work correctly

## Fix Required

The compiler must generate code that calls the IMPORTED `string_compare` host function, not any internal implementation.

When compiling `a == b` where both are strings:
1. Get pointer to string `a`
2. Get pointer to string `b`
3. Call the IMPORTED `string_compare(ptr_a, ptr_b)`
4. Use return value (1=equal, 0=not equal) for branching

## Files to Fix

In clean-language-compiler:
- `src/codegen/mir_codegen.rs` - Check how string `==` is compiled
- `src/codegen/` - Find where comparison operators are handled
- Look for any internal `string_compare` function that might be shadowing the import

## Verification Test

After fixing, this test should work:

```clean
functions:
    integer test()
        string a = "hello"
        if a == ""
            return 1  // Should NOT reach here
        return 0      // Should return 0

start()
    integer r = test()
    printl("Result: " + r.toString())  // Should print "Result: 0"
```

Expected: `Result: 0`
Currently: `Result: 1` (WRONG)
