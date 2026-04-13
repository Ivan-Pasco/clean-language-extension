# Website Project — Using `html:` Blocks Inside Functions

Component: Web Site Clean
Issue Type: instructions
Priority: high
Description: How to use the new `html:` block syntax inside function bodies to replace string concatenation for HTML generation.

---

## Summary

The compiler (v0.30.22) now supports `html:` blocks inside function bodies. This lets you replace verbose string concatenation with clean, readable HTML templates. The feature requires the `frame.ui` plugin to be declared in each `.cln` file that uses `html:` blocks.

## Required Change

Every `.cln` file that uses `html:` blocks **must** have a `plugins:` declaration at the top:

```clean
plugins:
    frame.ui
```

Without this declaration, the compiler does not know that `html` is a block keyword and will fail with:
```
error[E001]: Unexpected token in expression: Less
```

## Before / After Examples

### Before (string concatenation):
```clean
functions:
    string build_card(string title, string desc)
        string html = ("<div class='card'>"
            + "<h1>{title}</h1>"
            + "<p>{desc}</p>"
            + "</div>")
        return html
```

### After (html: block):
```clean
plugins:
    frame.ui

functions:
    string build_card(string title, string desc)
        html:
            <div class="card">
                <h1>{title}</h1>
                <p>{desc}</p>
            </div>
```

## Features Supported Inside `html:` Blocks

| Feature | Syntax | Example |
|---------|--------|---------|
| Variable interpolation | `{variable}` | `<h1>{title}</h1>` |
| Raw (unescaped) interpolation | `{!variable}` | `<nav>{!nav_html}</nav>` |
| Multi-line HTML | Indented block | Full HTML tree with any tags |
| Standard HTML attributes | Normal HTML | `<div class="card" id="main">` |
| Nested tags | Indented | `<div><h1><span>` etc. |

## Migration Strategy

The website project currently builds HTML through string concatenation in `app/api/helpers.cln` and other server-side files. To migrate:

1. **Add `plugins: frame.ui`** at the top of each `.cln` file that will use `html:` blocks

2. **Replace string concatenation** with `html:` blocks, one function at a time

3. **Keep both approaches working** during migration — you can mix string concatenation and `html:` blocks in the same file

### Example: helpers.cln migration

Current `app/api/helpers.cln` uses patterns like:
```clean
string html = ("<div class='section'>"
    + "<h2>{heading}</h2>"
    + "<p>{content}</p>"
    + "</div>")
```

Add at the top of the file:
```clean
plugins:
    frame.ui
```

Then replace individual functions as needed:
```clean
functions:
    string build_section(string heading, string content)
        html:
            <div class="section">
                <h2>{heading}</h2>
                <p>{content}</p>
            </div>
```

## Important Notes

- The `plugins: frame.ui` declaration is per-file, not project-wide
- The `frame.ui` plugin must be accessible at compile time (it already is for the client-side `app/client/main.cln`)
- `html:` blocks preserve whitespace and indentation exactly as written
- The block ends when indentation returns to the same level as `html:` or higher (less indented)
- `html:` blocks inside functions produce `FrameworkBlock` AST nodes that the plugin expander processes into return statements with string concatenation
