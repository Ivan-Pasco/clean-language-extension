# Language Server Plugin Integration Prompt

## Context

The Clean Language framework uses a plugin architecture where plugins define their own syntax, keywords, and language constructs. The language server needs to dynamically load these definitions from plugin.toml files to provide proper IDE support (syntax highlighting, auto-completion, hover documentation, diagnostics).

## Recent Changes Summary

### 1. New Project Structure (Clean Architecture)

Projects now use an `app/` base directory with clean architecture separation:

```
project-name/
├── app.cln                 # Application entry point
├── app/
│   ├── ui/                 # frame.ui plugin
│   │   ├── pages/          # HTML pages (.html)
│   │   ├── components/     # Component definitions (.cln)
│   │   ├── layouts/        # Layout templates
│   │   └── styles/         # Theme and CSS
│   ├── backend/            # frame.httpserver plugin
│   │   ├── api/            # Endpoint definitions
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Request middleware
│   ├── data/               # frame.data plugin
│   │   ├── models/         # Data model definitions
│   │   ├── queries/        # Named queries
│   │   ├── migrations/     # Database migrations
│   │   └── repositories/   # Data access patterns
│   ├── shared/             # Shared code (no plugin)
│   │   ├── types/          # Shared type definitions
│   │   └── utils/          # Utility functions
│   ├── config/             # frame.auth plugin
│   │   ├── project.cln     # Project configuration
│   │   └── auth.cln        # Auth configuration
│   └── canvas/             # frame.canvas plugin (games/graphics)
│       ├── scenes/         # Canvas scenes
│       ├── sprites/        # Sprite assets
│       └── audio/          # Audio assets
└── plugins/                # Local plugin overrides (optional)
```

### 2. Plugin Folder Ownership

Each plugin owns specific folders via `[paths]` section in plugin.toml:

| Plugin | Owned Folders |
|--------|---------------|
| frame.ui | `app/ui/**` |
| frame.httpserver | `app/backend/**` |
| frame.data | `app/data/**` |
| frame.auth | `app/config/**` |
| frame.canvas | `app/canvas/**` |

Files in owned folders have **implicit plugin import** - they don't need `plugins:` block.

### 3. New Block Syntax

**Plugin imports use `plugins:` block (no quotes):**
```clean
plugins:
    frame.ui
    frame.data
```

**File imports use `import:` block (with quotes):**
```clean
import:
    "app/data/models/User.cln"
    "app/backend/api/auth.cln"
```

### 4. New `[language]` Section in plugin.toml

Each plugin now defines its language constructs for IDE support:

```toml
[language]
# Block-level keywords that start a declaration
blocks = ["data", "component", "endpoints"]

# Keywords used within plugin context
keywords = [
  { name = "find", description = "Query records from a model", context = "expression" },
  { name = "where", description = "Filter query conditions", context = "block" },
]

# Custom types provided by the plugin
types = [
  { name = "Model", description = "Base type for data models" },
]

# Built-in functions/expressions
functions = [
  { name = "json", signature = "json(data)", description = "Return JSON response" },
]

# Auto-completion suggestions
completions = [
  { trigger = "data ", insert = "data ${1:ModelName}:\n\t${2:field}: ${3:type}" },
]
```

## Implementation Requirements

### 1. Plugin Discovery

The language server must discover plugins from:

1. **Global plugins directory**: `~/.clean/plugins/` (standard Frame plugins)
2. **Project plugins directory**: `<project>/plugins/` (local overrides)
3. **Project app.cln**: Parse to find declared plugins in `plugins:` block

**Algorithm:**
```
1. On workspace open:
   a. Scan for app.cln in project root
   b. Parse plugins: block to get active plugin list
   c. Load plugin.toml from global dir first, then project dir (override)
   d. Cache merged plugin definitions

2. On app.cln change:
   a. Re-parse plugins: block
   b. Reload affected plugin definitions
   c. Invalidate related caches
```

### 2. Language Definition Loading

For each active plugin, load the `[language]` section:

```rust
struct PluginLanguage {
    blocks: Vec<String>,
    keywords: Vec<Keyword>,
    types: Vec<TypeDef>,
    functions: Vec<FunctionDef>,
    completions: Vec<Completion>,
}

struct Keyword {
    name: String,
    description: String,
    context: String,  // "expression", "block", "directive", "config", "attribute"
}

struct TypeDef {
    name: String,
    description: String,
}

struct FunctionDef {
    name: String,
    signature: String,
    description: String,
}

struct Completion {
    trigger: String,
    insert: String,  // Uses snippet syntax: ${1:placeholder}
}
```

### 3. Context-Aware Features

The server must track context to provide correct suggestions:

**File Context:**
- Determine which plugin owns the file based on path
- Apply implicit imports for files in owned folders
- Use different validation rules per plugin

**Block Context:**
- Track when inside a block (e.g., `endpoints:`, `data:`)
- Only suggest keywords valid for current context
- Validate syntax against block-specific rules

**Example contexts:**
```
- "expression": Available in any expression context
- "block": Available as sub-block within a parent block
- "directive": Available as HTML directives (if, each, bind)
- "config": Available as configuration key-value
- "attribute": Available as HTML attribute
- "endpoint": Available within endpoints: block
- "guard": Available within guard: sub-block
```

### 4. Features to Implement

#### 4.1 Syntax Highlighting (TextMate Grammar Generation)

Generate TextMate grammar dynamically from plugin definitions:

```json
{
  "patterns": [
    {
      "name": "keyword.block.clean",
      "match": "\\b(data|component|endpoints|auth)\\b(?=:)"
    },
    {
      "name": "keyword.control.clean",
      "match": "\\b(where|order|limit|guard|cache)\\b(?=:)"
    }
  ]
}
```

