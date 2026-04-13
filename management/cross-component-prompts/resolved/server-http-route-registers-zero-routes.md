Component: clean-server
Issue Type: bug
Priority: critical
Source Component: Web Site Clean + frame.server plugin + compiler v0.30.48

## Summary

After fixing the `_http_route` import type mismatch (commit 4633c50), the WASM now loads successfully but `_http_route` calls register 0 routes. The `_start` function runs, the plugin-generated code calls `_http_route("GET", "/api/health", 0)` etc., but the server logs:

```
Calling WASM entry point: _start
Registered 0 routes
Module initialized with 0 routes
No routes were registered by the WASM module
```

All requests return "Not Found".

## Previous behavior

With the old plugin (frame.httpserver) + compiler v0.30.22-v0.30.38 + clean-server v1.7.11-v1.8.11:
```
Registered 24 routes
Module initialized with 24 routes
```

## What the plugin generates

The frame.server plugin `expand_endpoints` function generates a `start:` block like:

```
start:
	_http_route("GET", "/api/health", 0)
	_http_route("GET", "/api/content", 1)
	_http_route("POST", "/api/v1/reports", 8)
	... (24 routes total)
	printl("Registered 24 routes")
```

The `printl` output says "Registered 0 routes" — meaning `handler_idx` stayed at 0 in the plugin's expand loop. OR the routes register but the server doesn't count them.

Wait — actually "Registered 0 routes" comes from the plugin-generated `printl`. If the plugin generates `printl("Registered " + handler_idx.toString() + " routes")` and it prints 0, then the **plugin expansion itself** produced 0 routes. The plugin's endpoint parser failed to parse any routes from the body.

## Likely root cause

The frame.server plugin's `expand_endpoints` function receives the `endpoints server:` body content and parses it with string operations (indexOf, substring). On compiler v0.30.48, the string operations may behave differently (e.g., indexOf returns different values, substring boundaries changed), causing the route parser to find 0 method positions.

## Debug suggestion

Add debug output to the plugin's `expand_endpoints` function to print the `body` parameter it receives. The body should contain:

```
GET "/api/health" :
	return api_health()

GET "/api/content" :
	return api_content()
...
```

If the body is empty or malformed, the issue is in how the compiler passes the block body to the plugin. If the body is correct but parsing fails, the issue is in the plugin's string parsing logic on v0.30.48.

## Environment

- Compiler: v0.30.48
- Framework: v2.10.9 (frame.server plugin)
- Server: clean-server v1.9.0 (commit 4633c50)
- Website: 24 routes in endpoints server: block
