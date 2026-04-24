# Clean Language Memory Policy

> **Status:** Design specification — no code changes yet.
> **Date:** 2026-04-16
> **Motivation:** Memory bugs were the #1 source of runtime failures in Q2 2026. Five memory-related error reports were filed in 48 hours, each patched individually with no cross-stack root-cause analysis.

This document defines the unified memory contract across all Clean Language components. It is the single source of truth for memory budgets, growth strategy, allocator behavior, and observability. Component-specific implementation tasks are at the end.

For memory **layout** (string format, heap pointer location, alignment), see [MEMORY_MODEL.md](./MEMORY_MODEL.md).

---

## 1. Current State Map

Values verified from source code on 2026-04-16:

### 1.1 Compiler (clean-language-compiler)

| Setting | Value | Location |
|---------|-------|----------|
| Initial WASM pages | 32 (2 MB) | `src/codegen/mod.rs:302` |
| Max WASM pages | 1024 (64 MB) | `src/codegen/mod.rs:61` — `DEFAULT_MAX_MEMORY_PAGES` |
| Data-section HEAP_START | 1024 bytes (1 KB) | `src/codegen/mod.rs:60` |
| Runtime HEAP_START | 1,048,576 bytes (1 MB) | `src/codegen/native_stdlib/mod.rs:28` |
| Max data-section size | 1,048,576 bytes (1 MB) | `src/codegen/memory.rs:19` — `MAX_MEMORY_SIZE` |
| Compilation targets | Server, Plugin, Standalone | `src/lib.rs:127-138` |
| Per-target memory differences | **None** — all targets emit identical page counts | `src/codegen/mir_codegen/mod.rs:490-503` |
| CLI memory flags | **None** — memory is not configurable | — |
| Dual codegen paths | Legacy (`mod.rs`) + MIR (`mir_codegen/utilities.rs`) — both emit same config | `mod.rs:300`, `utilities.rs:575` |

### 1.2 Rust Server (clean-server)

| Setting | Value | Location |
|---------|-------|----------|
| wasmtime Engine config | **Default** — no custom `Config` options | `src/wasm.rs:459` |
| StoreLimits | **None** — no `StoreLimits` or `ResourceLimiter` | `src/wasm.rs:517` |
| Instance lifecycle | Fresh instance per request | `src/wasm.rs:587-595` |
| Heap start offset | 65,536 bytes (64 KB) | `host-bridge/src/wasm_linker/state.rs:120` |
| Allocation alignment | 8-byte | `host-bridge/src/wasm_linker/state.rs:128` |
| Growth strategy | **Exact-fit** — grows by minimum pages needed | `src/memory.rs:260-265` |
| Reset behavior | Bump pointer resets to 65,536 per request | `src/wasm.rs:260`, `state.rs:134` |
| `mem_retain` / `mem_release` | **No-op** (stub implementations) | `host-bridge/src/wasm_linker/memory.rs:75-90` |
| CLI memory flags | `--body_limit` only (default 10 MB) | `src/main.rs:64` |

### 1.3 Node Server (clean-node-server)

| Setting | Value | Location |
|---------|-------|----------|
| WebAssembly.Memory creation | **None** — uses WASM module's exported memory | `src/wasm/memory.ts` |
| Explicit `memory.grow()` calls | **None** — delegates to WASM malloc | `src/wasm/state.ts:50-55` |
| Memory management model | Reference-counting wrapper over WASM malloc/free | `src/bridge/memory-runtime.ts:24-125` |
| Per-request reset | No explicit reset — delegates to WASM module | — |

### 1.4 Browser Bridges (JS runtimes)

| Component | Initial Pages | Max Pages | Memory Owner | Location |
|-----------|---------------|-----------|--------------|----------|
| frame.canvas loader | 256 (16 MB) | 1024 (64 MB) | **JS creates**, passes to WASM | `frame.canvas/runtime/loader.js:45-49` |
| frame.ui loader | WASM-provided | WASM-provided | **WASM exports**, JS imports | `frame.ui/runtime/loader.js:475` |
| frame.ui heap pointer | 4096 bytes | — | JS-side bump allocator | `frame.ui/runtime/loader.js:14` |
| canvas example.html | 1 (64 KB) | implicit | Test-only | `frame.canvas/runtime/example.html:120` |

### 1.5 Known Discrepancies

