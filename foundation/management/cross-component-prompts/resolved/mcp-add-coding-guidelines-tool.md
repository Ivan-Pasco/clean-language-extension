# MCP Server — Add `get_coding_guidelines` Tool

Component: clean-language-compiler (MCP server in `src/mcp/server.rs`)
Issue Type: feature
Priority: high
Description: Add a `get_coding_guidelines` MCP tool that returns comprehensive coding best practices, idiomatic patterns, known issues, and quality standards for writing Clean Language applications. Currently, AI tools using the MCP server only get syntax from `get_quick_reference` but miss critical practical guidance needed to write correct, idiomatic, production-quality code.
Context: Working on Clean Language projects, extensive practical knowledge has been accumulated about what works, what patterns produce the cleanest results, and which pitfalls to avoid. A centralized MCP tool makes this available to all AI tools automatically.

---

## Suggested Implementation

### Tool Registration

Add to the tool list in `src/mcp/server.rs` (after `get_quick_reference`):

```json
{
  "name": "get_coding_guidelines",
  "description": "Returns comprehensive coding guidelines, idiomatic patterns, known issues, and quality standards for Clean Language development. Call this after get_quick_reference to learn practical patterns and avoid known pitfalls.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "description": "Filter by category: 'idioms', 'gotchas', 'types', 'database', 'framework', 'quality', 'all' (default)",
        "enum": ["idioms", "gotchas", "types", "database", "framework", "quality", "all"]
      }
    },
    "required": []
  }
}
```

### Handler

Add a match arm in the tool handler:

```rust
"get_coding_guidelines" => self.tool_get_coding_guidelines(id, arguments),
```

### Tool Content

The tool should return the following sections (filterable by `category` parameter):

---

#### Category: `idioms` — Idiomatic Clean Language Patterns

```
## Idiomatic Clean Language

Clean Language follows a "one way to do things" philosophy.
Write clean, simple, friendly code — clarity over cleverness.

### Program Structure
Every executable program needs a `start:` block. Library files (helpers, utils) only need `functions:`.

  // Executable program
  start:
      string name = "World"
      print("Hello, " + name)

  // Library file (no start: block)
  functions:
      string greet(string name)
          return "Hello, " + name

### Variable Declarations
Always declare with explicit types. Group related variables with type apply-blocks:

  // Individual declarations
  integer count = 0
  string name = "Alice"
  boolean active = true

  // Type apply-block (group same type)
  integer:
      width = 800
      height = 600
      depth = 32

  // Constants
  constant:
      integer MAX_USERS = 1000
      string API_VERSION = "v2"

### Functions — Automatic Returns
The last expression in a function is automatically returned. Use explicit `return` only for early exits:

  functions:
      // Automatic return (preferred for simple functions)
      integer double(integer x)
          x * 2

      // Explicit return for early exit
      string classify(integer score)
          if score >= 90
              return "excellent"
          if score >= 70
              return "good"
          return "needs improvement"

### String Building — Concatenation with `+`
Build strings with the `+` operator:

  string html = "<h1>" + title + "</h1>"
  string url = "/api/" + resource + "/" + id.toString()
  string greeting = "Hello, " + name + "!"
  string info = "User " + name + " has " + count.toString() + " items"

### Method Calls — Always Use Parentheses
Every method call requires parentheses, even with no arguments:

  integer len = text.length()       // Correct
  string upper = text.toUpperCase() // Correct
  string s = value.toString()       // Correct

### Control Flow
  // if/else (indentation-based, no braces)
  if count > 0
      print("has items")
  else
      print("empty")

  // iterate (range-based)
  iterate i in 1 to 10
      print(i.toString())

  // iterate (collection-based)
  iterate item in myList
      print(item.toString())

  // while
  integer n = 0
  while n < 5
      print(n.toString())
      n = n + 1

### Error Handling — `onError` for Graceful Fallbacks
  number result = riskyDivide(a, b) onError 0.0
  string data = fetchData(url) onError "default"

  // Raise errors with error()
  functions:
      number divide(number a, number b)
          if b == 0.0
              error("Division by zero")
          return a / b

### Contracts — `require` for Preconditions
  functions:
      integer withdraw(integer balance, integer amount)
          require amount > 0
          require amount <= balance
          return balance - amount

### Classes — Direct Field Access (No `this` or `self`)
  class User
      string name
      integer age

      constructor(string userName, integer userAge)
          name = userName
          age = userAge

      functions:
          string toString()
              return name + " (" + age.toString() + ")"

  // Inheritance with `is` and `base()`
  class Admin is User
      string role

      constructor(string adminName, integer adminAge, string adminRole)
          base(adminName, adminAge)
          role = adminRole

### Naming Conventions
  - Variables: camelCase or snake_case (myValue, my_value)
  - Functions: descriptive verbs (renderHome, buildNav, calculateTotal)
  - Classes: PascalCase (User, HttpClient, GameEngine)
  - Public API: dot notation (string.length(), math.abs(), list.push())
  - Host bridge internals: underscore prefix (_db_query, _http_respond)
  - NEVER use underscore names in application code — use dot notation
```

