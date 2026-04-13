Component: clean-framework (frame.server plugin)
Issue Type: bug
Priority: high
Description: The frame.server plugin's expand() function generates Clean Language code that uses `any` as a parameter type, which the parser doesn't support in function signatures.

## Error

```
Failed to parse plugin output: Syntax error: Expected RightParen, found Identifier("status")
  at <plugin-output>:3:32
```

## Root Cause

The plugin source at `~/.cleen/plugins/frame.server/src/main.cln` generates helper functions with `any` parameter types:

```clean
// Line 47-48 of expand_endpoints():
result = result + "\tstring jsonResponse(any data)\n"
result = result + "\t\treturn _http_respond(200, \"application/json\", data.toString())\n\n"

// Line 49-50:
result = result + "\tstring jsonResponseStatus(any data, integer status_code)\n"
```

The `any` type is not supported as a function parameter type in the Clean Language parser. When the compiler tries to parse the plugin output, it fails at `(any data)` — it sees `any` as an identifier, then `data` as the next identifier, and expects `)` instead.

## Fix

Replace `any` with `string` in the generated function signatures since `data.toString()` is always called on the parameter anyway:

```clean
// BEFORE:
result = result + "\tstring jsonResponse(any data)\n"
result = result + "\tstring jsonResponseStatus(any data, integer status_code)\n"

// AFTER:
result = result + "\tstring jsonResponse(string data)\n"
result = result + "\tstring jsonResponseStatus(string data, integer status_code)\n"
```

## Context

This was discovered after fixing two compiler codegen bugs (v0.30.43 and v0.30.44) that caused the frame.server plugin's expand() function to trap with `unreachable` before it could produce output. Now that expand() runs to completion, the generated code is parsed — and this type error was found.

## Verification

After fixing, recompile the plugin:
```bash
cln compile ~/.cleen/plugins/frame.server/src/main.cln -o ~/.cleen/plugins/frame.server/plugin.wasm --target=plugin
cp ~/.cleen/plugins/frame.server/plugin.wasm ~/.cleen/plugins/frame.server/2.1.0/plugin.wasm
```

Then test:
```bash
echo 'plugins:
	frame.server

endpoints server:
	GET "/" :
		return http.respond(200, "text/html", "<h1>Hello</h1>")' > /tmp/test_server.cln

cln compile --plugins -o /tmp/test_server.wasm /tmp/test_server.cln
```

## Files Affected

- `~/.cleen/plugins/frame.server/src/main.cln` — lines generating `jsonResponse` and `jsonResponseStatus` signatures
