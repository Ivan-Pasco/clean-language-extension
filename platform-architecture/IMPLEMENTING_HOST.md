# Implementing a New Host Runtime

This guide explains how to implement a new host runtime for Clean Language WASM modules.

## Prerequisites

Before implementing a host, understand:
1. [Host Bridge Specification](./HOST_BRIDGE.md) - All portable functions
2. [Memory Model](./MEMORY_MODEL.md) - String format and allocation
3. [Server Extensions](./SERVER_EXTENSIONS.md) - HTTP server functions (if building a server)

## Step 1: Choose Your WASM Runtime

| Runtime | Language | Recommended For |
|---------|----------|-----------------|
| wasmtime | Rust | High performance servers |
| wazero | Go | Go applications |
| wasmer | Multiple | General purpose |
| wasm3 | C | Embedded systems |
| node:wasi | Node.js | JavaScript applications |

## Step 2: Implement Memory Management

### Memory Allocator

Create a bump allocator that tracks the heap pointer:

```javascript
// Node.js example
class WasmMemory {
  constructor() {
    this.heapPtr = 0;
    this.initialHeap = 0;
  }

  setFromWasm(memory) {
    // Read initial heap pointer from address 0
    const view = new DataView(memory.buffer);
    this.heapPtr = view.getUint32(0, true); // little-endian
    this.initialHeap = this.heapPtr;
  }

  allocate(size, align = 4) {
    // Align the pointer
    const aligned = (this.heapPtr + align - 1) & ~(align - 1);
    const ptr = aligned;
    this.heapPtr = aligned + size;
    return ptr;
  }

  reset() {
    this.heapPtr = this.initialHeap;
  }
}
```

### String Helpers

Implement string reading and writing:

```javascript
// Read length-prefixed string from WASM memory
function readString(memory, ptr) {
  const view = new DataView(memory.buffer);
  const len = view.getUint32(ptr, true); // little-endian
  const bytes = new Uint8Array(memory.buffer, ptr + 4, len);
  return new TextDecoder().decode(bytes);
}

// Read raw string (ptr + len pair, no prefix)
function readRawString(memory, ptr, len) {
  const bytes = new Uint8Array(memory.buffer, ptr, len);
  return new TextDecoder().decode(bytes);
}

// Write string to WASM memory, return pointer
function writeString(memory, wasmMemory, str) {
  const bytes = new TextEncoder().encode(str);
  const totalSize = 4 + bytes.length;
  const ptr = wasmMemory.allocate(totalSize, 4);

  const view = new DataView(memory.buffer);
  view.setUint32(ptr, bytes.length, true); // length prefix

  const dest = new Uint8Array(memory.buffer, ptr + 4, bytes.length);
  dest.set(bytes);

  return ptr;
}
```

## Step 3: Implement Host Functions

### Console Functions

```javascript
const consoleImports = {
  print: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    process.stdout.write(str);
  },

  printl: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    console.log(str);
  },

  print_integer: (value) => {
    // value is BigInt for i64
    console.log(value.toString());
  },

  print_float: (value) => {
    console.log(value);
  },

  print_boolean: (value) => {
    console.log(value ? "true" : "false");
  },
};
```

### Math Functions

```javascript
const mathImports = {
  "math.sin": Math.sin,
  "math.cos": Math.cos,
  "math.tan": Math.tan,
  "math.asin": Math.asin,
  "math.acos": Math.acos,
  "math.atan": Math.atan,
  "math.atan2": Math.atan2,
  "math.sinh": Math.sinh,
  "math.cosh": Math.cosh,
  "math.tanh": Math.tanh,
  "math.ln": Math.log,
  "math.log10": Math.log10,
  "math.log2": Math.log2,
  "math.exp": Math.exp,
  "math.exp2": (x) => Math.pow(2, x),
  "math.pow": Math.pow,
  "math.sqrt": Math.sqrt,

  // Also register with underscore names
  math_sin: Math.sin,
  math_cos: Math.cos,
  // ... etc
};
```

### String Operations

