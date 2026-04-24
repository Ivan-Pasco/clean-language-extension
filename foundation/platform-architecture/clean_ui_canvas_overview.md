# Clean UI & Clean Canvas
## Overview and Mental Model

---

## 1. Purpose of This Document

This document introduces **Clean UI** and **Clean Canvas** at a conceptual level.

Its goal is to help you understand:
- what each system is for
- how they work together
- when to use each one
- how to think about UI in the Clean Language platform

This is **not** a full syntax reference. Detailed syntax is defined in separate documents.

---

## 2. One UI Model, Multiple Render Targets

Clean Language uses a **single UI model** with **multiple rendering targets**.

You describe *what the interface is*, not *how it is rendered*.

```
Clean UI  →  DOM rendering
         →  Canvas rendering
         →  Hybrid (DOM + Canvas)
```

Clean UI is the **primary API**. Canvas and DOM are **rendering targets**.

---

## 3. Clean UI (Primary API)

### What is Clean UI?

Clean UI is the **main way to build user interfaces** in Clean applications.

It is responsible for:
- screens and navigation
- layout and composition
- widgets (buttons, text fields, lists)
- state binding
- event handling

Clean UI defines **intent**, not rendering.

---

### Example: A Simple Screen

```clean
screen "Login":

    state:
        email: text = ""
        message: text = ""

    ui.column gap 12 padding 20 width 360:

        ui.text "Sign in" size 24 weight "bold"

        ui.textField
            label "Email"
            value state.email
            onChange (v):
                state.email = v

        ui.button "Continue"
            onClick:
                message = "Signing in..."

        ui.text message tone "muted"
```

This same screen can render to **DOM**, **Canvas**, or both.

---

## 4. Rendering Targets

### 4.1 DOM Rendering

The DOM target renders UI using native platform elements.

Use DOM when you need:
- text input and forms
- accessibility
- selection and copy/paste
- platform conventions (IME, focus, keyboard navigation)

DOM rendering is the default target.

---

### 4.2 Canvas Rendering

Clean Canvas is a **drawing and animation system**, not a UI framework.

Use Canvas when you need:
- custom visuals
- animation
- charts, scenes, or effects
- high-performance rendering

Canvas renders **pixels**, not elements.

---

## 5. Hybrid Rendering (Recommended Pattern)

Most real applications benefit from **hybrid rendering**.

Canvas is used for visuals.
DOM is used for controls.

Both share:
- the same screen
- the same state
- the same event model

---

### Example: Hybrid Screen

```clean
screen "Landing":

    state:
        progress: number = 0.3

    ui.stack:

        ui.region target "canvas" height 240:
            ui.canvasScene:
                draw =>
                    canvas.clear
                    canvas.circle x 200 y 120 radius 60
                    canvas.arc progress progress

        ui.region target "dom" padding 20:
            ui.button "Increase"
                onClick:
                progress = min(progress + 0.1, 1)
```

---

## 6. How Synchronization Works

Canvas and DOM are **not synchronized by direct communication**.

They are synchronized through:
- shared state
- shared lifecycle
- deterministic update phases

When state changes:
- Canvas redraws
- DOM updates

This keeps behavior predictable and portable.

---

## 7. What Clean Canvas Is Not

Clean Canvas does **not**:
- replace Clean UI
- define layout or widgets
- manage text input or accessibility
- act as a DOM abstraction

Canvas is a **render target**, not a UI system.

---

## 8. Design Principles

1. **One mental model** – learn UI once
2. **Intent over implementation** – describe, don’t micromanage
3. **Explicit power** – Canvas is opt-in
4. **Hybrid by default** – visuals + usability
5. **Host-driven rendering** – browser or native

---

## 9. How to Read the Next Documents

After this overview:

- Read **Clean UI Syntax Reference** to learn all UI elements
- Read **Clean Canvas Syntax Reference** to learn drawing and animation

You rarely need Canvas to build normal applications.
You use it when visuals matter.

---

## 10. Summary

- Clean UI is the primary API
- DOM and Canvas are rendering targets
- Screens may use both
- Synchronization is state-driven

> Build interfaces with `ui.*`.  
> Use `canvas.*` for visuals.

