# Dynamic Compile Options - Complete Implementation Guide

**Author:** Ivan Pasco
**Date:** January 2025
**Applies to:** Clean Language Compiler, Clean Manager (cleen), Clean Language Extension

---

## Overview

This guide walks you through implementing dynamic compile options across all three Clean Language projects. Follow each section in order.

---

## 🔧 PART 1: Compiler Implementation

### Step 1.1: Create the Options Export Module

**File:** `/Users/earcandy/Documents/Dev/Clean Language/clean-language-compiler/src/cli/mod.rs`

First, create the `cli` directory if it doesn't exist:

```bash
cd /Users/earcandy/Documents/Dev/Clean\ Language/clean-language-compiler
mkdir -p src/cli
```

**Create:** `src/cli/mod.rs`

```rust
pub mod options_export;
```

### Step 1.2: Create Options Export Implementation

**Create:** `src/cli/options_export.rs`

```rust
use serde::{Deserialize, Serialize};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompileOption {
    pub id: String,
    pub label: String,
    pub description: String,
    pub flag: Option<String>,
    pub default: bool,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mutually_exclusive: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompilePreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub flags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CompileOptionsSchema {
    pub version: String,
    pub compiler_version: String,
    pub generated_at: String,
    pub targets: Vec<CompileOption>,
    pub optimizations: Vec<CompileOption>,
    pub runtimes: Vec<CompileOption>,
    pub flags: Vec<CompileOption>,
    pub presets: Vec<CompilePreset>,
}

impl CompileOptionsSchema {
    /// Create the compile options schema based on current compiler capabilities
    pub fn generate() -> Self {
        Self {
            version: "1.0.0".to_string(),
            compiler_version: env!("CARGO_PKG_VERSION").to_string(),
            generated_at: Utc::now().to_rfc3339(),
            targets: Self::get_available_targets(),
            optimizations: Self::get_available_optimizations(),
            runtimes: Self::get_available_runtimes(),
            flags: Self::get_available_flags(),
            presets: Self::get_available_presets(),
        }
    }

    fn get_available_targets() -> Vec<CompileOption> {
        vec![
            CompileOption {
                id: "web".to_string(),
                label: "🌐 Web".to_string(),
                description: "WebAssembly for web browsers".to_string(),
                flag: Some("--target".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "nodejs".to_string(),
                label: "🟢 Node.js".to_string(),
                description: "WebAssembly for Node.js runtime".to_string(),
                flag: Some("--target".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "native".to_string(),
                label: "💻 Native".to_string(),
                description: "Native desktop/server applications".to_string(),
                flag: Some("--target".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "embedded".to_string(),
                label: "🔧 Embedded".to_string(),
                description: "Embedded systems with resource constraints".to_string(),
                flag: Some("--target".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "wasi".to_string(),
                label: "🌍 WASI".to_string(),
                description: "WebAssembly System Interface for portable system integration".to_string(),
                flag: Some("--target".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "auto".to_string(),
                label: "🤖 Auto".to_string(),
                description: "Automatically detect best target".to_string(),
                flag: None,
                default: true,
                available: true,
                mutually_exclusive: None,
            },
        ]
    }

    fn get_available_optimizations() -> Vec<CompileOption> {
        vec![
            CompileOption {
                id: "development".to_string(),
                label: "🔧 Development".to_string(),
                description: "Fast compilation, basic optimizations".to_string(),
                flag: Some("--optimization".to_string()),
                default: true,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "production".to_string(),
                label: "🚀 Production".to_string(),
                description: "Full optimizations for release builds".to_string(),
                flag: Some("--optimization".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "size".to_string(),
                label: "📦 Size".to_string(),
                description: "Optimize for smaller binary size".to_string(),
                flag: Some("--optimization".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "speed".to_string(),
                label: "⚡ Speed".to_string(),
                description: "Optimize for runtime performance".to_string(),
                flag: Some("--optimization".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "debug".to_string(),
                label: "🐛 Debug".to_string(),
                description: "No optimizations, maximum debug info".to_string(),
                flag: Some("--optimization".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
        ]
    }

    fn get_available_runtimes() -> Vec<CompileOption> {
        vec![
            CompileOption {
                id: "auto".to_string(),
                label: "🤖 Auto".to_string(),
                description: "Automatically detect best runtime".to_string(),
                flag: None,
                default: true,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "wasmtime".to_string(),
                label: "⚡ Wasmtime".to_string(),
                description: "Fast and secure WebAssembly runtime".to_string(),
                flag: Some("--runtime".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
            CompileOption {
                id: "wasmer".to_string(),
                label: "🦀 Wasmer".to_string(),
                description: "Universal WebAssembly runtime".to_string(),
                flag: Some("--runtime".to_string()),
                default: false,
                available: true,
                mutually_exclusive: None,
            },
        ]
    }

    fn get_available_flags() -> Vec<CompileOption> {
        vec![
            CompileOption {
                id: "debug".to_string(),
                label: "🐛 Include debug information".to_string(),
                description: "Add debug symbols for debugging".to_string(),
                flag: Some("--debug".to_string()),
                default: false,
                available: true,
                mutually_exclusive: Some(vec![]),
            },
            CompileOption {
                id: "verbose".to_string(),
                label: "💬 Verbose output".to_string(),
                description: "Show detailed compilation information".to_string(),
                flag: Some("--verbose".to_string()),
                default: false,
                available: true,
                mutually_exclusive: Some(vec![]),
            },
        ]
    }

    fn get_available_presets() -> Vec<CompilePreset> {
        vec![
            CompilePreset {
                id: "standard".to_string(),
                label: "📋 Standard compilation".to_string(),
                description: "No additional options".to_string(),
                flags: vec![],
            },
            CompilePreset {
                id: "debug_only".to_string(),
                label: "🐛 Include debug information".to_string(),
                description: "Add debug symbols for debugging".to_string(),
                flags: vec!["debug".to_string()],
            },
            CompilePreset {
                id: "verbose_only".to_string(),
                label: "💬 Verbose output".to_string(),
                description: "Show detailed compilation information".to_string(),
                flags: vec!["verbose".to_string()],
            },
            CompilePreset {
                id: "debug_verbose".to_string(),
                label: "🐛💬 Debug + Verbose".to_string(),
                description: "Include debug info and show verbose output".to_string(),
                flags: vec!["debug".to_string(), "verbose".to_string()],
            },
        ]
    }

    /// Export the schema to a JSON file
    pub fn export_to_file(&self, path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json)?;
        Ok(())
    }

    /// Get the default installation path for the options file
    pub fn get_default_install_path() -> PathBuf {
        // Place in build directory for packaging
        PathBuf::from("./compile-options.json")
    }
}

/// Export compile options as JSON
pub fn export_compile_options(output_path: Option<PathBuf>) -> Result<(), Box<dyn std::error::Error>> {
    let schema = CompileOptionsSchema::generate();
    let path = output_path.unwrap_or_else(CompileOptionsSchema::get_default_install_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    schema.export_to_file(&path)?;
    println!("✓ Compile options exported to: {}", path.display());
    Ok(())
}
```

