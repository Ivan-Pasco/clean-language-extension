# Compiler Enhancement — String Interpolation

Component: clean-language-compiler
Issue Type: enhancement
Priority: high
Description: Add string interpolation syntax to eliminate verbose string concatenation. This is the single most impactful readability improvement possible for Clean Language.

---

## Problem

Every HTML fragment, JSON response, and SQL query requires manual `+` concatenation:

```clean
html = html + "<h1 class='hero-title'>" + title + "</h1><p>" + subtitle + "</p>"
string resp = "{\"report_id\":\"" + report_id + "\",\"status\":\"" + status + "\"}"
```

This makes code hard to read, error-prone (missing quotes/escapes), and verbose.

## Proposed Syntax

Use backtick template strings with `${expr}` interpolation (like JavaScript/Kotlin):

```clean
html = html + `<h1 class='hero-title'>${title}</h1><p>${subtitle}</p>`
string resp = `{"report_id":"${report_id}","status":"${status}"}`
```

## Impact

- Reduces string concatenation noise by ~50% across all Clean Language projects
- Makes HTML generation readable
- Makes JSON construction readable
- Reduces bugs from mismatched quotes and missing `+` operators

## Implementation Notes

- Backtick delimiter avoids conflicts with single/double quotes already used in HTML/JSON
- Parser splits template into string literals + expressions at compile time
- Generates the same concatenation WASM but with cleaner source
- Could support multi-line by default (backticks inherently multi-line)

## Real-World Example (from this website)

Before:
```clean
string nav = "<nav class='navbar'><div class='container navbar-container'><a href='" + lang_href("/", lang) + "' class='navbar-logo'><img src='/images/logo.png' alt='Clean Language' class='navbar-logo-img'></a>"
```

After:
```clean
string home = lang_href("/", lang)
string nav = `<nav class='navbar'><div class='container navbar-container'><a href='${home}' class='navbar-logo'><img src='/images/logo.png' alt='Clean Language' class='navbar-logo-img'></a>`
```