#### 4.2 Auto-Completion

Provide completions based on:
1. Plugin `completions` array (snippet templates)
2. Plugin `keywords` filtered by current context
3. Plugin `functions` with signature
4. Plugin `types` for type annotations

**Trigger conditions:**
- After typing block keyword + space: `data ` → suggest model template
- After `.` on model instance: `User.` → suggest `find:`, `insert:`, etc.
- Inside block: suggest valid sub-blocks/keywords

#### 4.3 Hover Documentation

Show documentation on hover:
- For keywords: Show description and context
- For functions: Show signature and description
- For types: Show description
- For blocks: Show plugin name and description

#### 4.4 Diagnostics

Validate based on plugin definitions:
- Unknown block keywords → error
- Keywords used in wrong context → warning
- Missing required sub-blocks → error
- Invalid syntax within plugin blocks → error

### 5. Caching Strategy

```
PluginCache {
    // Global cache (lives across workspaces)
    global_plugins: HashMap<String, PluginDefinition>
    global_plugins_mtime: HashMap<String, SystemTime>

    // Workspace cache (per project)
    workspace_plugins: HashMap<PathBuf, WorkspacePlugins>

    // Derived cache (invalidated on plugin change)
    merged_keywords: Vec<Keyword>
    merged_blocks: Vec<String>
    textmate_grammar: String
}

// Cache invalidation triggers:
// 1. plugin.toml file change
// 2. app.cln plugins: block change
// 3. Workspace folder change
```

### 6. File Extension Handling

The `frame.ui` plugin handles multiple file types:

| Extension | Processing |
|-----------|------------|
| `.cln` | Standard Clean Language file |
| `.html` | Pure HTML (no processing) |
| `.html` | HTML with Clean directives and custom components |

For `.html` files:
- Provide HTML completions
- Add custom tag completions from component registry
- Support directive attributes (`if`, `each`, `bind`, `client`)
- Support interpolation syntax `{{}}` and `{{{}}}`

## Plugin Definition Reference

### frame.data

**Blocks:** `data`

**Keywords:**
- `find`, `first`, `count` (expression) - Query operations
- `insert`, `update`, `delete` (expression) - Mutation operations
- `where`, `order`, `limit`, `offset`, `include` (block) - Query modifiers

**Functions:**
- `Data.tx:` - Transaction block
- `db.query:` - Raw SQL query
- `db.queryAs()` - Raw SQL with model mapping

### frame.httpserver

**Blocks:** `server`, `endpoints`

**Keywords:**
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (endpoint) - HTTP methods
- `guard`, `returns`, `cache`, `handle` (block) - Endpoint configuration

**Functions:**
- `json()`, `html()`, `redirect()`, `notFound()`, `error()` - Response helpers
- `req.param()`, `req.query()`, `req.header()`, `req.body()` - Request context

### frame.ui

**Blocks:** `component`, `screen`, `page`, `styles`

**Keywords:**
- `state`, `props`, `render`, `handlers`, `computed` (block) - Component structure
- `variables`, `global` (block) - Styles structure
- `if`, `else`, `each`, `bind`, `slot`, `show`, `validate` (directive) - HTML directives
- `client` (attribute) - Hydration mode

**Functions:**
- `rawHtml()`, `escape()`, `slot()` - Template helpers

### frame.auth

**Blocks:** `auth`, `protected`, `login`, `roles`

**Keywords:**
- `session`, `jwt`, `roles` (block) - Configuration blocks
- `cookie`, `sameSite`, `secure`, `httpOnly`, `timeoutMinutes` (config) - Session config
- `enabled`, `secret`, `algorithm`, `expiresIn` (config) - JWT config
- `require` (guard) - Role requirement

**Functions:**
- `Auth.login()`, `Auth.logout()`, `Auth.session()`, `Auth.user()` - Auth operations
- `Auth.check()`, `Auth.hasRole()`, `Auth.can()` - Authorization checks
- `hashPassword()`, `verifyPassword()` - Password utilities

### frame.canvas

**Blocks:** `canvasScene`, `draw`, `onFrame`

**Keywords:**
- `canvas`, `width`, `height`, `fps`, `background` (config) - Scene configuration
- `assets`, `init`, `update`, `render` (block) - Scene lifecycle blocks

**Types:**
- `Canvas`, `Sprite`, `Sound`, `Music`, `Image` - Asset types

**Functions:**
- Drawing: `canvas.clear()`, `canvas.circle()`, `canvas.rect()`, `canvas.line()`, `canvas.text()`, `canvas.image()`
- Sprites: `sprite.load()`, `sprite.draw()`
- Audio: `audio.loadSound()`, `audio.play()`, `audio.loadMusic()`, `audio.playMusic()`
- Input: `input.mouseX()`, `input.mouseY()`, `input.mousePressed()`, `input.keyDown()`, `input.keyJustPressed()`
- Animation: `deltaTime()`, `time()`, `fps()`
- Collision: `collision.circleCircle()`, `collision.rectRect()`, `collision.pointRect()`
- Camera: `camera.setPosition()`, `camera.setZoom()`, `camera.shake()`
- Easing: `ease.linear()`, `ease.inQuad()`, `ease.outQuad()`, `ease.inOutQuad()`

## Testing Checklist

- [ ] Plugin discovery finds global and project plugins
- [ ] Plugin definitions are correctly parsed from TOML
- [ ] Keywords are filtered by context
- [ ] Completions trigger at correct positions
- [ ] Hover shows plugin-provided documentation
- [ ] Diagnostics report unknown plugin keywords
- [ ] File ownership is correctly determined
- [ ] Implicit imports work in owned folders
- [ ] Cache invalidates on plugin.toml changes
- [ ] `.html` files get correct language features
- [ ] TextMate grammar updates with plugin changes