### Step 1.3: Update main.rs to Add CLI Command

**Edit:** `src/main.rs`

Add the module import at the top:

```rust
mod cli;
use cli::options_export;
```

Add new command to the `Commands` enum (after the existing commands):

```rust
#[derive(Subcommand, Debug)]
enum Commands {
    // ... existing commands ...

    /// Export compile options to JSON for IDE integration
    Options {
        /// Export compile options as JSON
        #[arg(long)]
        export_json: bool,

        /// Output path for the JSON file (optional)
        #[arg(short, long)]
        output: Option<String>,
    },
}
```

Add the handler in the `main()` function (in the match statement):

```rust
Commands::Options { export_json, output } => {
    if export_json {
        let output_path = output.map(PathBuf::from);
        options_export::export_compile_options(output_path)?;
    } else {
        eprintln!("Use --export-json to export compile options");
        std::process::exit(1);
    }
}
```

### Step 1.4: Update Cargo.toml (if needed)

The dependencies are already present in your Cargo.toml:
- ✅ `serde` with derive features
- ✅ `serde_json`
- ✅ `chrono`
- ✅ `dirs`

No changes needed!

### Step 1.5: Test the Implementation

```bash
cd /Users/earcandy/Documents/Dev/Clean\ Language/clean-language-compiler

# Build the compiler
cargo build --release

# Test the new command
cargo run --release -- options --export-json

# Verify the file was created
cat compile-options.json
```

