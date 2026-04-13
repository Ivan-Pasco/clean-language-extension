# Clean Language & Frame Framework Implementation Plan

This document provides a comprehensive plan for:
1. Fixing critical compiler bugs
2. Completing the Frame Framework implementation

---

## Part 1: Compiler Bug Fixes

### Overview

Two critical bugs were discovered during Frame canvas plugin development. These bugs affect all WASM compilation and must be fixed before framework development can proceed reliably.

---

### Bug 1: Unused Return Values Not Dropped

**Severity**: CRITICAL
**Location**: `clean-language-compiler/src/codegen/`

**Problem**: When a function call returns a value but that value is not assigned to a variable, the compiler does not emit a `drop` instruction. This leaves a value on the WASM stack, causing validation error: "type mismatch in return".

**Example that fails**:
```clean
void draw()
    _canvas_clear(canvasId)  // Returns integer, not used - STACK IMBALANCE
    _canvas_circle_filled(canvasId, 100.0, 100.0, 50.0, "#ff0000")
```

**Expected behavior**: Compiler should emit `drop` after any expression statement that leaves a value on the stack.

**Root Cause Analysis**:
- `statement_generator.rs:378-425` has `generate_expression_statement()` that DOES call `drop`
- Bug occurs when function calls bypass this path (e.g., in certain nested contexts)
- Two codegen paths exist: old AST-to-WASM and new MIR-to-WASM
- The old path in `statement_generator.rs` may not be consistently used

**Files to investigate**:
- `src/codegen/statement_generator.rs` - Lines 378-425 (expression statement handling)
- `src/codegen/mod.rs` - Main codegen that might bypass statement_generator
- `src/codegen/mir_codegen.rs` - Lines 2899-2903 (MIR path handles this correctly)

---

### Bug 2: Nested If-Else Generates Unreachable

**Severity**: CRITICAL
**Location**: `clean-language-compiler/src/codegen/`

**Problem**: When a void function contains nested if-else statements, the compiler generates `unreachable` instructions after else blocks, causing runtime trap.

**Example that fails**:
```clean
void updateGame()
    if ballY > 600.0
        lives = lives - 1
        if lives <= 0
            gameOver = true
        else
            resetBall()  // After this, compiler adds 'unreachable' - TRAP!
```

**Expected behavior**: Void functions with nested if-else should NOT generate unreachable unless both branches explicitly return.

**Root Cause Analysis**:
- `statement_generator.rs:478-506` uses `BlockType::Empty` for all if statements
- `mir_codegen.rs:1437-1543` has sophisticated handling but adds `Unreachable` at line 1489
- The unreachable is correct ONLY when both branches return - but it's being added incorrectly

**Files to investigate**:
- `src/codegen/statement_generator.rs` - Lines 478-506 (if statement generation)
- `src/codegen/mir_codegen.rs` - Lines 1437-1543, especially 1487-1489

---

### Compiler Fix Prompt

Use this prompt in the clean-language-compiler project:

```
## Task: Fix Two Critical WASM Code Generation Bugs

### Context
The Clean Language compiler has two bugs that cause invalid WASM generation:

1. **Unused return values not dropped** - Function calls that return values but aren't assigned leave values on the stack
2. **Nested if-else generates unreachable** - Void functions with nested if-else trap at runtime

### Bug 1: Unused Return Values

**Location**: `src/codegen/statement_generator.rs` and potentially `src/codegen/mod.rs`

**Current behavior**:
- `generate_expression_statement()` at line 419 does emit `drop` for non-Unit returns
- But some code paths bypass this function

**Required fix**:
1. Ensure ALL expression statements go through `generate_expression_statement()`
2. Or add drop logic to any path that can have a function call as a statement
3. Check `mod.rs` for direct statement handling that skips statement_generator

**Test case** - Create `tests/cln/codegen/unused_return_value.cln`:
```clean
// Test: Function calls with unused return values should compile
// The compiler must emit 'drop' for unused returns

integer getValue()
    return 42

void useValue()
    integer x = getValue()  // Used - OK

void ignoreValue()
    getValue()  // Unused - must emit drop

void multipleIgnored()
    getValue()  // drop
    getValue()  // drop
    getValue()  // drop
    integer x = 1  // This should still work

void mixedUsage()
    getValue()  // drop
    integer a = getValue()  // used
    getValue()  // drop
    integer b = getValue()  // used

void start()
    useValue()
    ignoreValue()
    multipleIgnored()
    mixedUsage()