| # | Issue | Severity |
|---|-------|----------|
| D1 | Compiler emits 32 initial pages; frame.ui lets WASM decide; frame.canvas hardcodes 256. No contract. | High |
| D2 | Compiler's runtime HEAP_START = 1 MB; host-bridge bump allocator starts at 64 KB. The 64 KB – 1 MB range is ambiguous. | High |
| D3 | No StoreLimits on Rust server — unbounded `memory.grow()` possible. | Critical |
| D4 | Exact-fit growth causes frequent expensive `memory.grow()` calls under SSR load. | Medium |
| D5 | `mem_retain` / `mem_release` are no-ops in host-bridge but implemented in node server. Contract mismatch. | Medium |
| D6 | No memory metrics exposed anywhere. Operators have no visibility. | Medium |

---

## 2. Deployment Targets & Memory Profiles

Clean Language compiles to WASM for multiple deployment contexts. Each has fundamentally different memory characteristics:

### 2.1 Target Overview

| Target | Runtime | Lifecycle | Memory Pattern | Typical Plugins |
|--------|---------|-----------|----------------|-----------------|
| **Web (static site)** | Browser | Page-lifetime | Grows once, never resets | frame.ui, frame.client |
| **PWA** | Browser + SW | Page-lifetime + cache | Same as web, plus offline cache | frame.ui, frame.client |
| **Server (Rust)** | clean-server / wasmtime | Per-request instance | Allocate → respond → discard | frame.server, frame.data, frame.auth |
| **Server (Node)** | clean-node-server | Per-request (shared instance) | Malloc/free within request | frame.server, frame.data, frame.auth |
| **SSR** | Server rendering UI | Per-request, large HTML output | Heavy string allocation, then discard | frame.server, frame.ui |
| **Canvas / Game** | Browser or Tauri | Frame-lifetime (60 fps) | Steady-state with per-frame temp allocs | frame.canvas |
| **Desktop** | Tauri (Rust host) | App-lifetime | Long-lived, growing heap | frame.ui, frame.canvas |
| **Mobile** | Capacitor | App-lifetime | Constrained RAM, must stay small | frame.ui, frame.client |
| **CLI / Daemon** | WASI or native | Process-lifetime | Short bursts or continuous | core only |
| **Embedded** | Wasmer (minimal) | Device-lifetime | Hard ceiling, no growth | core only |
| **Plugin WASM** | Host-embedded | Loaded by compiler | Small, specialized | plugin-specific |

### 2.2 Why Targets Matter for Memory

- **Per-request targets** (server, SSR) benefit from bump allocation + reset. Memory never leaks across requests.
- **Page-lifetime targets** (web, PWA) cannot reset — memory only grows. A general-purpose allocator with free is eventually needed.
- **Frame-lifetime targets** (canvas/game) need predictable memory. Large initial allocation avoids mid-frame `memory.grow()` stalls.
- **Constrained targets** (mobile, embedded) need low initial pages and strict max caps.
- **Long-lived targets** (desktop, daemon) need real allocation/free or will exhaust memory over time.

---

## 3. Memory Budget Tiers

Each tier defines initial pages, max pages, and the host-side limit. The compiler emits the tier's values into the WASM module's memory declaration. Operators can override via server config or CLI flags.

| Tier | Use Case | Targets | Initial Pages | Initial Size | Max Pages | Max Size | Host Limit |
|------|----------|---------|---------------|-------------|-----------|----------|------------|
| **embedded** | IoT, constrained devices | embedded | 4 | 256 KB | 16 | 1 MB | 1 MB |
| **minimal** | CLI tools, simple scripts, plugins | CLI, plugin | 8 | 512 KB | 128 | 8 MB | 8 MB |
| **standard** | Web apps, APIs, PWAs, mobile | web, PWA, mobile, server (API) | 32 | 2 MB | 512 | 32 MB | 32 MB |
| **heavy** | SSR, large data processing, desktop | SSR, desktop, daemon | 64 | 4 MB | 1024 | 64 MB | 64 MB |
| **canvas** | Games, real-time rendering | canvas, game | 256 | 16 MB | 1024 | 64 MB | 64 MB |

### 3.1 Tier Selection Rules

1. **Compiler default:** `standard` (unchanged from current behavior for initial pages).
2. **Compiler flag:** `--memory-tier <embedded|minimal|standard|heavy|canvas>` overrides the default.
3. **Plugin override:** A plugin's `plugin.toml` MAY declare `[memory] tier = "canvas"` to set the default for projects using that plugin. The highest tier among all active plugins wins.
4. **Operator override:** Server CLI flags `--memory-initial-pages` and `--memory-max-pages` override everything. This is the escape hatch.
5. **Backward compatibility:** Existing `.wasm` files without tier metadata use `standard` defaults on the server.

