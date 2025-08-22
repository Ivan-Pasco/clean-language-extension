"use strict";
/*
 * Clean Language Extension for VS Code / Cursor
 * Created by Ivan Pasco
 *
 * This extension provides comprehensive support for the Clean Language including:
 * - Syntax highlighting and language features
 * - LSP server integration
 * - cleen - the Clean Language Manager integration for version management
 * - Compile, run, test, and debug capabilities
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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const cleanmanager_1 = require("./cleanmanager");
const commands_1 = require("./commands");
const statusbar_1 = require("./statusbar");
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
function activate(context) {
    try {
        console.log('Clean Language extension is now active!');
        // Initialize Clean Manager integration
        cleanManager = new cleanmanager_1.CleanManagerIntegration();
        // Initialize command handler and status bar
        commands = new commands_1.CleanCommands(cleanManager);
        statusBar = new statusbar_1.CleanStatusBar(cleanManager);
        // Connect status bar to commands for updates
        commands.setStatusBar(statusBar);
        // Register commands using the command handler
        const runCommand = vscode.commands.registerCommand('clean.runFile', () => commands.runFile());
        const compileCommand = vscode.commands.registerCommand('clean.compileFile', () => commands.compileFile());
        const compileWithOptionsCommand = vscode.commands.registerCommand('clean.compileWithOptions', () => commands.compileWithOptions());
        const testCommand = vscode.commands.registerCommand('clean.testFile', () => commands.testFile());
        const selectVersionCommand = vscode.commands.registerCommand('clean.selectVersion', () => commands.selectVersion());
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
                versions.forEach(v => {
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
        // Register commands first
        context.subscriptions.push(runCommand, compileCommand, compileWithOptionsCommand, testCommand, selectVersionCommand, showVersionInfoCommand);
        // Set up tab indentation enforcement for Clean files
        setupCleanIndentationSettings(context);
        // Initialize cleen and LSP asynchronously (non-blocking)
        setImmediate(() => {
            initializeCleanLanguage(context).catch(error => {
                console.error('Failed to initialize cleen/LSP:', error);
            });
        });
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
        // First check if cleen is available
        const isInstalled = await cleanManager.isInstalled();
        if (!isInstalled) {
            console.log('Clean Language: cleen not found, LSP disabled');
            vscode.window.showInformationMessage('Clean Language: cleen not found. LSP features will be disabled.');
            await statusBar.updateVersionDisplay();
            return;
        }
        // cleen is available, show version info and update status bar
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
        // Try to start LSP, but don't fail if it's not available
        try {
            await startLanguageClient(context);
        }
        catch (error) {
            console.log('Clean Language: LSP not available, continuing without it');
            vscode.window.showInformationMessage('Clean Language: Language Server not available. Basic features will work.');
        }
    }
    catch (error) {
        console.error('Clean Language: Failed to initialize:', error);
        // Don't fail activation, just log the error and show user-friendly message
        vscode.window.showWarningMessage('Clean Language: Some features may not work properly due to initialization issues.');
    }
}
function checkCleanManager() {
    const { exec } = require('child_process');
    const os = require('os');
    const path = require('path');
    // Try multiple possible locations for cleen
    const possiblePaths = [
        'cleen',
        path.join(os.homedir(), '.cleen', 'bin', 'cleen'),
        path.join(os.homedir(), '.cargo', 'bin', 'cleen'),
        '/usr/local/bin/cleen',
        'C:\\Users\\' + os.userInfo().username + '\\.cleen\\bin\\cleen.exe'
    ];
    let found = false;
    let attempts = 0;
    function tryNextPath() {
        if (attempts >= possiblePaths.length) {
            // Not found in any location
            vscode.window.showWarningMessage('cleen not found. Clean Language features may be limited.', 'Install cleen', 'Show Installation Guide').then(selection => {
                if (selection === 'Install cleen') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/Ivan-Pasco/clean-language-manager/releases'));
                }
                else if (selection === 'Show Installation Guide') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/Ivan-Pasco/clean-language-manager#installation'));
                }
            });
            return;
        }
        const currentPath = possiblePaths[attempts];
        attempts++;
        exec(`"${currentPath}" --version`, (error, stdout, stderr) => {
            if (!error && !found) {
                found = true;
                console.log(`cleen found at: ${currentPath}`);
                console.log('Version:', stdout.trim());
                vscode.window.showInformationMessage(`cleen - the Clean Language Manager found: ${stdout.trim()}`);
            }
            else if (!found) {
                // Try next path
                tryNextPath();
            }
        });
    }
    tryNextPath();
}
async function startLanguageClient(context) {
    try {
        // Check if LSP components are available
        if (!LanguageClient) {
            console.log('Clean Language: Language Client not available, skipping LSP');
            return;
        }
        // Get the language server path from cleen
        const serverPath = await cleanManager.getLanguageServerPath();
        if (!serverPath) {
            console.log('Clean Language: Language server not available, skipping LSP');
            return;
        }
        console.log('Starting Clean Language Server from:', serverPath);
        // Configure server options
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
        // Configure client options
        const clientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'clean' }
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.cleen')
            },
            outputChannelName: 'Clean Language Server'
        };
        // Create and start the language client
        client = new LanguageClient('cleanLanguageServer', 'Clean Language Server', serverOptions, clientOptions);
        // Start the client and register for disposal
        await client.start();
        context.subscriptions.push(client);
        console.log('Clean Language Server started successfully');
        vscode.window.showInformationMessage('Clean Language Server started');
    }
    catch (error) {
        console.error('Failed to start Clean Language Server:', error);
        // Don't show error to user, just log it - LSP is optional
        console.log('Clean Language: Continuing without LSP support');
    }
}
function setupCleanIndentationSettings(context) {
    // Listen for when Clean Language documents are opened
    const disposable = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'clean') {
            enforceCleanIndentationSettings();
        }
    });
    context.subscriptions.push(disposable);
    // Also enforce for any Clean documents that are already open
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
        // Apply settings for Clean Language files specifically
        const cleanConfig = vscode.workspace.getConfiguration('[clean]');
        const editorConfig = vscode.workspace.getConfiguration('editor');
        // Update workspace configuration for Clean files
        cleanConfig.update('insertSpaces', false, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('tabSize', tabSize, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('detectIndentation', false, vscode.ConfigurationTarget.Workspace);
        cleanConfig.update('useTabStops', true, vscode.ConfigurationTarget.Workspace);
        console.log('Clean Language: Enforced tab-based indentation settings');
    }
}
function deactivate() {
    try {
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