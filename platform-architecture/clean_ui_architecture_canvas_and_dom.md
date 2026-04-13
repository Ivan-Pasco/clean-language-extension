# Clean Language UI Architecture
## Canvas and DOM Rendering Systems

---

## 1. Overview

The Clean Language Platform supports **multiple rendering systems** to address different UI needs while preserving a **single programming model**.

Two primary rendering targets are supported:

- **Canvas Rendering System** – pixel-based, animation-first, high-performance
- **DOM Rendering System** – document-based, accessible, form-centric

These systems are **not competing UI frameworks**.  
They are **rendering targets** coordinated by **Clean UI**, the platform’s primary UI abstraction.

---

## 2. Architectural Layers

```
Clean Application
 ├─ Clean UI (primary API)
 │    ├─ Layout & widgets
 │    ├─ State & events
 │    └─ Screen lifecycle
 │
 ├─ Rendering Targets
 │    ├─ DOM Target
 │    └─ Canvas Target
 │
 ├─ Clean Runtime (WASM)
 │
 └─ Host Environment
      ├─ Browser (HTML, Canvas, WebGPU)
      └─ Native (Window, GPU surface)
```

---

## 3. Clean UI: The Primary Interface Layer

### Role

Clean UI is the **only layer where application UI intent is defined**.

It is responsible for:
- Screens and navigation
- Layout and composition
- Widgets (buttons, text fields, lists)
- State binding
- Event handling
- Target selection (DOM / Canvas / hybrid)

Clean UI does **not** render directly.  
It **describes intent**, which is compiled and dispatched to rendering targets.

---

## 4. Canvas Rendering System

### Purpose

Clean Canvas is a **rendering and animation system**, not a UI framework.

It provides:
- Immediate-mode drawing
- Frame-driven animation
- Custom visuals and effects
- High-performance rendering via GPU

### Characteristics

| Aspect | Canvas |
|------|-------|
| Rendering model | Pixel-based |
| Layout | Manual |
| UI semantics | None |
| Accessibility | External |
| Text input | Not native |
| Performance | High |
| Typical usage | Visual layers, animation, scenes |

Canvas is executed by the **host environment** (browser or native) through the Clean host bridge.

---

## 5. DOM Rendering System

### Purpose

The DOM rendering system handles **document-centric UI concerns**.

It provides:
- Native text input
- Accessibility
- Layout and flow
- SEO-friendly content
- Platform conventions (IME, focus, selection)

### Characteristics

| Aspect | DOM |
|------|----|
| Rendering model | Element tree |
| Layout | Automatic |
| UI semantics | Native |
| Accessibility | Built-in |
| Text input | Native |
| Performance | Moderate |
| Typical usage | Forms, content, admin UIs |

DOM rendering is also executed by the host through controlled APIs.

---

## 6. Hybrid Rendering Model

### Single Screen, Multiple Targets

A **screen** may contain multiple rendering targets.

Example:
- Canvas for animated background or charts
- DOM for controls, text, and forms

Both targets:
- Share the same state
- Share the same event model
- Share the same lifecycle

They are **visually layered**, not logically coupled.

---

## 7. Synchronization Model

### What Synchronization Means in Clean

Synchronization is **declarative**, not procedural.

Canvas and DOM are synchronized through:
- Shared state
- Shared lifecycle
- Deterministic update phases

They **never query or manipulate each other directly**.

### Guaranteed
- Consistent state
- Coordinated updates
- Predictable rendering order

### Not Guaranteed (by design)
- Pixel-perfect timing
- Sub-millisecond animation lockstep
- Canvas awareness of DOM layout unless explicitly provided

---

## 8. Lifecycle and Update Flow

A typical screen update follows this sequence:

1. Input events are received by the host
2. Events are dispatched to Clean UI
3. State updates occur
4. Layout is resolved
5. Canvas draw phase executes
6. DOM commit phase executes

This order ensures visual stability and avoids feedback loops.

---

## 9. Interaction Rules (Hard Constraints)

To preserve clarity and portability, the platform enforces the following rules:

### Forbidden
- Canvas querying DOM layout directly
- DOM mutating Canvas state outside Clean state
- Independent event systems per target
- Widgets implemented directly inside Canvas without Clean UI

### Required
- All interaction flows through Clean state
- All UI intent flows through Clean UI
- Canvas and DOM treated as render targets only

---

## 10. Design Principles

1. **Single Mental Model** – developers learn one UI system
2. **Intent Over Implementation** – describe what, not how
3. **Explicit Power** – advanced rendering is opt-in
4. **Host-Driven Execution** – rendering handled by the host
5. **Hybrid by Default** – mixed rendering is a first-class concept

---

## 11. Best Practices

### Use Canvas When
- You need animation or custom visuals
- Performance matters
- UI elements are non-semantic
- You are building scenes or dashboards

### Use DOM When
- You need text input or forms
- Accessibility is required
- Content must be selectable or searchable
- Platform conventions matter

### Combine Them When
- You want animated visuals with real UI
- You need both performance and usability
- You want future portability (web + desktop)

---

## 12. Summary

- Clean UI is the **single source of UI truth**
- Canvas and DOM are **rendering targets**
- Screens may use both
- Synchronization is state-driven
- The architecture prevents fragmentation by design

> Canvas renders pixels.  
> DOM renders documents.  
> Clean UI defines interfaces.