### 3.2 Target-to-Tier Mapping (defaults)

| Target Flag | Default Tier |
|-------------|-------------|
| `--target web` | standard |
| `--target pwa` | standard |
| `--target nodejs` | standard |
| `--target native` | heavy |
| `--target embedded` | embedded |
| `--target wasi` | minimal |
| `--target server` (Rust) | standard |
| canvas projects | canvas (via plugin.toml) |
| SSR projects | heavy (via frame.ui plugin.toml when SSR enabled) |

---

## 4. Growth Contract

### 4.1 Who Grows Memory

| Component | Role |
|-----------|------|
| **WASM module** (compiler-emitted allocator) | Executes `memory.grow` instruction when its allocator needs more pages |
| **Host bridge** (`mem_alloc`) | Calls `ensure_memory_capacity()` before writing strings/data into WASM memory |
| **wasmtime / browser** | Validates the grow request against declared maximum and StoreLimits |

Both the WASM module and the host bridge may trigger growth. This is correct — the host bridge allocates on behalf of the module (e.g., writing response strings).

### 4.2 Growth Factor

**Current:** Exact-fit (grow by minimum pages needed).
**New policy:** **1.5x amortized growth** with a floor and ceiling.

```
Algorithm: ensure_memory_capacity(needed_bytes)
  current_bytes = memory.data_size()
  if needed_bytes <= current_bytes:
    return ok

  // Grow by at least 1.5x current, but at least 4 pages, and at most max
  target = max(needed_bytes, current_bytes * 3 / 2)
  target = max(target, current_bytes + 4 * PAGE_SIZE)
  target = min(target, max_pages * PAGE_SIZE)

  pages_to_grow = ceil((target - current_bytes) / PAGE_SIZE)
  memory.grow(pages_to_grow)
```

**Rationale:** Amortized growth reduces the number of `memory.grow()` calls from O(n) to O(log n) for linearly growing workloads. Each `memory.grow()` is expensive (may involve mmap/mprotect). The 4-page floor prevents pathological single-page growths.

### 4.3 Failure Mode

When `memory.grow()` fails (max exceeded or host limit hit):

| Runtime | Behavior |
|---------|----------|
| **Rust server (wasmtime)** | Trap (via `StoreLimitsBuilder::trap_on_grow_failure(true)`). The trap is caught as a `RuntimeError` and returns HTTP 500 with a structured error. |
| **Node server** | `memory.grow()` returns -1. The allocator returns null/0. The bridge function returns an error string. |
| **Browser** | `memory.grow()` returns -1. The JS bridge logs a console.error and throws. The UI shows a user-facing error. |

**No silent failures.** A failed grow must always be surfaced — never silently return a null pointer that will cause an unrelated crash later.

### 4.4 Reset Policy

| Target Type | Reset Strategy |
|-------------|---------------|
| **Per-request** (server, SSR) | Bump allocator resets to `HEAP_START` after each request. New wasmtime instance per request (current behavior) ensures full isolation. |
| **Page-lifetime** (web, PWA) | No reset. Memory grows monotonically. Future: scope-based collection or full allocator. |
| **Frame-lifetime** (canvas) | Per-frame temp arena that resets each frame. Persistent allocations use a separate region. |
| **Long-lived** (desktop, daemon) | Scope-based: `mem_scope_push` / `mem_scope_pop` release allocations. Future: general-purpose allocator. |

---

## 5. StoreLimits Specification (Rust Server)

The Rust server MUST configure `StoreLimits` on every `Store` to prevent runaway memory consumption.

### 5.1 Configuration

```rust
use wasmtime::{StoreLimitsBuilder, Store};

let limits = StoreLimitsBuilder::new()
    .memory_size(tier.max_bytes())       // e.g., 32 MB for standard tier
    .trap_on_grow_failure(true)          // trap instead of returning -1
    .instances(1)                        // one instance per store
    .tables(10)                          // reasonable table limit
    .memories(1)                         // one linear memory per module
    .build();

let mut store = Store::new(&engine, WasmState { limits, ..state });
store.limiter(|state| &mut state.limits);
```

