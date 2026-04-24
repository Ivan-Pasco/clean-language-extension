Component: clean-framework (frame.ui plugin)
Issue Type: bug
Priority: critical
Description: The frame.ui plugin's html_block_to_code function generates broken string concatenation when {variable} interpolation appears inside single-quoted HTML attributes.

## Error

```
Failed to tokenize plugin output: Unterminated string literal at <plugin-output>:9:85
```

## Root Cause

When HTML content has interpolation inside single-quoted attributes like:
```html
<span class='badge {status_badge}'>
```

The plugin generates incorrect Clean Language code:
```clean
__html = __html + "<span class='" + "badge " + _html_escape(status_badge) + " + "'>"
```

The ` + "` at the end is wrong — it creates an unterminated string. The correct output should be:
```clean
__html = __html + "<span class='" + "badge " + _html_escape(status_badge) + "'>"
```

The issue is that the html_block_to_code function doesn't correctly rejoin the string after interpolation when the interpolation is inside a single-quoted attribute value. The closing single quote `'` gets mixed with the `"` delimiters of the Clean string literals.

## Reproduction

```clean
plugins:
    frame.ui

start:
    print(test_fn())

functions:
    string test_fn()
        string status = "active"
        html:
            <span class='badge {status}'>text</span>
```

This produces invalid output where the string concatenation around `{status}` has mismatched quotes.

## Impact

Affects 7 out of 8 page files in the Clean Language website. Any html: block with `{variable}` inside single-quoted attributes fails.

## Files Affected

- `~/.cleen/plugins/frame.ui/src/main.cln` — the `html_block_to_code` function's interpolation handling

## Workaround

Use double quotes for HTML attributes instead of single quotes:
```html
<!-- Instead of: -->
<span class='badge {status}'>

<!-- Use: -->
<span class="badge {status}">
```

But this requires escaping the double quotes in the Clean string output, which the plugin already handles for non-interpolated content.
