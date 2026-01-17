/**
 * Clean Language CLI Integration
 * Created by Ivan Pasco
 *
 * This service provides integration with the cln/cleen CLI commands
 * for Frame Framework projects, including build, server, database, and generate operations.
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type ServerStatusCallback = (status: ServerStatus, port?: number) => void;

export class CLIIntegration {
    private serverTerminal?: vscode.Terminal;
    private buildWatchTerminal?: vscode.Terminal;
    private serverStatus: ServerStatus = 'stopped';
    private serverPort?: number;
    private statusCallbacks: ServerStatusCallback[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Clean Framework');
    }

    // ==================== Project Commands ====================

    /**
     * Create a new Clean Framework project
     */
    async createProject(name?: string, template?: string): Promise<void> {
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter project name',
                placeHolder: 'my-clean-project',
                validateInput: (value) => {
                    if (!value) return 'Project name is required';
                    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
                        return 'Project name must start with a letter and contain only letters, numbers, underscores, and hyphens';
                    }
                    return null;
                }
            });
        }

        if (!name) return;

        // Ask for template if not provided
        if (!template) {
            const templateChoice = await vscode.window.showQuickPick([
                { label: 'default', description: 'Basic Clean Framework project' },
                { label: 'web', description: 'Web application with server and pages' },
                { label: 'api', description: 'REST API project with endpoints' },
                { label: 'fullstack', description: 'Full-stack with components and API' },
                { label: 'game', description: 'Canvas-based game project' }
            ], {
                placeHolder: 'Select project template'
            });

            template = templateChoice?.label;
        }

        const args = ['new', name];
        if (template && template !== 'default') {
            args.push('--template', template);
        }

        await this.runCLICommand(args, 'Creating project...');

        // Offer to open the new project
        const choice = await vscode.window.showInformationMessage(
            `Project "${name}" created successfully!`,
            'Open Project',
            'Stay Here'
        );

        if (choice === 'Open Project') {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const projectPath = workspaceFolder
                ? path.join(workspaceFolder.uri.fsPath, name)
                : name;

            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
        }
    }

    /**
     * Add a plugin to the project
     */
    async addPlugin(name?: string): Promise<void> {
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter plugin name',
                placeHolder: 'frame-data',
                validateInput: (value) => {
                    if (!value) return 'Plugin name is required';
                    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
                        return 'Plugin name must start with a letter';
                    }
                    return null;
                }
            });
        }

        if (!name) return;

        await this.runCLICommand(['plugin', 'add', name], `Adding plugin ${name}...`);
    }

    /**
     * List installed plugins
     */
    async listPlugins(): Promise<void> {
        await this.runCLICommand(['plugin', 'list'], 'Listing plugins...');
    }

    // ==================== Build Commands ====================

    /**
     * Build the project
     */
    async build(): Promise<void> {
        await this.runCLICommand(['build'], 'Building project...');
    }

    /**
     * Build with watch mode (in terminal)
     */
    async buildWatch(): Promise<void> {
        if (this.buildWatchTerminal) {
            this.buildWatchTerminal.show();
            return;
        }

        this.buildWatchTerminal = vscode.window.createTerminal({
            name: 'Clean Build Watch',
            cwd: this.getWorkspacePath()
        });

        this.buildWatchTerminal.show();
        this.buildWatchTerminal.sendText('cln build --watch');

        // Clean up when terminal is closed
        vscode.window.onDidCloseTerminal(t => {
            if (t === this.buildWatchTerminal) {
                this.buildWatchTerminal = undefined;
            }
        });
    }

    /**
     * Build for production
     */
    async buildProduction(): Promise<void> {
        await this.runCLICommand(['build', '--production'], 'Building for production...');
    }

    // ==================== Server Commands ====================

    /**
     * Start the development server
     */
    async startServer(): Promise<void> {
        if (this.serverStatus === 'running') {
            vscode.window.showInformationMessage('Server is already running');
            this.serverTerminal?.show();
            return;
        }

        const config = vscode.workspace.getConfiguration('clean');
        const port = config.get<number>('server.port', 3000);

        this.setServerStatus('starting');

        this.serverTerminal = vscode.window.createTerminal({
            name: `Clean Server :${port}`,
            cwd: this.getWorkspacePath()
        });

        this.serverTerminal.show();
        this.serverTerminal.sendText(`cln serve --port ${port}`);

        this.serverPort = port;

        // Assume server starts after a brief delay
        setTimeout(() => {
            this.setServerStatus('running', port);
        }, 2000);

        // Clean up when terminal is closed
        vscode.window.onDidCloseTerminal(t => {
            if (t === this.serverTerminal) {
                this.serverTerminal = undefined;
                this.setServerStatus('stopped');
            }
        });
    }

    /**
     * Stop the development server
     */
    async stopServer(): Promise<void> {
        if (this.serverStatus !== 'running' || !this.serverTerminal) {
            vscode.window.showInformationMessage('Server is not running');
            return;
        }

        this.setServerStatus('stopping');

        // Send Ctrl+C to stop the server
        this.serverTerminal.sendText('\x03');

        setTimeout(() => {
            this.serverTerminal?.dispose();
            this.serverTerminal = undefined;
            this.setServerStatus('stopped');
        }, 500);
    }

    /**
     * Restart the development server
     */
    async restartServer(): Promise<void> {
        await this.stopServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.startServer();
    }

    /**
     * Toggle server state
     */
    async toggleServer(): Promise<void> {
        if (this.serverStatus === 'running') {
            await this.stopServer();
        } else {
            await this.startServer();
        }
    }

    /**
     * Get current server status
     */
    getServerStatus(): ServerStatus {
        return this.serverStatus;
    }

    /**
     * Get current server port
     */
    getServerPort(): number | undefined {
        return this.serverPort;
    }

    /**
     * Register callback for server status changes
     */
    onServerStatusChange(callback: ServerStatusCallback): void {
        this.statusCallbacks.push(callback);
    }

    // ==================== Database Commands ====================

    /**
     * Run database migrations
     */
    async dbMigrate(): Promise<void> {
        await this.runCLICommand(['db', 'migrate'], 'Running migrations...');
    }

    /**
     * Seed the database
     */
    async dbSeed(): Promise<void> {
        await this.runCLICommand(['db', 'seed'], 'Seeding database...');
    }

    /**
     * Reset the database (with confirmation)
     */
    async dbReset(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'This will delete all data in the database. Are you sure?',
            { modal: true },
            'Yes, Reset Database'
        );

        if (confirm === 'Yes, Reset Database') {
            await this.runCLICommand(['db', 'reset'], 'Resetting database...');
        }
    }

    // ==================== Generate Commands ====================

    /**
     * Generate a model
     */
    async generateModel(name?: string): Promise<void> {
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter model name',
                placeHolder: 'User',
                validateInput: (value) => {
                    if (!value) return 'Model name is required';
                    if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                        return 'Model name should be PascalCase';
                    }
                    return null;
                }
            });
        }

        if (!name) return;

        await this.runCLICommand(['generate', 'model', name], `Generating model ${name}...`);
    }

    /**
     * Generate an endpoint
     */
    async generateEndpoint(routePath?: string): Promise<void> {
        if (!routePath) {
            routePath = await vscode.window.showInputBox({
                prompt: 'Enter endpoint path',
                placeHolder: '/api/users',
                validateInput: (value) => {
                    if (!value) return 'Endpoint path is required';
                    if (!value.startsWith('/')) {
                        return 'Endpoint path should start with /';
                    }
                    return null;
                }
            });
        }

        if (!routePath) return;

        await this.runCLICommand(['generate', 'endpoint', routePath], `Generating endpoint ${routePath}...`);
    }

    /**
     * Generate a component
     */
    async generateComponent(name?: string): Promise<void> {
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter component name',
                placeHolder: 'Button',
                validateInput: (value) => {
                    if (!value) return 'Component name is required';
                    if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                        return 'Component name should be PascalCase';
                    }
                    return null;
                }
            });
        }

        if (!name) return;

        await this.runCLICommand(['generate', 'component', name], `Generating component ${name}...`);
    }

    /**
     * Generate a page
     */
    async generatePage(pagePath?: string): Promise<void> {
        if (!pagePath) {
            pagePath = await vscode.window.showInputBox({
                prompt: 'Enter page path',
                placeHolder: '/about',
                validateInput: (value) => {
                    if (!value) return 'Page path is required';
                    if (!value.startsWith('/')) {
                        return 'Page path should start with /';
                    }
                    return null;
                }
            });
        }

        if (!pagePath) return;

        await this.runCLICommand(['generate', 'page', pagePath], `Generating page ${pagePath}...`);
    }

    /**
     * Generate a canvas scene
     */
    async generateScene(name?: string): Promise<void> {
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter scene name',
                placeHolder: 'MainMenu',
                validateInput: (value) => {
                    if (!value) return 'Scene name is required';
                    if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                        return 'Scene name should be PascalCase';
                    }
                    return null;
                }
            });
        }

        if (!name) return;

        await this.runCLICommand(['generate', 'scene', name], `Generating scene ${name}...`);
    }

    // ==================== Helper Methods ====================

    /**
     * Run a CLI command and show output
     */
    private async runCLICommand(args: string[], message: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const workspacePath = this.getWorkspacePath();

            if (!workspacePath) {
                vscode.window.showErrorMessage('No workspace folder open');
                reject(new Error('No workspace folder'));
                return;
            }

            this.outputChannel.show();
            this.outputChannel.appendLine(`\n> cln ${args.join(' ')}`);
            this.outputChannel.appendLine(message);

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: message,
                cancellable: false
            }, async () => {
                return new Promise<void>((resolveProgress, rejectProgress) => {
                    const process = cp.spawn('cln', args, {
                        cwd: workspacePath,
                        shell: true
                    });

                    let stdout = '';
                    let stderr = '';

                    process.stdout?.on('data', (data) => {
                        const text = data.toString();
                        stdout += text;
                        this.outputChannel.append(text);
                    });

                    process.stderr?.on('data', (data) => {
                        const text = data.toString();
                        stderr += text;
                        this.outputChannel.append(text);
                    });

                    process.on('close', (code) => {
                        if (code === 0) {
                            this.outputChannel.appendLine('\n✓ Command completed successfully');
                            vscode.window.showInformationMessage(`${message} Done!`);
                            resolveProgress();
                            resolve();
                        } else {
                            const errorMsg = `Command failed with code ${code}`;
                            this.outputChannel.appendLine(`\n✗ ${errorMsg}`);
                            vscode.window.showErrorMessage(`${message} Failed. See output for details.`);
                            rejectProgress(new Error(errorMsg));
                            reject(new Error(errorMsg));
                        }
                    });

                    process.on('error', (err) => {
                        const errorMsg = `Failed to execute command: ${err.message}`;
                        this.outputChannel.appendLine(`\n✗ ${errorMsg}`);
                        vscode.window.showErrorMessage(errorMsg);
                        rejectProgress(err);
                        reject(err);
                    });
                });
            });
        });
    }

    /**
     * Get the current workspace path
     */
    private getWorkspacePath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Set server status and notify callbacks
     */
    private setServerStatus(status: ServerStatus, port?: number): void {
        this.serverStatus = status;
        if (port !== undefined) {
            this.serverPort = port;
        }

        for (const callback of this.statusCallbacks) {
            try {
                callback(status, this.serverPort);
            } catch (error) {
                console.error('Error in server status callback:', error);
            }
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.serverTerminal?.dispose();
        this.buildWatchTerminal?.dispose();
        this.outputChannel.dispose();
    }
}
