# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MCP Server — Use It First

**CRITICAL: Before writing ANY Clean Language code, call `get_quick_reference` from the clean-language MCP server.** This gives you the correct, up-to-date syntax. Do NOT write Clean code from memory — always verify against the MCP tools.

Available MCP tools: `get_quick_reference`, `check`, `compile`, `parse`, `get_specification`, `list_functions`, `list_types`, `list_builtins`, `list_plugins`, `get_architecture`, `explain_error`

The MCP server is configured in `.mcp.json`. Start it with: `cln mcp-server`

## Overview

This is a Rust-based compiler for Clean Language, a type-safe programming language that compiles to WebAssembly. Clean Language combines JavaScript-like readability with Rust-like safety features.

Language characteristics are described in the [Language Specification](./Language-Specification.md). if you find something that is not described in the specification, propose a change to the specification before implementing it. When something is added you need to update the specification.

## Formal Specifications (`foundation/spec/`)

The `foundation/spec/` directory contains the formal, machine-readable specifications that are the single source of truth for language correctness (Principles 2 and 3):

- **[`foundation/spec/grammar.ebnf`](./spec/grammar.ebnf)** — Core language syntax in EBNF (authoritative)
- **[`foundation/spec/semantic-rules.md`](./spec/semantic-rules.md)** — Numbered semantic rules (SYN, SEM, SCOPE, FUNC, CLASS, etc.)
- **[`foundation/spec/type-system.md`](./spec/type-system.md)** — Type hierarchy, compatibility matrix, conversions
- **[`foundation/spec/stdlib-reference.md`](./spec/stdlib-reference.md)** — 287 built-in functions across 14 categories
- **[`foundation/spec/plugins/`](./spec/plugins/)** — Plugin grammar extensions:
  - `frame-server.ebnf` — endpoints, routing, request/response
  - `frame-data.ebnf` — ORM models, queries, migrations
  - `frame-ui.ebnf` — components, HTML directives, styles
  - `frame-auth.ebnf` — sessions, JWT, roles, CSRF
  - `frame-canvas.ebnf` — canvas scenes, drawing, audio, input

When writing tests, cite the relevant `grammar.ebnf` production rule. When resolving ambiguity, `grammar.ebnf` takes precedence over prose documentation.

**Spec-Implementation Parity (Principle 24):** Everything in the spec must be implemented. Everything implemented must be in the spec. No exceptions.

**Specification Change Control (Principle 25):** NEVER modify spec files without developer approval. If you find a gap between spec and implementation, report it and ask the developer for a decision. You CAN fix compiler bugs to match the spec. You CANNOT add unauthorized syntax to the compiler.

## Platform Architecture

**CRITICAL: Before implementing ANY function, read the Execution Layers specification.**

The runtime platform architecture is documented in [platform-architecture/](./platform-architecture/README.md). This includes:

- **[⚠️ EXECUTION LAYERS](./platform-architecture/EXECUTION_LAYERS.md)** - **READ FIRST: Authoritative definition of which layer executes which functions**
- **[⚠️ IDE EXTENSION ARCHITECTURE](./platform-architecture/IDE_EXTENSION_ARCHITECTURE.md)** - **Language Server is single source of truth for ALL IDE intelligence**
- **[Host Bridge Specification](./platform-architecture/HOST_BRIDGE.md)** - Layer 2: Portable host functions (console, math, string, database, file I/O, HTTP client, crypto)
- **[Memory Model](./platform-architecture/MEMORY_MODEL.md)** - WASM memory layout, string format, bump allocator
- **[Server Extensions](./platform-architecture/SERVER_EXTENSIONS.md)** - Layer 3: HTTP server-specific functions (routing, request context, auth)
- **[Implementing a New Host](./platform-architecture/IMPLEMENTING_HOST.md)** - Guide for building new runtime implementations

### Language Server Responsibility

**CRITICAL:** The language server (included in this compiler) is the **single source of truth** for all IDE language intelligence. The VS Code extension is a thin client — it does NOT hardcode keywords, types, or framework blocks. All syntax highlighting (via semantic tokens), completions, hover, and diagnostics MUST come from the language server. See [IDE Extension Architecture](./platform-architecture/IDE_EXTENSION_ARCHITECTURE.md) for full specification.

### Execution Layer Summary

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **Layer 0** | Compiler | Parse, analyze, generate WASM imports (NOT implementations) |
| **Layer 1** | WASM Runtime | Pure computation (math intrinsics, memory ops) |
| **Layer 2** | Host Bridge | Portable I/O (console, file, HTTP client, DB, crypto) |
| **Layer 3** | Server Extensions | Server-only (HTTP routing, request context, sessions) |
| **Layer 4** | Plugins | Custom bridge functions via plugin.toml |
| **Layer 5** | Framework/Apps | High-level abstractions |