```

### Bug 2: Nested If-Else Unreachable

**Location**: `src/codegen/statement_generator.rs:478-506` and `src/codegen/mir_codegen.rs:1437-1543`

**Current behavior**:
- Generates `Unreachable` after if-else even when branches don't return
- This is only correct when BOTH branches have explicit returns

**Required fix**:
1. Track whether each branch has an explicit return statement
2. Only emit `Unreachable` if BOTH branches return (function is guaranteed to have returned)
3. For void functions with no returns, do NOT emit unreachable

**Test case** - Create `tests/cln/codegen/nested_if_else.cln`:
```clean
// Test: Nested if-else in void functions should not generate unreachable

state:
    integer lives = 3
    boolean gameOver = false
    number ballY = 650.0

functions:
    void resetBall()
        ballY = 300.0

    void simpleIfElse()
        if lives > 0
            lives = lives - 1
        else
            gameOver = true
        // Should NOT have unreachable here

    void nestedIfElse()
        if ballY > 600.0
            lives = lives - 1
            if lives <= 0
                gameOver = true
            else
                resetBall()
            // Should NOT have unreachable here
        // Should NOT have unreachable here

    void deeplyNested()
        if lives > 0
            if ballY > 500.0
                if gameOver == false
                    lives = lives - 1
                else
                    resetBall()
                // No unreachable
            else
                gameOver = true
            // No unreachable
        // No unreachable

    void ifWithReturn()
        if lives <= 0
            return
        // Code after if should execute
        lives = lives - 1

    void ifElseWithReturns()
        if lives <= 0
            return
        else
            return
        // Unreachable IS correct here - both branches return

void start()
    simpleIfElse()
    nestedIfElse()
    deeplyNested()
    ifWithReturn()
    ifElseWithReturns()
```

### Testing Instructions

1. **Compile test files**:
   ```bash
   cargo run --bin clean-language-compiler compile -i tests/cln/codegen/unused_return_value.cln -o tests/output/unused_return_value.wasm
   cargo run --bin clean-language-compiler compile -i tests/cln/codegen/nested_if_else.cln -o tests/output/nested_if_else.wasm
   ```

2. **Validate WASM** (should not error):
   ```bash
   wasm-validate tests/output/unused_return_value.wasm
   wasm-validate tests/output/nested_if_else.wasm
   ```

3. **Run with wasmtime** (should not trap):
   ```bash
   wasmtime tests/output/unused_return_value.wasm
   wasmtime tests/output/nested_if_else.wasm
   ```

4. **Debug WASM output** (to verify drop/unreachable):
   ```bash
   wasm2wat tests/output/unused_return_value.wasm | grep -E "(drop|unreachable|call)"
   wasm2wat tests/output/nested_if_else.wasm | grep -E "(drop|unreachable)"
   ```

### Success Criteria

1. Both test files compile without errors
2. `wasm-validate` passes on both outputs
3. `wasmtime` runs both without trapping
4. WASM disassembly shows:
   - `drop` after function calls with unused returns
   - NO `unreachable` after if-else in void functions (except when both branches return)

### Additional Context

- Two codegen paths exist: old (statement_generator.rs) and new (mir_codegen.rs)
- Fixes may be needed in both paths
- The MIR path at line 2899-2903 correctly handles drops
- The MIR path at line 1487-1489 adds unreachable but needs condition check
```

---

## Part 2: Frame Framework Implementation Plan

### Phase Overview

| Phase | Focus | Priority | Dependencies |
|-------|-------|----------|--------------|
| 1 | Host Bridge Foundation | CRITICAL | Compiler fixes |
| 2 | Frame CLI | CRITICAL | Phase 1 |
| 3 | Frame Server | CRITICAL | Phase 1, 2 |
| 4 | Frame Data (ORM) | CRITICAL | Phase 1, 3 |
| 5 | Frame UI | MEDIUM-HIGH | Phase 3 |
| 6 | Frame Auth | MEDIUM-HIGH | Phase 3, 4 |
| 7 | Frame Plugins | LOW | Phase 1-6 |
| 8 | Platform Support | MEDIUM-HIGH | Phase 1-6 |

---

### Phase 1: Host Bridge Foundation

**Goal**: Implement all bridge namespaces that WASM modules use to interact with the host.

**Reference**: `documents/specification/frame_bridge_contracts.md`

#### 1.1 HTTP Bridge (`bridge:http`)

```rust
// Request structure
{
  "fn": "bridge:http.request",
  "args": {
    "method": "GET|POST|PUT|DELETE|PATCH",
    "url": "https://...",
    "headers": { "key": "value" },
    "body": "..."
  }
}

// Response structure
{
  "ok": true,
  "data": {
    "status": 200,
    "headers": { "key": "value" },
    "body": "..."
  }
}
```

