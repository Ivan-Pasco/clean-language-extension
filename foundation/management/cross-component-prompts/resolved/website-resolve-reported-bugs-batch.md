Component: Web Site Clean
Issue Type: task
Priority: high
Source Component: clean-language-compiler
Description: Four compiler bugs that were reported via the error reporting API have been fixed. Their status needs to be updated to "resolved" on the remote API using the authorized resolution endpoint.

## Bugs to Resolve

### Bug 1: Dot-notation plugin calls fail at WASM codegen
- **Report ID:** e06a5dc6-ab31-4ec8-b829-fc21390064de
- **Error Code:** COM001
- **Summary:** Function 'http.respond' not found in function map — all dot-notation namespace calls (http.*, req.*, json.*, db.*, ui.*) pass semantic analysis but fail at WASM codegen
- **Fixed in version:** 0.30.27
- **Fix description:** Plugin manifests were not stored in registry; added add_manifest() call in wasm_loader and auto-derive phase for dot-notation aliases from bridge function names
- **Fix commit:** d976d84

### Bug 2: iterate statement fails at parser level
- **Report ID:** f4f346d7-eaee-4913-9b53-854e29807784
- **Error Code:** SYN001
- **Summary:** Expected identifier, found LeftParen — iterate statement fails at parser level
- **Fixed in version:** 0.30.25
- **Fix description:** iterate syntax fixed in parser — iterate i in 0 to N now compiles correctly

### Bug 3: ALL dot-notation plugin calls fail at WASM codegen
- **Report ID:** 3828addc-b901-43a5-b751-a0b7322263fe
- **Error Code:** COM001
- **Summary:** Function 'namespace.function' not found in function map — ALL dot-notation plugin calls fail at WASM codegen
- **Fixed in version:** 0.30.27
- **Fix description:** Same root cause as Bug 1 — plugin manifests not stored in registry, language_to_bridge_map() returned empty
- **Fix commit:** d976d84

### Bug 4: Single-quoted HTML attributes rejected in html: blocks
- **Report ID:** b092e4ee-05c3-44d3-b7bd-5feae0aa172c
- **Error Code:** SYN001
- **Summary:** Lexer error: Invalid character apostrophe in html: block — single-quoted HTML attributes rejected
- **Fixed in version:** 0.30.25
- **Fix description:** html: block lexer now accepts single-quoted HTML attributes

## How to Resolve

For each bug, look up its fingerprint in the `error_reports` table using the `report_id`, then call the resolution endpoint:

```sql
SELECT fingerprint FROM error_reports WHERE report_id = '<report_id>';
```

Then for each fingerprint:

```bash
curl -X POST "https://errors.cleanlanguage.dev/api/v1/fingerprints/<fingerprint>/resolve" \
  -H "Authorization: Bearer $ERROR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fixed_in_version": "<version>",
    "fix_description": "<description>",
    "fix_commit": "<commit_hash>",
    "resolved_by": "compiler-team"
  }'
```

## Verification

After resolving, verify each report shows as resolved:

```bash
curl -s "https://errors.cleanlanguage.dev/api/v1/reports/status?id=e06a5dc6-ab31-4ec8-b829-fc21390064de"
# Should return: {"status": "resolved", "fixed_in_version": "0.30.27", ...}
```