**Rule:** If a function needs external I/O, it belongs in Layer 2+, NOT in the compiler.

When modifying host functions or adding new ones, always:
1. Check EXECUTION_LAYERS.md for correct placement
2. Update the platform architecture documentation

## Common Commands

### Building and Testing
```bash
# Build the compiler
cargo build
make build

# Run all tests
cargo test
make test

# Run integration tests specifically
cargo test --test integration

# Run simple compilation test
cargo run --bin clean-language-compiler simple-test

# Run comprehensive tests
cargo run --bin clean-language-compiler comprehensive-test
```

### Compilation
```bash
# Compile a Clean Language file
cargo run --bin clean-language-compiler compile -i examples/hello.cln -o output.wasm

# Alternative using cleanc binary
cargo run --bin cleanc -- input.clean output.wasm

# Using Makefile
make run INPUT=examples/hello.cln OUTPUT=examples/hello.wasm
```

### Debugging Tools
```bash
# Debug parsing with AST display
cargo run --bin clean-language-compiler debug -i file.clean --show-ast

# Parse with error recovery
cargo run --bin clean-language-compiler parse -i file.clean --recover-errors

# Lint code
cargo run --bin clean-language-compiler lint -i file.clean

# Debug WebAssembly generation
cargo run --bin debug_wasm -- file.wasm

# Debug parser specifically
cargo run --bin debug_parser -- file.clean
```

### Package Management
```bash
# Initialize a new Clean Language package
cargo run --bin clean-language-compiler package init

# Add a dependency
cargo run --bin clean-language-compiler package add package-name

# Install dependencies
cargo run --bin clean-language-compiler package install
```

## Architecture

### Core Components

**Parser** (`src/parser/`): Pest-based parser with error recovery
- Uses `grammar.pest` for grammar rules
- Supports classes, functions, async operations, and inheritance
- Error recovery mode for better debugging

**Semantic Analysis** (`src/semantic/`): Type checking and validation
- Type inference and constraint solving
- Scope management for variables and functions
- Class inheritance validation

**Code Generation** (`src/codegen/`): WebAssembly output
- Generates WASM using `wasm-encoder`
- Memory management and string pooling
- Type-specific instruction generation

**Runtime** (`src/runtime/`): Async and I/O operations
- Async task scheduling
- File I/O operations
- HTTP client functionality

**Standard Library** (`src/stdlib/`): Built-in functions
- Array operations, math functions, string manipulation
- Memory management utilities
- Type conversion functions

### Key Features

**Type System**: Strong static typing with inference
- Primitive types: `integer`, `number`, `string`, `boolean`
- Complex types: `Array<T>`, `Matrix<T>`
- Class inheritance with `base()` constructor calls

**WebAssembly Target**: All code compiles to WASM
- Memory-safe execution
- Portable across platforms
- Integration with existing WASM toolchain

**Error Handling**: Comprehensive error recovery
- Parse errors with recovery suggestions
- Semantic analysis errors with context
- Runtime error propagation with `onError` syntax

## Testing Strategy

The project uses multiple testing approaches:

1. **Unit Tests**: Individual component testing (`cargo test`)
2. **Integration Tests**: End-to-end compilation testing (`tests/integration_tests.rs`)
3. **Parser Tests**: Grammar and parsing validation (`tests/parser_tests/`)
4. **Standard Library Tests**: Built-in function verification (`tests/stdlib_tests.rs`)

## Development Workflow

When implementing new features:

1. Update grammar in `src/parser/grammar.pest` if needed
2. Extend AST definitions in `src/ast/mod.rs`
3. Add parsing logic in appropriate `src/parser/` files
4. Implement semantic analysis in `src/semantic/`
5. Add code generation in `src/codegen/`
6. Write comprehensive tests
7. Update examples and documentation
8. Update the language specification in `Language-Specification.md`
9. when you find an error while compiling, add it to the `TASKS.md` file.
10. when a test fails, check if the test is correct and has the right syntax according to the Language-Specification.md, if it is wrong, fix the test. once the test is fixed if it still fails add the needed changes to the TASKS.md file.

## File Extensions

- `.cln`: Clean Language source files
- `.wasm`: Compiled WebAssembly output
- `package.clean.toml`: Package manifest files

## Development Rules and Guidelines

### Code Quality Standards

1. **NO PLACEHOLDER IMPLEMENTATIONS**: Never create placeholder functions that return dummy values (like `return 0`, `return false`, etc.). All functions must be fully implemented and functional.

2. **NO FALLBACK IMPLEMENTATIONS**: Avoid temporary "simplified" implementations that don't provide the actual functionality. Each function should work as intended.