### 5.2 CLI / Environment Override

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--memory-limit <MB>` | `CLEAN_MEMORY_LIMIT_MB` | Tier default | Max memory per WASM instance |
| `--memory-tier <tier>` | `CLEAN_MEMORY_TIER` | `standard` | Budget tier name |

### 5.3 Interaction with WASM Module's Declared Max

The effective limit is `min(StoreLimits.memory_size, module.declared_max)`. StoreLimits provides a host-side ceiling that cannot be exceeded regardless of what the WASM module declares.

### 5.4 Pooling Allocator (future)

For high-throughput deployments, enable wasmtime's pooling allocator:

```rust
let mut config = Config::new();
config.allocation_strategy(InstanceAllocationStrategy::Pooling);
config.memory_init_cow(true);  // copy-on-write for fast instance creation

let pool = PoolingAllocationConfig::default();
pool.total_memories(max_concurrent_requests);
pool.max_memory_size(tier.max_bytes());
pool.linear_memory_keep_resident(tier.initial_bytes());  // keep initial pages warm
```

This is not required for initial implementation but should be planned for production deployments handling > 100 concurrent requests.

---

## 6. JS Bridge Alignment

### 6.1 Problem

frame.ui imports memory from the WASM module (correct — uses the module's declared pages). frame.canvas creates its own `WebAssembly.Memory` with 256 initial pages, potentially mismatching what the compiler declared.

### 6.2 Policy

**Rule: The WASM module's declared memory is authoritative.** JS bridges MUST NOT create their own `WebAssembly.Memory` with different page counts.

**For module-exported memory** (frame.ui pattern — correct):
```javascript
// WASM module exports its memory. JS uses it as-is.
const { memory } = instance.exports;
```

**For module-imported memory** (frame.canvas pattern — must fix):
```javascript
// Read the module's declared initial/max from the WASM binary header,
// or use a convention: the WASM custom section "clean:memory" carries
// the tier's initial/max pages.
//
// Fallback: use standard tier defaults (32 initial, 512 max).
const memory = new WebAssembly.Memory({
    initial: moduleInitialPages ?? 32,
    maximum: moduleMaxPages ?? 512
});
```

### 6.3 Canvas Exception

Canvas/game targets legitimately need more initial memory (256 pages / 16 MB) to avoid mid-frame grows. This is handled by the `canvas` tier: the compiler emits 256 initial pages when `--memory-tier canvas` is used (or the frame.canvas plugin is active). The JS loader then reads the module's declaration and matches it.

---

## 7. Heap Start Alignment

### 7.1 Problem

| Component | Heap Start | Location |
|-----------|-----------|----------|
| Compiler (data-section layout) | 1,024 bytes | `codegen/mod.rs:60` |
| Compiler (runtime `__heap_ptr`) | 1,048,576 bytes (1 MB) | `native_stdlib/mod.rs:28` |
| Host bridge (bump allocator) | 65,536 bytes (64 KB) | `state.rs:120` |
| frame.ui (JS heap pointer) | 4,096 bytes | `loader.js:14` |

Four different values. The actual runtime heap starts at the `__heap_ptr` global (1 MB), which is correct — it's after the 1 MB data section. But the host bridge starts at 64 KB, which overlaps with the data section region.

### 7.2 Policy

**Rule: The WASM module's `__heap_ptr` export is the authoritative heap start.**

- The host bridge MUST read `__heap_ptr` from the instance exports and use it as the initial bump offset.
- The host bridge MUST NOT hardcode 65,536 or any other value.
- JS bridges MUST read `__heap_ptr` from instance exports (frame.ui already does this at `loader.js:477`).

```rust
// Host bridge initialization (Rust)
let heap_ptr = instance
    .get_global(&mut store, "__heap_ptr")
    .and_then(|g| g.get(&mut store).i32())
    .unwrap_or(65536) as usize;  // fallback for old modules