**Tasks**:
- [ ] Implement `bridge:http.request` for outbound HTTP
- [ ] Implement `bridge:http.respond` for SSR responses
- [ ] Implement `bridge:http.redirect`
- [ ] Add request parsing (headers, body, query params)
- [ ] Add response serialization (JSON, HTML)
- [ ] Write tests

#### 1.2 Database Bridge (`bridge:db`)

```rust
// Query structure
{
  "fn": "bridge:db.query",
  "args": {
    "sql": "SELECT * FROM users WHERE id = $1",
    "params": [123]
  }
}
```

**Tasks**:
- [ ] Implement `bridge:db.query` with parameterized queries
- [ ] Implement `bridge:db.tx` for transactions
- [ ] Add PostgreSQL driver
- [ ] Add SQLite driver
- [ ] Implement connection pooling
- [ ] Write tests

#### 1.3 Environment Bridge (`bridge:env`)

**Tasks**:
- [ ] Implement `bridge:env.get`
- [ ] Implement `bridge:env.list`
- [ ] Add secure secret handling
- [ ] Write tests

#### 1.4 Time Bridge (`bridge:time`)

**Tasks**:
- [ ] Implement `bridge:time.now`
- [ ] Implement `bridge:time.sleep`
- [ ] Add timezone support
- [ ] Write tests

#### 1.5 Crypto Bridge (`bridge:crypto`)

**Tasks**:
- [ ] Implement `bridge:crypto.random`
- [ ] Implement `bridge:crypto.hash` (SHA256/512)
- [ ] Implement `bridge:crypto.verify` (bcrypt/argon2)
- [ ] Implement `bridge:crypto.sign` (JWT)
- [ ] Write tests

#### 1.6 Log Bridge (`bridge:log`)

**Tasks**:
- [ ] Implement `bridge:log.info`, `warn`, `error`
- [ ] Add structured logging
- [ ] Add log level filtering
- [ ] Write tests

#### 1.7 Filesystem Bridge (`bridge:fs`)

**Tasks**:
- [ ] Implement `bridge:fs.read`
- [ ] Implement `bridge:fs.write`
- [ ] Implement `bridge:fs.list`
- [ ] Add sandboxing
- [ ] Write tests

#### 1.8 System Bridge (`bridge:sys`)

**Tasks**:
- [ ] Implement `bridge:sys.exit`
- [ ] Implement `bridge:sys.platform`
- [ ] Write tests

---

### Phase 2: Frame CLI

**Goal**: Build the command-line tool for Frame development.

**Reference**: `documents/specification/02_frame_cli.md`

#### 2.1 Core Commands

| Command | Description |
|---------|-------------|
| `frame new <name>` | Create new project |
| `frame serve` | Development server with hot reload |
| `frame build` | Production build |
| `frame test` | Run tests |

#### 2.2 Database Commands

| Command | Description |
|---------|-------------|
| `frame db:plan` | Show migration plan |
| `frame db:migrate` | Run migrations |
| `frame db:seed` | Seed database |
| `frame db:reset` | Reset database |

#### 2.3 API Commands

| Command | Description |
|---------|-------------|
| `frame api:spec` | Generate OpenAPI spec |
| `frame api:sdk` | Generate client SDKs |

#### 2.4 Platform Commands

| Command | Description |
|---------|-------------|
| `frame pwa:init` | Initialize PWA |
| `frame mobile:init` | Initialize mobile (Capacitor) |
| `frame desktop:init` | Initialize desktop (Tauri) |

---

### Phase 3: Frame Server

**Goal**: Build the HTTP server runtime that executes WASM modules.

**Reference**: `documents/specification/03_frame_server.md`

#### 3.1 WASM Runtime

**Tasks**:
- [ ] WASM module loading
- [ ] Module caching
- [ ] Execution sandboxing
- [ ] Per-request isolation

#### 3.2 HTTP Router

**Tasks**:
- [ ] File-based routing
- [ ] Dynamic route parameters (/:id)
- [ ] Query parameter parsing
- [ ] Request body parsing (JSON, form)

#### 3.3 Endpoints System

Parse and execute `endpoints:` blocks:

```clean
endpoints:
    GET /users:
        guard: auth.requireLogin()
        returns: Array<User>
        cache: ttl=60
        handle:
            users = User.find:
                order: createdAt desc
                limit: 100
            return json(users)
```

#### 3.4 SSR Pipeline

**Tasks**:
- [ ] Server-side rendering engine
- [ ] Component tree rendering
- [ ] HTML generation
- [ ] Islands manifest for hydration

---

### Phase 4: Frame Data (ORM)

**Goal**: Implement the type-safe ORM layer.

**Reference**: `documents/specification/04_frame_data.md`

#### 4.1 Model Definitions

```clean
data User:
    id: integer pk auto
    email: string unique
    name: string
    createdAt: datetime default=now()
```

