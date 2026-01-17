/**
 * Compile Options Loader Service
 * Dynamically loads compile options from Clean Language compiler
 *
 * Author: Ivan Pasco
 */

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

    /**
     * Load compile options from the compiler's JSON file
     * Falls back to cached or default options if unavailable
     */
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

    /**
     * Find the compile-options.json path
     * Checks multiple locations in priority order
     */
    private async findCompileOptionsPath(): Promise<string | null> {
        const possiblePaths: string[] = [];

        // 1. Custom path from settings
        const customPath = vscode.workspace.getConfiguration('clean').get<string>('compiler.optionsPath');
        if (customPath) {
            possiblePaths.push(customPath);
        }

        // 2. In the active compiler version directory (managed by cleen)
        // This is the PRIMARY location where cleen installs the JSON
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const cleenVersionsDir = path.join(homeDir, '.cleen', 'versions');

        // Try to get active version from cleen config
        const cleenConfigPath = path.join(homeDir, '.cleen', 'config.json');
        if (fs.existsSync(cleenConfigPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(cleenConfigPath, 'utf-8'));
                if (config.active_version) {
                    const versionOptionsPath = path.join(cleenVersionsDir, config.active_version, 'compile-options.json');
                    possiblePaths.push(versionOptionsPath);
                }
            } catch (error) {
                console.error('Failed to read cleen config:', error);
            }
        }

        // 3. Check all installed versions (fallback if config doesn't have active version)
        if (fs.existsSync(cleenVersionsDir)) {
            try {
                const versions = fs.readdirSync(cleenVersionsDir);
                // Sort versions in descending order to get the latest first
                versions.sort().reverse();
                for (const version of versions) {
                    const versionOptionsPath = path.join(cleenVersionsDir, version, 'compile-options.json');
                    possiblePaths.push(versionOptionsPath);
                }
            } catch (error) {
                console.error('Failed to read versions directory:', error);
            }
        }

        // 4. Next to cleen binary
        const cleenPath = vscode.workspace.getConfiguration('clean').get<string>('manager.path', 'cleen');
        if (cleenPath && cleenPath !== 'cleen') {
            const cleenDir = path.dirname(cleenPath);
            possiblePaths.push(path.join(cleenDir, 'compile-options.json'));
        }

        // 5. Platform-specific config directories
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            possiblePaths.push(path.join(appData, 'CleanLanguage', 'compile-options.json'));
        } else {
            const configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            possiblePaths.push(path.join(configDir, 'clean-language', 'compile-options.json'));
        }

        // 6. ~/.clean-language/
        possiblePaths.push(path.join(homeDir, '.clean-language', 'compile-options.json'));

        // Return the first existing path
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return null;
    }

    /**
     * Refresh compile options from compiler
     * Useful after compiler updates or version switches
     */
    async refreshCompileOptions(): Promise<boolean> {
        try {
            // Clear the cache to force reload from disk
            this.cachedOptions = null;

            console.log('Refreshing compile options...');

            // Reload options using existing path search
            const options = await this.loadCompileOptions();

            if (options) {
                console.log('Compile options refreshed successfully');
                return true;
            } else {
                console.log('Failed to refresh compile options - using fallback');
                return false;
            }
        } catch (error) {
            console.error('Failed to refresh compile options:', error);
            return false;
        }
    }

    /**
     * Get available options filtered by availability
     */
    getAvailableOptions(options: CompileOption[]): CompileOption[] {
        return options.filter(opt => opt.available);
    }

    /**
     * Get default option from a list
     */
    getDefaultOption(options: CompileOption[]): CompileOption | undefined {
        return options.find(opt => opt.default);
    }

    /**
     * Default fallback options (matches current hardcoded options)
     */
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
