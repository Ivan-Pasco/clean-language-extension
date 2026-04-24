Component: frame.ui plugin (clean-framework/plugins/frame.ui)
Issue Type: feature
Priority: high
Description: Client-side HTTP Fetch, WebSocket, and Server-Sent Events bridge capabilities
Context: Any Clean Language application that needs browser-side HTTP requests, real-time data, or API communication currently has no way to do so from .cln code. This forces developers to write external JavaScript files, violating the core Clean Language principle that applications use Clean for ALL layers — server, database, UI, and communication.

---

## Objective

Investigate, design, and propose the best structure and syntax for client-side HTTP and real-time communication capabilities in the `frame.ui` plugin. The goal is to enable Clean Language applications to handle all browser-side communication — HTTP requests, WebSocket connections, and Server-Sent Events — entirely from `.cln` code with zero JavaScript.

This is a foundational capability. Any interactive application (forms, dashboards, admin panels, collaborative tools, real-time feeds) needs to communicate with APIs. Without this, Clean Language cannot fulfill its promise of being a complete application language.

The design must follow Clean Language principles:
- **One way to do things** — a single, clear API pattern for each capability
- **Type-safe** — leverage Clean's type system to prevent misuse at compile time
- **Simple and friendly** — high-level abstractions that hide browser complexity; common use cases should require minimal code
- **Consistent** — follow existing frame.ui patterns (event handlers, state, dot notation)
- **Zero JavaScript** — developers should never need to write JS for standard communication patterns

---

## Current Architecture Context

### Existing Patterns to Follow

**Event handler pattern** (the core async model):
```clean
start:
    integer s = ui.onEvent(".button", "click", 0)

functions:
    handle_event_0()
        string value = ui.eventAttr("data-id")
        integer s = ui.addClass(".result", "visible")
```

- `ui.onEvent(selector, event, handler_idx)` registers a handler
- `handle_event_N()` is called asynchronously when the event fires
- Context functions (`ui.eventAttr`, `ui.eventValue`) provide event data inside the handler
- `ui.setTimeout(handler_idx, delay)` demonstrates non-DOM async callbacks into the same pattern

**State management:**
```clean
integer s = ui.setState("key", "value")
string val = ui.getState("key")
```

**Bridge function naming:** `ui.functionName()` in Clean -> `_ui_functionName` in bridge

**Bridge signature convention (plugin.toml):**
```toml
{ name = "_ui_functionName", params = ["string", "string"], returns = "string", expand_strings = true }
```

**Memory model:** Length-prefixed strings, 8-byte aligned heap, heap resets between handler invocations.

---

## Capability 1: HTTP Fetch

### Requirements

1. Make GET, POST, PUT, PATCH, DELETE requests from browser-side WASM
2. Set custom headers (Authorization, Content-Type, custom headers)
3. Send request body (JSON, form data, plain text)
4. Receive response status code, headers, and body
5. Handle success and error cases
6. Support async (non-blocking) responses via handler callback pattern

### Use Cases to Support

**Simple GET:**
```
Fetch JSON from an API and display the result in the page.
```

**Authenticated POST:**
```
Submit form data with a Bearer token in the Authorization header.
Read the response to determine success/failure and update the UI accordingly.
```

**File upload:**
```
POST multipart form data to an upload endpoint.
```

**Response-driven UI updates:**
```
Based on the response status and body, add/remove CSS classes,
update element text, show error messages, or navigate to a different page.
```

**Polling:**
```
Periodically fetch a status endpoint and update a dashboard widget.
```

### Design Questions to Investigate

- Should fetch be **synchronous-looking** (blocking the handler, returning the response directly) or **async** (registering a response handler via handler_idx, like ui.onEvent)?
  - Note: JavaScript fetch is inherently async. Blocking WASM on fetch requires SharedArrayBuffer + Atomics, which has COOP/COEP header requirements. Investigate feasibility, browser compatibility, and tradeoffs.
  - Alternative: async pattern using `handle_event_N` for response callbacks, with response data available via context functions (like the `ui.eventAttr` pattern).
  
- How should request options be structured? Consider:
  - Individual parameters: `ui.fetch(url, method, headers_json, body)` — simple but limited
  - Builder pattern: `ui.fetchSetHeader(name, value)` then `ui.fetchSend(url, method, body, handler_idx)` — flexible, composable
  - Object/pairs approach: leverage Clean's `pairs` type or a structured format

- How should response data be accessed in the response handler? Consider:
  - Return full response as JSON string: `{"status": 200, "body": "...", "headers": {...}}`
  - Context functions in response handler: `ui.responseStatus()`, `ui.responseBody()`, `ui.responseHeader(name)`
  - State-based: response auto-stored in state, accessible via `ui.getState("last-response")`

