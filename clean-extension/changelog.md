# Changelog

All notable changes to the Clean Language extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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