---

#### Category: `types` — Type System Guide

```
## Type System Guide

### Core Types
  boolean    — true, false
  integer    — 32-bit signed: 42, -17, 0xff, 0b1010
  number     — 64-bit float: 3.14, 6.02e23
  string     — UTF-8 text: "Hello"
  void       — No value (function returns only)
  null       — Absence of value (distinct from 0, false, "")

### Precision Modifiers
  integer:8, integer:16, integer:32, integer:64     — Signed integers
  integer:8u, integer:16u, integer:32u, integer:64u — Unsigned integers
  number:32, number:64                               — Float precision

### Collections
  list<integer> numbers = [1, 2, 3]           — Typed list
  list<string> names = ["alice", "bob"]        — String list
  list<any> mixed = []                         — Generic list
  matrix<number> grid = [[1.0, 2.0], [3.0, 4.0]] — 2D matrix

### Type Keyword: `list` not `array`
  list<string> items = []     // Correct
  // array<string> items = [] // Wrong — use list<>

### Type Conversions — Always Explicit
  string s = myInt.toString()       — integer to string
  string s = myNum.toString()       — number to string
  string s = myBool.toString()      — boolean to string
  integer n = toInteger("42")       — string to integer
  number f = toNumber("3.14")       — string to number

### List Operations
  list<integer> nums = [1, 2, 3]
  integer len = nums.length()        — NOT .length (must have parens)
  integer first = nums[0]            — Index access
  nums.push(4)                       — Add element
  integer last = nums.pop()          — Remove and return last
  boolean has = nums.contains(2)     — Membership check
  integer idx = nums.indexOf(3)      — Find position

### String Operations
  string text = "Hello, World!"
  integer len = text.length()
  string upper = text.toUpperCase()
  string sub = text.substring(0, 5)
  boolean has = text.contains("World")
  integer pos = text.indexOf("World")
  boolean starts = text.startsWith("Hello")
  boolean ends = text.endsWith("!")
  string replaced = text.replace("World", "Clean")
  list<string> parts = text.split(", ")
  string trimmed = text.trim()

### Null Handling
  null represents absence of value (distinct from 0, false, "").
  Use `default` for null-coalescing:

  string name = getUserName() default "Anonymous"
  integer count = getCount() default 0

### Module System: `import:` vs `plugins:`
  - `import:` is for importing Clean Language modules (.cln files)
  - `plugins:` is for declaring framework plugins
  - They are NOT interchangeable

  import:
      helpers              // imports helpers.cln
      utils                // imports utils.cln

  plugins:
      frame.httpserver     // declares httpserver plugin
      frame.data           // declares data plugin
```

---

#### Category: `gotchas` — Known Issues & Workarounds

