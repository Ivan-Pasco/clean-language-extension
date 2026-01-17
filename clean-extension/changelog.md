# Changelog

All notable changes to the Clean Language extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-17

### Added

#### Frame Framework Plugin Architecture
- **Dynamic Plugin Loading** - Automatically loads plugins from `plugins:` block in `app.cln`
  - Parses `plugin.toml` manifests from project `plugins/` folder
  - Falls back to global plugins at `~/.clean/plugins/`
  - Watches `app.cln` for changes and reloads plugins automatically
- **Plugin-based Completions** - IDE completions from plugin language definitions
  - Blocks, keywords, types, and functions from plugins
  - Hover documentation for plugin-provided symbols
- **Plugin Status Bar** - Shows loaded plugin count with tooltip listing plugin names

#### CLI Integration (cln commands)
- **Project Commands**
  - `Create New Project` - Initialize new Clean Framework project with templates
  - `Add Plugin` - Add plugins to project
  - `List Plugins` - View installed plugins
- **Build Commands**
  - `Build Project` - Run `cln build`
  - `Build Watch` - Run `cln build --watch` in terminal
  - `Build Production` - Run `cln build --production`
- **Server Commands**
  - `Start Server` - Start development server (`cln serve`)
  - `Stop Server` - Stop running server
  - `Restart Server` - Restart development server
- **Database Commands**
  - `Database Migrate` - Run migrations
  - `Database Seed` - Seed database
  - `Database Reset` - Reset database (with confirmation)
- **Generate Commands**
  - `Generate Model` - Create data model
  - `Generate Endpoint` - Create API endpoint
  - `Generate Component` - Create UI component
  - `Generate Page` - Create page
  - `Generate Scene` - Create canvas scene

#### New Syntax Highlighting
- **Framework Blocks** - `plugins:`, `import:`, `data`, `endpoints:`, `server:`, `component`, `screen`, `page`, `styles:`, `auth:`, `protected:`, `canvasScene`
- **Sub-block Keywords** - `where:`, `order:`, `limit:`, `guard:`, `render:`, `state:`, `props:`, `handlers:`, `computed:`, `jwt:`, `init:`, `update:`, `assets:`
- **HTTP Methods** - `GET`, `POST`, `PUT`, `PATCH`, `DELETE` with URL path highlighting
- **Framework Functions** - `json()`, `html()`, `redirect()`, `notFound()`, `error()`, `hashPassword()`, `verifyPassword()`, etc.
- **Framework Classes** - `Data`, `Auth`, `req`, `res`, `canvas`, `sprite`, `audio`, `input`, `collision`, `camera`, `ease`, `db`

#### HTML+Clean Hybrid Templates
- **New File Type** - `.html.cln` files for HTML templates with Clean expressions
- **Template Interpolation** - `{{expression}}` and `{{{rawExpression}}}` syntax
- **Directive Attributes** - `@if`, `@else`, `@each`, `@show`, `@slot`, `@client`, `@validate`
- **Bind Attributes** - `:attribute="expression"` syntax
- **Event Handlers** - `@onclick`, `@onsubmit`, etc.

#### Framework Snippets (20 new)
- `plugins` - Plugins declaration block
- `import` - Import block declaration
- `data` - Data model definition
- `get`, `post`, `put`, `delete` - HTTP endpoint templates
- `endpoints` - Endpoints block
- `component` - UI component with props/render
- `page` - Page definition
- `screen` - Screen with state/render/handlers
- `auth` - Auth configuration
- `protected` - Protected block with roles
- `find`, `insert` - Data operations
- `transaction` - Database transaction
- `guard` - Endpoint guard
- `canvasScene` - Canvas scene for games
- `styles` - Styles definition
- `server` - Server configuration

#### Status Bar Enhancements
- **Server Status Indicator** - Shows server state (stopped/starting/running/stopping/error) with port
- **Build Button** - Quick access to build command on .cln files
- **Plugin Context** - Shows loaded plugin count with names tooltip

#### Keybindings
- `Cmd+Shift+B` / `Ctrl+Shift+B` - Build project
- `Cmd+Shift+S` / `Ctrl+Shift+S` - Start server
- `F5` - Run current file

### Changed
- **Major Version Bump** - v2.0.0 for significant Frame Framework additions
- **Description Updated** - Now mentions Frame Framework, plugin architecture, CLI integration
- **Keywords Extended** - Added frame-framework, plugins, web-framework, fullstack, data-models, endpoints, components, canvas-games
- **Activation Events** - Now activates on both `clean` and `clean-html` languages

