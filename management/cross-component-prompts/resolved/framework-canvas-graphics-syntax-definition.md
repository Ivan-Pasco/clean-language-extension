# Canvas & Graphics Syntax Definition Prompt

## Context

You are designing the syntax specification for `frame.canvas` - the graphics and animation plugin for Clean Language. Clean Language is a type-safe language that compiles to WebAssembly, emphasizing readability, simplicity, and "one way to do things."

## Core Clean Language Principles (MUST FOLLOW)

1. **Block-based syntax** - Features use labeled blocks (`state:`, `functions:`, `watch:`)
2. **Tab indentation** - Code structure defined by tabs, not braces
3. **Strong typing** - All values have explicit or inferred types (`integer`, `number`, `string`, `boolean`)
4. **Lowercase namespaces** - `canvas.circle()`, not `Canvas.circle()`
5. **Method-style for objects** - `ball.move()`, `sprite.draw()`
6. **State is first-class** - Persistent state uses `state:` blocks with `watch:` for reactivity
7. **Plugin blocks** - Plugins define custom DSL blocks that expand to Clean Language code
8. **No global mutable variables** - State must be in `state:` blocks or class instances

## Existing Syntax Patterns

```clean
// State declaration (app-level, persists between frames)
state:
    integer score = 0
    number playerX = 100.0

// Watching state changes
watch score:
    print("Score: " + score.toString())

// Functions block
functions:
    void update()
        playerX = playerX + 1.0

// Class with state
class Player
    number x
    number y
    number speed

    constructor(number startX, number startY)
        x = startX
        y = startY
        speed = 200.0

    functions:
        void move(number dx, number dy, number dt)
            x = x + dx * speed * dt
            y = y + dy * speed * dt
```

## Task: Define Complete Canvas/Graphics Syntax

Design the syntax specification for these features. For each feature:
1. Show the **block syntax** (how users write it)
2. Explain **what it expands to** (underlying Clean Language code)
3. Provide **multiple examples** from simple to complex
4. Define **all parameters and their types**
5. Ensure consistency with Clean Language principles

---

## Features to Define

### 1. Canvas Scene Declaration

Define how to create a canvas with dimensions, background, and configuration.

Consider:
- Canvas ID for multiple canvases
- Width, height (fixed and responsive)
- Background color or image
- Pixel density / retina support
- Coordinate system (top-left origin vs center)

Example starting point:
```clean
canvas "game" (800, 600):
    background: "#0f0f23"
    // scene content
```

---

### 2. State for Animation

Define how persistent state works within canvas scenes. State must survive between frames.

Consider:
- Position, velocity, acceleration vectors
- Animation timers
- Game entities (players, enemies, particles)
- Integration with Clean Language `state:` blocks

Example starting point:
```clean
canvas "game":
    state:
        number ballX = 400.0
        number ballY = 300.0
        number velX = 200.0
        number velY = 0.0
```

---

### 3. Animation Loop (Frame Callback)

Define how the animation loop works - called every frame (~60fps).

Consider:
- Delta time for frame-independent movement
- Access to canvas state
- Separation of update logic vs render logic
- Pause/resume functionality

Example starting point:
```clean
canvas "game":
    onFrame(number dt):
        // Update physics
        velY = velY + gravity * dt
        ballY = ballY + velY * dt

        // Render
        clear()
        drawBall()
```

---

### 4. Drawing Primitives

Define syntax for all drawing operations.

**Basic Shapes:**
- Circle (filled, stroked, arc)
- Rectangle (filled, stroked, rounded corners)
- Line (single, polyline, polygon)
- Triangle
- Ellipse

**Text:**
- Text rendering with font, size, color
- Text measurement (width, height)
- Text alignment (left, center, right, top, middle, bottom)
- Multi-line text

**Paths:**
- Begin/end path
- Move to, line to
- Bezier curves (quadratic, cubic)
- Arc to
- Close path
- Fill and stroke

Example starting point:
```clean
draw:
    // Shape with properties
    circle(x, y, radius):
        fill: "#ff6b6b"
        stroke: "#ffffff"
        strokeWidth: 2.0

    // Or method style
    canvas.circle(x, y, radius, "#ff6b6b")
```

---

### 5. Styling & Effects

Define how to style shapes with advanced effects.

**Colors:**
- Solid colors (hex, rgb, rgba, named)
- Linear gradients
- Radial gradients
- Patterns (repeating images)

**Effects:**
- Shadows (blur, offset, color)
- Opacity/alpha
- Blend modes (multiply, screen, overlay, etc.)
- Filters (blur, brightness, contrast)

Example starting point:
```clean
style:
    gradient "sunset" linear(0, 0, 800, 0):
        stop(0.0, "#ff6b6b")
        stop(0.5, "#feca57")
        stop(1.0, "#48dbfb")

draw:
    rect(0, 0, 800, 600):
        fill: gradient("sunset")
        shadow:
            blur: 10.0
            offsetX: 5.0
            offsetY: 5.0
            color: "#00000080"
```

---

### 6. Transforms

Define how to transform the coordinate system.

Consider:
- Translate (move origin)
- Rotate (around point)
- Scale (uniform and non-uniform)
- Transform matrix
- Save/restore state stack

