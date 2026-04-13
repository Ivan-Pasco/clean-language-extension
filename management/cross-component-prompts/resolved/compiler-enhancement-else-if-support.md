# Compiler Enhancement — Verify `else if` Works Correctly

Component: clean-language-compiler
Issue Type: enhancement
Priority: low
Description: `else` compiles and appears in the spec, but `else if` chains need verification and should be tested in CI. Currently the website project doesn't use either — confirm they work at runtime, not just compilation.

---

## What Was Verified (compilation only, v0.30.20)

```clean
# This COMPILES:
if (lang == "")
    return "en"
else
    return lang
```

## What Needs Runtime Verification

```clean
# else if chain — does it execute correctly?
if (lang == "en")
    locale = "en_US"
else if (lang == "es")
    locale = "es_ES"
else
    locale = "en_US"
```

## Context

The website project currently uses paired `if`/`if` blocks everywhere because `else` was previously untested. Now that `else` compiles, the project can adopt it — but runtime correctness should be verified first with a test case in `tests/cln/`.

## Suggested Test

Add `tests/cln/control_flow/else_if_test.cln`:
```clean
functions:
    string test_else_if(string val)
        if (val == "a")
            return "first"
        else if (val == "b")
            return "second"
        else
            return "other"

start:
    print(test_else_if("a"))
    print(test_else_if("b"))
    print(test_else_if("c"))
```

Expected output:
```
first
second
other
```
