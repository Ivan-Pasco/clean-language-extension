Component: clean-node-server
Issue Type: compatibility
Priority: critical
Description: The UI bridge function names in clean-node-server must be renamed from snake_case to camelCase to match the compiler's dot-notation convention.

Context: The Web Site Clean loader.js has already been updated. The node server's bridge needs the same rename for consistency.

## Rename Map (functions found in clean-node-server)

| Old (snake_case) | New (camelCase) |
|---|---|
| `_ui_load_layout` | `_ui_loadLayout` |
| `_ui_inject_head_css` | `_ui_injectHeadCss` |

Plus any other `_ui_*` snake_case functions registered in the bridge index.

## Files to Modify

- `src/bridge/ui.ts` — rename exported function names
- `src/bridge/index.ts` — update WASM import registration keys
- Rebuild dist files after changes