### Configuration
- `clean.plugins.autoLoad` - Auto-load plugins from app.cln (default: true)
- `clean.plugins.globalPath` - Global plugins path (default: ~/.clean/plugins)
- `clean.server.port` - Development server port (default: 3000)
- `clean.server.autoStart` - Auto-start server on workspace open (default: false)

### Technical
- Created `src/types/plugin-types.ts` for plugin type definitions
- Created `src/services/plugin-loader.ts` for dynamic plugin loading
- Created `src/services/cli-integration.ts` for CLI command integration
- Created `syntaxes/clean-html.tmLanguage.json` for HTML+Clean hybrid syntax
- Updated `src/extension.ts` with new services and 17 new commands
- Updated `src/statusbar.ts` with server and plugin status indicators
- Updated `syntaxes/clean.tmLanguage.json` with framework patterns
- Updated `snippets/clean.code-snippets` with 20 framework snippets

## [1.3.1] - 2025-10-08

### Fixed
- **Refresh Compile Options Command** - Fixed refresh command that was calling non-existent `cleen options --export-json`
  - Now properly clears cache and reloads from disk
  - Works with existing compile-options.json files in `~/.cleen/versions/`

### Changed
- **Extension Icon** - Added new clean, simple icon design
  - Blue rounded background with white "C" letter
  - Sparkle accents for "clean" concept
  - 128x128 optimized PNG

## [1.3.0] - 2025-10-05

### Added
- **Dynamic Compile Options** - Compile options are now loaded dynamically from the Clean Language compiler
  - Options automatically match the capabilities of your installed compiler version
  - Each compiler version (v0.8.5+) includes its own `compile-options.json` file
  - Extension reads options from `~/.cleen/versions/{version}/compile-options.json`
  - Future-proof: new compiler options appear automatically without extension updates
  - Graceful fallback to defaults if JSON unavailable
- **Refresh Compile Options Command** - Manually reload compile options from compiler
  - Command: "Clean Language: Refresh Compile Options"
  - Useful after compiler updates or version switches
- **Version-Aware Options** - Different compiler versions can have different available options
  - Options are tied to specific compiler versions
  - Switching compiler versions updates available options automatically
- **Improved Option Discovery** - Multi-path search for compile options
  - Checks active version from cleen config first
  - Falls back to all installed versions if needed
  - Supports custom paths via settings

### Changed
- **Compile Options Dialog** - Now displays options from compiler instead of hardcoded values
  - Targets, optimizations, runtimes, flags, and presets are all dynamic
  - Labels and descriptions come from compiler-generated JSON
  - Better integration with compiler evolution
- **Extension Architecture** - Added new services layer for dynamic options loading
  - New `CompileOptionsLoader` service for managing options
  - TypeScript type definitions for compile options schema
  - Preloads options on activation for faster first use

### Technical
- Created `src/types/compile-options.ts` for TypeScript definitions
- Created `src/services/compile-options-loader.ts` for dynamic loading logic
- Updated `src/commands.ts` to use dynamic options loader
- Updated `src/extension.ts` to preload options on activation
- Added configuration option: `clean.compiler.optionsPath` for custom JSON paths
- Integration with Clean Language compiler v0.8.5+ options export feature
- Integration with Clean Manager extraction of compile-options.json from releases

### Documentation
- Added comprehensive testing guide in `TESTING-DYNAMIC-OPTIONS.md`
- Added implementation summary in `DYNAMIC-OPTIONS-COMPLETE.md`
- Added verification script: `verify-integration.js`

## [1.2.0] - 2025-08-21

### Added
- **Advanced Compile Options** - New "Compile with Options" button with 4-step selection dialog
  - Target platform selection (Web, Node.js, Native, Embedded, WASI, Auto)
  - Optimization level selection (Development, Production, Size, Speed, Debug)
  - WebAssembly runtime selection (Auto, Wasmtime, Wasmer)
  - Additional options (Debug info, Verbose output, or both)
- **Clean Language v0.5.0 Support** - Updated to support latest compiler features
- **Interactive Options Dialog** - User-friendly step-by-step configuration with icons and descriptions

### Changed
- **Manager Integration Updated** - Migrated from `cleanmanager` to `cleen` command
- **UI Improvements** - Added settings-gear icon for compile options button
- **Command Organization** - Reorganized button bar with compile options between compile and test

### Fixed
- **Manager Path Updates** - Updated all references from cleanmanager to cleen
- **Version Detection** - Improved version switching and detection with new manager

## [1.1.9] - 2025-08-12