state.memory_mut().set_offset(heap_ptr);
```

---

## 8. Allocator Roadmap

### 8.1 Current State: Bump Allocator

The bump allocator is correct for per-request server workloads:
- Simple, fast, no fragmentation
- Reset between requests is O(1)
- No free() needed within a request

**Bump allocation remains the recommended strategy for server targets.**

### 8.2 Limitations

| Scenario | Problem |
|----------|---------|
| Large SSR pages | A single request can exhaust 64 MB building HTML strings |
| Long-lived browser apps | Memory only grows, never shrinks |
| Desktop apps | Hours of use → OOM |
| Canvas games | Sprite/texture allocation over time |

### 8.3 Phased Roadmap

| Phase | Timeline | Change | Targets Affected |
|-------|----------|--------|-----------------|
| **Phase 1** (now) | Immediate | Fix heap start alignment, add StoreLimits, add 1.5x growth | All |
| **Phase 2** | Next quarter | Implement `mem_scope_push` / `mem_scope_pop` properly (arena-style) | Browser, desktop, canvas |
| **Phase 3** | Future | Evaluate `dlmalloc` or custom allocator for long-lived targets | Desktop, browser, daemon |

**Decision point for Phase 3:** If `mem_scope_push/pop` handles 90%+ of use cases, a full allocator may not be needed. Measure first.

### 8.4 `mem_retain` / `mem_release` Contract

These are currently no-ops in the host bridge but implemented in the node server. Policy:

- **Server (Rust):** Remain no-ops. Per-request instance creation makes ref-counting unnecessary.
- **Node server:** Keep reference counting. Shared instance model benefits from it.
- **Browser bridges:** Implement as no-ops until Phase 3. Document that they exist for future use.
- **Compiler:** Continue emitting calls. They are zero-cost when the host implements them as no-ops.

---

## 9. Observability

### 9.1 Metrics (Rust Server)

The server MUST expose these metrics. Implementation via the existing logging infrastructure or a future `/metrics` endpoint.

| Metric | Type | Description |
|--------|------|-------------|
| `clean_wasm_memory_current_bytes` | Gauge | Current WASM memory size per instance |
| `clean_wasm_memory_peak_bytes` | Gauge | Peak memory per request |
| `clean_wasm_memory_grows_total` | Counter | Total `memory.grow()` calls per request |
| `clean_wasm_memory_grow_pages_total` | Counter | Total pages grown per request |
| `clean_wasm_memory_oom_total` | Counter | OOM traps (grow failures) |

### 9.2 Structured Logging

Every `memory.grow()` call logs at `debug` level:

```json
{
  "event": "wasm_memory_grow",
  "current_pages": 32,
  "requested_pages": 16,
  "new_total_pages": 48,
  "request_id": "abc-123"
}
```

OOM events log at `warn` level:

```json
{
  "event": "wasm_memory_oom",
  "current_pages": 512,
  "requested_pages": 16,
  "max_pages": 512,
  "request_id": "abc-123"
}
```

### 9.3 Browser Observability

Canvas and UI loaders log memory growth to `console.warn`:

```
[clean] Memory grew: 32 → 48 pages (3.0 MB → 3.0 MB)
```

And expose `window.__cleanRuntime.memoryStats()` returning:

```javascript
{
  currentPages: 48,
  currentBytes: 3145728,
  maxPages: 512,
  growCount: 3,
  heapPtr: 1048576
}
```

### 9.4 Node Server Observability

Log memory stats per request at `debug` level, same structured format as Rust server.

---

## 10. Best Practices Reference

Research from wasmtime documentation and production embedders (2026-04-16):

| Topic | Finding | Source |
|-------|---------|--------|
| StoreLimits | Use `StoreLimitsBuilder` with `memory_size()` and `trap_on_grow_failure(true)` | wasmtime docs: `Store::limiter`, `StoreLimitsBuilder` |
| Growth strategy | Host gates growth via `ResourceLimiter::memory_growing()`. Module's allocator initiates growth. | wasmtime `ResourceLimiter` trait |
| Virtual memory | On 64-bit, wasmtime reserves 8 GiB virtual per memory (2 GiB guard + 4 GiB usable + 2 GiB guard). Only initial pages are committed. | wasmtime `contributing-architecture.md` |
| Pooling allocator | `InstanceAllocationStrategy::Pooling` pre-allocates slots. Use `linear_memory_keep_resident` to keep initial pages warm. | wasmtime `PoolingAllocationConfig` |
| wasmCloud limits | Default `maxLinearMemoryBytes = 20,000,000` (~19 MiB) per component | wasmCloud Helm chart `hostConfig.maxLinearMemoryBytes` |
| Bump + reset | Valid for request-response workloads. Pooling allocator's `linear_memory_keep_resident` is designed for this pattern. | wasmtime architecture docs |
| OOM handling | `trap_on_grow_failure(true)` causes WASM trap instead of returning -1. Recommended when module has no OOM recovery. | wasmtime `StoreLimitsBuilder` |

---

## 11. Component Implementation Tasks

### Component: clean-language-compiler

1. **[Add]** `--memory-tier <embedded|minimal|standard|heavy|canvas>` CLI flag. Maps to initial/max pages per the tier table in section 3.
2. **[Change]** Update `DEFAULT_MAX_MEMORY_PAGES` from 1024 to 512 for `standard` tier (32 MB is sufficient; 64 MB reserved for `heavy`/`canvas`).
3. **[Add]** Emit a WASM custom section `clean:memory` containing `{ tier, initial_pages, max_pages }` so hosts can read the module's intended configuration.
4. **[Fix]** Reconcile the two `HEAP_START` constants: codegen's 1 KB (`mod.rs:60`) is for data-section layout; runtime's 1 MB (`native_stdlib/mod.rs:28`) is for `__heap_ptr`. Document the distinction in code comments.
5. **[Add]** Per-target tier defaults: `--target embedded` implies `--memory-tier embedded`, `--target web` implies `standard`, etc. (section 3.2).

### Component: clean-server

1. **[Add]** `StoreLimitsBuilder` on every `Store` with `memory_size()` from tier and `trap_on_grow_failure(true)`. See section 5.1.
2. **[Add]** `--memory-limit <MB>` and `--memory-tier <tier>` CLI flags / `CLEAN_MEMORY_LIMIT_MB` env var.
3. **[Change]** Update growth strategy from exact-fit to 1.5x amortized (section 4.2) in `ensure_memory_capacity()`.
4. **[Add]** Structured logging for `memory.grow()` events and OOM traps (section 9.2).
5. **[Fix]** Read `__heap_ptr` from WASM instance exports instead of hardcoding 65,536 (section 7.2).

### Component: host-bridge

1. **[Fix]** `WasmMemory::new()` must accept initial offset as parameter instead of hardcoding 65,536. The server passes `__heap_ptr` value.
2. **[Change]** Growth strategy in `mem_alloc`: implement 1.5x amortized growth with 4-page floor (section 4.2).
3. **[Add]** Track grow count and peak offset per `WasmMemory` instance for metrics exposure.

### Component: clean-node-server

1. **[Fix]** Read `__heap_ptr` from WASM instance exports to initialize heap state.
2. **[Add]** Per-request memory stats logging (peak allocation, grow count).
3. **[Add]** `--memory-limit <MB>` CLI flag that enforces a cap on total allocation.

### Component: frame.canvas (JS runtime)

1. **[Fix]** `loader.js`: Read initial/max pages from the WASM module's memory declaration (or `clean:memory` custom section) instead of hardcoding 256 / 1024.
2. **[Add]** Expose `window.__cleanRuntime.memoryStats()` (section 9.3).
3. **[Add]** `console.warn` on every `memory.grow()` event.

### Component: frame.ui (JS runtime)

1. **[Fix]** `loader.js`: Verify `heapPtr` initialization reads `__heap_ptr` from exports (currently does — validate no fallback to 4096 is triggered for new modules).
2. **[Add]** Expose `window.__cleanRuntime.memoryStats()` (section 9.3).

### Component: frame.canvas plugin.toml

1. **[Add]** `[memory] tier = "canvas"` declaration so the compiler automatically uses the canvas tier.

### Component: frame.ui plugin.toml

1. **[Add]** `[memory] tier = "heavy"` when SSR mode is enabled, `"standard"` otherwise.

---

## 12. Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Old `.wasm` (no `clean:memory` section) on new server | Server uses `standard` tier defaults. StoreLimits still apply. |
| Old `.wasm` (no `__heap_ptr` export) on new server | Host bridge falls back to 65,536 offset (current behavior). |
| New `.wasm` on old server (no StoreLimits) | Module runs as before. Operator should upgrade server. |
| `--memory-limit` lower than module's declared max | StoreLimits wins. Module's `memory.grow()` traps at the host limit. |

---

## 13. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Keep bump allocator for server | Correct for per-request lifecycle. Simpler than general-purpose allocator. No fragmentation. | dlmalloc, wee_alloc |
| 1.5x growth factor | Industry standard amortized growth. Reduces grow count by ~60% for linear workloads. | 2x (too aggressive for constrained targets), exact-fit (current, too many grows) |
| `trap_on_grow_failure(true)` | Clean Language modules have no OOM recovery. A trap gives a clear error. | Return -1 (silent failure, causes harder-to-debug crashes later) |
| Five tiers (not three) | Deployment targets span IoT to game rendering. Three tiers would force bad fits. | Three tiers (embedded/standard/heavy), configurable-only |
| Custom section for tier metadata | Allows host to auto-detect without CLI flags. Non-breaking (ignored by hosts that don't read it). | CLI-only configuration, package.clean.toml |
