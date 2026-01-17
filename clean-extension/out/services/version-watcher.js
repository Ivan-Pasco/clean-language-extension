"use strict";
/**
 * Clean Language Version Watcher
 * Created by Ivan Pasco
 *
 * This service monitors the cleen configuration file for version changes
 * and automatically triggers updates when the user switches Clean Language versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionWatcher = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
class VersionWatcher {
    constructor() {
        this.callbacks = [];
        this.DEBOUNCE_MS = 500;
    }
    /**
     * Start watching for version changes
     */
    start(context) {
        const homeDir = os.homedir();
        const configPath = path.join(homeDir, '.cleen', 'config.json');
        const wrapperPath = path.join(homeDir, '.cleen', 'bin', 'cln');
        // Read initial version
        this.currentVersion = this.readActiveVersion(configPath);
        // Watch config.json for changes
        this.configWatcher = vscode.workspace.createFileSystemWatcher(configPath, false, // ignoreCreateEvents
        false, // ignoreChangeEvents
        true // ignoreDeleteEvents
        );
        this.configWatcher.onDidCreate(() => this.handleConfigChange(configPath));
        this.configWatcher.onDidChange(() => this.handleConfigChange(configPath));
        // Watch wrapper script for changes (indicates version switch)
        if (fs.existsSync(wrapperPath)) {
            this.wrapperWatcher = vscode.workspace.createFileSystemWatcher(wrapperPath, false, // ignoreCreateEvents
            false, // ignoreChangeEvents
            true // ignoreDeleteEvents
            );
            this.wrapperWatcher.onDidCreate(() => this.handleWrapperChange(configPath));
            this.wrapperWatcher.onDidChange(() => this.handleWrapperChange(configPath));
        }
        // Register for disposal
        context.subscriptions.push(this);
        console.log('Clean Language version watcher started');
    }
    /**
     * Stop watching
     */
    dispose() {
        if (this.configWatcher) {
            this.configWatcher.dispose();
        }
        if (this.wrapperWatcher) {
            this.wrapperWatcher.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
    /**
     * Register a callback to be notified of version changes
     */
    onVersionChange(callback) {
        this.callbacks.push(callback);
    }
    /**
     * Handle config file changes
     */
    handleConfigChange(configPath) {
        // Debounce: wait for file writes to settle
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.checkVersionChange(configPath);
        }, this.DEBOUNCE_MS);
    }
    /**
     * Handle wrapper script changes
     */
    handleWrapperChange(configPath) {
        // Wrapper change indicates version switch, check immediately (but still debounce)
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.checkVersionChange(configPath);
        }, this.DEBOUNCE_MS);
    }
    /**
     * Check if version has actually changed and notify callbacks
     */
    checkVersionChange(configPath) {
        const newVersion = this.readActiveVersion(configPath);
        if (!newVersion) {
            return; // Couldn't read version
        }
        if (newVersion !== this.currentVersion) {
            const oldVersion = this.currentVersion;
            this.currentVersion = newVersion;
            console.log(`Clean Language version changed: ${oldVersion || 'unknown'} → ${newVersion}`);
            // Notify all callbacks
            this.notifyCallbacks(newVersion, oldVersion);
            // Show user notification
            this.showVersionChangeNotification(newVersion, oldVersion);
        }
    }
    /**
     * Read active version from config file
     */
    readActiveVersion(configPath) {
        try {
            if (!fs.existsSync(configPath)) {
                return undefined;
            }
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            return config.active_version;
        }
        catch (error) {
            console.error('Failed to read cleen config:', error);
            return undefined;
        }
    }
    /**
     * Notify all registered callbacks
     */
    async notifyCallbacks(newVersion, oldVersion) {
        for (const callback of this.callbacks) {
            try {
                await callback(newVersion, oldVersion);
            }
            catch (error) {
                console.error('Error in version change callback:', error);
            }
        }
    }
    /**
     * Show notification to user about version change
     */
    showVersionChangeNotification(newVersion, oldVersion) {
        const message = oldVersion
            ? `Clean Language version changed: ${oldVersion} → ${newVersion}`
            : `Clean Language version set to: ${newVersion}`;
        vscode.window.showInformationMessage(message, 'Reload Window', 'Dismiss').then(choice => {
            if (choice === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
    }
    /**
     * Get the current tracked version
     */
    getCurrentVersion() {
        return this.currentVersion;
    }
    /**
     * Force check for version changes (useful after manual operations)
     */
    forceCheck() {
        const homeDir = os.homedir();
        const configPath = path.join(homeDir, '.cleen', 'config.json');
        this.checkVersionChange(configPath);
    }
}
exports.VersionWatcher = VersionWatcher;
//# sourceMappingURL=version-watcher.js.map