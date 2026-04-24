# 🤖 CLAUDE.md - AI Assistant Development Context

This document provides comprehensive context for AI assistants (like Claude) working on the Clean Language Extension project. It contains project-specific information, conventions, and guidelines to ensure consistent and effective AI assistance.

## 📋 Project Overview

### Project Identity
- **Name**: Clean Language Extension for VS Code & Cursor
- **Creator**: Ivan Pasco
- **Language**: Clean Language (custom programming language)
- **Implementation**: TypeScript (Extension Host) + Rust (Language Server)
- **Target Platforms**: VS Code, Cursor, VSCodium, Eclipse Theia, Gitpod

### Core Purpose
Provide comprehensive IDE support for Clean Language including:
- Syntax highlighting and code completion
- Language Server Protocol (LSP) implementation
- Integration with Clean Manager (compiler/runtime)
- Multi-platform distribution (VS Code Marketplace + Open VSX Registry)

## 🏗️ Architecture Context

**CRITICAL: Read [IDE Extension Architecture](../platform-architecture/IDE_EXTENSION_ARCHITECTURE.md) before making ANY changes.**

### Architectural Principle: Language Server as Single Source of Truth

The extension is a **thin client**. ALL language intelligence comes from the language server (which lives in the compiler repo, NOT here):

- **Syntax highlighting** → Language server semantic tokens (NOT hardcoded TextMate keywords)
- **Completions** → Language server (NOT plugin-loader.ts or hardcoded lists)
- **Hover documentation** → Language server
- **Diagnostics** → Language server
- **Plugin awareness** → Language server loads plugin.toml (NOT this extension)

**If the compiler is not installed, the user cannot code.** Do NOT provide fallback syntax highlighting. Instead, guide the user to install `cleen`.

### What This Extension DOES
- Starts and communicates with the language server via LSP
- Detects whether `cleen` is installed and guides setup if not
- Provides UI commands (run, compile, build)
- Provides a **minimal** TextMate grammar for basic lexical tokens only (strings, comments, numbers, operators)