3. **WORKING CODE ONLY**: All code must be production-ready and functional. If a feature cannot be fully implemented immediately, document it as a task rather than implementing a stub.

### Task Management

1. **TASKS.md TRACKING**: When discovering any error, bug, or incomplete implementation:
   - Add it as a new task in TASKS.md with appropriate priority level
   - Include specific file paths and line numbers
   - Describe the exact issue and expected behavior

2. **TASK COMPLETION UPDATES**: When completing any task:
   - Mark the task as completed in TASKS.md
   - Update the status and add completion notes
   - Include any relevant technical details about the solution

3. **TASK PRIORITIZATION**: Follow the existing priority system in TASKS.md:
   - 🔴 CRITICAL: Core functionality issues that break the compiler
   - 🟡 MEDIUM-HIGH: Important features with significant impact
   - 🟢 LOW: Nice-to-have improvements and optimizations

### Error Handling Philosophy

- Fix the root cause, not the symptoms
- Maintain functional implementations while fixing underlying issues
- Document complex issues that require multi-step solutions
- Always prefer proper fixes over workarounds
- our goal is to reach 100% accuracy on the whole compile and excecution  process. There should be no errors, we wont stop until reaching it. The process should include the testing of all files in the tests folder
- all test files should be inside tests/cln folder inside a logical  category, all the tests compiled from tests/cln folder should be compiled to tests/output folder. before creating a new test file read the tests in the category to verify if there is already a test for it, and if you need to create a new one save it in the same folder.
- for research about rust compilers or pest parser use context7

## COMITA — see ~/.claude/CLAUDE.md

The "comita" workflow is defined in the global CLAUDE.md. Do not duplicate it here.

## Architecture Boundaries

**CRITICAL: Read `foundation/management/ARCHITECTURE_BOUNDARIES.md` before implementing ANY new functionality in ANY component.**

This document defines what each component IS and IS NOT responsible for. It includes a boundary violation detection checklist and delegation patterns. Every component's CLAUDE.md must reference it.

Key boundary principle: **Each component has a single responsibility. If a function doesn't match that responsibility, it belongs in a different component.**

## Cross-Component Work Policy

**CRITICAL: AI Instance Separation of Concerns**

The Clean Language project is organized into multiple components, each in its own folder. When an AI instance is working in one component and discovers errors, bugs, or required changes in **another component** (different folder), it must **NOT** directly fix or modify code in that other component.

### Project Components

| Component | Folder | Purpose |
|-----------|--------|---------|
| Compiler | `clean-language-compiler/` | Clean Language to WASM compiler |
| Framework | `clean-framework/` | Frame full-stack framework |
| Manager | `clean-manager/` | Version manager for Clean Language |
| Extension | `clean-extension/` | VS Code/Cursor extension |
| Server | `clean-server/` | Runtime server |
| Node Server | `clean-node-server/` | Node.js runtime |
| UI | `clean-ui/` | UI components |
| Canvas | `clean-canvas/` | Canvas rendering |
| LLM | `clean-llm/` | LLM integration |
| MCP | `Clean MCP/` | Model Context Protocol |
| cPanel Plugin | `clean-cpanel-plugin/` | cPanel hosting plugin |

### Cross-Component Bug Reporting

When you discover a bug in another component, do NOT fix it directly. Instead:

1. **Call `report_error`** via the MCP server with: error message, reproduction code, compiler version, and affected component
2. The error is tracked in the website's error dashboard with automatic deduplication
3. The developer reviews the dashboard and directs fixes

### What You CAN Do

- Read files from other components to understand interfaces
- Report bugs via `report_error` MCP tool
- Update your component to work with existing interfaces

### What You MUST NOT Do

- Directly edit code in other components
- Make changes to other components' configuration files
- Modify shared resources without coordination

## Documentation Sync Protocol

Facts about the language live in `foundation/spec/` (at the project root). Facts about the platform live in `foundation/platform-architecture/`. Do not duplicate them here — link to them instead.

**When you make a change in this component, update the corresponding spec file in the same commit:**

| Change type | Update required |
|-------------|-----------------|
| New language syntax | `foundation/spec/grammar.ebnf` |
| New semantic rule or error code | `foundation/spec/semantic-rules.md` + `foundation/spec/error-codes.md` |
| New or changed type rule | `foundation/spec/type-system.md` |
| New or changed built-in function | `foundation/spec/stdlib-reference.md` |
| New or changed AST node | `foundation/spec/ast.md` |
| New or changed plugin contract | `foundation/spec/plugins/plugin-contract.md` |
| New or changed host bridge function | `foundation/platform-architecture/HOST_BRIDGE.md` |
| New or changed execution layer | `foundation/platform-architecture/EXECUTION_LAYERS.md` |

The spec files are the single source of truth. Component documentation explains implementation — it does not redefine language rules.