- How should errors (network failure, timeout, non-2xx) be handled?
  - Separate error handler index?
  - Error information in the same response handler via status code (e.g., 0 for network error)?
  - Both?

### Aspirational Syntax (for reference — propose better if found)

```clean
start:
    integer s = ui.onEvent(".submit-btn", "click", 10)

functions:
    handle_event_10()
        string id = ui.eventAttr("data-id")
        string token = ui.inputValue("#apiKey")
        string body = ui.formJson("#myForm")
        integer s = ui.fetchHeader("Authorization", "Bearer " + token)
        s = ui.fetchHeader("Content-Type", "application/json")
        s = ui.fetch("/api/items/" + id, "POST", body, 11)

    handle_event_11()
        integer status = ui.responseStatus()
        string body = ui.responseBody()
        if status == 200
            integer s = ui.addClass(".result-msg", "success")
            s = ui.updateElement(".result-msg", "Done!")
        else
            string error = json.get(body, "error")
            integer s = ui.addClass(".result-msg", "error")
            s = ui.updateElement(".result-msg", error)
```

---

## Capability 2: WebSocket

### Requirements

1. Connect to a WebSocket endpoint from browser WASM
2. Send text messages
3. Receive messages asynchronously via handler callback
4. Handle connection lifecycle (open, close, error events)
5. Support multiple simultaneous connections (identified by ID or URL)
6. Reconnection strategy (auto-reconnect with configurable backoff)

### Use Cases to Support

**Live data feeds:**
```
Connect to a WebSocket endpoint.
On each message, update a counter, append a row, or refresh a widget.
```

**Chat or collaboration:**
```
Send and receive messages in real time.
Maintain connection state (connected/disconnected indicator).
```

**Bidirectional control:**
```
Send commands to a server process.
Receive status updates and output in real time.
```

**Multi-channel subscriptions:**
```
Connect to multiple WebSocket endpoints simultaneously.
Route messages from each to different UI regions.
```

### Design Questions to Investigate

- How should connections be identified when there are multiple? By URL? By a returned connection ID?
- Should lifecycle events (open, close, error) be separate handler indices or a single handler with a type discriminator?
- How should the developer access message data in the handler? `ui.wsMessage()` context function? Auto-stored in state?
- Should there be a high-level "subscribe" pattern that auto-reconnects?
- How should `ui.wsSend()` work? Pass connection ID + message?

### Aspirational Syntax (for reference)

```clean
start:
    integer s = ui.wsConnect("wss://api.example.com/live", 20, 21, 22)
    // params: url, onMessage handler, onClose handler, onError handler

functions:
    handle_event_20()
        string data = ui.wsMessage()
        string count = json.get(data, "total")
        integer s = ui.updateElement("#live-count", count)

    handle_event_21()
        integer s = ui.addClass("#ws-status", "disconnected")
        s = ui.removeClass("#ws-status", "connected")

    handle_event_22()
        integer s = ui.addClass("#ws-status", "error")
```

---

## Capability 3: Server-Sent Events (SSE)

### Requirements

1. Connect to an SSE endpoint from browser WASM
2. Receive events asynchronously via handler callback
3. Handle named event types (not just "message")
4. Handle connection lifecycle (open, error, reconnect)
5. Access event data, event type, and last-event-id

### Use Cases to Support

**Progress streaming:**
```
Connect to a progress endpoint.
Update a progress bar as percentage events arrive.
```

**Live notifications:**
```
Connect to a notifications endpoint.
Show toast notifications for different event types (info, warning, error).
```

**Log tailing:**
```
Connect to a log stream endpoint.
Append log lines to a container in real time.
```

**Dashboard auto-refresh:**
```
Connect to a stats endpoint.
Update dashboard widgets as new data is pushed from the server.
```

### Design Questions to Investigate

