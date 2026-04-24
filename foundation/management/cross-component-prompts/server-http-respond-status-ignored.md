Component: clean-server (host bridge)
Issue Type: bug
Priority: high
Error Code: FRAME_SERVER_HTTP_STATUS_IGNORED
Fingerprint: e31521d0548c375ff0944b15e9e44c0bca01f358a7e96e6bc4eaf77cfc321fb1
First reported version: 0.30.70
Dashboard: https://errors.cleanlanguage.dev (framework/open)

## Description
`http.respond(status, content_type, body)` always returns HTTP 200 regardless of the status argument. All of 400, 500, 201, etc. come back to the client as 200.

## Reproduction
```clean
plugins:
	frame.server

endpoints server:
	GET "/error400" :
		return http.respond(400, "application/json", "{\"error\":\"test\"}")
	GET "/error500" :
		return http.respond(500, "application/json", "{\"error\":\"test\"}")
	GET "/created" :
		return http.respond(201, "application/json", "{\"ok\":true}")
```

Observed:
```
curl -w "%{http_code}\n" http://server/error400  -> 200
curl -w "%{http_code}\n" http://server/error500  -> 200
curl -w "%{http_code}\n" http://server/created   -> 200
```

## Why Cross-Component
The framework plugin (`plugins/frame.server/src/main.cln`) delegates to the host bridge import `_http_respond(integer status, string content_type, string body)`. That import is implemented in the clean-server host bridge (see `clean-server/src/bridge.rs` and `clean-server/host-bridge/src/http.rs`) — the framework plugin only declares the signature.

## Suspected Fix Location
Look for the `_http_respond` (or `bridge:http.respond`) handler in `clean-server/host-bridge/src/http.rs` or `clean-server/src/bridge.rs`. The handler likely ignores the status parameter and always writes `200 OK` to the response. Wire the `status` argument into the outgoing HTTP response builder.

## Files to Inspect
- `clean-server/src/bridge.rs`
- `clean-server/src/wasm.rs`
- `clean-server/host-bridge/src/http.rs`

## Verification
After fix, the reproduction above must show each endpoint returning its declared status code. A test in `clean-server/tests/` that asserts `StatusCode::BAD_REQUEST` / `INTERNAL_SERVER_ERROR` / `CREATED` for `_http_respond(400/500/201, ...)` would be appropriate.

## Framework-Side Status
No framework-side code change is needed or appropriate. The framework correctly forwards the status argument to `_http_respond`; the bug is entirely on the host bridge side.
