Component: clean-framework
Issue Type: bug fix
Priority: high
Source Component: clean-language-compiler
Description: The frame.ui build.sh uses compiler 0.31.0 (actually 0.30.7) which has a codegen bug: substring results in multi-part string concatenation produce null bytes instead of attribute names. This causes html: block output like `<div ='container'>` instead of `<div class='container'>`.

## Change Required

In `plugins/frame.ui/build.sh`, change the compiler version from 0.31.0 to **0.30.48**:

```bash
# OLD (line 7):
CLN="${CLEEN_HOME:-$HOME/.cleen}/versions/0.31.0/cln"

# NEW:
CLN="${CLEEN_HOME:-$HOME/.cleen}/versions/0.30.48/cln"
```

Update the comment to explain the version choice:
- 0.30.48 fixes NO-OP string stubs from 0.22.0
- 0.30.48 avoids `rules` keyword conflict in 0.30.38
- 0.30.48 avoids substring-in-concat bug in 0.30.7/0.31.0
- 0.30.48 avoids complex-function empty-return bug in 0.30.49+

## Verification

After updating build.sh, rebuild the plugin:
```bash
cd plugins/frame.ui && bash build.sh
```

Then test with the test file:
```clean
plugins:
	frame.server
	frame.data
	frame.ui

start:
	print(test_page())

functions:
	string test_page()
		string title = "Hello"
		html:
			<div class='container'>
			<a href='/home' class='nav-link'>Home</a>
			<h1 id='main-title'>{title}</h1>
			</div>
```

Expected output: `<div class='container'><a href='/home' class='nav-link'>Home</a><h1 id='main-title'>Hello</h1></div>`

## Root Cause

Two codegen bugs affecting plugin WASM:
1. **0.30.7/0.31.0 bug**: `gen_substring` returns strings with wrong length (1024 instead of actual) when the result is used in a multi-part concat chain (`result + attr_name + "='" + value + "'"`). Local variable index mismatch — `attr_name` stored in local 60 but referenced as local 61.
2. **0.30.49+ bug**: Complex functions (89+ locals, nested while/if/else with recursive calls) return empty string. `html_block_to_code` loop executes but `string.concat` host import never called.

Both bugs are tracked in TASKS.md for future codegen fixes.

## Files Affected
- `plugins/frame.ui/build.sh` — compiler version reference
- `plugins/frame.ui/plugin.wasm` — rebuilt binary (already installed locally from 0.30.48)