---

## 📦 PART 2: GitHub Actions Workflow

### Step 2.1: Update GitHub Actions to Include compile-options.json

**Edit:** `.github/workflows/release.yml` (or your build workflow)

Add a step to generate the JSON file during build:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact_name: clean-language-compiler
            asset_name: clean-compiler-linux-amd64
          - os: macos-latest
            target: x86_64-apple-darwin
            artifact_name: clean-language-compiler
            asset_name: clean-compiler-macos-amd64
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact_name: clean-language-compiler
            asset_name: clean-compiler-macos-arm64
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact_name: clean-language-compiler.exe
            asset_name: clean-compiler-windows-amd64.exe

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: ${{ matrix.target }}
          override: true

      - name: Build
        run: cargo build --release --target ${{ matrix.target }}

      - name: Generate compile-options.json
        run: cargo run --release --target ${{ matrix.target }} -- options --export-json

      - name: Create release package
        run: |
          mkdir -p release
          cp target/${{ matrix.target }}/release/${{ matrix.artifact_name }} release/
          cp compile-options.json release/
          cd release
          tar -czf ../${{ matrix.asset_name }}.tar.gz *

      - name: Upload Release Asset
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./${{ matrix.asset_name }}.tar.gz
          asset_name: ${{ matrix.asset_name }}.tar.gz
          asset_content_type: application/gzip
```

---

## 🛠️ PART 3: Clean Manager (cleen) Implementation

Now we need to update `cleen` to extract and install the `compile-options.json` file.

### Step 3.1: Locate cleen Manager

```bash
# Find where cleen manager source code is
ls -la /Users/earcandy/Documents/Dev/Clean\ Language/clean-manager/
```

### Step 3.2: Update cleen Installation Logic

**Find the file that handles downloading and extracting releases** (likely in `src/install.rs` or similar)

**Add logic to extract compile-options.json:**

```rust
// In the installation function after extracting the tarball:

pub fn install_version(version: &str) -> Result<()> {
    // ... existing download and extract logic ...

    // Extract the tarball
    extract_tarball(&tarball_path, &install_dir)?;

    // Copy compile-options.json to config directory
    let options_src = install_dir.join("compile-options.json");
    let options_dest = get_config_dir()?.join("compile-options.json");

    if options_src.exists() {
        fs::copy(&options_src, &options_dest)?;
        println!("✓ Installed compile-options.json to {}", options_dest.display());
    } else {
        eprintln!("⚠ Warning: compile-options.json not found in release package");
    }

    Ok(())
}

// Helper function to get config directory
fn get_config_dir() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
        .join("CleanLanguage");

    #[cfg(not(target_os = "windows"))]
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?
        .join("clean-language");

    fs::create_dir_all(&config_dir)?;
    Ok(config_dir)
}
```

---

## 🎨 PART 4: Extension Implementation

### Step 4.1: Create Type Definitions

**Create:** `src/types/compile-options.ts`

```typescript
/**
 * Compile Options Schema Types
 * Generated from Clean Language compiler options
 */

export interface CompileOption {
    id: string;
    label: string;
    description: string;
    flag: string | null;
    default: boolean;
    available: boolean;
    mutually_exclusive?: string[];
}

export interface CompilePreset {
    id: string;
    label: string;
    description: string;
    flags: string[];
}

