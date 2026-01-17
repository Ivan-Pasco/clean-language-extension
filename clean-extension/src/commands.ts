/**
 * Clean Language Commands
 * Created by Ivan Pasco
 *
 * This module implements all Clean Language extension commands including
 * compile, run, test, debug, and version management functionality.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CompileOptionsLoader } from './services/compile-options-loader';
import { SelectedCompileOptions } from './types/compile-options';

export class CleanCommands {
    private cleanManager: any;
    private outputChannel: vscode.OutputChannel;
    private statusBar: any;
    public compileOptionsLoader: CompileOptionsLoader;

    constructor(cleanManager: any) {
        this.cleanManager = cleanManager;
        this.outputChannel = vscode.window.createOutputChannel('Clean Language');
        this.compileOptionsLoader = new CompileOptionsLoader();
    }

    /**
     * Set the status bar instance for updates
     */
    setStatusBar(statusBar: any): void {
        this.statusBar = statusBar;
    }

    /**
     * Run the current Clean Language file
     */
    async runFile(): Promise<void> {
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
    async compileFile(): Promise<void> {
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
     * DYNAMIC: Options are loaded from compiler's compile-options.json
     */
    async compileWithOptions(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'clean') {
            vscode.window.showErrorMessage('Please open a Clean Language (.cln) file');
            return;
        }

        const filePath = editor.document.fileName;
        if (editor.document.isDirty) {
            await editor.document.save();
        }

        // Show compile options selection (now dynamic!)
        const options = await this.showCompileOptionsDialog();
        if (!options) {
            return; // User cancelled
        }

        // Build command arguments
        const args = [filePath];
        const additionalArgs: string[] = [];

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
     * DYNAMIC: Options are loaded from compiler-generated JSON
     */
    private async showCompileOptionsDialog(): Promise<SelectedCompileOptions | undefined> {
        // Load compile options from compiler dynamically
        const schema = await this.compileOptionsLoader.loadCompileOptions();

        // Step 1: Select target
        const targetItems = this.compileOptionsLoader.getAvailableOptions(schema.targets)
            .map(opt => ({
                label: opt.label,
                description: opt.description,
                value: opt.id
            }));

        const selectedTarget = await vscode.window.showQuickPick(targetItems, {
            placeHolder: 'Select compilation target',
            title: 'Clean Language Compile Options - Step 1/4: Target Platform'
        });

        if (!selectedTarget) {
            return undefined;
        }

        // Step 2: Select optimization level
        const optimizationItems = this.compileOptionsLoader.getAvailableOptions(schema.optimizations)
            .map(opt => ({
                label: opt.label,
                description: opt.description,
                value: opt.id
            }));

        const selectedOptimization = await vscode.window.showQuickPick(optimizationItems, {
            placeHolder: 'Select optimization level',
            title: 'Clean Language Compile Options - Step 2/4: Optimization Level'
        });

        if (!selectedOptimization) {
            return undefined;
        }

        // Step 3: Select runtime (if applicable)
        const runtimeItems = this.compileOptionsLoader.getAvailableOptions(schema.runtimes)
            .map(opt => ({
                label: opt.label,
                description: opt.description,
                value: opt.id
            }));

        const selectedRuntime = await vscode.window.showQuickPick(runtimeItems, {
            placeHolder: 'Select WebAssembly runtime',
            title: 'Clean Language Compile Options - Step 3/4: WebAssembly Runtime'
        });

        if (!selectedRuntime) {
            return undefined;
        }

        // Step 4: Select additional options (presets)
        const presetItems = schema.presets.map(preset => ({
            label: preset.label,
            description: preset.description,
            value: preset.id,
            flags: preset.flags
        }));

        const selectedPreset = await vscode.window.showQuickPick(presetItems, {
            placeHolder: 'Select additional options',
            title: 'Clean Language Compile Options - Step 4/4: Additional Options'
        });

        if (!selectedPreset) {
            return undefined;
        }

        return {
            target: selectedTarget.value,
            runtime: selectedRuntime.value,
            optimization: selectedOptimization.value,
            debug: selectedPreset.flags.includes('debug'),
            verbose: selectedPreset.flags.includes('verbose')
        };
    }

    /**
     * Refresh compile options from compiler
     * Useful command for users after compiler updates
     */
    async refreshCompileOptions(): Promise<void> {
        const success = await this.compileOptionsLoader.refreshCompileOptions();

        if (success) {
            vscode.window.showInformationMessage('Compile options refreshed successfully');
        } else {
            vscode.window.showWarningMessage('Failed to refresh compile options. Using cached options.');
        }
    }

    /**
     * Test the current Clean Language file
     */
    async testFile(): Promise<void> {
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
     * Select and switch Clean Language version
     */
    async selectVersion(): Promise<void> {
        try {
            const versions = await this.cleanManager.listInstalledVersions();

            if (versions.length === 0) {
                vscode.window.showWarningMessage(
                    'No Clean Language versions installed.',
                    'Install Version'
                ).then(choice => {
                    if (choice === 'Install Version') {
                        vscode.commands.executeCommand('clean.setupCleen');
                    }
                });
                return;
            }

            interface VersionItem extends vscode.QuickPickItem {
                value: string;
            }

            const items: VersionItem[] = versions.map((v: { version: string; current: boolean; installed: boolean }) => ({
                label: `${v.current ? '$(check) ' : '    '}${v.version}`,
                description: v.current ? 'Current version' : '',
                value: v.version
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select Clean Language version to activate',
                title: 'Clean Language Version Manager'
            });

            if (!selected) {
                return;
            }

            // Switch to selected version
            const success = await this.cleanManager.switchToVersion(selected.value);

            if (success) {
                vscode.window.showInformationMessage(
                    `Switched to Clean Language ${selected.value}`,
                    'Reload Window'
                ).then(choice => {
                    if (choice === 'Reload Window') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });

                if (this.statusBar) {
                    this.statusBar.updateVersion(selected.value);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to select version: ${error}`);
        }
    }

    /**
     * Setup cleen with guided wizard
     */
    async setupCleen(): Promise<void> {
        const setupChoice = await vscode.window.showQuickPick(
            [
                {
                    label: '$(cloud-download) Install cleen',
                    description: 'Download and install Clean Language Manager',
                    value: 'install'
                },
                {
                    label: '$(search) Auto-detect cleen',
                    description: 'Search for existing cleen installation',
                    value: 'detect'
                },
                {
                    label: '$(gear) Configure manually',
                    description: 'Set cleen path manually in settings',
                    value: 'manual'
                },
                {
                    label: '$(book) View documentation',
                    description: 'Open Clean Language installation guide',
                    value: 'docs'
                }
            ],
            {
                placeHolder: 'How would you like to setup Clean Language Manager?',
                title: 'Setup Clean Language Manager (cleen)'
            }
        );

        if (!setupChoice) {
            return;
        }

        switch (setupChoice.value) {
            case 'install':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Ivan-Pasco/clean-manager#installation'));
                vscode.window.showInformationMessage(
                    'After installing cleen, reload the window or run "Clean: Detect cleen" command.'
                );
                break;

            case 'detect':
                await this.detectCleen();
                break;

            case 'manual':
                const path = await vscode.window.showInputBox({
                    prompt: 'Enter the full path to cleen executable',
                    placeHolder: '/usr/local/bin/cleen or C:\\Program Files\\cleen\\cleen.exe',
                    validateInput: (value) => {
                        if (!value || value.trim() === '') {
                            return 'Path cannot be empty';
                        }
                        return null;
                    }
                });

                if (path) {
                    await vscode.workspace.getConfiguration('clean').update(
                        'manager.path',
                        path,
                        vscode.ConfigurationTarget.Workspace
                    );
                    vscode.window.showInformationMessage(`cleen path configured: ${path}. Reloading window...`);
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                break;

            case 'docs':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Ivan-Pasco/clean-manager/blob/main/README.md'));
                break;
        }
    }

    /**
     * Force re-detection of cleen installation
     */
    async detectCleen(): Promise<void> {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Detecting cleen installation...',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Searching for cleen...' });

                // Invalidate cache and reinitialize
                this.cleanManager.invalidateDetectionCache();
                await this.cleanManager.initialize();

                const result = this.cleanManager.getDetectionResult();

                if (result && result.found) {
                    vscode.window.showInformationMessage(
                        `✓ Found cleen at: ${result.path} (${result.method})`,
                        'Reload Window'
                    ).then(choice => {
                        if (choice === 'Reload Window') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });

                    if (this.statusBar) {
                        await this.statusBar.updateVersionDisplay();
                    }
                } else {
                    vscode.window.showWarningMessage(
                        'Could not auto-detect cleen installation.',
                        'Setup cleen',
                        'Check Installation'
                    ).then(choice => {
                        if (choice === 'Setup cleen') {
                            this.setupCleen();
                        } else if (choice === 'Check Installation') {
                            this.checkInstallation();
                        }
                    });
                }
            }
        );
    }

    /**
     * Run installation diagnostics
     */
    async checkInstallation(): Promise<void> {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running Clean Language installation diagnostics...',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Analyzing installation...' });

                try {
                    const diagnostics = await this.cleanManager.runDiagnostics();

                    // Show diagnostics in output channel
                    this.outputChannel.clear();
                    this.outputChannel.appendLine(diagnostics);
                    this.outputChannel.show();

                    // Also offer to show in editor
                    const choice = await vscode.window.showInformationMessage(
                        'Diagnostics completed. Check the Output panel for details.',
                        'Open in Editor',
                        'Setup cleen'
                    );

                    if (choice === 'Open in Editor') {
                        const doc = await vscode.workspace.openTextDocument({
                            content: diagnostics,
                            language: 'text'
                        });
                        await vscode.window.showTextDocument(doc);
                    } else if (choice === 'Setup cleen') {
                        await this.setupCleen();
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to run diagnostics: ${error}`);
                }
            }
        );
    }

    /**
     * Execute a command in the integrated terminal
     */
    private async executeInTerminal(command: string, args: string[], title: string): Promise<void> {
        const useIntegratedTerminal = vscode.workspace.getConfiguration('clean').get('terminal.integratedConsole', true);

        if (useIntegratedTerminal) {
            const compilerPath = await this.cleanManager.getCompilerPath();
            const fullCommand = `${compilerPath} ${command} ${args.map(arg => `"${arg}"`).join(' ')}`;

            const terminal = vscode.window.createTerminal(`Clean Language: ${title}`);
            terminal.sendText(fullCommand);
            terminal.show();
        } else {
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
            } catch (error) {
                this.outputChannel.clear();
                this.outputChannel.appendLine(`=== ${title} ===`);
                this.outputChannel.appendLine(`Error: ${error}`);
                this.outputChannel.show();
            }
        }
    }
}
