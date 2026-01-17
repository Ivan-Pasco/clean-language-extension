/**
 * Clean Language Plugin Loader
 * Created by Ivan Pasco
 *
 * This service manages Frame Framework plugin loading, parsing, and integration.
 * Loads plugins from app.cln and plugin.toml files, providing completions and hovers.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    PluginManifest,
    PluginLanguageDefinition,
    LoadedPlugin,
    PluginLoadResult,
    PluginLoadError,
    PluginCompletion,
    PluginHoverResult,
    PluginWatcherEvent
} from '../types/plugin-types';

export type PluginChangeCallback = (event: PluginWatcherEvent) => void | Promise<void>;

export class PluginLoader {
    private loadedPlugins: Map<string, LoadedPlugin> = new Map();
    private appClnWatcher?: vscode.FileSystemWatcher;
    private callbacks: PluginChangeCallback[] = [];
    private completionProvider?: vscode.Disposable;
    private hoverProvider?: vscode.Disposable;
    private debounceTimer?: NodeJS.Timeout;
    private readonly DEBOUNCE_MS = 500;

    /**
     * Initialize the plugin loader with VS Code context
     */
    async initialize(context: vscode.ExtensionContext): Promise<void> {
        // Check if auto-load is enabled
        const config = vscode.workspace.getConfiguration('clean');
        const autoLoad = config.get<boolean>('plugins.autoLoad', true);

        if (autoLoad) {
            await this.loadPluginsFromWorkspace();
        }

        // Set up file watcher for app.cln
        this.setupAppClnWatcher(context);

        // Register completion and hover providers
        this.registerProviders(context);

        console.log('Clean Language plugin loader initialized');
    }

    /**
     * Load all plugins from the current workspace
     */
    async loadPluginsFromWorkspace(): Promise<PluginLoadResult> {
        const errors: PluginLoadError[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return { plugins: [], errors: [] };
        }

        // Clear existing plugins
        this.loadedPlugins.clear();

        for (const folder of workspaceFolders) {
            const appClnPath = path.join(folder.uri.fsPath, 'app.cln');

            if (fs.existsSync(appClnPath)) {
                try {
                    const content = fs.readFileSync(appClnPath, 'utf-8');
                    const pluginNames = this.parsePluginsBlock(content);

                    for (const pluginName of pluginNames) {
                        try {
                            const plugin = await this.loadPlugin(pluginName, folder.uri.fsPath);
                            if (plugin) {
                                this.loadedPlugins.set(pluginName, plugin);
                            }
                        } catch (error) {
                            errors.push({
                                pluginName,
                                message: error instanceof Error ? error.message : String(error),
                                path: folder.uri.fsPath
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to read app.cln in ${folder.uri.fsPath}:`, error);
                }
            }
        }

        const plugins = Array.from(this.loadedPlugins.values());
        console.log(`Loaded ${plugins.length} plugins`);

        return { plugins, errors };
    }

    /**
     * Parse plugins block from app.cln content
     */
    parsePluginsBlock(content: string): string[] {
        const plugins: string[] = [];
        const lines = content.split('\n');
        let inPluginsBlock = false;
        let blockIndent = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Check for plugins: block start
            if (trimmed === 'plugins:') {
                inPluginsBlock = true;
                // Get the indentation of the plugins: line
                blockIndent = line.search(/\S/);
                continue;
            }

            if (inPluginsBlock) {
                // Check if we've left the plugins block (less indentation or different block)
                const currentIndent = line.search(/\S/);

                if (trimmed === '' || line.match(/^\s*$/)) {
                    continue; // Skip empty lines
                }

                if (currentIndent <= blockIndent && trimmed !== '') {
                    // We've exited the plugins block
                    break;
                }

                // Parse plugin name - could be just a name or a string
                let pluginName = trimmed;

                // Handle quoted plugin names: "plugin-name" or 'plugin-name'
                const quotedMatch = trimmed.match(/^["']([^"']+)["']$/);
                if (quotedMatch) {
                    pluginName = quotedMatch[1];
                }

                // Handle plugin with version: plugin@version or plugin: version
                const versionMatch = pluginName.match(/^([a-zA-Z][a-zA-Z0-9_-]*)(?:@|:\s*)(.+)$/);
                if (versionMatch) {
                    pluginName = versionMatch[1];
                }

                // Validate plugin name
                if (pluginName && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(pluginName)) {
                    plugins.push(pluginName);
                }
            }
        }

        return plugins;
    }

    /**
     * Load a single plugin by name
     */
    async loadPlugin(name: string, workspacePath: string): Promise<LoadedPlugin | null> {
        // Try project plugins folder first
        const projectPluginPath = path.join(workspacePath, 'plugins', name);
        if (fs.existsSync(projectPluginPath)) {
            const manifest = await this.loadPluginManifest(projectPluginPath);
            if (manifest) {
                return {
                    name,
                    path: projectPluginPath,
                    manifest,
                    source: 'project',
                    active: true
                };
            }
        }

        // Try global plugins path
        const config = vscode.workspace.getConfiguration('clean');
        const globalPath = config.get<string>('plugins.globalPath', '~/.clean/plugins');
        const resolvedGlobalPath = globalPath.replace(/^~/, os.homedir());
        const globalPluginPath = path.join(resolvedGlobalPath, name);

        if (fs.existsSync(globalPluginPath)) {
            const manifest = await this.loadPluginManifest(globalPluginPath);
            if (manifest) {
                return {
                    name,
                    path: globalPluginPath,
                    manifest,
                    source: 'global',
                    active: true
                };
            }
        }

        console.warn(`Plugin not found: ${name}`);
        return null;
    }

    /**
     * Load and parse plugin.toml manifest
     */
    private async loadPluginManifest(pluginPath: string): Promise<PluginManifest | null> {
        const tomlPath = path.join(pluginPath, 'plugin.toml');

        if (!fs.existsSync(tomlPath)) {
            // Try package.json as fallback
            const jsonPath = path.join(pluginPath, 'package.json');
            if (fs.existsSync(jsonPath)) {
                return this.loadPluginFromJson(jsonPath);
            }
            return null;
        }

        try {
            const content = fs.readFileSync(tomlPath, 'utf-8');
            return this.parsePluginToml(content);
        } catch (error) {
            console.error(`Failed to parse plugin.toml in ${pluginPath}:`, error);
            return null;
        }
    }

    /**
     * Parse plugin.toml content (simplified TOML parser)
     */
    private parsePluginToml(content: string): PluginManifest {
        const manifest: PluginManifest = {
            name: '',
            version: '0.0.0',
            description: '',
            author: ''
        };

        const lines = content.split('\n');
        let currentSection = '';
        let language: PluginLanguageDefinition = {
            blocks: [],
            keywords: [],
            types: [],
            functions: [],
            completions: []
        };

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed === '') {
                continue;
            }

            // Section header
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                continue;
            }

            // Key-value pair
            const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (kvMatch) {
                const key = kvMatch[1];
                let value = kvMatch[2].trim();

                // Parse string values
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }

                // Parse array values
                if (value.startsWith('[') && value.endsWith(']')) {
                    const arrayContent = value.slice(1, -1);
                    const items = arrayContent.split(',').map(item => {
                        const trimmedItem = item.trim();
                        if (trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) {
                            return trimmedItem.slice(1, -1);
                        }
                        return trimmedItem;
                    }).filter(Boolean);

                    if (currentSection === '' || currentSection === 'plugin') {
                        // Top-level or [plugin] section
                    } else if (currentSection === 'language') {
                        if (key === 'blocks') language.blocks = items;
                        else if (key === 'keywords') language.keywords = items;
                        else if (key === 'types') language.types = items;
                    }
                    continue;
                }

                // Assign to manifest based on section
                if (currentSection === '' || currentSection === 'plugin') {
                    switch (key) {
                        case 'name': manifest.name = value; break;
                        case 'version': manifest.version = value; break;
                        case 'description': manifest.description = value; break;
                        case 'author': manifest.author = value; break;
                        case 'homepage': manifest.homepage = value; break;
                        case 'repository': manifest.repository = value; break;
                        case 'cleanVersion': manifest.cleanVersion = value; break;
                    }
                }
            }
        }

        // Only add language if it has content
        if (language.blocks.length > 0 || language.keywords.length > 0 ||
            language.types.length > 0 || language.functions.length > 0) {
            manifest.language = language;
        }

        return manifest;
    }

    /**
     * Load plugin from package.json (fallback)
     */
    private loadPluginFromJson(jsonPath: string): PluginManifest | null {
        try {
            const content = fs.readFileSync(jsonPath, 'utf-8');
            const pkg = JSON.parse(content);

            return {
                name: pkg.name || '',
                version: pkg.version || '0.0.0',
                description: pkg.description || '',
                author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '',
                homepage: pkg.homepage,
                repository: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url,
                language: pkg.cleanLanguage || pkg.language
            };
        } catch (error) {
            console.error(`Failed to parse package.json:`, error);
            return null;
        }
    }

    /**
     * Set up file watcher for app.cln changes
     */
    private setupAppClnWatcher(context: vscode.ExtensionContext): void {
        this.appClnWatcher = vscode.workspace.createFileSystemWatcher(
            '**/app.cln',
            false,
            false,
            false
        );

        this.appClnWatcher.onDidCreate(() => this.handleAppClnChange());
        this.appClnWatcher.onDidChange(() => this.handleAppClnChange());
        this.appClnWatcher.onDidDelete(() => this.handleAppClnChange());

        context.subscriptions.push(this.appClnWatcher);
    }

    /**
     * Handle app.cln file changes
     */
    private handleAppClnChange(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            console.log('app.cln changed, reloading plugins...');
            await this.loadPluginsFromWorkspace();

            // Notify callbacks
            for (const callback of this.callbacks) {
                try {
                    await callback({ type: 'changed', pluginName: '*' });
                } catch (error) {
                    console.error('Error in plugin change callback:', error);
                }
            }
        }, this.DEBOUNCE_MS);
    }

    /**
     * Register completion and hover providers
     */
    private registerProviders(context: vscode.ExtensionContext): void {
        // Completion provider
        this.completionProvider = vscode.languages.registerCompletionItemProvider(
            [{ language: 'clean' }, { language: 'clean-html' }],
            {
                provideCompletionItems: (document, position) => {
                    return this.getCompletionItems(document, position);
                }
            },
            '.' // Trigger on dot
        );

        // Hover provider
        this.hoverProvider = vscode.languages.registerHoverProvider(
            [{ language: 'clean' }, { language: 'clean-html' }],
            {
                provideHover: (document, position) => {
                    return this.getHoverInfo(document, position);
                }
            }
        );

        context.subscriptions.push(this.completionProvider, this.hoverProvider);
    }

    /**
     * Get completion items from loaded plugins
     */
    getCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        for (const plugin of this.loadedPlugins.values()) {
            if (!plugin.manifest.language) continue;

            const lang = plugin.manifest.language;

            // Add blocks as keywords
            for (const block of lang.blocks) {
                const item = new vscode.CompletionItem(
                    block,
                    vscode.CompletionItemKind.Keyword
                );
                item.detail = `(${plugin.name}) Block`;
                item.insertText = new vscode.SnippetString(`${block}:\n\t$0`);
                completions.push(item);
            }

            // Add keywords
            for (const keyword of lang.keywords) {
                const item = new vscode.CompletionItem(
                    keyword,
                    vscode.CompletionItemKind.Keyword
                );
                item.detail = `(${plugin.name})`;
                completions.push(item);
            }

            // Add types
            for (const type of lang.types) {
                const item = new vscode.CompletionItem(
                    type,
                    vscode.CompletionItemKind.Class
                );
                item.detail = `(${plugin.name}) Type`;
                completions.push(item);
            }

            // Add functions
            for (const func of lang.functions) {
                const item = new vscode.CompletionItem(
                    func.name,
                    vscode.CompletionItemKind.Function
                );
                item.detail = func.signature || `(${plugin.name})`;
                item.documentation = new vscode.MarkdownString(func.description);
                if (func.example) {
                    item.documentation.appendCodeblock(func.example, 'clean');
                }
                completions.push(item);
            }

            // Add custom completions
            for (const completion of lang.completions) {
                const kindMap: Record<string, vscode.CompletionItemKind> = {
                    'keyword': vscode.CompletionItemKind.Keyword,
                    'function': vscode.CompletionItemKind.Function,
                    'class': vscode.CompletionItemKind.Class,
                    'property': vscode.CompletionItemKind.Property,
                    'variable': vscode.CompletionItemKind.Variable,
                    'snippet': vscode.CompletionItemKind.Snippet
                };

                const item = new vscode.CompletionItem(
                    completion.label,
                    kindMap[completion.kind] || vscode.CompletionItemKind.Text
                );
                item.detail = completion.detail;
                if (completion.documentation) {
                    item.documentation = new vscode.MarkdownString(completion.documentation);
                }
                if (completion.insertText) {
                    if (completion.insertTextFormat === 'snippet') {
                        item.insertText = new vscode.SnippetString(completion.insertText);
                    } else {
                        item.insertText = completion.insertText;
                    }
                }
                completions.push(item);
            }
        }

        return completions;
    }

    /**
     * Get hover information from loaded plugins
     */
    getHoverInfo(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | null {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return null;

        const word = document.getText(wordRange);

        for (const plugin of this.loadedPlugins.values()) {
            if (!plugin.manifest.language) continue;

            const lang = plugin.manifest.language;

            // Check functions
            for (const func of lang.functions) {
                if (func.name === word) {
                    const md = new vscode.MarkdownString();
                    md.appendCodeblock(func.signature || func.name, 'clean');
                    md.appendMarkdown(`\n\n${func.description}`);
                    if (func.example) {
                        md.appendMarkdown('\n\n**Example:**\n');
                        md.appendCodeblock(func.example, 'clean');
                    }
                    md.appendMarkdown(`\n\n*From plugin: ${plugin.name}*`);
                    return new vscode.Hover(md);
                }
            }

            // Check blocks
            if (lang.blocks.includes(word)) {
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`**${word}** - Block keyword\n\n`);
                md.appendMarkdown(`*From plugin: ${plugin.name}*`);
                return new vscode.Hover(md);
            }

            // Check types
            if (lang.types.includes(word)) {
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`**${word}** - Type\n\n`);
                md.appendMarkdown(`*From plugin: ${plugin.name}*`);
                return new vscode.Hover(md);
            }
        }

        return null;
    }

    /**
     * Register a callback for plugin changes
     */
    onPluginsChanged(callback: PluginChangeCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Get all loaded plugins
     */
    getLoadedPlugins(): LoadedPlugin[] {
        return Array.from(this.loadedPlugins.values());
    }

    /**
     * Get plugin count
     */
    getPluginCount(): number {
        return this.loadedPlugins.size;
    }

    /**
     * Get plugin names
     */
    getPluginNames(): string[] {
        return Array.from(this.loadedPlugins.keys());
    }

    /**
     * Force reload all plugins
     */
    async reload(): Promise<PluginLoadResult> {
        return this.loadPluginsFromWorkspace();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.appClnWatcher) {
            this.appClnWatcher.dispose();
        }
        if (this.completionProvider) {
            this.completionProvider.dispose();
        }
        if (this.hoverProvider) {
            this.hoverProvider.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.loadedPlugins.clear();
    }
}
