# Cross-Component Prompt: Integral WASM Memory Management Analysis

## Target
Run from the **project root**: `/Users/earcandy/Documents/Dev/Clean Language/`
This is a **research + design** task. No code changes — produce a unified
memory policy document that each component's AI then implements separately.

## Priority
High — memory bugs have been the #1 source of runtime failures in
2026-Q2. Three `RUNTIME_MEMORY_GROW` reports, one `RUNTIME_MEMORY`
report, and one `CODEGEN_MEMORY_MAX` report were filed in a 48-hour
window. Each was patched individually; no root-cause analysis was done
across the stack.

## Problem Statement

Memory management in Clean Language is split across 5 components with
**no shared contract**:

| Component | What it controls | Current behavior |
|---|---|---|
| Compiler | Initial/max pages in emitted WASM | 32 initial (2MB), 1024 max (64MB) |
| JS bridges (node/browser) | `WebAssembly.Memory` object | 1 initial (64KB!), 1024 max |
| Host-bridge (Rust) | `memory.grow()` calls + bump allocator | On-demand, minimum-needed, starts at offset 65536, 8-byte aligned |
| Server (wasmtime) | `Engine` + `Store` configuration | Default config, **no StoreLimits**, no per-instance caps |
| Node server | JS WASM instantiation | Delegates to WASM malloc, no explicit growth |

### Known discrepancies and gaps

1. **JS bridges start at 1 page; compiler declares 32.** When WASM
   imports memory from JS (node/browser targets), the module gets 64KB
   instead of 2MB. The first string allocation that crosses 64KB
   will trigger a grow — or crash if grow isn't wired.

2. **No StoreLimits on the server.** A malicious or buggy WASM module
   can `memory.grow()` until the host process runs out of RAM. There
   is no per-instance cap. The open report `b56d6b70` flagged this.

3. **Bump allocator never frees.** `WasmMemory` at
   `host-bridge/src/wasm_linker/state.rs:108` is a bump allocator
   that resets to 65536 between requests. Within a single request,
   memory only grows. For SSR pages that build large HTML strings,
   this means a single request can exhaust the 64MB max.

4. **Heap start mismatch.** The compiler declares `HEAP_START = 1024`
   (`codegen/mod.rs:60`), but the host-bridge allocator starts at
   `65536` (`state.rs:120`). This means the first 64KB - 1KB is
   wasted or used for the data section, but the contract is implicit.

5. **No memory budget guidance.** Operators have no way to know how
   much RAM a Clean Language app needs. There's no profiling, no
   warnings when memory is high, no metrics exposed.

6. **Growth strategy is "just enough."** `ensure_memory_capacity()`
   grows by the exact number of pages needed. Best practice in
   allocators is to grow by a factor (1.5x or 2x) to avoid frequent
   small growths, each of which is an expensive `memory.grow()` call.

## What This Analysis Must Produce

### Deliverable 1: Current State Map (verify / correct the table above)

Read the actual code in each component. The numbers above come from a
snapshot; they may have changed. Confirm or correct every value. Pay
special attention to:

- Is there a second codegen path that emits different page counts?
- Does the node server's `memory.ts` ever call `memory.grow()`?
- Are there any wasmtime `Config` options set on the `Engine`?

### Deliverable 2: Best Practices Research (use context7)

Research how production wasmtime embedders handle WASM memory. Specific
questions to answer:

1. **StoreLimits**: What's the recommended way to cap per-instance
   memory in wasmtime? What defaults do projects like Spin, Wasmcloud,
   Fastly Compute use?
2. **Growth strategy**: Should the host call `memory.grow()` or should
   the WASM module's own allocator handle it? What does the wasmtime
   team recommend?
3. **Initial vs. max pages**: What ratio is recommended? Is 32
   initial / 1024 max reasonable, or should initial be higher to avoid
   early grows?
4. **Memory pooling**: Does wasmtime support memory pooling across
   instances? Would it help for request-per-instance isolation?
5. **Bump allocator in production**: Is a bump allocator with
   per-request reset a valid strategy, or should we move to a
   proper allocator (e.g., `wee_alloc`, `dlmalloc`)?
6. **Memory metrics**: How do production embedders expose memory
   usage? Prometheus metrics? Structured logs? Per-request tracking?
