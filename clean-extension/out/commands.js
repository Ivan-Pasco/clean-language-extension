"use strict";
/*
 * Clean Language Commands
 * Created by Ivan Pasco
 *
 * This module implements all Clean Language extension commands including
 * compile, run, test, debug, and version management functionality.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanCommands = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class CleanCommands {
    constructor(cleanManager) {
        this.cleanManager = cleanManager;
        this.outputChannel = vscode.window.createOutputChannel('Clean Language');
    }
    /**
     * Set the status bar instance for updates
     */
    setStatusBar(statusBar) {
        this.statusBar = statusBar;
    }
    /**
     * Run the current Clean Language file
     */
    async runFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        await this.executeInTerminal('run', [filePath], `Running ${path.basename(filePath)}`);
    }
    /**
     * Compile the current Clean Language file
     */
    async compileFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        await this.executeInTerminal('compile', [filePath], `Compiling ${path.basename(filePath)}`);
    }
    /**
     * Compile the current Clean Language file with user-selected options
     */
    async compileWithOptions() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        // Show compile options selection
        const options = await this.showCompileOptionsDialog();
        if (!options) {
            return; // User cancelled
        }
        // Build command arguments
        const args = [filePath];
        const additionalArgs = [];
        if (options.target !== 'auto') {
            additionalArgs.push('--target', options.target);
        }
        if (options.runtime !== 'auto') {
            additionalArgs.push('--runtime', options.runtime);
        }
        if (options.optimization !== 'development') {
            additionalArgs.push('--optimization', options.optimization);
        }
        if (options.debug) {
            additionalArgs.push('--debug');
        }
        if (options.verbose) {
            additionalArgs.push('--verbose');
        }
        const finalArgs = [...args, ...additionalArgs];
        const optionsText = additionalArgs.length > 0 ? ` (${additionalArgs.join(' ')})` : '';
        await this.executeInTerminal('compile', finalArgs, `Compiling ${path.basename(filePath)}${optionsText}`);
    }
    /**
     * Show compile options dialog and return selected options
     */
    async showCompileOptionsDialog() {
        // Step 1: Select target
        const targetItems = [
            { label: '🌐 Web', description: 'WebAssembly for web browsers', value: 'web' },
            { label: '🟢 Node.js', description: 'WebAssembly for Node.js runtime', value: 'nodejs' },
            { label: '💻 Native', description: 'Native desktop/server applications', value: 'native' },
            { label: '🔧 Embedded', description: 'Embedded systems with resource constraints', value: 'embedded' },
            { label: '🌍 WASI', description: 'WebAssembly System Interface for portable system integration', value: 'wasi' },
            { label: '🤖 Auto', description: 'Automatically detect best target', value: 'auto' }
        ];
        const selectedTarget = await vscode.window.showQuickPick(targetItems, {
            placeHolder: 'Select compilation target',
            title: 'Clean Language Compile Options - Step 1/4: Target Platform'
        });
        if (!selectedTarget)
            return undefined;
        // Step 2: Select optimization level
        const optimizationItems = [
            { label: '🔧 Development', description: 'Fast compilation, basic optimizations', value: 'development' },
            { label: '🚀 Production', description: 'Full optimizations for release builds', value: 'production' },
            { label: '📦 Size', description: 'Optimize for smaller binary size', value: 'size' },
            { label: '⚡ Speed', description: 'Optimize for runtime performance', value: 'speed' },
            { label: '🐛 Debug', description: 'No optimizations, maximum debug info', value: 'debug' }
        ];
        const selectedOptimization = await vscode.window.showQuickPick(optimizationItems, {
            placeHolder: 'Select optimization level',
            title: 'Clean Language Compile Options - Step 2/4: Optimization Level'
        });
        if (!selectedOptimization)
            return undefined;
        // Step 3: Select runtime (if applicable)
        const runtimeItems = [
            { label: '🤖 Auto', description: 'Automatically detect best runtime', value: 'auto' },
            { label: '⚡ Wasmtime', description: 'Fast and secure WebAssembly runtime', value: 'wasmtime' },
            { label: '🦀 Wasmer', description: 'Universal WebAssembly runtime', value: 'wasmer' }
        ];
        const selectedRuntime = await vscode.window.showQuickPick(runtimeItems, {
            placeHolder: 'Select WebAssembly runtime',
            title: 'Clean Language Compile Options - Step 3/4: WebAssembly Runtime'
        });
        if (!selectedRuntime)
            return undefined;
        // Step 4: Select additional options
        const additionalOptions = await vscode.window.showQuickPick([
            { label: '📋 Standard compilation', description: 'No additional options', value: 'none' },
            { label: '🐛 Include debug information', description: 'Add debug symbols for debugging', value: 'debug' },
            { label: '💬 Verbose output', description: 'Show detailed compilation information', value: 'verbose' },
            { label: '🐛💬 Debug + Verbose', description: 'Include debug info and show verbose output', value: 'both' }
        ], {
            placeHolder: 'Select additional options',
            title: 'Clean Language Compile Options - Step 4/4: Additional Options'
        });
        if (!additionalOptions)
            return undefined;
        return {
            target: selectedTarget.value,
            runtime: selectedRuntime.value,
            optimization: selectedOptimization.value,
            debug: additionalOptions.value === 'debug' || additionalOptions.value === 'both',
            verbose: additionalOptions.value === 'verbose' || additionalOptions.value === 'both'
        };
    }
    /**
     * Test the current Clean Language file
     */
    async testFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        await this.executeInTerminal('check', [filePath], `Type checking ${path.basename(filePath)}`);
    }
    /**
     * Debug the current Clean Language file
     */
    async debugFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        // Check if debug command is supported
        try {
            await this.executeInTerminal('debug', [filePath], `Debugging ${path.basename(filePath)}`);
        }
        catch (error) {
            vscode.window.showWarningMessage('Debug mode may not be supported in this version of Clean Language');
            // Fallback to run with verbose output
            await this.executeInTerminal('run', [filePath, '--verbose'], `Running ${path.basename(filePath)} (debug mode)`);
        }
    }
    /**
     * Validate the current Clean Language file
     */
    async validateFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }
        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }
        try {
            const result = await this.cleanManager.executeCompilerCommand('validate', [filePath]);
            this.outputChannel.clear();
            this.outputChannel.appendLine(`=== Validating ${path.basename(filePath)} ===`);
            if (result.stdout) {
                this.outputChannel.appendLine(result.stdout);
            }
            if (result.stderr) {
                this.outputChannel.appendLine('Errors:');
                this.outputChannel.appendLine(result.stderr);
                vscode.window.showErrorMessage('Validation failed. Check output for details.');
            }
            else {
                vscode.window.showInformationMessage('File validation completed successfully');
            }
            this.outputChannel.show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Validation failed: ${error}`);
        }
    }
    /**
     * Select and switch to a Clean Language version
     */
    async selectVersion() {
        try {
            const versions = await this.cleanManager.listInstalledVersions();
            if (versions.length === 0) {
                vscode.window.showInformationMessage('No Clean Language versions installed. Use "Install Version" to install one.');
                return;
            }
            // Sort versions: current first, then latest to oldest
            const sortedVersions = versions.sort((a, b) => {
                if (a.current)
                    return -1;
                if (b.current)
                    return 1;
                // Handle 'latest' special case
                if (a.version === 'latest')
                    return -1;
                if (b.version === 'latest')
                    return 1;
                // Sort semantic versions in descending order (newest first)
                return this.compareVersions(b.version, a.version);
            });
            const items = sortedVersions.map(version => ({
                label: version.version,
                description: version.current ? '(current)' : '',
                detail: version.current ? 'Currently active version' : 'Switch to this version',
                version: version.version
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Clean Language version to activate'
            });
            if (selected && !versions.find(v => v.version === selected.version)?.current) {
                const success = await this.cleanManager.switchToVersion(selected.version);
                if (success) {
                    vscode.window.showInformationMessage(`Switched to Clean Language version ${selected.version}`);
                    // Update status bar to reflect the new version
                    if (this.statusBar) {
                        await this.statusBar.updateVersionDisplay();
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list versions: ${error}`);
        }
    }
    /**
     * Install a new Clean Language version
     */
    async installVersion() {
        try {
            const availableVersions = await this.cleanManager.listAvailableVersions();
            const uninstalledVersions = availableVersions.filter(v => !v.installed);
            if (uninstalledVersions.length === 0) {
                vscode.window.showInformationMessage('All available versions are already installed.');
                return;
            }
            const items = uninstalledVersions.map(version => ({
                label: version.version,
                description: 'Available for installation',
                version: version.version
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Clean Language version to install'
            });
            if (selected) {
                const success = await this.cleanManager.installVersion(selected.version);
                if (success) {
                    vscode.window.showInformationMessage(`Successfully installed Clean Language version ${selected.version}`);
                    // Ask if user wants to switch to the newly installed version
                    const switchAction = await vscode.window.showInformationMessage(`Would you like to switch to version ${selected.version}?`, 'Yes', 'No');
                    if (switchAction === 'Yes') {
                        await this.cleanManager.switchToVersion(selected.version);
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to install version: ${error}`);
        }
    }
    /**
     * List all available Clean Language versions
     */
    async listAvailable() {
        try {
            const versions = await this.cleanManager.listAvailableVersions();
            if (versions.length === 0) {
                vscode.window.showInformationMessage('No Clean Language versions available.');
                return;
            }
            this.outputChannel.clear();
            this.outputChannel.appendLine('=== Available Clean Language Versions ===');
            this.outputChannel.appendLine('');
            versions.forEach(version => {
                let status = '';
                if (version.current) {
                    status = ' (current)';
                }
                else if (version.installed) {
                    status = ' (installed)';
                }
                this.outputChannel.appendLine(`${version.version}${status}`);
            });
            this.outputChannel.show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list available versions: ${error}`);
        }
    }
    /**
     * Run cleen doctor to check the environment
     */
    async doctorCheck() {
        try {
            this.outputChannel.clear();
            this.outputChannel.appendLine('=== Clean Language Environment Check ===');
            this.outputChannel.show();
            const doctorOutput = await this.cleanManager.runDoctor();
            this.outputChannel.appendLine(doctorOutput);
            vscode.window.showInformationMessage('Environment check completed. See output for details.');
        }
        catch (error) {
            this.outputChannel.appendLine(`Doctor check failed: ${error}`);
            vscode.window.showErrorMessage('Environment check failed. See output for details.');
        }
    }
    /**
     * Initialize the Clean Language environment
     */
    async initEnvironment() {
        try {
            const success = await this.cleanManager.initializeEnvironment();
            if (success) {
                vscode.window.showInformationMessage('Clean Language environment initialized successfully');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize environment: ${error}`);
        }
    }
    /**
     * Compare two semantic version strings
     */
    compareVersions(a, b) {
        // Remove 'v' prefix and split by dots
        const normalizeVersion = (version) => {
            return version.replace(/^v/, '').split(/[.-]/).map(part => {
                const num = parseInt(part, 10);
                return isNaN(num) ? part : num;
            });
        };
        const aParts = normalizeVersion(a);
        const bParts = normalizeVersion(b);
        const maxLength = Math.max(aParts.length, bParts.length);
        for (let i = 0; i < maxLength; i++) {
            const aPart = aParts[i] ?? 0;
            const bPart = bParts[i] ?? 0;
            if (typeof aPart === 'number' && typeof bPart === 'number') {
                if (aPart !== bPart) {
                    return aPart - bPart;
                }
            }
            else {
                const aStr = String(aPart);
                const bStr = String(bPart);
                if (aStr !== bStr) {
                    return aStr.localeCompare(bStr);
                }
            }
        }
        return 0;
    }
    /**
     * Execute a command in the integrated terminal
     */
    async executeInTerminal(command, args, title) {
        const useIntegratedTerminal = vscode.workspace.getConfiguration('clean').get('terminal.integratedConsole', true);
        if (useIntegratedTerminal) {
            const compilerPath = await this.cleanManager.getCompilerPath();
            const fullCommand = `${compilerPath} ${command} ${args.map(arg => `"${arg}"`).join(' ')}`;
            const terminal = vscode.window.createTerminal(`Clean Language: ${title}`);
            terminal.sendText(fullCommand);
            terminal.show();
        }
        else {
            // Use output channel for non-interactive commands
            try {
                const result = await this.cleanManager.executeCompilerCommand(command, args);
                this.outputChannel.clear();
                this.outputChannel.appendLine(`=== ${title} ===`);
                if (result.stdout) {
                    this.outputChannel.appendLine(result.stdout);
                }
                if (result.stderr) {
                    this.outputChannel.appendLine('Errors:');
                    this.outputChannel.appendLine(result.stderr);
                }
                this.outputChannel.show();
            }
            catch (error) {
                this.outputChannel.clear();
                this.outputChannel.appendLine(`=== ${title} ===`);
                this.outputChannel.appendLine(`Error: ${error}`);
                this.outputChannel.show();
            }
        }
    }
}
exports.CleanCommands = CleanCommands;
//# sourceMappingURL=commands.js.map