```
## Known Issues & Workarounds

### Reserved Words — Cannot Be Used as Variable Names
These keywords CANNOT be used as identifiers:
  error, description, input, test, computed, rules, guard,
  state, watch, reset, screen, require, spec, intent, source,
  break, continue, private, constant, null, default

  // WRONG — these will cause parse errors:
  string error = "oops"
  string input = "data"
  integer test = 42

  // CORRECT — use descriptive alternatives:
  string errorMsg = "oops"
  string userInput = "data"
  integer testValue = 42

### .length() is a Method, Not a Property
  integer len = text.length()   // Correct — with parentheses
  // integer len = text.length  // Wrong — will not compile

### Extracting Substrings — indexOf + substring Pattern
  For extracting parts of a string by delimiter, use indexOf + substring:

  string s = "hello:world"
  integer idx = s.indexOf(":")
  integer slen = s.length()
  string after = s.substring(idx + 1, slen)
  // after == "world"

### String Prefix/Suffix Checks
  Use the built-in startsWith() and endsWith() methods:

  if text.startsWith("/api")
      print("API route")
  if filename.endsWith(".cln")
      print("Clean Language file")

### JSON Strings — No Spaces Around Colons
  When building JSON strings manually, use no spaces:

  string json = "{\"key\":\"value\"}"       // Correct
  // string json = "{\"key\": \"value\"}"   // May cause issues

### json_get Helper Pattern
  For extracting values from JSON strings returned by host functions:

  functions:
      string json_get(string json, string key)
          string needle = "\"" + key + "\":\""
          integer idx = json.indexOf(needle)
          if idx < 0
              return ""
          integer needleLen = needle.length()
          integer startPos = idx + needleLen
          integer jsonLen = json.length()
          string after = json.substring(startPos, jsonLen)
          integer endIdx = after.indexOf("\"")
          if endIdx < 0
              return ""
          return after.substring(0, endIdx)

### Print with + Operator
  The + operator for multiline print must be OUTSIDE the parentheses:

  print("Hello") +
  print("World")

  // NOT: print("Hello" +)

### No break/continue in Loops
  Use boolean flags to control loop exit:

  boolean found = false
  integer i = 0
  while i < 10 and not found
      if items[i] == target
          found = true
      i = i + 1
```

---

#### Category: `database` — Database Patterns

```
## Database Patterns

### _db_query Return Format
  _db_query(sql, params) returns a JSON string with query results.
  The exact format depends on the host implementation.
  Use the json_get() helper to extract values from results.

### SQL Best Practices
  - Always parameterize user input:
    string params = "[\"" + userInput + "\"]"
    string result = _db_query(sql, params)

  - For JSON columns, always use CAST + JSON_UNQUOTE + JSON_EXTRACT:
    CAST(JSON_UNQUOTE(JSON_EXTRACT(table.col, '$.field')) AS CHAR) as alias

### Building HTML from Array Data (GROUP_CONCAT)
  Since Clean Language loops cannot always iterate query results directly,
  use SQL GROUP_CONCAT with JSON_TABLE for rendering lists:

  SELECT GROUP_CONCAT(
      CONCAT('<div>', jt.title, '</div>')
      ORDER BY jt.ord SEPARATOR ''
  ) as html
  FROM JSON_TABLE(json_col, '$[*]' COLUMNS(
      ord FOR ORDINALITY,
      title VARCHAR(200) PATH '$.title'
  )) jt

### HTML Escaping in SQL
  Use a REPLACE chain for HTML-escaping values in SQL:

  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      value, '&','&amp;'), '<','&lt;'), '>','&gt;'),
      '"','&quot;'), CHAR(10),'&#10;'), CHAR(9),'&#9;')

### Reusable Query Helper Pattern
  functions:
      string pageQuery(string fields, string slug, string lang)
          string sql = "SELECT " + fields + " FROM page_content pc "
              + "JOIN pages p ON pc.page_id = p.id "
              + "JOIN languages l ON pc.language_id = l.id "
              + "WHERE p.slug = ? AND l.code = ? "
              + "AND p.is_active = 1 AND l.is_active = 1"
          string params = "[\"" + slug + "\", \"" + lang + "\"]"
          return _db_query(sql, params)
```

---

#### Category: `framework` — Frame Framework Architecture