7. **OOM handling**: What should happen when `memory.grow()` fails?
   Trap? Graceful error? How should the error propagate to the user?

### Deliverable 3: Unified Memory Policy

A document called `platform-architecture/MEMORY_POLICY.md` that
defines:

#### 3a. Memory Budget Tiers

| Tier | Use case | Initial pages | Max pages | Host limit |
|------|----------|---------------|-----------|------------|
| minimal | CLI tools, scripts | ? | ? | ? |
| standard | Web apps, APIs | ? | ? | ? |
| heavy | SSR, large data | ? | ? | ? |

The compiler should default to `standard`; operators can override via
config.

#### 3b. Growth Contract

- **Who grows**: compiler-emitted allocator, host bridge, or both?
- **Growth factor**: exact-fit, 1.5x, 2x, or configurable?
- **Failure mode**: what happens when max is hit?
- **Reset policy**: per-request bump reset, or something smarter?

#### 3c. StoreLimits Specification

Exact `StoreLimitsBuilder` configuration for the Rust server, including:
- Default memory cap
- Whether it's configurable via CLI / env var
- How it interacts with the WASM module's declared max

#### 3d. JS Bridge Alignment

How to fix the 1-page vs 32-page discrepancy in node/browser bridges.
Should JS bridges respect the module's declared initial pages?

#### 3e. Allocator Roadmap

Current bump allocator limitations and whether/when to migrate to a
proper allocator. This is a decision point, not a mandate.

#### 3f. Observability

What memory metrics to expose, where, and how. At minimum:
- Peak memory per request (for the server)
- Total grows per request
- Current memory size on the store

### Deliverable 4: Component-Specific Implementation Tasks

For each component, a numbered list of concrete changes derived from
the policy. These become cross-component prompts or TASKS.md entries.

Format:
```
## Component: clean-language-compiler
1. [Change] Update DEFAULT_MAX_MEMORY_PAGES from X to Y (reason)
2. [Change] Add --memory-tier flag to CLI (minimal/standard/heavy)
3. ...

## Component: clean-server
1. [Change] Add StoreLimitsBuilder with configurable cap
2. [Change] Add --memory-limit CLI flag
3. ...

## Component: host-bridge
1. [Change] Update growth strategy from exact-fit to 1.5x
2. ...

## Component: clean-node-server
1. [Change] Fix initial pages to match module declaration
2. ...
```

### Deliverable 5: Link from Architecture Documents

After the policy document is written:

1. Add a section to `platform-architecture/README.md` pointing to
   `MEMORY_POLICY.md`
2. Update `platform-architecture/MEMORY_MODEL.md` to reference the
   policy for budget/limits decisions (keep the model doc focused on
   layout, move policy to the new doc)
3. Update `platform-architecture/EXECUTION_LAYERS.md` to note which
   layer is responsible for memory growth decisions

## Research Sources

Use **context7** for:
- wasmtime documentation on `StoreLimits`, `ResourceLimiter`,
  `PoolingAllocationConfig`
- How Spin (Fermyon) configures memory limits
- How Wasmcloud handles per-component memory
- WASM memory best practices from the Bytecode Alliance
- Rust allocator patterns for WASM (wee_alloc vs dlmalloc vs bump)

Use **the codebase** for:
- Current values (verify everything above)
- Git history of memory-related commits (`git log --all --grep=memory`)
- Open bug reports (3 resolved, 2 open as of 2026-04-16)

## Constraints

- **Do NOT modify code in any component.** This is research + design.
- **Do NOT modify spec files** without developer approval.
- You MAY create `platform-architecture/MEMORY_POLICY.md` and update
  `platform-architecture/README.md` to link it — these are shared
  architecture docs, not component code.
- The policy must be **implementable independently** by each
  component's AI instance. No changes that require synchronized
  cross-component deploys.
- Backward compatibility: existing `.wasm` files compiled with older
  compilers must still run on updated servers.

## Success Criteria

The analysis is complete when:
1. Every number in the "Current State Map" has a file:line citation
2. Every best-practice recommendation cites a source (context7 doc,
   wasmtime issue, production project config)
3. The policy document is self-contained — a developer reading only
   `MEMORY_POLICY.md` understands the full memory story
4. Each component has ≤ 5 concrete, actionable implementation tasks
5. The architecture docs link to the new policy
