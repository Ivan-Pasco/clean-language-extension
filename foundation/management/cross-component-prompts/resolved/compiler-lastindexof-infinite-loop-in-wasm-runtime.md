Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: `lastIndexOf` causes infinite loop when called in plugin WASM. The plugin runtime hangs indefinitely when executing `string.lastIndexOf(":")` on any string. `indexOf(":")` on the same string works correctly.

## Context

Discovered while fixing the frame.server plugin to work with compiler v0.30.47 and v0.31.0. The plugin's `expand_endpoints` function used `first_line.lastIndexOf(":")` to find the colon terminating a route declaration (e.g., `GET /health:`). This call caused the WASM plugin runtime to hang at 96% CPU with no output.

Replacing `lastIndexOf(":")` with `indexOf(":")` immediately fixed the hang and the plugin now works correctly on both v0.30.47 and v0.31.0.

## Reproduction

1. Compile any Clean Language source that uses `lastIndexOf` with `--target=plugin`
2. Load the plugin WASM in the plugin runtime
3. Call the exported function that uses `lastIndexOf`
4. The runtime hangs indefinitely

### Minimal test case

```clean
functions:
	string expand(string block_name, string attributes, string body)
		string test = "/health:"
		integer pos = test.lastIndexOf(":")
		return pos.toString()
```

Compile with: `cln compile test.cln -o test.wasm --target=plugin`

### Expected behavior
`lastIndexOf(":")` should return 7 (position of the last colon in "/health:")

### Actual behavior
The plugin runtime hangs indefinitely, consuming 96% CPU

## Root cause hypothesis

The `lastIndexOf` implementation in the WASM codegen or runtime likely has a loop that doesn't terminate. Possible causes:
- The loop counter isn't decrementing correctly (searching backward from end)
- The string comparison in the loop never matches and the loop doesn't have a proper bounds check
- Memory corruption in the length-prefixed string format causes wrong length reading

## Impact

Any plugin that uses `lastIndexOf` will hang. The frame.server plugin was unusable on v0.30.47+ until this call was replaced with `indexOf`.

## Workaround

Replace all `lastIndexOf` calls with `indexOf` in plugin source code. For cases where the last occurrence is needed, use a manual reverse search loop with `indexOf` and position tracking.

## Files to investigate

- `src/codegen/` — WASM codegen for `lastIndexOf` string method
- `src/stdlib/` — Standard library implementation of `lastIndexOf`  
- The plugin runtime's string operation implementations

## Compiler versions affected

- v0.30.47: confirmed hang
- v0.31.0 (reports as 0.30.7): confirmed hang
- Earlier versions: unknown but likely affected too