#### 4.2 Query Builder

```clean
users = User.find:
    where:
        status == "active"
        age >= 18
    order: createdAt desc
    limit: 10
```

#### 4.3 Mutations

```clean
User.insert:
    email: "test@example.com"
    name: "Test User"

User.update:
    where: id == userId
    set:
        name: newName

User.delete:
    where: id == userId
```

#### 4.4 Transactions

```clean
Data.tx:
    User.insert: ...
    Order.insert: ...
    // Auto-rollback on error
```

#### 4.5 Migrations

**Tasks**:
- [ ] Schema diff algorithm
- [ ] SQL generation (up/down)
- [ ] Migration version tracking
- [ ] Rollback support

---

### Phase 5: Frame UI

**Goal**: Implement the UI component system with SSR and hydration.

**Reference**: `documents/specification/05_frame_ui.md`

#### 5.1 Component System

```clean
component UserCard:
    props:
        user: User
        showEmail: boolean = false

    render()
        <div class="card">
            <h2>{user.name}</h2>
            {if showEmail}
                <p>{user.email}</p>
            {/if}
        </div>
```

#### 5.2 Hydration Strategies

| Strategy | Behavior |
|----------|----------|
| `client="off"` | SSR only, no JS |
| `client="on"` | Hydrate on load |
| `client="visible"` | Hydrate when visible |
| `client="idle"` | Hydrate when idle |
| `client="only"` | Client-only, no SSR |

#### 5.3 Event Handling

```clean
<button onClick={handleClick}>Click me</button>
<input onInput={handleInput} />
```

---

### Phase 6: Frame Auth

**Goal**: Implement authentication and authorization.

**Reference**: `documents/specification/06_frame_auth.md`

#### 6.1 Session Authentication

**Tasks**:
- [ ] Session creation/destruction
- [ ] HTTP-only cookies
- [ ] CSRF protection
- [ ] Session storage (memory, Redis, DB)

#### 6.2 JWT Authentication

**Tasks**:
- [ ] JWT signing (HS256, RS256)
- [ ] JWT verification
- [ ] Refresh token flow
- [ ] Token expiration

#### 6.3 Roles & Permissions

```clean
// config/roles.cln
roles:
    admin:
        permissions: ["*"]
    user:
        permissions: ["read:own", "write:own"]
    guest:
        permissions: ["read:public"]
```

---

### Phase 7: Frame Plugins (Canvas Already Done)

**Goal**: Plugin system for extensibility.

**Reference**: `documents/specification/07_frame_plugins.md`

#### Completed
- [x] `frame.canvas` - Graphics, animation, audio, input, sprites

#### Remaining
- [ ] Plugin discovery system
- [ ] Plugin lifecycle management
- [ ] Plugin sandboxing
- [ ] Hook system (UI, CLI, server, data, build)

---

### Phase 8: Platform Support

**Goal**: Multi-platform deployment.

**Reference**: `documents/specification/08_frame_platforms.md`

| Platform | Technology | Status |
|----------|------------|--------|
| Web | Static files | Pending |
| PWA | Service Worker | Pending |
| Mobile | Capacitor | Pending |
| Desktop | Tauri | Pending |
| Server | Node/Rust/Deno | Pending |

---

## Implementation Order

### Immediate (Blocking)
1. **Fix compiler bugs** - Required for reliable WASM generation

### Short Term
2. **Phase 1: Host Bridge** - Foundation for everything
3. **Phase 2: Frame CLI** - Developer tooling
4. **Phase 3: Frame Server** - HTTP runtime

### Medium Term
5. **Phase 4: Frame Data** - ORM layer
6. **Phase 5: Frame UI** - Component system
7. **Phase 6: Frame Auth** - Security layer

### Long Term
8. **Phase 7: Plugins** - Extensibility
9. **Phase 8: Platforms** - Multi-platform support

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Compilation time | < 1s per 1000 LOC |
| Incremental rebuild | < 100ms |
| First request (SSR) | < 50ms |
| API latency (p95) | < 10ms simple, < 100ms with DB |
| Throughput | > 10k req/sec |
| Test coverage | > 80% critical paths |

---

## Testing Strategy

### Unit Tests
- Each bridge function
- Each ORM operation
- Each component lifecycle

### Integration Tests
- Full HTTP request/response cycle
- Database transactions
- Component rendering

### E2E Tests
- Complete user flows
- Multi-step transactions
- Error scenarios

---

## Next Steps

1. **Copy the compiler fix prompt** to the clean-language-compiler project
2. **Create the test files** as specified
3. **Fix the bugs** and verify with tests
4. **Return to Frame Framework** and start Phase 1

---

*Last Updated: 2026-01-15*
