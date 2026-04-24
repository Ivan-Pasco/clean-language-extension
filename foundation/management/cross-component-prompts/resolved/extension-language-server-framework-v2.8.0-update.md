Component: clean-extension
Issue Type: enhancement
Priority: high
Description: Update language server, syntax highlighting, and snippets for Frame Framework v2.8.0

The Frame Framework v2.8.0 introduces significant new features across all 5 plugins. The extension's TextMate grammar, snippets, and any hardcoded keyword lists need updating to reflect these additions. The plugin.toml [language] sections have already been updated, so auto-loaded metadata (completions, hover, functions) will work automatically. This prompt covers the HARDCODED elements that need manual updates.

## 1. TextMate Grammar Updates

**File**: `syntaxes/clean.tmLanguage.json`

### New Block Keywords to Add

Add to the block keywords pattern (alongside `data`, `endpoints`, `component`, etc.):

```
migrate, ui
```

`migrate` is a new block type in frame.data for schema migrations:
```clean
migrate "001_create_users":
    up:
        CREATE TABLE users (...)
    down:
        DROP TABLE users
```

`ui` is a new block type in frame.ui for theming configuration:
```clean
ui:
    theme:
        colors:
            primary: "#2563eb"
        spacing:
            sm: "0.5rem"
```

### New Sub-Block Keywords to Add

Add to the sub-block keywords pattern (alongside `where`, `order`, `guard`, etc.):

```
up, down, tenant, theme, colors, spacing, maxAge, noCache
```

### New Directive Keywords for HTML Templates

Add to the clean-html grammar (`syntaxes/clean-html.tmLanguage.json`) if HTML directive patterns are defined:

```
cl-show, cl-validate, cl-slot, error-message
```

### New Event Attributes for HTML

These should be highlighted as event handlers in HTML context:

```
data-on-click, data-on-input, data-on-change, data-on-submit,
data-on-focus, data-on-blur, data-on-keydown, data-on-keyup,
data-on-mouseenter, data-on-mouseleave
```

And their modifier companions:
```
data-on-click-prevent, data-on-submit-prevent, data-on-click-stop,
data-on-click-once, data-on-keydown-enter, data-on-keydown-escape
```

### New Canvas Event Block Keywords

Add to block keywords if not already present:

```
onPointerDown, onPointerMove, onKeyDown
```

### New Framework Functions

Add to the framework function pattern (alongside `json()`, `html()`, etc.):

```
tenant_getId, tenant_require, tenant_matches, csrf_generate, csrf_validate, validate
```

### New Framework Classes/Objects

Add `tenant` to the framework class pattern if one exists.

## 2. Code Snippets Updates

**File**: `snippets/clean.code-snippets`

Add or update these snippets:

