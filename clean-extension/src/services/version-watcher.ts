/**
 * Clean Language Version Watcher
 * Created by Ivan Pasco
 *
 * This service monitors the cleen configuration file for version changes
 * and automatically triggers updates when the user switches Clean Language versions.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type VersionChangeCallback = (newVersion: string, oldVersion?: string) => void | Promise<void>;

export class VersionWatcher {
	private configWatcher?: vscode.FileSystemWatcher;
	private wrapperWatcher?: vscode.FileSystemWatcher;
	private currentVersion?: string;
	private callbacks: VersionChangeCallback[] = [];
	private debounceTimer?: NodeJS.Timeout;
	private readonly DEBOUNCE_MS = 500;

	/**
	 * Start watching for version changes
	 */
	start(context: vscode.ExtensionContext): void {
		const homeDir = os.homedir();
		const configPath = path.join(homeDir, '.cleen', 'config.json');
		const wrapperPath = path.join(homeDir, '.cleen', 'bin', 'cln');

		// Read initial version
		this.currentVersion = this.readActiveVersion(configPath);

		// Watch config.json for changes
		this.configWatcher = vscode.workspace.createFileSystemWatcher(
			configPath,
			false, // ignoreCreateEvents
			false, // ignoreChangeEvents
			true   // ignoreDeleteEvents
		);

		this.configWatcher.onDidCreate(() => this.handleConfigChange(configPath));
		this.configWatcher.onDidChange(() => this.handleConfigChange(configPath));

		// Watch wrapper script for changes (indicates version switch)
		if (fs.existsSync(wrapperPath)) {
			this.wrapperWatcher = vscode.workspace.createFileSystemWatcher(
				wrapperPath,
				false, // ignoreCreateEvents
				false, // ignoreChangeEvents
				true   // ignoreDeleteEvents
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
	dispose(): void {
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
	onVersionChange(callback: VersionChangeCallback): void {
		this.callbacks.push(callback);
	}

	/**
	 * Handle config file changes
	 */
	private handleConfigChange(configPath: string): void {
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
	private handleWrapperChange(configPath: string): void {
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
	private checkVersionChange(configPath: string): void {
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
	private readActiveVersion(configPath: string): string | undefined {
		try {
			if (!fs.existsSync(configPath)) {
				return undefined;
			}

			const configContent = fs.readFileSync(configPath, 'utf-8');
			const config = JSON.parse(configContent);

			return config.active_version;
		} catch (error) {
			console.error('Failed to read cleen config:', error);
			return undefined;
		}
	}

	/**
	 * Notify all registered callbacks
	 */
	private async notifyCallbacks(newVersion: string, oldVersion?: string): Promise<void> {
		for (const callback of this.callbacks) {
			try {
				await callback(newVersion, oldVersion);
			} catch (error) {
				console.error('Error in version change callback:', error);
			}
		}
	}

	/**
	 * Show notification to user about version change
	 */
	private showVersionChangeNotification(newVersion: string, oldVersion?: string): void {
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
	getCurrentVersion(): string | undefined {
		return this.currentVersion;
	}

	/**
	 * Force check for version changes (useful after manual operations)
	 */
	forceCheck(): void {
		const homeDir = os.homedir();
		const configPath = path.join(homeDir, '.cleen', 'config.json');
		this.checkVersionChange(configPath);
	}
}