export interface CompileOptionsSchema {
    version: string;
    compiler_version: string;
    generated_at: string;
    targets: CompileOption[];
    optimizations: CompileOption[];
    runtimes: CompileOption[];
    flags: CompileOption[];
    presets: CompilePreset[];
}

export interface SelectedCompileOptions {
    target: string;
    runtime: string;
    optimization: string;
    debug: boolean;
    verbose: boolean;
}
```

### Step 4.2: Create Options Loader Service

**Create:** `src/services/compile-options-loader.ts`

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CompileOptionsSchema, CompileOption } from '../types/compile-options';

export class CompileOptionsLoader {
    private cachedOptions: CompileOptionsSchema | null = null;
    private readonly fallbackOptions: CompileOptionsSchema;

    constructor() {
        this.fallbackOptions = this.getDefaultFallbackOptions();
    }

    async loadCompileOptions(): Promise<CompileOptionsSchema> {
        try {
            const optionsPath = await this.findCompileOptionsPath();

            if (optionsPath && fs.existsSync(optionsPath)) {
                const content = fs.readFileSync(optionsPath, 'utf-8');
                this.cachedOptions = JSON.parse(content) as CompileOptionsSchema;

                console.log(`Loaded compile options from: ${optionsPath}`);
                console.log(`Compiler version: ${this.cachedOptions.compiler_version}`);

                return this.cachedOptions;
            }
        } catch (error) {
            console.error('Failed to load compile options from file:', error);
        }

        if (this.cachedOptions) {
            console.log('Using cached compile options');
            return this.cachedOptions;
        }

        console.log('Using fallback default compile options');
        return this.fallbackOptions;
    }

    private async findCompileOptionsPath(): Promise<string | null> {
        const possiblePaths: string[] = [];

        // 1. Custom path from settings
        const customPath = vscode.workspace.getConfiguration('clean').get<string>('compiler.optionsPath');
        if (customPath) {
            possiblePaths.push(customPath);
        }

        // 2. Next to cleen binary
        const cleenPath = vscode.workspace.getConfiguration('clean').get<string>('manager.path', 'cleen');
        if (cleenPath && cleenPath !== 'cleen') {
            const cleenDir = path.dirname(cleenPath);
            possiblePaths.push(path.join(cleenDir, 'compile-options.json'));
        }

        // 3. Platform-specific config directories
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            possiblePaths.push(path.join(appData, 'CleanLanguage', 'compile-options.json'));
        } else {
            const configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            possiblePaths.push(path.join(configDir, 'clean-language', 'compile-options.json'));
        }

        // 4. ~/.clean-language/
        possiblePaths.push(path.join(homeDir, '.clean-language', 'compile-options.json'));

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return null;
    }

    async refreshCompileOptions(): Promise<boolean> {
        this.cachedOptions = null;

        try {
            const cleenPath = vscode.workspace.getConfiguration('clean').get<string>('manager.path', 'cleen');
            const { exec } = require('child_process');

            await new Promise<void>((resolve, reject) => {
                exec(`${cleenPath} options --export-json`, (error: any, stdout: any) => {
                    if (error) {
                        console.error('Failed to regenerate compile options:', error);
                        reject(error);
                    } else {
                        console.log('Compile options regenerated:', stdout);
                        resolve();
                    }
                });
            });

            await this.loadCompileOptions();
            return true;
        } catch (error) {
            console.error('Failed to refresh compile options:', error);
            return false;
        }
    }

    getAvailableOptions(options: CompileOption[]): CompileOption[] {
        return options.filter(opt => opt.available);
    }

    getDefaultOption(options: CompileOption[]): CompileOption | undefined {
        return options.find(opt => opt.default);
    }

    private getDefaultFallbackOptions(): CompileOptionsSchema {
        return {
            version: "1.0.0",
            compiler_version: "unknown",
            generated_at: new Date().toISOString(),
            targets: [
                { id: "web", label: "🌐 Web", description: "WebAssembly for web browsers", flag: "--target", default: false, available: true },
                { id: "nodejs", label: "🟢 Node.js", description: "WebAssembly for Node.js runtime", flag: "--target", default: false, available: true },
                { id: "native", label: "💻 Native", description: "Native desktop/server applications", flag: "--target", default: false, available: true },
                { id: "embedded", label: "🔧 Embedded", description: "Embedded systems with resource constraints", flag: "--target", default: false, available: true },
                { id: "wasi", label: "🌍 WASI", description: "WebAssembly System Interface", flag: "--target", default: false, available: true },
                { id: "auto", label: "🤖 Auto", description: "Automatically detect best target", flag: null, default: true, available: true }
            ],
            optimizations: [
                { id: "development", label: "🔧 Development", description: "Fast compilation", flag: "--optimization", default: true, available: true },
                { id: "production", label: "🚀 Production", description: "Full optimizations", flag: "--optimization", default: false, available: true },
                { id: "size", label: "📦 Size", description: "Optimize for size", flag: "--optimization", default: false, available: true },
                { id: "speed", label: "⚡ Speed", description: "Optimize for speed", flag: "--optimization", default: false, available: true },
                { id: "debug", label: "🐛 Debug", description: "No optimizations", flag: "--optimization", default: false, available: true }
            ],
            runtimes: [
                { id: "auto", label: "🤖 Auto", description: "Auto-detect runtime", flag: null, default: true, available: true },
                { id: "wasmtime", label: "⚡ Wasmtime", description: "Wasmtime runtime", flag: "--runtime", default: false, available: true },
                { id: "wasmer", label: "🦀 Wasmer", description: "Wasmer runtime", flag: "--runtime", default: false, available: true }
            ],
            flags: [
                { id: "debug", label: "🐛 Include debug information", description: "Add debug symbols", flag: "--debug", default: false, available: true },
                { id: "verbose", label: "💬 Verbose output", description: "Detailed output", flag: "--verbose", default: false, available: true }
            ],
            presets: [
                { id: "standard", label: "📋 Standard compilation", description: "No additional options", flags: [] },
                { id: "debug_only", label: "🐛 Include debug information", description: "Debug symbols", flags: ["debug"] },
                { id: "verbose_only", label: "💬 Verbose output", description: "Verbose", flags: ["verbose"] },
                { id: "debug_verbose", label: "🐛💬 Debug + Verbose", description: "Both", flags: ["debug", "verbose"] }
            ]
        };
    }
}
```