```json
{
  "migrate": {
    "prefix": "migrate",
    "body": [
      "migrate \"${1:001_migration_name}\":",
      "\tup:",
      "\t\t${2:CREATE TABLE ...}",
      "\tdown:",
      "\t\t${3:DROP TABLE ...}"
    ],
    "description": "Define a versioned schema migration"
  },
  "ui-theme": {
    "prefix": "ui theme",
    "body": [
      "ui:",
      "\ttheme:",
      "\t\tcolors:",
      "\t\t\tprimary: \"${1:#2563eb}\"",
      "\t\t\tsecondary: \"${2:#64748b}\"",
      "\t\t\tbackground: \"${3:#ffffff}\"",
      "\t\t\ttext: \"${4:#0f172a}\"",
      "\t\tspacing:",
      "\t\t\tsm: \"${5:0.5rem}\"",
      "\t\t\tmd: \"${6:1rem}\"",
      "\t\t\tlg: \"${7:2rem}\""
    ],
    "description": "UI theme with CSS variables"
  },
  "auth-tenant": {
    "prefix": "auth tenant",
    "body": [
      "auth:",
      "\tsession:",
      "\t\tcookie = \"${1:app.sid}\"",
      "\t\ttimeoutMinutes = ${2:60}",
      "\ttenant:",
      "\t\tfield = \"${3:tenantId}\""
    ],
    "description": "Auth configuration with multi-tenant support"
  },
  "data-config": {
    "prefix": "data config",
    "body": [
      "data:",
      "\tengine = \"${1:postgres}\"",
      "\thost = \"${2:localhost}\"",
      "\tport = ${3:5432}",
      "\tdatabase = \"${4:app}\"",
      "\tuser = \"${5:admin}\"",
      "\tpassword = env(\"${6:DB_PASSWORD}\")",
      "\tpool:",
      "\t\tmax = ${7:10}",
      "\t\tidleTimeout = ${8:30000}"
    ],
    "description": "Database configuration block"
  },
  "data-validation": {
    "prefix": "data validated",
    "body": [
      "data ${1:User}",
      "\tinteger id : pk, auto",
      "\tstring ${2:name} : min=${3:2}, max=${4:100}",
      "\tstring ${5:email} : unique, email",
      "\tinteger ${6:age} : range=${7:0}..${8:150}"
    ],
    "description": "Data model with field validation constraints"
  },
  "canvas-input": {
    "prefix": "canvasScene input",
    "body": [
      "canvasScene: width=${1:800} height=${2:600}",
      "",
      "\tonPointerDown: params=\"x,y\"",
      "\t\t${3:// handle click}",
      "",
      "\tonKeyDown: params=\"key\"",
      "\t\t${4:// handle key press}",
      "",
      "\tonFrame: params=\"dt\"",
      "\t\tcanvas.clear: color=\"${5:#1a1a2e}\"",
      "\t\t${6:// draw}"
    ],
    "description": "Canvas scene with input handling"
  },
  "endpoint-guarded": {
    "prefix": "endpoint guarded",
    "body": [
      "${1:GET} ${2:/api/resource}:",
      "\tguard:",
      "\t\trole == \"${3:admin}\"",
      "\treturns:",
      "\t\tjson ${4:list<Resource>}",
      "\tcache:",
      "\t\tmaxAge = ${5:60}",
      "\thandle:",
      "\t\t${6:// handler code}",
      "\t\treturn json(${7:data})"
    ],
    "description": "HTTP endpoint with guard, returns, cache, and handle blocks"
  },
  "form-validated": {
    "prefix": "form validated",
    "body": [
      "<form onsubmit.prevent=\"${1:handleSubmit}\">",
      "\t<label>",
      "\t\t${2:Email}",
      "\t\t<input type=\"${3:email}\" cl-bind=\"${4:formData.email}\" cl-validate=\"${5:email}\" error-message=\"${6:Please enter a valid email}\">",
      "\t</label>",
      "\t<button type=\"submit\">${7:Submit}</button>",
      "</form>"
    ],
    "description": "HTML form with validation and CSRF auto-injection"
  },
  "layout": {
    "prefix": "layout",
    "body": [
      "<!DOCTYPE html>",
      "<html>",
      "<head>",
      "\t<meta charset=\"UTF-8\">",
      "\t<title>${1:title} - ${2:App}</title>",
      "\t<link rel=\"stylesheet\" href=\"/css/${3:main}.css\">",
      "</head>",
      "<body>",
      "\t${4:<app-header></app-header>}",
      "\t<main>",
      "\t\t<slot></slot>",
      "\t</main>",
      "\t${5:<app-footer></app-footer>}",
      "</body>",
      "</html>"
    ],
    "description": "Page layout template with default slot"
  },
  "cl-show": {
    "prefix": "cl-show",
    "body": [
      "<div cl-show=\"${1:isVisible}\">${2:content}</div>"
    ],
    "description": "Conditional visibility (CSS display toggle)"
  },
  "cl-slot": {
    "prefix": "cl-slot",
    "body": [
      "<div cl-slot=\"${1:name}\">${2:default content}</div>"
    ],
    "description": "Named slot for content projection"
  }
}
```