- SSE is simpler than WebSocket (unidirectional, auto-reconnect built-in). Should the API reflect this simplicity with fewer parameters?
- How should named events be handled? One handler per event type? Or one handler with `ui.sseEventType()` context function?
- Should auto-reconnect (built into the browser's EventSource) be exposed, hidden, or configurable?
- Should there be a way to explicitly close the connection? `ui.sseClose(id)`?

### Aspirational Syntax (for reference)

```clean
start:
    integer s = ui.sseConnect("/api/v1/stream", 30)

functions:
    handle_event_30()
        string event_type = ui.sseEventType()
        string data = ui.sseData()
        if event_type == "progress"
            integer s = ui.updateAttr("#progress-bar", "style", "width:" + data + "%")
        if event_type == "notification"
            string msg = json.get(data, "message")
            integer s = ui.updateElement("#toast", msg)
            s = ui.addClass("#toast", "visible")
            s = ui.setTimeout(31, 3000)

    handle_event_31()
        integer s = ui.removeClass("#toast", "visible")
```

---

## Capability 4: High-Level Object Interaction

### Objective

The low-level capabilities (fetch, WebSocket, SSE) provide the foundation, but most developers work with higher-level patterns: calling API endpoints, reading/writing resources, subscribing to data changes. Investigate a **high-level abstraction layer** that lets developers interact with remote objects and APIs using simple, declarative commands — hiding the details of HTTP methods, headers, serialization, and response parsing.

The goal is to make the most common 80% of use cases trivially simple, while the lower-level fetch/ws/sse API remains available for advanced scenarios.

### Design Philosophy

Clean Language values readability and simplicity. A developer building a CRUD interface, a dashboard that polls an API, or a form that submits data should be able to express intent in 1-3 lines, not 10-15. The API should read like what it does, not how it does it.

### Patterns to Investigate

**1. Simple API calling with automatic JSON handling:**
```
Instead of building headers, encoding JSON, parsing responses, and dispatching
to separate handlers — provide a single command that does it all.
```

Aspirational (propose better):
```clean
handle_event_0()
    string result = ui.api("/api/users/42", "GET", "", 1)

handle_event_1()
    integer status = ui.responseStatus()
    string name = ui.responseJson("name")
    string email = ui.responseJson("email")
    integer s = ui.updateElement("#user-name", name)
    s = ui.updateElement("#user-email", email)
```

**2. One-line form submission:**
```
Collect all form fields, POST them as JSON to an endpoint, and route
the response to a handler — all in one call.
```

Aspirational:
```clean
handle_event_0()
    integer s = ui.submitForm("#create-user-form", "/api/users", "POST", 1)

handle_event_1()
    integer status = ui.responseStatus()
    if status == 201
        integer s = ui.locationHref("/users")
```

**3. Direct JSON field access from responses:**
```
Instead of getting the raw body and manually calling json.get() to extract
each field, provide direct field access that navigates nested JSON.
```

Aspirational:
```clean
handle_event_1()
    string name = ui.responseJson("user.name")
    string city = ui.responseJson("user.address.city")
    integer count = ui.responseJson("meta.total").toInteger()
```

**4. Resource binding — connect a DOM element to an API endpoint:**
```
Declare that a DOM element's content should reflect data from an API.
The framework handles fetching, updating, and optionally polling or
subscribing for changes.
```

Aspirational:
```clean
start:
    integer s = ui.bindResource("#user-count", "/api/stats/users", "total", 30000)
    // selector, endpoint, JSON field to display, refresh interval in ms (0 = once)
```

**5. Authenticated session management:**
```
Set a token once, and all subsequent API calls include it automatically.
No need to pass Authorization headers on every request.
```

Aspirational:
```clean
start:
    integer s = ui.setAuth("bearer", "token-value-here")
    // all ui.api() and ui.submitForm() calls now include Authorization header

functions:
    handle_event_0()
        integer s = ui.api("/api/protected/data", "GET", "", 1)
        // Authorization: Bearer token-value-here is added automatically
```

**6. List/collection rendering from API data:**
```
Fetch a list from an API and render each item into a container using
a template pattern, without manual iteration.
```

Aspirational:
```clean
handle_event_0()
    integer s = ui.apiList("/api/users", "#user-list", ".user-template", 1)
    // fetch list, clone template for each item, populate fields, append to container

handle_event_1()
    integer count = ui.responseJson("length").toInteger()
    integer s = ui.updateElement("#total-badge", count.toString())
```

### Design Questions to Investigate

- What is the right boundary between "high-level convenience" and "magic that hides too much"? Clean Language values explicitness — the abstractions should be predictable.
- Should high-level commands be separate functions or built on top of the lower-level fetch API? (i.e., `ui.api()` internally calls `ui.fetch()` with defaults)
- How should authentication state be scoped? Per-page? Per-session? Stored in the state store?
- For resource binding and list rendering, how much should the framework own vs the developer? Consider: what happens when the API returns an error, when the data shape is unexpected, when the list is empty?
- Should there be a `ui.responseJson(path)` that does dot-notation traversal into the response body, or is `json.get(ui.responseBody(), path)` sufficient?
- How do these high-level patterns compose with the lower-level fetch/ws/sse? Can a developer start with `ui.api()` and drop down to `ui.fetch()` when they need more control?

### Key Principle

**The common case should be trivially simple. The uncommon case should be possible.** A developer building a standard CRUD app should rarely need to think about HTTP methods, headers, or JSON serialization. A developer building a custom protocol should have full control via the lower-level API.

---

## Cross-Cutting Design Concerns

### 1. Form Data Helpers

All three capabilities benefit from easy form data collection. Currently there is no way to read input values from the DOM outside of an event target. Investigate adding:
- `ui.inputValue(selector)` — get the value of any input/textarea/select by CSS selector
- `ui.formJson(selector)` — collect all named inputs within a form as a JSON object string
- `ui.formData(selector)` — collect as URL-encoded key=value pairs

These are essential for any form submission workflow and would be useful even without the fetch capability.

### 2. Response/Message Context Pattern

Fetch responses, WebSocket messages, and SSE events all deliver data to a handler. Should they use:
- **Unified context pattern**: `ui.asyncData()` returns the payload regardless of source type, with `ui.asyncType()` to discriminate (fetch/ws/sse)
- **Separate context functions**: `ui.responseBody()`, `ui.wsMessage()`, `ui.sseData()` — explicit, no ambiguity, but more functions to declare
- **State-based**: auto-write to a named state key that the handler reads via `ui.getState()`

Consider: a developer might use the same handler index for multiple sources. How does the context pattern handle that? Is it a design error or a valid use case?

### 3. Connection Lifecycle Management

- How are connections stored internally? Map keyed by URL? By a generated integer ID returned from connect?
- Explicit teardown: `ui.wsClose(id)` / `ui.sseClose(id)` — needed for cleanup
- What happens on page navigation? All connections should auto-close.
- Should connection state be queryable? `ui.wsState(id)` returning "connecting"/"open"/"closed"?

### 4. Error Handling Philosophy

Clean Language avoids exceptions and uses return values. How should network errors surface?
- HTTP: status code 0 for network error, actual HTTP status for server errors
- WebSocket/SSE: dedicated error handler index with `ui.errorMessage()` context function
- Timeouts: configurable per-request? Global default?
- The pattern should make it impossible to silently ignore errors — every fetch should require a response handler

### 5. Security Considerations

- CORS implications for cross-origin fetch requests
- Credential handling (cookies via `credentials: include`, auth headers)
- WebSocket origin validation
- Should the plugin enforce same-origin by default and require explicit opt-in for cross-origin?
- How should sensitive data (tokens, keys) be handled in WASM memory? (heap resets help, but investigate)

### 6. Plugin.toml Declaration Pattern

Each new bridge function needs a declaration following the existing convention:
```toml
{ name = "_ui_fetch", params = ["string", "string", "string", "integer"], returns = "integer", description = "...", expand_strings = true }
```

Group the new functions logically in the bridge section with clear comments.

### 7. Loader.js Implementation Pattern

Each bridge function is implemented in the env object passed to `WebAssembly.instantiate`. Follow existing patterns for:
- String parameter reading: `readString(ptr, len)`
- String return writing: `writeString(str)` returns heap pointer
- Heap management: respect `heapPtr` and 8-byte alignment
- Async callbacks: use `handle_event_N` dispatch pattern (same as `_ui_setTimeout`)
- State isolation: reset `heapPtr` to `baseHeapPtr` before invoking async handlers

---

## Deliverables Requested

1. **Investigation report**: Analyze the feasibility of synchronous vs async fetch in WASM, SharedArrayBuffer requirements, browser compatibility implications, and recommended approach.

2. **Proposed API design**: Complete function signatures for all three capabilities (fetch, WebSocket, SSE) including:
   - Clean Language syntax (what the developer writes in .cln files)
   - Plugin.toml bridge declarations
   - Loader.js implementation sketches
   - Rationale for each design decision

3. **Form helper design**: Proposed functions for collecting form data from the DOM, independent of but complementary to the fetch capability.

4. **High-level API design**: Proposed abstractions for common patterns:
   - Simple API calling with automatic JSON handling
   - One-line form submission
   - Direct response field access
   - Resource binding (DOM element linked to API data)
   - Session/auth management
   - List rendering from API data
   - Clear layering: how high-level commands compose with low-level fetch/ws/sse

5. **Example programs**: Complete .cln examples showing real-world patterns:
   - CRUD interface using high-level API commands
   - Authenticated API call with form data collection
   - WebSocket live data feed with connection status
   - SSE progress streaming with auto-updating UI
   - Polling pattern using fetch + setTimeout
   - Mixed pattern: high-level for simple calls, low-level for custom protocol

6. **Specification update**: Proposed additions to the Language Specification and plugin documentation.

---

## Files Affected

- `clean-framework/plugins/frame.ui/plugin.toml` — new bridge function declarations
- `clean-framework/plugins/frame.ui/src/` — plugin source (if compilation logic needed)
- Clean server's loader.js template — bridge function implementations for the browser runtime
- Clean compiler — only if new syntax is needed (unlikely; should work with existing function call syntax and the `expand_strings` convention)

## Reference Files

- Current plugin.toml: `~/.cleen/plugins/frame.ui/2.6.1/plugin.toml` (62 existing bridge functions)
- Execution layers: `platform-architecture/EXECUTION_LAYERS.md`
- Host bridge spec: `platform-architecture/HOST_BRIDGE.md`
- Memory model: `platform-architecture/MEMORY_MODEL.md`