```javascript
const stringImports = {
  string_concat: (aPtr, aLen, bPtr, bLen) => {
    const a = readRawString(memory, aPtr, aLen);
    const b = readRawString(memory, bPtr, bLen);
    return writeString(memory, wasmMemory, a + b);
  },

  string_substring: (ptr, len, start, end) => {
    const str = readRawString(memory, ptr, len);
    const result = str.substring(start, end);
    return writeString(memory, wasmMemory, result);
  },

  string_trim: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    return writeString(memory, wasmMemory, str.trim());
  },

  string_to_upper: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    return writeString(memory, wasmMemory, str.toUpperCase());
  },

  string_to_lower: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    return writeString(memory, wasmMemory, str.toLowerCase());
  },

  int_to_string: (value) => {
    return writeString(memory, wasmMemory, value.toString());
  },

  float_to_string: (value) => {
    return writeString(memory, wasmMemory, value.toString());
  },

  string_to_int: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    return BigInt(parseInt(str, 10) || 0);
  },

  string_to_float: (ptr, len) => {
    const str = readRawString(memory, ptr, len);
    return parseFloat(str) || 0.0;
  },
};
```

### Memory Runtime

```javascript
const memoryImports = {
  mem_alloc: (size, align) => {
    return wasmMemory.allocate(size, align);
  },

  mem_retain: (ptr) => {
    // Reference counting (optional, can be no-op for bump allocator)
  },

  mem_release: (ptr) => {
    // Reference counting (optional)
  },

  mem_scope_push: () => {
    // Push allocation scope (optional)
  },

  mem_scope_pop: () => {
    // Pop scope, free allocations (optional)
  },
};
```

### Database (Optional)

```javascript
const dbImports = {
  _db_query: async (sqlPtr, sqlLen, paramsPtr, paramsLen) => {
    const sql = readRawString(memory, sqlPtr, sqlLen);
    const paramsJson = readRawString(memory, paramsPtr, paramsLen);
    const params = JSON.parse(paramsJson || "[]");

    // Use your database driver
    const rows = await db.query(sql, params);
    return writeString(memory, wasmMemory, JSON.stringify(rows));
  },

  _db_execute: async (sqlPtr, sqlLen, paramsPtr, paramsLen) => {
    const sql = readRawString(memory, sqlPtr, sqlLen);
    const paramsJson = readRawString(memory, paramsPtr, paramsLen);
    const params = JSON.parse(paramsJson || "[]");

    const result = await db.execute(sql, params);
    return BigInt(result.affectedRows);
  },

  _db_begin: async () => {
    await db.beginTransaction();
    return 1;
  },

  _db_commit: async () => {
    await db.commit();
    return 1;
  },

  _db_rollback: async () => {
    await db.rollback();
    return 1;
  },
};
```

### File I/O

```javascript
const fs = require("fs");

const fileImports = {
  file_read: (pathPtr, pathLen) => {
    const path = readRawString(memory, pathPtr, pathLen);
    try {
      const content = fs.readFileSync(path, "utf8");
      return writeString(memory, wasmMemory, content);
    } catch {
      return writeString(memory, wasmMemory, "");
    }
  },

  file_write: (pathPtr, pathLen, dataPtr, dataLen) => {
    const path = readRawString(memory, pathPtr, pathLen);
    const data = readRawString(memory, dataPtr, dataLen);
    try {
      fs.writeFileSync(path, data);
      return 1;
    } catch {
      return 0;
    }
  },

  file_exists: (pathPtr, pathLen) => {
    const path = readRawString(memory, pathPtr, pathLen);
    return fs.existsSync(path) ? 1 : 0;
  },

  file_delete: (pathPtr, pathLen) => {
    const path = readRawString(memory, pathPtr, pathLen);
    try {
      fs.unlinkSync(path);
      return 1;
    } catch {
      return 0;
    }
  },

  file_append: (pathPtr, pathLen, dataPtr, dataLen) => {
    const path = readRawString(memory, pathPtr, pathLen);
    const data = readRawString(memory, dataPtr, dataLen);
    try {
      fs.appendFileSync(path, data);
      return 1;
    } catch {
      return 0;
    }
  },
};
```

### HTTP Client