### Fixed
- **Version selection persistence** - Status bar now properly updates and shows selected version after switching
- **Architecture refactor** - Unified command handling and status bar management for better integration
- **Status bar updates** - Version changes are now immediately reflected in the status bar display
- **Command integration** - Connected improved version parsing with status bar updates

## [1.1.8] - 2025-08-12

### Fixed
- **Version selector parsing issues** - Fixed strange version names appearing in dropdown
- **Version parsing logic** - Improved cleanmanager output parsing to handle formatted output correctly
- **Version sorting** - Added proper semantic version sorting (latest first, current highlighted)
- **Error handling** - Better filtering of header text and non-version lines from cleanmanager output

## [1.1.7] - 2025-08-12

### Fixed
- Marketplace visibility issue resolved for Cursor
- Forced re-publication to refresh marketplace cache

## [1.1.6] - 2025-01-12

### Fixed
- Marketplace publication issue resolved
- All features from 1.1.5 confirmed working

## [1.1.5] - 2025-01-12

### Added
- Enhanced UI with toolbar buttons for main functions (Run, Compile, Test)
- Right-click context menu items for Clean Language files
- Interactive status bar with version display and quick access to version switching
- New "Show Version Info" command with detailed version information
- Visual icons for all commands using VS Code's icon system
- Improved command palette integration with better command organization

### Fixed
- Cursor compatibility issues by removing universal activation event
- Non-blocking extension activation to prevent timeout issues  
- LSP import compatibility with graceful fallback when Language Client unavailable
- Enhanced error handling during activation and deactivation
- Improved cleanmanager detection and status reporting

### Changed
- Restructured activation flow for better performance in Cursor
- Commands now only appear when working with .cln files (context-aware)
- Status bar updates automatically when switching Clean Language versions
- Better user feedback with loading states and error messages

### Technical
- Conditional LSP imports for better compatibility across editors
- Asynchronous initialization to prevent blocking the main thread
- Enhanced error recovery and user-friendly messaging
- Improved extension stability and reliability

## [1.0.0] - 2025-07-19

### Added
- Initial release of Clean Language extension
- Comprehensive syntax highlighting for `.cln` files
- Language Server Protocol (LSP) implementation in Rust
- cleanmanager integration for version management
- Smart autocompletion for built-in classes (Math, String, List, Http, File)
- Apply-block syntax support with intelligent completions
- Tab-based indentation enforcement and formatting
- Real-time error detection and diagnostics
- Hover documentation for built-in classes and methods
- Code snippets for common Clean Language patterns
- One-click compile, run, test, and debug commands
- Status bar integration with version display and action buttons
- Per-project version detection via `.cleanmanager` files
- Command palette integration for all Clean Language operations
- Editor context menus and title bar buttons
- Comprehensive keyboard shortcuts
- Error recovery and helpful suggestion system
- Type-aware completions with precision modifiers
- Method chaining support in completions
- Built-in testing framework integration
- HTTP class integration for REST API development
- File I/O class integration
- Mathematical operations class integration
- String manipulation class integration
- List operations class integration

### Features
- **Language Support**: Full Clean Language syntax highlighting and parsing
- **LSP Server**: Rust-based Language Server Protocol implementation
- **Version Management**: Seamless cleanmanager integration
- **Smart Completions**: Context-aware autocompletion system
- **Error Handling**: Advanced error detection with recovery suggestions
- **Development Tools**: Integrated compile/run/test/debug workflow
- **Documentation**: Hover information and built-in class documentation
- **Formatting**: Automatic tab-based indentation formatting
- **Project Support**: Per-project version configuration
- **UI Integration**: Status bar, context menus, and command palette

### Technical Details
- Built with TypeScript for VS Code/Cursor integration
- Rust-based LSP server for optimal performance
- TextMate grammar for syntax highlighting
- cleanmanager binary integration for version management
- Incremental parsing for real-time feedback
- Support for Clean Language's unique features:
  - Apply-blocks with colon syntax
  - Tab-based indentation requirements
  - Built-in class method chaining
  - Type precision modifiers
  - Generic type system with `any`
  - Functions blocks requirements
  - Class inheritance with `is` keyword

### Extension Capabilities
- File association for `.cln` and `.test.cln` files
- Language configuration with proper bracket matching
- Code snippets for rapid development
- Command contributions for all Clean Language operations
- Menu contributions in editor title and context
- Keyboard shortcuts for common operations
- Configuration options for customization
- Status bar integration with version display
- Automatic cleanmanager detection and installation prompts

Created by Ivan Pasco - Creator of Clean Language, Clean Language Extension, and Clean Language Manager.