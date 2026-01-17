/**
 * Clean Manager Integration
 * Created by Ivan Pasco
 *
 * This module handles integration with cleen for version management
 * and compiler routing in the Clean Language extension.
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CleenDetector, CleenDetectionResult } from './services/cleen-detector';

const execAsync = promisify(exec);

export class CleanManagerIntegration {
	private cleanManagerPath: string;
	private currentVersion?: string;
	private detector: CleenDetector;
	private detectionResult?: CleenDetectionResult;

	constructor() {
		this.cleanManagerPath = vscode.workspace.getConfiguration('clean').get('manager.path', 'cleen');
		this.detector = new CleenDetector();
	}

	/**
	 * Initialize and auto-detect cleen path
	 */
	async initialize(): Promise<void> {
		const autoDetect = vscode.workspace.getConfiguration('clean').get('manager.autoDetect', true);

		if (autoDetect) {
			const configuredPath = vscode.workspace.getConfiguration('clean').get<string>('manager.path');
			this.detectionResult = await this.detector.detectCleenPath(configuredPath);

			if (this.detectionResult.found && this.detectionResult.path) {
				this.cleanManagerPath = this.detectionResult.path;

				// Auto-configure if not already configured
				if (!configuredPath || configuredPath === 'cleen') {
					await vscode.workspace.getConfiguration('clean').update(
						'manager.path',
						this.detectionResult.path,
						vscode.ConfigurationTarget.Workspace
					);

					console.log(`Auto-configured cleen path: ${this.detectionResult.path} (method: ${this.detectionResult.method})`);
				}
			}
		}
	}

	/**
	 * Get the detection result
	 */
	getDetectionResult(): CleenDetectionResult | undefined {
		return this.detectionResult;
	}

	/**
	 * Check if cleen is installed and available
	 */
	async isInstalled(): Promise<boolean> {
		try {
			await execAsync(`"${this.cleanManagerPath}" --version`);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the current active Clean Language version
	 */
	async getCurrentVersion(): Promise<string | undefined> {
		try {
			const { stdout } = await execAsync(`"${this.cleanManagerPath}" current`);
			const version = stdout.trim();
			this.currentVersion = version;
			return version;
		} catch (error) {
			console.error('Failed to get current version:', error);
			return undefined;
		}
	}

	/**
	 * List all installed Clean Language versions
	 */
	async listInstalledVersions(): Promise<Array<{ version: string; current: boolean; installed: boolean }>> {
		try {
			const { stdout } = await execAsync(`"${this.cleanManagerPath}" list`);
			const lines = stdout.trim().split('\n');

			return lines.map(line => {
				const trimmedLine = line.trim();

				// Skip header lines and empty lines
				if (
					!trimmedLine ||
					trimmedLine.includes('Installed Clean Language versions:') ||
					trimmedLine.includes('Active version:') ||
					trimmedLine.startsWith('=') ||
					trimmedLine.startsWith('•') ||
					trimmedLine.startsWith('🔧') ||
					trimmedLine.startsWith('💡')
				) {
					return null;
				}

				const isCurrent = trimmedLine.includes('✅') || trimmedLine.includes('(active)');

				// Extract version number - look for pattern starting with 'v' or 'latest'
				let version = '';
				if (trimmedLine.startsWith('latest')) {
					version = 'latest';
				} else {
					// Match version pattern like v0.3.0, v0.2.2-ls, etc.
					const versionMatch = trimmedLine.match(/v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+)?/);
					if (versionMatch) {
						version = versionMatch[0];
					}
				}

				if (!version) {
					return null;
				}

				return {
					version,
					current: isCurrent,
					installed: true
				};
			}).filter(v => v !== null) as Array<{ version: string; current: boolean; installed: boolean }>;
		} catch (error) {
			console.error('Failed to list installed versions:', error);
			return [];
		}
	}

	/**
	 * List all available Clean Language versions (including uninstalled)
	 */
	async listAvailableVersions(): Promise<Array<{ version: string; current: boolean; installed: boolean }>> {
		try {
			const { stdout } = await execAsync(`"${this.cleanManagerPath}" available`);
			const lines = stdout.trim().split('\n');
			const installedVersions = await this.listInstalledVersions();
			const installedVersionNumbers = new Set(installedVersions.map(v => v.version));

			return lines.map(line => {
				const trimmedLine = line.trim();

				// Skip header lines, examples, and descriptions
				if (
					!trimmedLine ||
					trimmedLine.includes('Clean Language Compiler Versions') ||
					trimmedLine.includes('Available versions:') ||
					trimmedLine.includes('To install a version') ||
					trimmedLine.includes('Examples:') ||
					trimmedLine.includes('cleen install') ||
					trimmedLine.includes('Assets:') ||
					trimmedLine.startsWith('=') ||
					trimmedLine.startsWith('🔧') ||
					trimmedLine.startsWith('💡') ||
					trimmedLine.startsWith('📋')
				) {
					return null;
				}

				// Extract version from lines that start with bullet points
				let version = '';
				if (trimmedLine.startsWith('• ')) {
					// Handle lines like "• v0.3.0 (latest)"
					const versionMatch = trimmedLine.match(/• (v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+)?|latest)/);
					if (versionMatch) {
						version = versionMatch[1];
					}
				} else {
					// Handle plain version lines
					const versionMatch = trimmedLine.match(/^(v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+)?|latest)(?:\s|$)/);
					if (versionMatch) {
						version = versionMatch[1];
					}
				}

				if (!version) {
					return null;
				}

				const isInstalled = installedVersionNumbers.has(version);
				const isCurrent = installedVersions.find(v => v.version === version)?.current || false;

				return {
					version,
					current: isCurrent,
					installed: isInstalled
				};
			}).filter(v => v !== null) as Array<{ version: string; current: boolean; installed: boolean }>;
		} catch (error) {
			console.error('Failed to list available versions:', error);
			return [];
		}
	}

	/**
	 * Switch to a specific Clean Language version
	 */
	async switchToVersion(version: string): Promise<boolean> {
		try {
			const { stdout, stderr } = await execAsync(`"${this.cleanManagerPath}" use ${version}`);
			if (stderr && !stderr.includes('warning')) {
				throw new Error(stderr);
			}

			this.currentVersion = version;
			return true;
		} catch (error) {
			console.error(`Failed to switch to version ${version}:`, error);
			vscode.window.showErrorMessage(`Failed to switch to Clean Language version ${version}: ${error}`);
			return false;
		}
	}

	/**
	 * Install a specific Clean Language version
	 */
	async installVersion(version: string): Promise<boolean> {
		try {
			// Show progress indication
			return vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Installing Clean Language ${version}`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ message: 'Downloading and installing...' });

					const { stdout, stderr } = await execAsync(`"${this.cleanManagerPath}" install ${version}`);
					if (stderr && !stderr.includes('warning')) {
						throw new Error(stderr);
					}

					return true;
				}
			);
		} catch (error) {
			console.error(`Failed to install version ${version}:`, error);
			vscode.window.showErrorMessage(`Failed to install Clean Language version ${version}: ${error}`);
			return false;
		}
	}

	/**
	 * Uninstall a specific Clean Language version
	 */
	async uninstallVersion(version: string): Promise<boolean> {
		try {
			const { stdout, stderr } = await execAsync(`"${this.cleanManagerPath}" uninstall ${version}`);
			if (stderr && !stderr.includes('warning')) {
				throw new Error(stderr);
			}

			return true;
		} catch (error) {
			console.error(`Failed to uninstall version ${version}:`, error);
			vscode.window.showErrorMessage(`Failed to uninstall Clean Language version ${version}: ${error}`);
			return false;
		}
	}

	/**
	 * Run cleen doctor to check the environment
	 */
	async runDoctor(): Promise<string> {
		try {
			const { stdout } = await execAsync(`"${this.cleanManagerPath}" doctor`);
			return stdout;
		} catch (error) {
			console.error('Failed to run doctor:', error);
			throw error;
		}
	}

	/**
	 * Run diagnostic check for installation
	 */
	async runDiagnostics(): Promise<string> {
		return await this.detector.runDiagnostics();
	}

	/**
	 * Initialize the shell environment for cleen
	 */
	async initializeEnvironment(): Promise<boolean> {
		try {
			const { stdout, stderr } = await execAsync(`"${this.cleanManagerPath}" init`);
			if (stderr && !stderr.includes('warning')) {
				throw new Error(stderr);
			}

			return true;
		} catch (error) {
			console.error('Failed to initialize environment:', error);
			vscode.window.showErrorMessage(`Failed to initialize Clean Language environment: ${error}`);
			return false;
		}
	}

	/**
	 * Get the path to the Clean Language compiler (cln)
	 */
	async getCompilerPath(): Promise<string> {
		const configuredPath = vscode.workspace.getConfiguration('clean').get('compiler.path', '');
		if (configuredPath) {
			return configuredPath as string;
		}

		// Default to 'cln' which should be managed by cleen
		return 'cln';
	}

	/**
	 * Execute a Clean Language compiler command
	 */
	async executeCompilerCommand(
		command: string,
		args: string[],
		cwd?: string
	): Promise<{ stdout: string; stderr: string }> {
		try {
			const compilerPath = await this.getCompilerPath();
			const fullCommand = `"${compilerPath}" ${command} ${args.map(arg => `"${arg}"`).join(' ')}`;
			const options = cwd ? { cwd } : {};

			const { stdout, stderr } = await execAsync(fullCommand, options);
			return { stdout, stderr };
		} catch (error: any) {
			return { stdout: '', stderr: error.message || 'Unknown error' };
		}
	}

	/**
	 * Get the path to the Clean Language Server binary from the current compiler version
	 */
	async getLanguageServerPath(): Promise<string | undefined> {
		try {
			// Since cleen manages the Clean compiler versions,
			// the language server should be available alongside the compiler
			// Try clean-language-server directly (should be in PATH via cleen)
			await execAsync('clean-language-server --version');
			return 'clean-language-server';
		} catch (error) {
			console.error('clean-language-server not available via cleen:', error);
			return undefined;
		}
	}

	/**
	 * Invalidate detection cache (useful after configuration changes)
	 */
	invalidateDetectionCache(): void {
		this.detector.invalidateCache();
	}
}
