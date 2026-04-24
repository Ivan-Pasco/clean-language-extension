# Server: Debug string_compare Function

**Component**: clean-server
**Issue Type**: bug investigation
**Priority**: critical
**Created**: 2026-01-27

## Problem

String comparisons return wrong results. Need to verify if `string_compare` is:
1. Being called at all
2. Receiving correct pointers
3. Reading strings correctly

## Current Implementation

Location: `host-bridge/src/wasm_linker/string_ops.rs`

```rust
linker.func_wrap(
    "env",
    "string_compare",
    |mut caller: Caller<'_, S>, str1_ptr: i32, str2_ptr: i32| -> i32 {
        let s1 = read_string_from_caller(&mut caller, str1_ptr).unwrap_or_default();
        let s2 = read_string_from_caller(&mut caller, str2_ptr).unwrap_or_default();
        if s1 == s2 { 1 } else { 0 }
    },
)?;
```

## Task: Add Debug Logging

Update the function to log every call:

```rust
linker.func_wrap(
    "env",
    "string_compare",
    |mut caller: Caller<'_, S>, str1_ptr: i32, str2_ptr: i32| -> i32 {
        error!("=== string_compare CALLED ===");
        error!("  ptr1={}, ptr2={}", str1_ptr, str2_ptr);

        // Log raw memory at ptr1
        if let Some(memory) = caller.get_export("memory").and_then(|e| e.into_memory()) {
            let data = memory.data(&*caller);
            if (str1_ptr as usize) + 20 <= data.len() {
                let raw = &data[str1_ptr as usize..(str1_ptr as usize + 20).min(data.len())];
                error!("  ptr1 raw bytes: {:02x?}", raw);
            }
            if (str2_ptr as usize) + 20 <= data.len() {
                let raw = &data[str2_ptr as usize..(str2_ptr as usize + 20).min(data.len())];
                error!("  ptr2 raw bytes: {:02x?}", raw);
            }
        }

        let s1 = read_string_from_caller(&mut caller, str1_ptr).unwrap_or_else(|| {
            error!("  FAILED to read s1!");
            String::new()
        });
        let s2 = read_string_from_caller(&mut caller, str2_ptr).unwrap_or_else(|| {
            error!("  FAILED to read s2!");
            String::new()
        });

        error!("  s1='{}' (len={})", s1, s1.len());
        error!("  s2='{}' (len={})", s2, s2.len());

        let result = if s1 == s2 { 1 } else { 0 };
        error!("  result={}", result);
        result
    },
)?;
```

## Test After Adding Logging

```bash
# Build server
cd /Users/earcandy/Documents/Dev/Clean\ Language/clean-server
cargo build --release

# Copy to cleen
cp target/release/clean-server ~/.cleen/server/1.7.11/

# Run with debug
RUST_LOG=error cleen server run /tmp/str-test.wasm --port 3002

# Test
curl http://localhost:3002/t/hello
```

## What to Look For

### If string_compare IS called:
- Check the pointer values
- Check the raw bytes at those pointers
- Check if strings are read correctly
- Verify the comparison logic

### If string_compare is NOT called:
- The bug is in the compiler (not calling the function)
- Or the WASM is using internal func 60 instead of import

## Potential Issues

1. **Import/Export Conflict**: WASM exports `string_compare` as func 60. This might shadow the imported host function.

2. **Wrong Pointer Format**: Compiler might be passing raw pointers without length prefix.

3. **Function Not Called**: Compiler might be inlining comparison or using different approach.

## Report Back

After adding logging, report:
1. Is `string_compare` being called?
2. What pointer values are passed?
3. What strings are read from those pointers?
4. What result is returned?
