Component: clean-framework
Issue Type: compatibility
Priority: critical
Description: The frame.ui plugin bridge function names must be renamed from snake_case to camelCase in the runtime loader.js to match the compiler's dot-notation convention (`ui.toggleClass` → `_ui_toggleClass`).

Context: The Web Site Clean loader.js has already been updated. The framework's canonical loader at `plugins/frame.ui/runtime/loader.js` needs the same rename so all runtimes are consistent.

## Rename Map

| Old (snake_case) | New (camelCase) |
|---|---|
| `_ui_register_component` | `_ui_registerComponent` |
| `_ui_get_component` | `_ui_getComponent` |
| `_ui_load_layout` | `_ui_loadLayout` |
| `_ui_set_slot` | `_ui_setSlot` |
| `_ui_get_slot` | `_ui_getSlot` |
| `_ui_on_event` | `_ui_onEvent` |
| `_ui_set_state` | `_ui_setState` |
| `_ui_get_state` | `_ui_getState` |
| `_ui_update_element` | `_ui_updateElement` |
| `_ui_update_attr` | `_ui_updateAttr` |
| `_ui_bind_input` | `_ui_bindInput` |
| `_ui_validate` | `_ui_validate` |
| `_ui_event_attr` | `_ui_eventAttr` |
| `_ui_event_value` | `_ui_eventValue` |
| `_ui_event_closest_attr` | `_ui_eventClosestAttr` |
| `_ui_event_type` | `_ui_eventType` |
| `_ui_clipboard_write` | `_ui_clipboardWrite` |
| `_ui_location_href` | `_ui_locationHref` |
| `_ui_location_query` | `_ui_locationQuery` |
| `_ui_location_path` | `_ui_locationPath` |
| `_ui_get_text` | `_ui_getText` |
| `_ui_get_attr` | `_ui_getAttr` |
| `_ui_toggle_class` | `_ui_toggleClass` |
| `_ui_add_class` | `_ui_addClass` |
| `_ui_remove_class` | `_ui_removeClass` |
| `_ui_set_style` | `_ui_setStyle` |
| `_ui_update_element_self` | `_ui_updateElementSelf` |
| `_ui_query_set_style` | `_ui_querySetStyle` |
| `_ui_query_set_attr` | `_ui_querySetAttr` |
| `_ui_query_add_class` | `_ui_queryAddClass` |
| `_ui_query_remove_class` | `_ui_queryRemoveClass` |
| `_ui_filter_by_attr` | `_ui_filterByAttr` |
| `_ui_filter_by_text` | `_ui_filterByText` |
| `_ui_observe_visible` | `_ui_observeVisible` |
| `_ui_set_timeout` | `_ui_setTimeout` |
| `_ui_inject_head_css` | `_ui_injectHeadCss` |

Unchanged (already match): `_html_escape`, `_html_raw`

## Files to Modify

- `plugins/frame.ui/runtime/loader.js` — rename all WASM import keys
- `plugins/frame.ui/runtime/README.md` — update any function name references
- `documents/specification/05_frame_ui.md` — update bridge name references
- `documents/specification/frame_bridge_contracts.md` — update contract definitions