```javascript
const httpImports = {
  http_get: async (urlPtr, urlLen) => {
    const url = readRawString(memory, urlPtr, urlLen);
    try {
      const response = await fetch(url);
      const body = await response.text();
      return writeString(memory, wasmMemory, body);
    } catch {
      return writeString(memory, wasmMemory, "");
    }
  },

  http_post: async (urlPtr, urlLen, bodyPtr, bodyLen) => {
    const url = readRawString(memory, urlPtr, urlLen);
    const body = readRawString(memory, bodyPtr, bodyLen);
    try {
      const response = await fetch(url, { method: "POST", body });
      const result = await response.text();
      return writeString(memory, wasmMemory, result);
    } catch {
      return writeString(memory, wasmMemory, "");
    }
  },

  http_post_json: async (urlPtr, urlLen, jsonPtr, jsonLen) => {
    const url = readRawString(memory, urlPtr, urlLen);
    const body = readRawString(memory, jsonPtr, jsonLen);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const result = await response.text();
      return writeString(memory, wasmMemory, result);
    } catch {
      return writeString(memory, wasmMemory, "");
    }
  },

  // ... other HTTP methods follow same pattern
};
```

## Step 4: Create the Imports Object

Combine all imports:

```javascript
const imports = {
  env: {
    ...consoleImports,
    ...mathImports,
    ...stringImports,
    ...dbImports,
    ...fileImports,
    ...httpImports,
    ...cryptoImports,
  },
  memory_runtime: {
    ...memoryImports,
  },
};
```

## Step 5: Load and Run Module

```javascript
const fs = require("fs");
const { WASI } = require("wasi");

async function runModule(wasmPath) {
  const wasmBytes = fs.readFileSync(wasmPath);
  const module = await WebAssembly.compile(wasmBytes);

  // Initialize memory helper
  const wasmMemory = new WasmMemory();

  // Create imports with memory reference
  let memory;
  const imports = createImports(() => memory, wasmMemory);

  // Instantiate
  const instance = await WebAssembly.instantiate(module, imports);
  memory = instance.exports.memory;

  // Initialize memory helper from WASM
  wasmMemory.setFromWasm(memory);

  // Call entry point
  if (instance.exports._start) {
    instance.exports._start();
  } else if (instance.exports.main) {
    instance.exports.main();
  }

  return instance;
}
```

## Step 6: Add Server Extensions (Optional)

If building an HTTP server, add server-specific functions:

```javascript
let currentRequest = null;

const serverImports = {
  _req_param: (namePtr, nameLen) => {
    const name = readRawString(memory, namePtr, nameLen);
    const value = currentRequest?.params?.[name] || "";
    return writeString(memory, wasmMemory, value);
  },

  _req_query: (namePtr, nameLen) => {
    const name = readRawString(memory, namePtr, nameLen);
    const value = currentRequest?.query?.[name] || "";
    return writeString(memory, wasmMemory, value);
  },

  _req_body: () => {
    return writeString(memory, wasmMemory, currentRequest?.body || "");
  },

  _req_header: (namePtr, nameLen) => {
    const name = readRawString(memory, namePtr, nameLen).toLowerCase();
    const value = currentRequest?.headers?.[name] || "";
    return writeString(memory, wasmMemory, value);
  },

  _req_method: () => {
    return writeString(memory, wasmMemory, currentRequest?.method || "GET");
  },

  _req_path: () => {
    return writeString(memory, wasmMemory, currentRequest?.path || "/");
  },
};
```

## Testing Your Implementation

1. **Basic test**: Load a simple "Hello World" module
2. **String test**: Test string concatenation and manipulation
3. **Math test**: Verify math functions return correct values
4. **Memory test**: Ensure allocations don't overlap
5. **I/O test**: Test file and HTTP operations

## Common Pitfalls

1. **Endianness**: Always use little-endian for length prefixes
2. **Alignment**: Align allocations to 4 bytes minimum
3. **Memory growth**: Handle WASM memory growth signals
4. **Async in sync**: WASM calls are synchronous; use blocking or promises carefully
5. **String encoding**: Always use UTF-8

## Reference Implementation

See `clean-server/host-bridge` for the reference Rust implementation.
