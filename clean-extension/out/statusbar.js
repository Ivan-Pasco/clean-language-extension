"use strict";
/**
 * Clean Language Status Bar
 * Created by Ivan Pasco
 *
 * This module manages the status bar integration for the Clean Language extension,
 * showing current version, compilation status, server status, plugin context, and quick access buttons.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanStatusBar = void 0;
const vscode = require("vscode");
class CleanStatusBar {
    constructor(cleanManager) {
        this.actionStatusBarItems = [];
        this.cleanManager = cleanManager;
        this.versionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.serverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
        this.buildStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 94);
        this.pluginStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 93);
    }
    /**
     * Initialize the status bar items
     */
    async initialize(context) {
        // Version status bar item
        this.versionStatusBarItem.command = 'clean.selectVersion';
        this.versionStatusBarItem.tooltip = 'Click to select Clean Language version';
        await this.updateVersionDisplay();
        // Server status bar item
        this.serverStatusBarItem.text = '$(circle-outline) Server';
        this.serverStatusBarItem.tooltip = 'Click to start/stop Clean Framework server';
        this.serverStatusBarItem.command = 'clean.startServer';
        this.updateServerStatus('stopped');
        // Build status bar item
        this.buildStatusBarItem.text = '$(package) Build';
        this.buildStatusBarItem.tooltip = 'Build Clean Framework project';
        this.buildStatusBarItem.command = 'clean.build';
        // Plugin status bar item (hidden by default)
        this.pluginStatusBarItem.text = '$(extensions) 0 plugins';
        this.pluginStatusBarItem.tooltip = 'No plugins loaded';
        this.pluginStatusBarItem.command = 'clean.listPlugins';
        // Action buttons for Clean Language files
        this.createActionButtons();
        // Subscribe to editor changes to show/hide action buttons
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(this.updateActionButtonsVisibility.bind(this));
        context.subscriptions.push(this.versionStatusBarItem, this.serverStatusBarItem, this.buildStatusBarItem, this.pluginStatusBarItem, editorChangeDisposable, ...this.actionStatusBarItems);
        // Initial visibility update
        this.updateActionButtonsVisibility();
    }
    /**
     * Update the version display in the status bar
     */
    async updateVersionDisplay() {
        try {
            const detectionResult = this.cleanManager.getDetectionResult();
            // Check if cleen was detected
            if (!detectionResult || !detectionResult.found) {
                this.versionStatusBarItem.text = `$(alert) Clean Language`;
                this.versionStatusBarItem.tooltip = 'cleen not found - Click to setup';
                this.versionStatusBarItem.command = 'clean.setupCleen';
                this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.versionStatusBarItem.show();
                return;
            }
            // cleen is detected, get current version
            const currentVersion = await this.cleanManager.getCurrentVersion();
            if (currentVersion) {
                this.versionStatusBarItem.text = `$(versions) Clean ${currentVersion}`;
                this.versionStatusBarItem.tooltip = `Clean Language ${currentVersion} - Click to select version`;
                this.versionStatusBarItem.command = 'clean.selectVersion';
                this.versionStatusBarItem.backgroundColor = undefined;
                this.versionStatusBarItem.show();
            }
            else {
                // cleen found but couldn't get version
                this.versionStatusBarItem.text = `$(versions) Clean Language`;
                this.versionStatusBarItem.tooltip = 'cleen found but version unavailable - Click to check installation';
                this.versionStatusBarItem.command = 'clean.checkInstallation';
                this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.versionStatusBarItem.show();
            }
        }
        catch (error) {
            console.error('Error updating version display:', error);
            this.versionStatusBarItem.text = `$(error) Clean Language`;
            this.versionStatusBarItem.tooltip = 'Error detecting Clean Language - Click to check installation';
            this.versionStatusBarItem.command = 'clean.checkInstallation';
            this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.versionStatusBarItem.show();
        }
    }
    /**
     * Update the version display with a specific version
     */
    updateVersion(version) {
        this.versionStatusBarItem.text = `$(versions) Clean ${version}`;
        this.versionStatusBarItem.tooltip = `Clean Language ${version} - Click to select version`;
        this.versionStatusBarItem.command = 'clean.selectVersion';
        this.versionStatusBarItem.backgroundColor = undefined;
        this.versionStatusBarItem.show();
    }
    /**
     * Create action buttons for the status bar
     */
    createActionButtons() {
        // Run button
        const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
        runButton.text = '$(play) Run';
        runButton.command = 'clean.runFile';
        runButton.tooltip = 'Run Clean Language file';
        this.actionStatusBarItems.push(runButton);
        // Compile button
        const compileButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 89);
        compileButton.text = '$(gear) Compile';
        compileButton.command = 'clean.compileFile';
        compileButton.tooltip = 'Compile Clean Language file';
        this.actionStatusBarItems.push(compileButton);
        // Test button
        const testButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 88);
        testButton.text = '$(beaker) Test';
        testButton.command = 'clean.testFile';
        testButton.tooltip = 'Type check Clean Language file';
        this.actionStatusBarItems.push(testButton);
    }
    /**
     * Update the visibility of action buttons based on the active editor
     */
    updateActionButtonsVisibility() {
        const editor = vscode.window.activeTextEditor;
        const isCleanFile = editor && (editor.document.languageId === 'clean' || editor.document.languageId === 'clean-html');
        for (const button of this.actionStatusBarItems) {
            if (isCleanFile) {
                button.show();
            }
            else {
                button.hide();
            }
        }
        // Show/hide framework-specific status bar items
        if (isCleanFile) {
            this.serverStatusBarItem.show();
            this.buildStatusBarItem.show();
            // Plugin status bar is shown based on plugin count
        }
        else {
            this.serverStatusBarItem.hide();
            this.buildStatusBarItem.hide();
            this.pluginStatusBarItem.hide();
        }
    }
    /**
     * Update server status display
     */
    updateServerStatus(status, port) {
        switch (status) {
            case 'stopped':
                this.serverStatusBarItem.text = '$(circle-outline) Server';
                this.serverStatusBarItem.tooltip = 'Click to start Clean Framework server';
                this.serverStatusBarItem.command = 'clean.startServer';
                this.serverStatusBarItem.backgroundColor = undefined;
                break;
            case 'starting':
                this.serverStatusBarItem.text = '$(sync~spin) Starting...';
                this.serverStatusBarItem.tooltip = 'Server is starting...';
                this.serverStatusBarItem.command = undefined;
                this.serverStatusBarItem.backgroundColor = undefined;
                break;
            case 'running':
                this.serverStatusBarItem.text = `$(circle-filled) Server :${port || 3000}`;
                this.serverStatusBarItem.tooltip = `Server running on port ${port || 3000}. Click to stop.`;
                this.serverStatusBarItem.command = 'clean.stopServer';
                this.serverStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
                break;
            case 'stopping':
                this.serverStatusBarItem.text = '$(sync~spin) Stopping...';
                this.serverStatusBarItem.tooltip = 'Server is stopping...';
                this.serverStatusBarItem.command = undefined;
                this.serverStatusBarItem.backgroundColor = undefined;
                break;
            case 'error':
                this.serverStatusBarItem.text = '$(error) Server Error';
                this.serverStatusBarItem.tooltip = 'Server encountered an error. Click to restart.';
                this.serverStatusBarItem.command = 'clean.restartServer';
                this.serverStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
        }
    }
    /**
     * Update plugin count display
     */
    updatePluginCount(count, pluginNames) {
        if (count === 0) {
            this.pluginStatusBarItem.hide();
            return;
        }
        this.pluginStatusBarItem.text = `$(extensions) ${count} plugin${count === 1 ? '' : 's'}`;
        if (pluginNames && pluginNames.length > 0) {
            this.pluginStatusBarItem.tooltip = `Loaded plugins:\n${pluginNames.map(n => `  • ${n}`).join('\n')}\n\nClick to view plugin list`;
        }
        else {
            this.pluginStatusBarItem.tooltip = `${count} plugin${count === 1 ? '' : 's'} loaded. Click to view list.`;
        }
        // Only show if on a Clean file
        const editor = vscode.window.activeTextEditor;
        const isCleanFile = editor && (editor.document.languageId === 'clean' || editor.document.languageId === 'clean-html');
        if (isCleanFile) {
            this.pluginStatusBarItem.show();
        }
    }
    /**
     * Show a temporary status message
     */
    showTemporaryStatus(message, durationMs = 3000) {
        const originalText = this.versionStatusBarItem.text;
        const originalTooltip = this.versionStatusBarItem.tooltip;
        const originalCommand = this.versionStatusBarItem.command;
        this.versionStatusBarItem.text = message;
        this.versionStatusBarItem.tooltip = undefined;
        this.versionStatusBarItem.command = undefined;
        setTimeout(() => {
            this.versionStatusBarItem.text = originalText;
            this.versionStatusBarItem.tooltip = originalTooltip;
            this.versionStatusBarItem.command = originalCommand;
        }, durationMs);
    }
    /**
     * Show success status (green background)
     */
    showSuccess(message) {
        this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
        this.showTemporaryStatus(`$(check) ${message}`);
        setTimeout(() => {
            this.versionStatusBarItem.backgroundColor = undefined;
        }, 3000);
    }
    /**
     * Show error status (red background)
     */
    showError(message) {
        this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.showTemporaryStatus(`$(error) ${message}`);
        setTimeout(() => {
            this.versionStatusBarItem.backgroundColor = undefined;
        }, 5000);
    }
    /**
     * Show warning status (yellow background)
     */
    showWarning(message) {
        this.versionStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.showTemporaryStatus(`$(warning) ${message}`);
        setTimeout(() => {
            this.versionStatusBarItem.backgroundColor = undefined;
        }, 4000);
    }
}
exports.CleanStatusBar = CleanStatusBar;
//# sourceMappingURL=statusbar.js.map