Example starting point:
```clean
draw:
    save()
    translate(400, 300)
    rotate(45)
    rect(-50, -50, 100, 100):
        fill: "#ff6b6b"
    restore()
```

---

### 7. Images & Sprites

Define how to load and draw images.

Consider:
- Image loading (sync/async)
- Drawing images (position, size, clipping)
- Sprite sheets (grid-based, atlas-based)
- Animation frames
- Image caching

Example starting point:
```clean
assets:
    image "player" from "sprites/player.png"
    spritesheet "enemies" from "sprites/enemies.png" (32, 32)

draw:
    image("player", x, y, width, height)
    sprite("enemies", frameIndex, x, y)
```

---

### 8. Input Handling

Define how to handle user input.

**Pointer/Mouse:**
- Position (x, y)
- Button state (down, up, pressed)
- Click, double-click
- Drag start/move/end
- Hover detection

**Keyboard:**
- Key down/up events
- Key held state
- Key combinations (Ctrl+S, etc.)
- Text input

**Touch:**
- Touch points (multi-touch)
- Gestures (tap, swipe, pinch, rotate)

**Gamepad:**
- Button mapping
- Analog sticks
- Vibration

Example starting point:
```clean
canvas "game":
    onPointerDown(number x, number y, integer button):
        if button == 0
            shoot(x, y)

    onKeyDown(string key):
        if key == "ArrowLeft"
            moveLeft = true

    onKeyUp(string key):
        if key == "ArrowLeft"
            moveLeft = false
```

---

### 9. Audio

Define how to play sounds and music.

Consider:
- Sound effects (short, one-shot)
- Music (long, looping)
- Volume, pan, pitch
- Spatial audio (3D positioning)
- Audio sprites

Example starting point:
```clean
assets:
    sound "jump" from "sounds/jump.wav"
    music "bgm" from "music/background.mp3"

functions:
    void playJump()
        audio.play("jump", volume: 0.8)

    void startMusic()
        audio.playMusic("bgm", loop: true)
```

---

### 10. Collision Detection

Define built-in collision helpers.

Consider:
- Point vs shape
- Shape vs shape (circle-circle, rect-rect, circle-rect)
- Ray casting
- Collision response helpers

Example starting point:
```clean
functions:
    boolean checkHit(number x1, number y1, number r1, number x2, number y2, number r2)
        return collision.circleCircle(x1, y1, r1, x2, y2, r2)

    // Or declarative
    collision:
        player collidesWith enemies -> onHit
        bullet collidesWith enemies -> onBulletHit
```

---

### 11. Scene & Layer Management

Define how to organize complex scenes.

Consider:
- Multiple layers (background, entities, UI)
- Layer ordering (z-index)
- Layer visibility
- Scene transitions
- Camera/viewport

Example starting point:
```clean
canvas "game":
    layers:
        layer "background" (z: 0)
        layer "entities" (z: 10)
        layer "ui" (z: 100)

    camera:
        follow: player
        bounds: (0, 0, worldWidth, worldHeight)
```

---

### 12. Particles & Effects

Define a particle system for visual effects.

Consider:
- Emitter configuration
- Particle properties (position, velocity, life, color, size)
- Particle behaviors (gravity, wind, attraction)
- Particle rendering (sprites, shapes)

Example starting point:
```clean
particles "explosion":
    count: 100
    lifetime: (0.5, 1.5)
    speed: (100, 300)
    direction: (0, 360)
    gravity: 200
    color: gradient("#ff6b6b", "#feca57", "#48dbfb")
    size: (5, 15) -> (0, 0)

functions:
    void explode(number x, number y)
        particles.emit("explosion", x, y)
```

---

### 13. UI Components on Canvas

Define how to create interactive UI elements within canvas.

Consider:
- Buttons, sliders, checkboxes
- Text input fields
- Panels and containers
- Focus management
- Accessibility

Example starting point:
```clean
canvas "menu":
    ui:
        button "start" (300, 200, 200, 50):
            text: "Start Game"
            onClick: startGame

        slider "volume" (300, 300, 200, 30):
            min: 0
            max: 100
            value: 80
            onChange: setVolume
```

---

### 14. Canvas + DOM Integration

Define how canvas interacts with HTML DOM elements.

Consider:
- Overlaying DOM on canvas
- Canvas inside DOM containers
- Event bubbling
- Responsive sizing

Example starting point:
```clean
canvas "game" in "#game-container":
    overlay:
        dom "#score-display"
        dom "#health-bar"
```

---

## Output Requirements

For each feature, provide:

1. **Syntax Definition** - EBNF or similar grammar
2. **Semantic Rules** - Type requirements, constraints
3. **Expansion** - What Clean Language code it generates
4. **Examples** - At least 3 examples per feature
5. **Edge Cases** - How to handle errors, invalid input
6. **Integration** - How it works with other features

## Design Constraints

- Must compile to WebAssembly
- Must work without JavaScript (pure WASM where possible)
- Must be deterministic (same input → same output)
- Must support multiple canvases
- Must integrate with Clean Language type system
- Must follow Clean Language error handling patterns

## Deliverable

A complete syntax specification document that:
1. Defines all syntax in formal grammar
2. Provides comprehensive examples
3. Explains the expansion/compilation process
4. Covers error handling
5. Documents all types and functions
6. Is consistent with Clean Language specification
