# Clean Language WASM Memory Model

This document describes the memory layout and allocation strategy used by Clean Language WASM modules.

## Memory Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Address 0-3: Heap Pointer (4 bytes, little-endian u32)         │
├─────────────────────────────────────────────────────────────────┤
│  Address 4+: Data Section (string literals, constants)         │
├─────────────────────────────────────────────────────────────────┤
│  ... static data ...                                            │
├─────────────────────────────────────────────────────────────────┤
│  Heap Start (value stored at address 0)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Bump-allocated runtime data                                ││
│  │  - String results from host functions                       ││
│  │  - Temporary allocations                                    ││
│  │  - Growing upward →                                         ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Stack (grows downward ←)                                       │
│  - Function call frames                                         │
│  - Local variables                                              │
└─────────────────────────────────────────────────────────────────┘
  Address 65535 (64KB initial memory)
```

## Heap Pointer

The heap pointer is stored at memory address 0 as a 4-byte little-endian unsigned integer:

```rust
// Reading heap pointer
let heap_ptr = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);

// Writing heap pointer
let bytes = heap_ptr.to_le_bytes();
data[0..4].copy_from_slice(&bytes);
```

## String Format

All strings use **length-prefixed format** (NOT null-terminated):

```
┌─────────────────┬─────────────────────────────────────┐
│ 4 bytes (LE)   │ UTF-8 string data                   │
│ length prefix  │ (variable length, no null term)     │
└─────────────────┴─────────────────────────────────────┘
```

### Example: "Hello World"

```
Offset  Hex                         Meaning
0x0000  0B 00 00 00                 Length: 11 (little-endian)
0x0004  48 65 6C 6C 6F 20           "Hello "
0x000A  57 6F 72 6C 64              "World"
```

Total size: 4 (prefix) + 11 (content) = 15 bytes

### Reading a String (Host Side)

```rust
pub fn read_string_from_memory(memory: &[u8], ptr: u32) -> Option<String> {
    let ptr = ptr as usize;
    if ptr + 4 > memory.len() {
        return None;
    }

    // Read length prefix
    let len = u32::from_le_bytes([
        memory[ptr],
        memory[ptr + 1],
        memory[ptr + 2],
        memory[ptr + 3],
    ]) as usize;

    // Read string data
    let start = ptr + 4;
    let end = start + len;
    if end > memory.len() {
        return None;
    }

    String::from_utf8(memory[start..end].to_vec()).ok()
}
```

### Writing a String (Host Side)

```rust
pub fn write_string_to_memory(memory: &mut [u8], heap_ptr: &mut u32, s: &str) -> u32 {
    let bytes = s.as_bytes();
    let len = bytes.len() as u32;
    let total_size = 4 + len;

    let ptr = *heap_ptr;

    // Write length prefix
    let len_bytes = len.to_le_bytes();
    memory[ptr as usize..(ptr + 4) as usize].copy_from_slice(&len_bytes);

    // Write string data
    memory[(ptr + 4) as usize..(ptr + 4 + len) as usize].copy_from_slice(bytes);

    // Update heap pointer
    *heap_ptr = ptr + total_size;

    ptr
}
```

## Bump Allocator

The host-bridge uses a simple bump allocator:

```rust
pub struct WasmMemory {
    heap_ptr: u32,
    initial_heap: u32,
}

impl WasmMemory {
    pub fn allocate(&mut self, size: u32, align: u32) -> u32 {
        // Align the pointer
        let aligned = (self.heap_ptr + align - 1) & !(align - 1);

        // Return current position and bump
        let ptr = aligned;
        self.heap_ptr = aligned + size;
        ptr
    }

    pub fn reset(&mut self) {
        // Reset to initial position (for new requests)
        self.heap_ptr = self.initial_heap;
    }
}
```

## Memory Growth

WASM memory starts at 1 page (64KB) and can grow:

```rust
// Check if we need more memory
if needed_ptr > memory.data_size() as u32 {
    let pages_needed = ((needed_ptr as usize - memory.data_size()) / 65536) + 1;
    memory.grow(pages_needed as u64)?;
}
```

## Passing Strings Between WASM and Host

### WASM → Host (Reading)

1. WASM function provides `(ptr: i32, len: i32)` pair
2. Host reads `len` bytes starting at `ptr`
3. Host decodes as UTF-8

```rust
fn read_raw_string(caller: &mut Caller<S>, ptr: i32, len: i32) -> Option<String> {
    let memory = caller.get_export("memory")?.into_memory()?;
    let data = memory.data(&caller);

    let start = ptr as usize;
    let end = start + len as usize;

    String::from_utf8(data[start..end].to_vec()).ok()
}
```

### Host → WASM (Writing)

1. Host allocates space using bump allocator
2. Host writes length prefix + string data
3. Host returns pointer to WASM

```rust
fn write_string_to_caller(caller: &mut Caller<S>, s: &str) -> i32 {
    let memory = caller.get_export("memory")?.into_memory()?;
    let state = caller.data_mut();

    let ptr = state.memory_mut().allocate(4 + s.len() as u32, 4);

    // Write to WASM memory...

    ptr as i32
}
```

## Request Isolation

Each HTTP request gets a fresh memory state:

1. Create new WASM instance (or reset memory)
2. Reset heap pointer to initial value
3. Process request
4. Discard allocations when request completes

This prevents memory leaks and ensures request isolation.

## Alignment Requirements

| Type | Alignment | Size |
|------|-----------|------|
| i32 | 4 bytes | 4 bytes |
| i64 | 8 bytes | 8 bytes |
| f32 | 4 bytes | 4 bytes |
| f64 | 8 bytes | 8 bytes |
| String pointer | 4 bytes | 4 bytes |
| String content | 1 byte | variable |

## Memory Safety

The host-bridge ensures memory safety by:

1. **Bounds checking**: All memory accesses are validated
2. **Alignment**: Allocations are properly aligned
3. **Isolation**: Each request has isolated memory
4. **No dangling pointers**: Bump allocator doesn't reuse memory within a request