### Step 4.3: Update Commands

**Edit:** `out/commands.js` source (you'll need the TypeScript source - let me find it)

Actually, let's look for the source TypeScript files:

```bash
# Check if there's a src directory with TypeScript
ls -la /Users/earcandy/Documents/Dev/Clean\ Language/clean-extension/
```

---

## 📝 Testing Checklist

### Compiler Testing
- [ ] `cargo build --release` succeeds
- [ ] `cargo run -- options --export-json` creates `compile-options.json`
- [ ] JSON file is valid and contains all expected sections
- [ ] Compiler version matches Cargo.toml version

### Manager Testing
- [ ] `cleen install latest` downloads and extracts tarball
- [ ] `compile-options.json` is copied to config directory
- [ ] Config directory is created if it doesn't exist
- [ ] Works on all platforms (Windows, macOS, Linux)

### Extension Testing
- [ ] Extension loads compile options on activation
- [ ] "Compile with Options" shows dynamic options
- [ ] Options match the compiler-generated JSON
- [ ] Fallback works when JSON is missing
- [ ] Refresh command regenerates options

---

## 🚀 Deployment Order

1. **Compiler:** Merge and tag new version (e.g., v0.8.5)
2. **GitHub Actions:** Automatic build creates packages with JSON
3. **Manager:** Update to handle JSON extraction
4. **Extension:** Update to load dynamic options
5. **Test:** Install compiler via manager, verify extension picks up options

---

Would you like me to continue with finding the TypeScript source files for the extension, or help you implement a specific part first?
