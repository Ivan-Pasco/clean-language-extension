# Bug Fix: bugs_list() API Returns `bugs` as Base64 Instead of JSON Array

## Component
Web Site Clean (error API) — `app/server/errors_api.cln`

## Issue Type
Bug — the `/api/v1/bugs` endpoint returns invalid JSON: the `bugs` field is serialized as a base64 string (`W10=` = base64 of `[]`) instead of a JSON array. Every strict JSON parser fails on the response.

## Priority
**High** — this breaks every programmatic consumer of the dashboard:

- `list_component_bugs` in the compiler MCP silently returns empty results (the `ComponentBug` deserializer in `clean-language-compiler/src/telemetry/submit.rs:391-467` can't parse the response).
- The `/errors` team skill can only extract `total` via regex; the bug details are unreachable.
- Local/server reconciliation is blocked: developers can't tell whether the dashboard is truly empty or whether the filter is broken.

Companion bug report tracked via `report_error` with code `WEB_API_BUGS_BASE64_LEAK` (report id `4d84a7d5-c8b4-43ab-8294-78bab6fb11f9`).

## Problem

### Actual response

```
GET /api/v1/bugs?component=compiler&status=reported
Authorization: Bearer <key>

HTTP/1.1 200 OK
Content-Type: application/json

{"bugs":W10=,"total":0,"component":"compiler","status_filter":"reported"}
```

`W10=` is base64 for `[]`. The scalar sits unquoted, so the payload is not even a syntactically valid JSON document.

### Reproducibility

Every component returns the same malformed shape:

```
for c in compiler server node-server framework extension manager website canvas ui mcp parser codegen runtime plugin unknown; do
  curl -s -H "Authorization: Bearer $KEY" \
    "https://errors.cleanlanguage.dev/api/v1/bugs?component=$c&status=reported" \
  | head -c 80
  echo
done
```

All responses have `"bugs":W10=,"total":0,...`. There is no path where the serializer currently emits a proper JSON array for this field.

### Root cause (hypothesis)

Almost certainly the frame.data / Clean JSON serializer is treating the `bugs` variable as `pairs` (or another base64-encoded type) instead of as a `list<Pairs>` / JSON array. When Clean serializes a `pairs` value into a JSON response, it emits a base64 string — that is correct for `pairs` values, but wrong for a list of records that should be an inline array.

Two likely shapes of the underlying mistake:

1. The query result is being assigned to a variable typed as `pairs` (or `any`) and serialized with the generic encoder that falls back to base64.
2. A loop builds a list but pushes values the wrong way (e.g., builds a single `pairs` object keyed by integer indices instead of a `list<JsonObject>`).

The sibling endpoint response fields (`total`, `component`, `status_filter`) serialize correctly, so the issue is localized to the `bugs` field only.

## Fix

### 1. Locate the endpoint handler

`app/server/errors_api.cln` — the same file referenced by `website-bugs-api-missing-subsystem.md`. Search for the function that returns the response containing `bugs`, `total`, `component`, `status_filter` (this is `bugs_list()` or whatever the endpoint binds to `GET /api/v1/bugs`).

### 2. Verify the variable type

The `bugs` array must be built as an explicit JSON array, not a `pairs` value. Concretely, the code pattern should be:

```clean
functions:
    JsonValue bugs_list(...)
        rows = database.query(...)
        list<JsonValue> bugs = []
        iterate row in rows
            bug = JsonObject.new()
            bug.set("fingerprint", row.fingerprint)
            bug.set("error_code", row.error_code)
            bug.set("component", row.error_component)
            bug.set("subsystem", row.error_subsystem or "")
            bug.set("canonical_message", row.canonical_message)
            ... other fields ...
            bugs.push(bug)
        response = JsonObject.new()
        response.set("bugs", JsonArray.from_list(bugs))   // <-- explicit JSON array
        response.set("total", bugs.length)
        response.set("component", component_param)
        response.set("status_filter", status_param)
        return response
```

The key point: whatever container holds the bug list **must** serialize as a JSON array. If the current code uses `pairs` or lets the type default to `any`, switch to `list<JsonValue>` and wrap it explicitly with the framework's JSON array constructor before attaching it to the response.

### 3. Confirm the serializer choice

If `JsonObject.set(key, list<T>)` exists and correctly emits `[...]`, the list itself is enough. If the serializer is falling back to base64, it means the framework doesn't auto-convert the list type to a JSON array at that attachment point — you must call the explicit array constructor (`JsonArray.from_list(...)`, `JsonValue.from_array(...)`, or whatever the current frame.data API provides).

Check `clean-framework/plugins/frame.data/` for the current JSON helper surface. If no helper exists, add one — this bug will recur anywhere else a list is attached to a JSON response.

### 4. Handle the empty case

When the query returns zero rows, the response must still be `"bugs":[]`, not `"bugs":W10=` or `"bugs":null`. Verify by querying a component with no bugs:

```
curl -s "$HOST/api/v1/bugs?component=nonexistent&status=reported"
# Expected: {"bugs":[],"total":0,"component":"nonexistent","status_filter":"reported"}
```

## Verification

After the fix is deployed:

```
# 1. Valid JSON
curl -s -H "Authorization: Bearer $KEY" \
  "https://errors.cleanlanguage.dev/api/v1/bugs?component=compiler&status=reported" \
  | python3 -m json.tool

# 2. bugs field is an array
curl -s -H "Authorization: Bearer $KEY" \
  "https://errors.cleanlanguage.dev/api/v1/bugs?component=compiler&status=reported" \
  | python3 -c "import json, sys; d=json.load(sys.stdin); assert isinstance(d['bugs'], list), type(d['bugs'])"

# 3. compiler MCP can see bugs
cln mcp-server <<< '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_component_bugs","arguments":{"component":"compiler"}}}'
# Should return actual bug records (if any), not an empty list or parse error.
```

Once verified, the companion report (`WEB_API_BUGS_BASE64_LEAK`) should auto-surface on the dashboard and can be resolved via `/resolve-fix`.

## Downstream Cleanup

Once the API returns valid JSON:

1. Re-run the `/errors` team skill against the live dashboard — all 10 local reports without fingerprints (in `~/.cleen/telemetry/reported_errors.json`) can be reconciled or re-submitted.
2. The 16 local reports with fingerprints can finally be checked for resolution status — right now the compiler's `check_reported_fixes` has no reliable way to pull their server state.
3. Audit any other endpoint returning a list-shaped field. If this bug exists for `bugs_list`, it may exist for `reports_list`, `components_list`, or any other endpoint returning a JSON array. A grep for handlers that attach lists to response objects will catch them.
