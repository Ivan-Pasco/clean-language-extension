Component: clean-server
Issue Type: feature
Priority: critical
Description: Implement islands manifest generation and hydration loader for client-side interactivity

Pages with `client="on|visible|idle"` components need a hydration system. The server must generate an islands manifest at build time and serve a client-side loader that hydrates interactive components.

## Architecture

```
Build time:
  Compiler → identifies components with client="on|visible|idle|only"
  Server → generates islands-manifest.json mapping component → WASM module
  Server → generates loader.js (client-side hydration runtime)

Runtime (server):
  1. SSR renders the full page HTML
  2. Injects <script src="/loader.js"> at page end
  3. loader.js reads data-client attributes from DOM
  4. Loads appropriate WASM modules based on hydration mode

Runtime (browser):
  loader.js handles four hydration strategies:
  - "on"      → load WASM immediately after DOMContentLoaded
  - "visible" → use IntersectionObserver, load when element scrolls into view
  - "idle"    → use requestIdleCallback, load when browser is idle
  - "only"    → element has no SSR content, load and render entirely on client
```

## Islands Manifest Format

```json
{
  "islands": [
    {
      "component": "counter-widget",
      "module": "/wasm/counter-widget.wasm",
      "hydration": "on"
    },
    {
      "component": "data-chart",
      "module": "/wasm/data-chart.wasm",
      "hydration": "visible"
    }
  ]
}
```

## Loader.js Requirements

The frame.ui plugin already injects this at the end of pages that need client interactivity:
```html
<script src="/loader.js" data-wasm="/frontend.wasm"></script>
```

The loader must:
1. Find all elements with `data-client` attributes in the DOM
2. For each element, determine the hydration strategy
3. Load the corresponding WASM module from the islands manifest
4. Instantiate the WASM module with the element's DOM node as target
5. Call the component's `hydrate()` function

### Hydration Strategies Implementation

```javascript
// "on" strategy
document.addEventListener('DOMContentLoaded', () => loadIsland(el))

// "visible" strategy
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            loadIsland(entry.target)
            observer.unobserve(entry.target)
        }
    })
})
observer.observe(el)

// "idle" strategy
requestIdleCallback(() => loadIsland(el))

// "only" strategy — element starts empty, render entirely from WASM
loadIsland(el)
```

## SSR Output

The frame.ui plugin generates SSR HTML with markers. Example output for a hydrated component:
```html
<div data-island="counter-widget" data-client="on" data-props='{"start":0}'>
    <!-- SSR content here -->
    <span>0</span>
</div>
```

The server needs to:
1. Render the SSR HTML
2. Attach `data-island` and `data-client` attributes
3. Serialize component props as `data-props`

## Context
Currently, pages with `client="on"` render the SSR HTML but no client-side interactivity works. The frame.ui plugin does its part (generates the SSR HTML and marks components), but the server needs to generate the manifest and loader. Without this, Frame is SSR-only with no client-side interactivity.

## Files Affected
- Build pipeline — generate `islands-manifest.json` from compiled component metadata
- Static file serving — serve `loader.js` and component WASM modules
- SSR renderer — attach data attributes to island components