```
## Frame Framework Patterns

### Plugin Auto-Detection
  Plugins are auto-loaded based on folder location:

  | Folder               | Auto-Loaded Plugins                          |
  | app/server/api/      | frame.httpserver + frame.data + frame.auth   |
  | app/server/models/   | frame.data                                   |
  | app/ui/components/   | frame.ui                                     |
  | app/ui/pages/        | frame.ui                                     |

  No explicit `plugins:` block needed in recognized folders.
  You can also declare plugins explicitly in config.cln or with a `plugins:` block.

### Project Structure
  app/
      config.cln            Single config file
      server/               Server-side
          api/              Endpoints, API handlers
              main.cln      endpoints: block
          models/           Database schemas
          middleware/       Request filters
      ui/                   Frontend
          pages/            HTML page routes
          components/       Custom HTML elements
          layouts/          Page wrappers
      shared/               Shared code
          lib/              Utility modules
      public/               Static assets
          css/              Stylesheets
          images/           Images

### endpoints: Block (requires frame.httpserver plugin)
  endpoints:
      GET "/users" -> listUsers
      GET "/users/{id}" -> getUser
      POST "/users" -> createUser

  The endpoints: block is expanded by the frame.httpserver plugin
  into proper _http_route calls at compile time.

### SSR Pattern (Server-Side Rendering)
  Route handlers return HTML via _http_respond:

  functions:
      string renderHome()
          string title = "Welcome"
          string html = buildHead(title)
              + "<body>"
              + buildNav()
              + "<main>"
              + "<h1>" + title + "</h1>"
              + "</main>"
              + buildFooter()
              + "</body></html>"
          return _http_respond(200, "text/html", html)

### HTML Best Practices in Clean Language
  - Use single-quoted HTML attributes (avoids JSON escaping conflicts):
    string html = "<div class='container'>"

  - All CSS in external files (public/css/) — no inline styles or <style> tags

  - Extract repeated HTML patterns into builder functions:
    buildHead(), buildNav(), buildFooter(), buildHero()

  - Centralize version strings in helpers for easy bumping

### Helper File Organization
  Put shared helpers in a separate file and import:

  // helpers.cln (library — no start: block)
  functions:
      string buildHead(string title)
          return "<!DOCTYPE html><html><head>"
              + "<title>" + title + "</title>"
              + "</head>"

      string buildNav()
          return "<nav class='main-nav'>...</nav>"

  // main.cln
  import:
      helpers

  endpoints:
      GET "/" -> renderHome

### Language Detection (i18n)
  functions:
      string getLang()
          string lang = _req_query("lang")
          if lang == ""
              return "en"
          return lang

      string langHref(string path, string lang)
          if lang == "en"
              return path
          return path + "?lang=" + lang
```

---

#### Category: `quality` — Code Quality Standards

```
## Code Quality Standards

### Implementation Rules
  - NO placeholder implementations (no dummy `return 0` values)
  - NO fallback or stub implementations
  - All code must be production-ready and functional
  - Fix root causes, not symptoms
  - Document complex issues in TASKS.md rather than implementing stubs

### The Clean Language Way
  - Prefer clarity over brevity
  - One function = one responsibility
  - Name functions as verbs that describe what they do
  - Name variables as nouns that describe what they hold
  - Use type apply-blocks to group related declarations
  - Use `require` contracts to validate inputs at boundaries
  - Use `intent` metadata to document function purpose

### Contract-Based Programming
  Use `require` for input validation and `rules` for state invariants:

  functions:
      integer withdraw(integer balance, integer amount)
          intent "Deducts amount from balance safely"
          require amount > 0
          require amount <= balance
          return balance - amount

  state:
      integer count = 0
      integer maxCount = 100
      rules:
          count >= 0
          count <= maxCount

### Testing
  Clean Language supports inline tests:

  tests:
      "adds correctly": add(2, 3) = 5
      "handles zero": factorial(0) = 1
      "empty string": "".length() = 0

### Cross-Component Work Policy
  - When working in one component and finding issues in another, do NOT fix directly
  - Create a prompt in system-documents/cross-component-prompts/ instead
  - Each component has its own AI instance, context, and testing

### Architecture Boundaries
  - Each component has a single responsibility
  - The compiler generates WASM imports — it does NOT implement runtime functions
  - Host bridge functions (I/O, network, database) belong in plugins, NOT the compiler
  - Read ARCHITECTURE_BOUNDARIES.md before implementing new functionality
```

---

## Update get_quick_reference Workflow

After implementing `get_coding_guidelines`, update the workflow section in `get_quick_reference` to include it as step 2:

```
## Workflow
1. Call `get_quick_reference` (this tool) to learn base syntax
2. Call `get_coding_guidelines` to learn idiomatic patterns and avoid known pitfalls
3. Call `get_stack_recommendation` with your project type (web-app, api, game, cli)
4. Call `list_ecosystem` to see ALL available plugins in the ecosystem
5. Call `list_plugins` to see installed plugins with full DSL details
6. Call `get_plugin_examples` to see plugin usage patterns
7. Write .cln code following the patterns above
8. Call `check` to type-check (fast feedback loop)
9. Call `compile` when ready for WASM output
10. If errors occur, call `explain_error` with the code
11. Use `get_specification` for detailed docs on specific features
12. Use `report_error` to report compiler bugs; `check_reported_fixes` to verify fixes
```

Also update the "Available MCP Tools" list in `get_quick_reference` to include all 18 tools (currently lists only 14).

## Files Affected

- `clean-language-compiler/src/mcp/server.rs`:
  - Add tool definition (after `get_quick_reference` tool entry)
  - Add handler match arm
  - Add implementation function `tool_get_coding_guidelines`
  - Update `get_quick_reference` workflow section
  - Update tools_available count to 18
