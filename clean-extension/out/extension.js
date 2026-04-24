"use strict";
/**
 * Clean Language Extension for VS Code / Cursor
 * Created by Ivan Pasco
 *
 * This extension provides comprehensive support for the Clean Language including:
 * - Syntax highlighting and language features
 * - LSP server integration
 * - cleen - the Clean Language Manager integration for version management
 * - Compile, run, test, and debug capabilities
 * - Dynamic compile options from compiler
 * - Frame Framework plugin architecture support
 * - CLI integration for build, server, and generate commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const cleanmanager_1 = require("./cleanmanager");
const commands_1 = require("./commands");
const statusbar_1 = require("./statusbar");
const version_watcher_1 = require("./services/version-watcher");
const cli_integration_1 = require("./services/cli-integration");
// LSP imports - conditional for compatibility
let LanguageClient;
let LanguageClientOptions;
let ServerOptions;
try {
    const langClient = require('vscode-languageclient/node');
    LanguageClient = langClient.LanguageClient;
    LanguageClientOptions = langClient.LanguageClientOptions;
    ServerOptions = langClient.ServerOptions;
}
catch (error) {
    console.warn('Language Client not available, LSP features disabled:', error);
}
let client;
let cleanManager;
let commands;
let statusBar;
let versionWatcher;
let cliIntegration;
function activate(context) {
    try {
        console.log('Clean Language extension is now active!');
        // Initialize Clean Manager integration
        cleanManager = new cleanmanager_1.CleanManagerIntegration();
        // Initialize command handler and status bar
        commands = new commands_1.CleanCommands(cleanManager);
        statusBar = new statusbar_1.CleanStatusBar(cleanManager);
        // Initialize Frame Framework CLI integration
        cliIntegration = new cli_integration_1.CLIIntegration();
        // Connect status bar to commands for updates
        commands.setStatusBar(statusBar);
        // Connect CLI integration to status bar for server status
        cliIntegration.onServerStatusChange((status, port) => {
            statusBar.updateServerStatus(status, port);
        });
        // Preload compile options on activation for faster first use
        commands.compileOptionsLoader.loadCompileOptions().catch(error => {
            console.error('Failed to preload compile options:', error);
        });
        // Register commands using the command handler
        const runCommand = vscode.commands.registerCommand('clean.runFile', () => commands.runFile());
        const compileCommand = vscode.commands.registerCommand('clean.compileFile', () => commands.compileFile());
        const compileWithOptionsCommand = vscode.commands.registerCommand('clean.compileWithOptions', () => commands.compileWithOptions());
        const testCommand = vscode.commands.registerCommand('clean.testFile', () => commands.testFile());
        const selectVersionCommand = vscode.commands.registerCommand('clean.selectVersion', () => commands.selectVersion());
        // NEW: Refresh compile options command
        const refreshOptionsCommand = vscode.commands.registerCommand('clean.refreshCompileOptions', () => commands.refreshCompileOptions());
        // NEW: Setup and diagnostic commands
        const setupCleenCommand = vscode.commands.registerCommand('clean.setupCleen', () => commands.setupCleen());
        const detectCleenCommand = vscode.commands.registerCommand('clean.detectCleen', () => commands.detectCleen());
        const checkInstallationCommand = vscode.commands.registerCommand('clean.checkInstallation', () => commands.checkInstallation());
        // Frame Framework Project Commands
        const createProjectCommand = vscode.commands.registerCommand('clean.createProject', () => cliIntegration.createProject());
        const addPluginCommand = vscode.commands.registerCommand('clean.addPlugin', () => cliIntegration.addPlugin());
        const listPluginsCommand = vscode.commands.registerCommand('clean.listPlugins', () => cliIntegration.listPlugins());
        // Frame Framework Build Commands
        const buildCommand = vscode.commands.registerCommand('clean.build', () => cliIntegration.build());
        const buildWatchCommand = vscode.commands.registerCommand('clean.buildWatch', () => cliIntegration.buildWatch());
        const buildProductionCommand = vscode.commands.registerCommand('clean.buildProduction', () => cliIntegration.buildProduction());
        // Frame Framework Server Commands
        const startServerCommand = vscode.commands.registerCommand('clean.startServer', () => cliIntegration.startServer());
        const stopServerCommand = vscode.commands.registerCommand('clean.stopServer', () => cliIntegration.stopServer());
        const restartServerCommand = vscode.commands.registerCommand('clean.restartServer', () => cliIntegration.restartServer());
        // Frame Framework Database Commands
        const dbMigrateCommand = vscode.commands.registerCommand('clean.dbMigrate', () => cliIntegration.dbMigrate());
        const dbSeedCommand = vscode.commands.registerCommand('clean.dbSeed', () => cliIntegration.dbSeed());
        const dbResetCommand = vscode.commands.registerCommand('clean.dbReset', () => cliIntegration.dbReset());
        // Frame Framework Generate Commands
        const generateModelCommand = vscode.commands.registerCommand('clean.generateModel', () => cliIntegration.generateModel());
        const generateEndpointCommand = vscode.commands.registerCommand('clean.generateEndpoint', () => cliIntegration.generateEndpoint());
        const generateComponentCommand = vscode.commands.registerCommand('clean.generateComponent', () => cliIntegration.generateComponent());
        const generatePageCommand = vscode.commands.registerCommand('clean.generatePage', () => cliIntegration.generatePage());
        const generateSceneCommand = vscode.commands.registerCommand('clean.generateScene', () => cliIntegration.generateScene());
        const showVersionInfoCommand = vscode.commands.registerCommand('clean.showVersionInfo', async () => {
            try {
                const isInstalled = await cleanManager.isInstalled();
                if (!isInstalled) {
                    vscode.window.showInformationMessage('cleen not found. Please install cleen - the Clean Language Manager to view version information.');
                    return;
                }
                const currentVersion = await cleanManager.getCurrentVersion();
                const versions = await cleanManager.listInstalledVersions();
                let message = `Current Clean Language Version: ${currentVersion || 'Unknown'}\n\n`;
                message += `Installed versions:\n`;
                versions.forEach((v) => {
                    message += `${v.current ? '• ' : '  '}${v.version}${v.current ? ' (current)' : ''}\n`;
                });
                vscode.window.showInformationMessage(message, { modal: true });
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to get version information.');
                console.error('Version info error:', error);
            }
        });
        // Initialize status bar
        statusBar.initialize(context);
        // Register commands - now including new commands
        context.subscriptions.push(runCommand, compileCommand, compileWithOptionsCommand, testCommand, selectVersionCommand, showVersionInfoCommand, refreshOptionsCommand, setupCleenCommand, detectCleenCommand, checkInstallationCommand, 
        // Frame Framework commands
        createProjectCommand, addPluginCommand, listPluginsCommand, buildCommand, buildWatchCommand, buildProductionCommand, startServerCommand, stopServerCommand, restartServerCommand, dbMigrateCommand, dbSeedCommand, dbResetCommand, generateModelCommand, generateEndpointCommand, generateComponentCommand, generatePageCommand, generateSceneCommand);
        // Set up tab indentation enforcement for Clean files
        setupCleanIndentationSettings(context);
        // Initialize cleen and LSP asynchronously (non-blocking)
        setImmediate(() => {
            initializeCleanLanguage(context).catch(error => {
                console.error('Failed to initialize cleen/LSP:', error);
            });
        });
        // Check for auto-start server setting
        const serverConfig = vscode.workspace.getConfiguration('clean');
        if (serverConfig.get('server.autoStart', false)) {
            setImmediate(() => {
                cliIntegration.startServer().catch(error => {
                    console.error('Failed to auto-start server:', error);
                });
            });
        }
        console.log('Clean Language extension activated successfully!');
    }
    catch (error) {
        console.error('Clean Language extension failed to activate:', error);
        vscode.window.showErrorMessage('Clean Language extension failed to activate properly. Some features may not work.');
    }
}
exports.activate = activate;
async function initializeCleanLanguage(context) {
    try {
        // Add a delay to ensure Cursor is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Initialize cleanManager (runs auto-detection)
        await cleanManager.initialize();
        const detectionResult = cleanManager.getDetectionResult();
        if (!detectionResult || !detectionResult.found) {
            console.log('Clean Language: cleen not found, language features unavailable');
            statusBar.showSetupRequired();
            vscode.window.showWarningMessage('Clean Language: Compiler not found. Install cleen to enable all language features (syntax highlighting, completions, diagnostics).', 'Install cleen', 'Check Installation').then(choice => {
                if (choice === 'Install cleen') {
                    vscode.commands.executeCommand('clean.setupCleen');
                }
                else if (choice === 'Check Installation') {
                    vscode.commands.executeCommand('clean.checkInstallation');
                }
            });
            await statusBar.updateVersionDisplay();
            return;
        }
        // cleen detected successfully!
        console.log(`Clean Language: Found cleen at ${detectionResult.path} (${detectionResult.method})`);
        // Start version watcher to monitor for version changes
        versionWatcher = new version_watcher_1.VersionWatcher();
        versionWatcher.start(context);
        // Register version change callback to refresh compile options
        versionWatcher.onVersionChange(async (newVersion, oldVersion) => {
            console.log(`Version changed from ${oldVersion} to ${newVersion}, refreshing compile options...`);
            await commands.compileOptionsLoader.refreshCompileOptions();
            await statusBar.updateVersionDisplay();
        });
        // Get and display version info
        try {
            const version = await cleanManager.getCurrentVersion();
            if (version) {
                vscode.window.showInformationMessage(`cleen - the Clean Language Manager active: ${version}`);
            }
            await statusBar.updateVersionDisplay();
        }
        catch (error) {
            console.error('Failed to get Clean Language version:', error);
            await statusBar.updateVersionDisplay();
        }
        // Start language server — this is the single source of truth for all language intelligence
        try {
            await startLanguageClient(context);
        }
        catch (error) {
            console.log('Clean Language: Language server not available');
            vscode.window.showWarningMessage('Clean Language: Language server not available. Syntax highlighting, completions, and diagnostics require the language server.', 'Check Installation').then(choice => {
                if (choice === 'Check Installation') {
                    vscode.commands.executeCommand('clean.checkInstallation');
                }
            });
        }
    }
    catch (error) {
        console.error('Clean Language: Failed to initialize:', error);
        vscode.window.showWarningMessage('Clean Language: Some features may not work properly due to initialization issues.');
    }
}
async function startLanguageClient(context) {
    try {
        if (!LanguageClient) {
            console.log('Clean Language: Language Client not available, skipping LSP');
            return;
        }
        const serverPath = await cleanManager.getLanguageServerPath();
        if (!serverPath) {
            console.log('Clean Language: Language server not available, skipping LSP');
            return;
        }
        console.log('Starting Clean Language Server from:', serverPath);
        const serverOptions = {
            run: {
                command: serverPath,
                args: ['--stdio']
            },
            debug: {
                command: serverPath,
                args: ['--stdio', '--log-level', 'debug']
            }
        };
        const clientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'clean' }
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.cleen')
            },
            outputChannelName: 'Clean Language Server'
        };
        client = new LanguageClient('cleanLanguageServer', 'Clean Language Server', serverOptions, clientOptions);
        await client.start();
        context.subscriptions.push(client);
        console.log('Clean Language Server started successfully');
        vscode.window.showInformationMessage('Clean Language Server started');
    }
    catch (error) {
        console.error('Failed to start Clean Language Server:', error);
        console.log('Clean Language: Continuing without LSP support');
    }
}
function setupCleanIndentationSettings(context) {
    const disposable = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'clean') {
            enforceCleanIndentationSettings();
        }
    });
    context.subscriptions.push(disposable);
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'clean') {
            enforceCleanIndentationSettings();
        }
    });
}
function enforceCleanIndentationSettings() {
    const config = vscode.workspace.getConfiguration('clean');
    const enforceTabsOverSpaces = config.get('indentation.enforceTabsOverSpaces', true);
    const tabSize = config.get('indentation.tabSize', 4);
    if (enforceTabsOverSpaces) {
        const cleanConfig = vscode.workspace.getConfiguration('[clean]');
        cleanConfig.update('insertSpaces', false, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('tabSize', tabSize, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('detectIndentation', false, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('useTabStops', true, vscode.ConfigurationTarget.Workspace);
        console.log('Clean Language: Enforced tab-based indentation settings');
    }
}
function deactivate() {
    try {
        // Dispose Frame Framework services
        if (cliIntegration) {
            cliIntegration.dispose();
        }
        // Stop LSP client
        if (!client) {
            return undefined;
        }
        return client.stop();
    }
    catch (error) {
        console.error('Error during deactivation:', error);
        return undefined;
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map