## 3. Complete Framework Syntax Reference

For reference, here is the COMPLETE list of all framework keywords, blocks, directives, and functions across all 5 plugins as of v2.8.0:

### All Block Keywords (30)
```
data, migrate, endpoints, component, screen, page, styles, html, ui,
auth, protected, login, roles,
canvasScene, draw, onFrame, onPointerDown, onPointerMove, onKeyDown,
where, order, limit, offset, guard, returns, cache, handle,
up, down, state, props, render, session, jwt, tenant, theme, colors, spacing
```

### All Directives (8)
```
cl-if, cl-else, cl-iterate, cl-bind, cl-show, cl-validate, cl-slot, cl-client
```

### All HTML Event Attributes (10 + 5 modifiers)
```
Events: onclick, oninput, onchange, onsubmit, onfocus, onblur, onkeydown, onkeyup, onmouseenter, onmouseleave
Modifiers: .prevent, .stop, .once, .enter, .escape
```

### All Framework Functions (55+)
```
Auth: session_create, session_setCookie, session_get, session_destroy,
      jwt_sign, jwt_verify, jwt_refresh,
      hashPassword, verifyPassword, can, hasRole, getCurrentUser, isAuthenticated,
      csrf_generate, csrf_validate,
      tenant_getId, tenant_require, tenant_matches

Data: Model.find, Model.first, Model.count, Model.insert, Model.update, Model.delete,
      Model.save, Model.migrate, Model.validate,
      Data.tx, db.query, db.queryAs, tenant_getId

HTTP: jsonResponse, jsonResponseStatus, htmlResponse, redirectTo, notFound, notFoundMsg,
      badRequest, unauthorized, forbidden, httpHeader,
      req.params.*, req.query.*, req.json(), req.body, req.form, req.headers, req.ip

UI: rawHtml, escape, slot, process_html, expand_block, validate_html

Canvas: canvas.clear, canvas.circle, canvas.rect, canvas.line, canvas.text, canvas.image,
        canvas.save, canvas.restore, canvas.translate, canvas.rotate, canvas.scale,
        sprite.load, sprite.draw, audio.loadSound, audio.play, audio.loadMusic, audio.playMusic,
        input.mouseX, input.mouseY, input.mousePressed, input.keyDown, input.keyJustPressed,
        deltaTime, time, fps,
        collision.circleCircle, collision.rectRect, collision.pointRect,
        camera.setPosition, camera.setZoom, camera.shake,
        ease.linear, ease.inQuad, ease.outQuad, ease.inOutQuad,
        scene.change, scene.push, scene.pop, scene.current
```

### All Field Constraints (for data models)
```
pk, auto, unique, default=, min=, max=, email, range=, tenant, onDelete=cascade
```

### HTTP Methods
```
GET, POST, PUT, DELETE, PATCH
```

## 4. Plugin.toml Auto-Loading

The plugin.toml files already contain complete [language] sections with:
- `blocks[]` - Block keywords
- `keywords[]` - Sub-block and context keywords with descriptions
- `types[]` - Type names with descriptions
- `functions[]` - Function signatures with descriptions
- `[completions]` - Snippet-style completions

These are auto-loaded by `plugin-loader.ts` and provide completions + hover without manual updates. The TextMate grammar and snippets file are the only hardcoded parts that need updating.

## Context
Frame Framework v2.8.0 was released with comprehensive updates to all 5 plugins. The plugin.toml metadata is current and complete. Only the hardcoded TextMate grammar patterns and code snippets need updating to match.

## Files Affected
- `syntaxes/clean.tmLanguage.json` — Add new keywords to patterns
- `syntaxes/clean-html.tmLanguage.json` — Add new directives and event attributes
- `snippets/clean.code-snippets` — Add new snippet templates