### What This Extension DOES NOT DO
- Hardcode language keywords, types, framework blocks, or function names
- Load or parse `plugin.toml` files
- Provide completions or hover (that's the language server)
- Maintain keyword lists that need updating per release

### Technology Stack
```
Frontend: TypeScript + VS Code Extension API
Language Server: External binary (in compiler repo, started via LSP)
Build: npm (TypeScript)
Testing: Mocha (TypeScript)
Distribution: vsce (VS Code) + ovsx (Open VSX)
```

### Key Components
1. **Extension Host** (`src/`): Thin LSP client + UI commands
2. **Language Server**: External binary from compiler (NOT in this repo)
3. **Clean Manager Integration**: Compiler detection and setup
4. **Multi-platform Publishing**: VS Code Marketplace + Open VSX Registry

## 📁 Project Structure Understanding

### Core Files & Their Purpose
```
├── src/extension.ts           # Main extension entry point
├── package.json               # Extension manifest & dependencies
├── language-configuration.json # Language configuration for VS Code
├── syntaxes/                  # TextMate grammar for syntax highlighting
├── language-server/           # Rust LSP implementation
├── docs/                      # Comprehensive documentation
│   ├── architecture/          # System design documents
│   ├── development/           # Development guides
│   ├── deployment/            # Publishing and deployment
│   └── api/                   # API references
└── CLAUDE.md                  # This file - AI assistant context
```

### Important Conventions
- **File Extensions**: `.cln` for Clean Language files, `.test.cln` for test files
- **Indentation**: TABS ONLY for Clean Language (enforced by extension)
- **Naming**: kebab-case for files, camelCase for TypeScript, snake_case for Rust
- **Documentation**: Comprehensive docs in `docs/` folder with Markdown

## 🔧 Development Context

### Build Commands
```bash
# TypeScript Extension
npm install                    # Install dependencies
npm run compile               # Compile TypeScript
npm run watch                 # Watch mode for development
npm run lint                  # ESLint checking
npm run test                  # Run tests

# Rust Language Server
cd language-server
cargo build                   # Build LSP server
cargo test                    # Run Rust tests
cargo run                     # Run LSP server directly

# Packaging & Publishing
npm run package               # Create .vsix package
npm run publish               # Publish to VS Code Marketplace
npm run publish:ovsx          # Publish to Open VSX Registry
npm run publish:both          # Publish to both platforms
```

### Development Environment
- **Primary Editor**: VS Code with Extension Development Host
- **Language Server Testing**: F5 launches development instance
- **Debugging**: VS Code debugger for TypeScript, CodeLLDB for Rust
- **Hot Reload**: Automatic for TypeScript, manual restart for Rust changes

### Code Style & Standards
- **TypeScript**: ESLint configuration in `.eslintrc.js`
- **Rust**: Standard Rust formatting with `rustfmt`
- **Comments**: Minimal inline comments, comprehensive documentation
- **Error Handling**: Graceful degradation, user-friendly error messages

## 🎯 Clean Language Context

### Language Characteristics
Clean Language is Ivan Pasco's custom programming language with:
- **Syntax**: C-like syntax with modern features
- **Type System**: Strong static typing with inference
- **Paradigm**: Multi-paradigm (procedural, object-oriented)
- **Target**: WebAssembly compilation
- **Toolchain**: cleanmanager (compiler/runtime manager)

### Example Clean Language Code
```clean
// Variable declarations
integer age = 25
string name = "Clean Language"
number pi = 3.141592654

// Function definition
function calculateArea(number radius) -> number {
    return Math.pow(radius, 2) * pi
}

// Class definition
class Rectangle {
    number width
    number height
    
    constructor(number w, number h) {
        this.width = w
        this.height = h
    }
    
    function area() -> number {
        return this.width * this.height
    }
}
```

### File Extensions & Recognition
- **Primary**: `.cln` files
- **Testing**: `.test.cln` files
- **Auto-detection**: Extension activates on Clean Language files

## 🚀 Publishing & Distribution Context

### Current Status
- ✅ **VS Code Marketplace**: Published and available
- 🔄 **Open VSX Registry**: PR submitted for auto-sync (#950)
- ✅ **GitHub Releases**: Manual .vsix distribution

### Publishing Workflow
1. **Update version** in `package.json`
2. **Build & test** both TypeScript and Rust components
3. **Package** with `npm run package`
4. **Publish** to both marketplaces with `npm run publish:both`

### Target Audiences
- **Primary**: Clean Language developers
- **Secondary**: Language enthusiasts, compiler researchers
- **Platforms**: VS Code, Cursor, VSCodium, Gitpod, Eclipse Theia

## 🔐 Security & Compliance

### Data Handling
- **No Telemetry**: Extension collects no user data
- **Local Only**: All operations are local to user's machine
- **Sandboxed**: Clean Manager execution is controlled
- **Privacy First**: User code never leaves local environment

### Token Management (Publishing)
- **Sensitive Files**: `PUBLISHING-GUIDE.md`, `.env` files are gitignored
- **Token Storage**: Local environment variables only
- **Access Control**: Personal Access Tokens with minimal scope

## 🧪 Testing Philosophy

### Test Coverage Priorities
1. **Core Functionality**: Language server features
2. **Integration**: VS Code API interaction
3. **Error Handling**: Graceful failure scenarios
4. **Performance**: Response time and memory usage

### Test Structure
- **Unit Tests**: Individual component testing
- **Integration Tests**: Full workflow testing
- **Manual Tests**: Extension Development Host testing

## 📖 Documentation Standards

### Documentation Structure
```
docs/
├── README.md                 # Documentation hub
├── architecture/             # Technical design
├── development/              # Developer guides
├── deployment/               # Publishing info
└── api/                      # API references
```

### Writing Guidelines
- **Audience-Aware**: Separate docs for users vs developers
- **Comprehensive**: Cover all features and edge cases
- **Maintained**: Keep in sync with code changes
- **Accessible**: Clear language, good structure

## 🎨 UI/UX Context

### VS Code Integration
- **Commands**: Available in Command Palette with "Clean Language" prefix
- **Status Bar**: Shows Clean Language version and status
- **Menus**: Context menus for .cln files
- **Icons**: Custom icons for Clean Language files

### User Experience Goals
- **Intuitive**: Familiar to VS Code users
- **Fast**: Quick activation and response
- **Helpful**: Clear error messages and guidance
- **Consistent**: Uniform behavior across platforms

## 🔄 AI Assistant Guidelines

### When Working on This Project
1. **Preserve Architecture**: Maintain TypeScript + Rust split
2. **Follow Conventions**: Use established naming and structure patterns
3. **Update Documentation**: Keep docs in sync with code changes
4. **Test Thoroughly**: Ensure both TypeScript and Rust tests pass
5. **Security First**: Never commit tokens or sensitive data

### Common Tasks & Approaches
- **Adding Features**: Update both extension and language server as needed
- **Bug Fixes**: Check both TypeScript and Rust sides
- **Documentation Updates**: Update relevant docs/ files
- **Publishing**: Use established scripts and workflows

### Code Quality Standards
- **TypeScript**: Follow ESLint rules, use proper typing
- **Rust**: Use idiomatic Rust, handle errors properly
- **Integration**: Ensure LSP protocol compliance
- **Performance**: Consider memory and CPU impact

## 🔍 Troubleshooting Context

### Common Issues
1. **Extension Not Activating**: Check if .cln files are present
2. **LSP Not Working**: Verify Rust language server builds correctly
3. **Commands Not Available**: Check command registration in package.json
4. **Publishing Failures**: Verify tokens and package validity

### Debug Resources
- **Extension Host**: VS Code Developer Tools
- **Language Server**: Rust debugging with prints/debugger
- **LSP Communication**: Enable LSP tracing in settings
- **Build Issues**: Check npm/cargo error messages

## 📞 Support Context

### Primary Contacts
- **Creator**: Ivan Pasco
- **Repository**: https://github.com/Ivan-Pasco/clean-language-extension
- **Issues**: GitHub Issues for bug reports and features
- **Discussions**: GitHub Discussions for general questions

### Related Projects
- **Clean Language Compiler**: Core language implementation
- **Clean Language Manager**: Compiler and runtime manager
- **Clean Language Documentation**: Language specification

---

## 🤖 AI Assistant Reminders

When working on this project, remember to:

✅ **Maintain dual architecture** (TypeScript + Rust)
✅ **Update documentation** when making changes
✅ **Test both components** after modifications
✅ **Follow security practices** (gitignore sensitive files)
✅ **Preserve Ivan Pasco's authorship** and project vision
✅ **Keep Clean Language syntax and conventions** accurate
✅ **Consider multi-platform compatibility** (VS Code, Cursor, etc.)
✅ **Use established build and publishing workflows**

❌ **Don't commit sensitive publishing tokens**
❌ **Don't break the TypeScript ↔ Rust LSP communication**
❌ **Don't modify the core Clean Language syntax arbitrarily**
❌ **Don't ignore test failures**
❌ **Don't forget to update version numbers for releases**

---

**Last Updated**: January 2025
**Project Version**: 1.1.9
**AI Context Version**: 1.0

## Cross-Component Work Policy

**CRITICAL: AI Instance Separation of Concerns**

When working in this component and discovering errors, bugs, or required changes in **another component** (different folder in the Clean Language project), you must **NOT** directly fix or modify code in that other component.

Instead:

1. **Document the issue** by creating a prompt/task description
2. **Save the prompt** in a file that can be executed by the AI instance working in the correct folder
3. **Location for cross-component prompts**: Save prompts in `../management/cross-component-prompts/` at the project root

### Prompt Format for Cross-Component Issues

```
Component: [target component name, e.g., clean-language-compiler]
Issue Type: [bug/feature/enhancement/compatibility]
Priority: [critical/high/medium/low]
Description: [Detailed description of the issue discovered]
Context: [Why this was discovered while working in the current component]
Suggested Fix: [If known, describe the potential solution]
Files Affected: [List of files in the target component that need changes]
```

### Why This Rule Exists

- Each component has its own context, dependencies, and testing requirements
- AI instances are optimized for their specific component's codebase
- Cross-component changes without proper context can introduce bugs
- This maintains clear boundaries and accountability
- Ensures changes are properly tested in the target component's environment

### What You CAN Do

- Read files from other components to understand interfaces
- Document compatibility issues found
- Create detailed prompts for the correct AI instance
- Update your component to work with existing interfaces

### What You MUST NOT Do

- Directly edit code in other components
- Make changes to other components' configuration files
- Modify shared resources without coordination
- Skip the prompt creation step for cross-component issues

## Documentation Sync Protocol

Facts about the language live in `spec/` (at the project root). Facts about the platform live in `platform-architecture/`. Do not duplicate them here — link to them instead.

The extension is a thin LSP client. It does not define language rules, host bridge functions, or execution layers. When a change in this component exposes a gap in how the language server communicates with the IDE, report it via `report_error` — the language server lives in the compiler.

**When you make a change in this component that touches IDE integration contracts, update the corresponding spec file in the same commit:**

| Change type | Update required |
|-------------|-----------------|
| New or changed execution layer | `platform-architecture/EXECUTION_LAYERS.md` |
| New or changed IDE architecture contract | `platform-architecture/IDE_EXTENSION_ARCHITECTURE.md` |

The spec files are the single source of truth. Component documentation explains implementation — it does not redefine language rules.