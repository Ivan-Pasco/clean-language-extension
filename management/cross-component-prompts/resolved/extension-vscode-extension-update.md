# VS Code Extension Update Prompt

## Current State Analysis

The `clean-extension` at `/Users/earcandy/Documents/Dev/Clean Language/clean-extension/` is **significantly out of date** with the Frame Framework plugin architecture. It needs comprehensive updates.

### What's Missing

| Feature | Current State | Required State |
|---------|---------------|----------------|
| File extensions | `.cln`, `.test.cln` | + `.html` |
| Plugin blocks | None | `plugins:`, `import:` |
| Framework blocks | None | `data`, `endpoints`, `component`, `auth`, `canvasScene`, etc. |
| Plugin keywords | None | `where`, `order`, `guard`, `state`, `render`, etc. |
| Dynamic plugin loading | None | Load from plugin.toml `[language]` section |
| Snippets | Base language only | Framework snippets |

---

## 1. Update package.json

### Add file extensions

```json
"languages": [
  {
    "id": "clean",
    "extensions": [
      ".cln",
      ".test.cln",
      ".html"
    ],
    "aliases": [
      "Clean Language",
      "clean"
    ],
    "configuration": "./language-configuration.json"
  }
]
```

### Add framework keywords to search

```json
"keywords": [
  "clean",
  "clean-language",
  "webassembly",
  "wasm",
  "frame-framework",
  "full-stack",
  "orm",
  "ui-components"
]
```

---

## 2. Update syntaxes/clean.tmLanguage.json

### Add plugin block patterns

```json
{
  "name": "keyword.block.plugin.clean",
  "match": "\\b(plugins|import)\\b(?=:)"
},
{
  "name": "meta.plugin-declaration.clean",
  "begin": "^(plugins)\\s*:",
  "end": "^(?=\\S)",
  "beginCaptures": {
    "1": { "name": "keyword.block.plugin.clean" }
  },
  "patterns": [
    {
      "name": "entity.name.plugin.clean",
      "match": "^\\s+(frame\\.[a-zA-Z]+)"
    }
  ]
},
{
  "name": "meta.import-declaration.clean",
  "begin": "^(import)\\s*:",
  "end": "^(?=\\S)",
  "beginCaptures": {
    "1": { "name": "keyword.block.import.clean" }
  },
  "patterns": [
    {
      "name": "string.quoted.double.import.clean",
      "match": "^\\s+\"[^\"]+\""
    }
  ]
}
```

### Add framework block keywords

```json
{
  "name": "keyword.block.framework.clean",
  "match": "\\b(data|endpoints|server|component|screen|page|styles|auth|protected|login|roles|canvasScene|draw|onFrame)\\b(?=:)"
}
```

### Add framework sub-block keywords

```json
{
  "name": "keyword.block.framework.sub.clean",
  "match": "\\b(where|order|limit|offset|include|guard|returns|cache|handle|state|props|render|handlers|computed|variables|global|session|jwt|init|update|assets)\\b(?=:)"
}
```

### Add HTTP methods

```json
{
  "name": "keyword.method.http.clean",
  "match": "\\b(GET|POST|PUT|PATCH|DELETE)\\b(?=\\s+/)"
}
```

### Add framework functions

```json
{
  "name": "support.function.framework.clean",
  "match": "\\b(json|html|redirect|notFound|error|rawHtml|escape|slot|hashPassword|verifyPassword|deltaTime|time|fps)\\b(?=\\()"
},
{
  "name": "support.class.framework.clean",
  "match": "\\b(Data|Auth|req|canvas|sprite|audio|input|collision|camera|ease|db)\\b(?=\\.)"
}
```

### Add HTML directive attributes (for .html files)

```json
{
  "name": "entity.other.attribute-name.directive.clean",
  "match": "\\b(if|else|each|bind|client|slot|show|validate)\\b(?==)"
}
```

---

## 3. Update snippets/clean.code-snippets

### Add framework snippets

```json
{
  "plugins_block": {
    "prefix": "plugins",
    "body": [
      "plugins:",
      "\tframe.$1",
      "$0"
    ],
    "description": "Plugins block declaration"
  },
  "import_block": {
    "prefix": "import",
    "body": [
      "import:",
      "\t\"$1\"",
      "$0"
    ],
    "description": "Import block declaration"
  },
  "data_model": {
    "prefix": "data",
    "body": [
      "data $1:",
      "\t$2: $3",
      "$0"
    ],
    "description": "Data model definition"
  },
  "endpoint_get": {
    "prefix": "get",
    "body": [
      "GET /$1:",
      "\treturn json({ $2 })"
    ],
    "description": "GET endpoint"
  },
  "endpoint_post": {
    "prefix": "post",
    "body": [
      "POST /$1:",
      "\t$2 = req.body()",
      "\treturn json({ $3 })"
    ],
    "description": "POST endpoint"
  },
  "endpoints_block": {
    "prefix": "endpoints",
    "body": [
      "endpoints:",
      "\tGET /$1:",
      "\t\treturn json({ $2 })",
      "$0"
    ],
    "description": "Endpoints block"
  },
  "component": {
    "prefix": "component",
    "body": [
      "component $1:",
      "\tstate:",
      "\t\t$2: $3",
      "",
      "\trender:",
      "\t\t$0"
    ],
    "description": "UI component"
  },
  "auth_block": {
    "prefix": "auth",
    "body": [
      "auth:",
      "\tsession:",
      "\t\tcookie = \"$1\"",
      "\t\ttimeoutMinutes = $2"
    ],
    "description": "Auth configuration"
  },
  "data_query": {
    "prefix": "find",
    "body": [
      "$1.find:",
      "\twhere:",
      "\t\t$2"
    ],
    "description": "Data model query"
  },
  "data_insert": {
    "prefix": "insert",
    "body": [
      "$1.insert:",
      "\t$2: $3"
    ],
    "description": "Data model insert"
  },
  "transaction": {
    "prefix": "transaction",
    "body": [
      "Data.tx:",
      "\t$0"
    ],
    "description": "Database transaction"
  },
  "guard_block": {
    "prefix": "guard",
    "body": [
      "guard:",
      "\trequire: $1"
    ],
    "description": "Endpoint guard"
  },
  "canvas_scene": {
    "prefix": "canvasScene",
    "body": [
      "canvasScene $1:",
      "\twidth: $2",
      "\theight: $3",
      "",
      "\tinit:",
      "\t\t$4",
      "",
      "\tupdate:",
      "\t\t$5",
      "",
      "\trender:",
      "\t\t$0"
    ],
    "description": "Canvas scene for games"
  },
  "styles_block": {
    "prefix": "styles",
    "body": [
      "styles $1:",
      "\tvariables:",
      "\t\tcolor-primary: \"$2\"",
      "",
      "\tglobal:",
      "\t\tbody:",
      "\t\t\t$0"
    ],
    "description": "Styles definition"
  }
}
```

---

## 4. Dynamic Plugin Loading (New Feature)

### Create src/services/plugin-loader.ts

The extension should dynamically load plugin definitions from plugin.toml files:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface PluginLanguage {
  blocks: string[];
  keywords: { name: string; description: string; context: string }[];
  types: { name: string; description: string }[];
  functions: { name: string; signature: string; description: string }[];
  completions: { trigger: string; insert: string }[];
}

export class PluginLoader {
  private plugins: Map<string, PluginLanguage> = new Map();
  private globalPluginsPath: string;

  constructor() {
    this.globalPluginsPath = path.join(
      process.env.HOME || '',
      '.clean',
      'plugins'
    );
  }

  async loadWorkspacePlugins(workspacePath: string): Promise<void> {
    // 1. Find app.cln in workspace
    const appCln = path.join(workspacePath, 'app.cln');
    if (!fs.existsSync(appCln)) return;

    // 2. Parse plugins: block
    const content = fs.readFileSync(appCln, 'utf8');
    const pluginNames = this.parsePluginsBlock(content);

    // 3. Load each plugin's language definition
    for (const name of pluginNames) {
      await this.loadPlugin(name, workspacePath);
    }
  }

  private parsePluginsBlock(content: string): string[] {
    const plugins: string[] = [];
    const match = content.match(/plugins:\s*\n((?:\s+\S+\s*\n?)+)/);
    if (match) {
      const lines = match[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.startsWith('frame.')) {
          plugins.push(trimmed);
        }
      }
    }
    return plugins;
  }

  private async loadPlugin(name: string, workspacePath: string): Promise<void> {
    // Check project-local first, then global
    const projectPath = path.join(workspacePath, 'plugins', name, 'plugin.toml');
    const globalPath = path.join(this.globalPluginsPath, name, 'plugin.toml');

    const tomlPath = fs.existsSync(projectPath) ? projectPath : globalPath;
    if (!fs.existsSync(tomlPath)) return;

    const tomlContent = fs.readFileSync(tomlPath, 'utf8');
    const language = this.parseLanguageSection(tomlContent);

    if (language) {
      this.plugins.set(name, language);
    }
  }

  private parseLanguageSection(toml: string): PluginLanguage | null {
    // Parse [language] section from TOML
    // ... implementation
  }

  getCompletionItems(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const [pluginName, language] of this.plugins) {
      // Add completions from plugin definitions
      for (const completion of language.completions) {
        const item = new vscode.CompletionItem(
          completion.trigger,
          vscode.CompletionItemKind.Snippet
        );
        item.insertText = new vscode.SnippetString(completion.insert);
        item.detail = `[${pluginName}]`;
        items.push(item);
      }

      // Add functions
      for (const func of language.functions) {
        const item = new vscode.CompletionItem(
          func.name,
          vscode.CompletionItemKind.Function
        );
        item.detail = func.signature;
        item.documentation = func.description;
        items.push(item);
      }
    }

    return items;
  }

  getHoverInfo(word: string): vscode.Hover | null {
    for (const [pluginName, language] of this.plugins) {
      // Check keywords
      const keyword = language.keywords.find(k => k.name === word);
      if (keyword) {
        return new vscode.Hover([
          `**${keyword.name}** (${keyword.context})`,
          keyword.description,
          `*Plugin: ${pluginName}*`
        ].join('\n\n'));
      }

      // Check functions
      const func = language.functions.find(f => f.name === word || f.name.endsWith('.' + word));
      if (func) {
        return new vscode.Hover([
          `**${func.name}**`,
          '```clean',
          func.signature,
          '```',
          func.description,
          `*Plugin: ${pluginName}*`
        ].join('\n\n'));
      }
    }
    return null;
  }
}
```

### Update extension.ts to use PluginLoader

```typescript
import { PluginLoader } from './services/plugin-loader';

let pluginLoader: PluginLoader;

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Initialize plugin loader
  pluginLoader = new PluginLoader();

  // Load plugins when workspace opens
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      pluginLoader.loadWorkspacePlugins(folder.uri.fsPath);
    }
  }

  // Watch for app.cln changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/app.cln');
  watcher.onDidChange(async (uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      await pluginLoader.loadWorkspacePlugins(workspaceFolder.uri.fsPath);
    }
  });
  context.subscriptions.push(watcher);

  // Register completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    'clean',
    {
      provideCompletionItems(document, position) {
        return pluginLoader.getCompletionItems();
      }
    }
  );
  context.subscriptions.push(completionProvider);

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    'clean',
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);
        return pluginLoader.getHoverInfo(word);
      }
    }
  );
  context.subscriptions.push(hoverProvider);
}
```

---

## 5. HTML.cln Language Support

For `.html` files, the extension should provide:

1. **HTML base syntax** - Standard HTML highlighting
2. **Clean interpolation** - `{{expression}}` and `{{{rawExpression}}}`
3. **Custom component tags** - `<registration-form>`, etc.
4. **Directive attributes** - `if`, `each`, `bind`, `client`, etc.

### Create syntaxes/clean-html.tmLanguage.json

This should extend HTML grammar with Clean Language patterns for interpolation and directives.

---

## 6. File Ownership Awareness

The extension should be aware of folder ownership:

| Folder | Plugin | Implicit Import |
|--------|--------|-----------------|
| `app/ui/**` | frame.ui | Yes |
| `app/backend/**` | frame.httpserver | Yes |
| `app/data/**` | frame.data | Yes |
| `app/config/**` | frame.auth | Yes |
| `app/canvas/**` | frame.canvas | Yes |

Files in these folders should show the correct plugin context in the status bar and provide appropriate completions without requiring `plugins:` block.

---

## 7. Summary of Required Changes

### Files to Update

1. **package.json**
   - Add `.html` extension
   - Update keywords

2. **syntaxes/clean.tmLanguage.json**
   - Add `plugins:` and `import:` blocks
   - Add framework block keywords (`data`, `endpoints`, `component`, etc.)
   - Add sub-block keywords (`where`, `order`, `guard`, etc.)
   - Add HTTP method keywords (`GET`, `POST`, etc.)
   - Add framework functions and classes

3. **snippets/clean.code-snippets**
   - Add 15+ new framework snippets

### Files to Create

1. **src/services/plugin-loader.ts** - Dynamic plugin definition loading
2. **syntaxes/clean-html.tmLanguage.json** - HTML+Clean hybrid syntax

### Version Bump

Current: `1.3.1`
Recommended: `2.0.0` (major update due to framework support)

---

---

## 8. CLI Integration

The extension should provide IDE integration for `cln` (compiler) and `cleen` (package manager) commands.

### CLI Commands Reference

| Command | Description | IDE Integration |
|---------|-------------|-----------------|
| `cleen project create <name>` | Create new project | Command + wizard |
| `cleen plugin install <name>` | Install plugin | Command + quick pick |
| `cleen plugin list` | List installed plugins | Status bar / panel |
| `cln compile app.cln -o app.wasm --plugins` | Compile project | Build task |
| `cln compile --watch` | Watch mode | Task |
| `./host-bridge run app.wasm` | Run dev server | Task + status bar |

### Update package.json - Add Commands

```json
"commands": [
  // Existing commands...

  // Project commands
  {
    "command": "clean.newProject",
    "title": "$(new-folder) New Clean Project",
    "category": "Clean Language"
  },
  {
    "command": "clean.addPlugin",
    "title": "$(package) Add Plugin",
    "category": "Clean Language"
  },
  {
    "command": "clean.removePlugin",
    "title": "$(trash) Remove Plugin",
    "category": "Clean Language"
  },
  {
    "command": "clean.listPlugins",
    "title": "$(list-tree) List Plugins",
    "category": "Clean Language"
  },

  // Build commands
  {
    "command": "clean.build",
    "title": "$(gear) Build Project",
    "category": "Clean Language",
    "icon": "$(gear)"
  },
  {
    "command": "clean.buildWatch",
    "title": "$(eye) Build (Watch Mode)",
    "category": "Clean Language"
  },
  {
    "command": "clean.buildProduction",
    "title": "$(rocket) Build for Production",
    "category": "Clean Language"
  },

  // Server commands
  {
    "command": "clean.serve",
    "title": "$(server) Start Dev Server",
    "category": "Clean Language",
    "icon": "$(server)"
  },
  {
    "command": "clean.stopServer",
    "title": "$(debug-stop) Stop Dev Server",
    "category": "Clean Language"
  },
  {
    "command": "clean.restartServer",
    "title": "$(debug-restart) Restart Dev Server",
    "category": "Clean Language"
  },

  // Database commands (for frame.data plugin)
  {
    "command": "clean.dbMigrate",
    "title": "$(database) Run Migrations",
    "category": "Clean Language"
  },
  {
    "command": "clean.dbSeed",
    "title": "$(database) Seed Database",
    "category": "Clean Language"
  },
  {
    "command": "clean.dbReset",
    "title": "$(warning) Reset Database",
    "category": "Clean Language"
  },

  // Generate commands
  {
    "command": "clean.generateModel",
    "title": "$(symbol-class) Generate Model",
    "category": "Clean Language"
  },
  {
    "command": "clean.generateEndpoint",
    "title": "$(symbol-method) Generate Endpoint",
    "category": "Clean Language"
  },
  {
    "command": "clean.generateComponent",
    "title": "$(symbol-interface) Generate Component",
    "category": "Clean Language"
  }
],
"menus": {
  "editor/title": [
    {
      "when": "resourceExtname == .cln || resourceExtname == .html",
      "command": "clean.build",
      "group": "navigation@1"
    },
    {
      "when": "resourceExtname == .cln || resourceExtname == .html",
      "command": "clean.serve",
      "group": "navigation@2"
    }
  ]
}
```

### Create src/services/cli-integration.ts

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';

export class CliIntegration {
  private terminal: vscode.Terminal | undefined;
  private serverProcess: ChildProcess | undefined;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Clean Language');
  }

  // ===== PROJECT COMMANDS =====

  async createProject(): Promise<void> {
    // Step 1: Get project name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Enter project name',
      placeHolder: 'my-app',
      validateInput: (value) => {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return null;
      }
    });
    if (!projectName) return;

    // Step 2: Select plugins
    const availablePlugins = [
      { label: 'frame.ui', description: 'UI components, pages, SSR', picked: true },
      { label: 'frame.httpserver', description: 'HTTP endpoints, API routes', picked: true },
      { label: 'frame.data', description: 'ORM, database models', picked: true },
      { label: 'frame.auth', description: 'Authentication, authorization', picked: true },
      { label: 'frame.canvas', description: 'Canvas rendering, games', picked: false },
    ];

    const selectedPlugins = await vscode.window.showQuickPick(availablePlugins, {
      canPickMany: true,
      placeHolder: 'Select plugins to include'
    });
    if (!selectedPlugins) return;

    // Step 3: Select location
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select parent folder'
    });
    if (!folders || folders.length === 0) return;

    const parentPath = folders[0].fsPath;
    const projectPath = path.join(parentPath, projectName);

    // Step 4: Run cleen command
    const plugins = selectedPlugins.map(p => p.label).join(',');
    const command = `cleen project create ${projectName} --plugins=${plugins}`;

    await this.runInTerminal(command, parentPath);

    // Step 5: Open project
    const openChoice = await vscode.window.showInformationMessage(
      `Project '${projectName}' created successfully!`,
      'Open in New Window',
      'Open in Current Window'
    );

    if (openChoice === 'Open in New Window') {
      vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), true);
    } else if (openChoice === 'Open in Current Window') {
      vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false);
    }
  }

  async addPlugin(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    // Get available plugins (could fetch from registry)
    const availablePlugins = [
      { label: 'frame.ui', description: 'UI components, pages, SSR' },
      { label: 'frame.httpserver', description: 'HTTP endpoints, API routes' },
      { label: 'frame.data', description: 'ORM, database models' },
      { label: 'frame.auth', description: 'Authentication, authorization' },
      { label: 'frame.canvas', description: 'Canvas rendering, games' },
    ];

    const selected = await vscode.window.showQuickPick(availablePlugins, {
      placeHolder: 'Select plugin to add'
    });
    if (!selected) return;

    await this.runInTerminal(`cleen plugin add ${selected.label}`, workspaceFolder);
  }

  async listPlugins(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    await this.runCommand('cleen plugin list', workspaceFolder, (stdout) => {
      this.outputChannel.clear();
      this.outputChannel.appendLine('Installed Plugins:');
      this.outputChannel.appendLine('==================');
      this.outputChannel.appendLine(stdout);
      this.outputChannel.show();
    });
  }

  // ===== BUILD COMMANDS =====

  async build(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building Clean Project...',
      cancellable: false
    }, async () => {
      await this.runCommand(
        'cln compile app.cln -o app.wasm --plugins',
        workspaceFolder,
        (stdout) => {
          vscode.window.showInformationMessage('Build successful!');
        },
        (stderr) => {
          this.outputChannel.clear();
          this.outputChannel.appendLine('Build Errors:');
          this.outputChannel.appendLine(stderr);
          this.outputChannel.show();
          vscode.window.showErrorMessage('Build failed. Check output for details.');
        }
      );
    });
  }

  async buildWatch(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    await this.runInTerminal('cln compile app.cln -o app.wasm --plugins --watch', workspaceFolder);
  }

  async buildProduction(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building for production...',
      cancellable: false
    }, async () => {
      await this.runCommand(
        'cln compile app.cln -o app.wasm --plugins -O3',
        workspaceFolder,
        () => vscode.window.showInformationMessage('Production build complete!')
      );
    });
  }

  // ===== SERVER COMMANDS =====

  async serve(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    // Check if app.wasm exists, build if not
    const wasmPath = path.join(workspaceFolder, 'app.wasm');
    if (!fs.existsSync(wasmPath)) {
      const choice = await vscode.window.showWarningMessage(
        'app.wasm not found. Build first?',
        'Build & Serve',
        'Cancel'
      );
      if (choice === 'Build & Serve') {
        await this.build();
      } else {
        return;
      }
    }

    // Start server
    await this.runInTerminal('./host-bridge run app.wasm', workspaceFolder);

    // Update status bar
    vscode.commands.executeCommand('setContext', 'clean.serverRunning', true);

    // Show notification with open browser option
    const openBrowser = await vscode.window.showInformationMessage(
      'Dev server started on http://localhost:3000',
      'Open in Browser'
    );
    if (openBrowser) {
      vscode.env.openExternal(vscode.Uri.parse('http://localhost:3000'));
    }
  }

  async stopServer(): Promise<void> {
    if (this.terminal) {
      this.terminal.sendText('\x03'); // Ctrl+C
      vscode.commands.executeCommand('setContext', 'clean.serverRunning', false);
    }
  }

  async restartServer(): Promise<void> {
    await this.stopServer();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.serve();
  }

  // ===== DATABASE COMMANDS =====

  async dbMigrate(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    // Database commands run through the host-bridge at runtime
    // For now, we trigger a special endpoint or command
    await this.runInTerminal('./host-bridge migrate', workspaceFolder);
  }

  async dbSeed(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    await this.runInTerminal('./host-bridge seed', workspaceFolder);
  }

  async dbReset(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    const confirm = await vscode.window.showWarningMessage(
      'This will drop all tables and re-run migrations. Are you sure?',
      'Yes, Reset',
      'Cancel'
    );
    if (confirm === 'Yes, Reset') {
      await this.runInTerminal('./host-bridge db:reset', workspaceFolder);
    }
  }

  // ===== GENERATE COMMANDS =====

  async generateModel(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    const modelName = await vscode.window.showInputBox({
      prompt: 'Enter model name',
      placeHolder: 'User',
      validateInput: (v) => /^[A-Z][a-zA-Z0-9]*$/.test(v) ? null : 'Use PascalCase'
    });
    if (!modelName) return;

    // Create model file
    const modelPath = path.join(workspaceFolder, 'app', 'data', 'models', `${modelName}.cln`);
    const modelContent = `// ${modelName} Model
// Generated by Clean Language extension

data ${modelName}:
\tinteger id: pk, auto
\t// Add fields here
\tstring createdAt: default="now()"
\tstring updatedAt: default="now()"
`;

    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    fs.writeFileSync(modelPath, modelContent);

    // Open the file
    const doc = await vscode.workspace.openTextDocument(modelPath);
    await vscode.window.showTextDocument(doc);
  }

  async generateEndpoint(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    const endpointName = await vscode.window.showInputBox({
      prompt: 'Enter endpoint name (e.g., users, products)',
      placeHolder: 'users',
      validateInput: (v) => /^[a-z][a-z0-9-]*$/.test(v) ? null : 'Use lowercase with hyphens'
    });
    if (!endpointName) return;

    // Select HTTP methods
    const methods = await vscode.window.showQuickPick(
      ['GET (list)', 'GET (single)', 'POST', 'PUT', 'DELETE'],
      { canPickMany: true, placeHolder: 'Select HTTP methods' }
    );
    if (!methods || methods.length === 0) return;

    // Generate endpoint file
    const endpointPath = path.join(workspaceFolder, 'app', 'backend', 'api', `${endpointName}.cln`);
    let content = `// ${endpointName} API Endpoints
// Generated by Clean Language extension

endpoints:\n`;

    for (const method of methods) {
      if (method.includes('list')) {
        content += `\tGET /${endpointName}:\n\t\treturn json({ "${endpointName}": [] })\n\n`;
      } else if (method.includes('single')) {
        content += `\tGET /${endpointName}/:id:\n\t\tid = req.param("id")\n\t\treturn json({ "id": id })\n\n`;
      } else if (method === 'POST') {
        content += `\tPOST /${endpointName}:\n\t\tbody = req.body()\n\t\treturn json({ "created": true })\n\n`;
      } else if (method === 'PUT') {
        content += `\tPUT /${endpointName}/:id:\n\t\tid = req.param("id")\n\t\tbody = req.body()\n\t\treturn json({ "updated": true })\n\n`;
      } else if (method === 'DELETE') {
        content += `\tDELETE /${endpointName}/:id:\n\t\tid = req.param("id")\n\t\treturn json({ "deleted": true })\n\n`;
      }
    }

    fs.mkdirSync(path.dirname(endpointPath), { recursive: true });
    fs.writeFileSync(endpointPath, content);

    const doc = await vscode.workspace.openTextDocument(endpointPath);
    await vscode.window.showTextDocument(doc);
  }

  async generateComponent(): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) return;

    const componentName = await vscode.window.showInputBox({
      prompt: 'Enter component name',
      placeHolder: 'UserCard',
      validateInput: (v) => /^[A-Z][a-zA-Z0-9]*$/.test(v) ? null : 'Use PascalCase'
    });
    if (!componentName) return;

    const componentPath = path.join(workspaceFolder, 'app', 'ui', 'components', `${componentName}.cln`);
    const tagName = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1); // UserCard -> user-card

    const content = `// ${componentName} Component
// Generated by Clean Language extension

component ${componentName}:
\tprops:
\t\t// Define props here

\tstate:
\t\t// Define state here

\trender:
\t\t<div class="${tagName}">
\t\t\t<p>Hello from ${componentName}!</p>
\t\t</div>

\thandlers:
\t\t// Define event handlers here
`;

    fs.mkdirSync(path.dirname(componentPath), { recursive: true });
    fs.writeFileSync(componentPath, content);

    const doc = await vscode.workspace.openTextDocument(componentPath);
    await vscode.window.showTextDocument(doc);
  }

  // ===== HELPERS =====

  private getWorkspaceFolder(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return undefined;
    }
    return folders[0].uri.fsPath;
  }

  private async runInTerminal(command: string, cwd: string): Promise<void> {
    if (!this.terminal || this.terminal.exitStatus !== undefined) {
      this.terminal = vscode.window.createTerminal({
        name: 'Clean Language',
        cwd
      });
    }
    this.terminal.show();
    this.terminal.sendText(command);
  }

  private runCommand(
    command: string,
    cwd: string,
    onSuccess?: (stdout: string) => void,
    onError?: (stderr: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          if (onError) onError(stderr || error.message);
          reject(error);
        } else {
          if (onSuccess) onSuccess(stdout);
          resolve();
        }
      });
    });
  }

  dispose(): void {
    if (this.terminal) {
      this.terminal.dispose();
    }
    this.outputChannel.dispose();
  }
}
```

### Update extension.ts - Register CLI Commands

```typescript
import { CliIntegration } from './services/cli-integration';

let cliIntegration: CliIntegration;

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Initialize CLI integration
  cliIntegration = new CliIntegration();

  // Project commands
  context.subscriptions.push(
    vscode.commands.registerCommand('clean.newProject', () => cliIntegration.createProject()),
    vscode.commands.registerCommand('clean.addPlugin', () => cliIntegration.addPlugin()),
    vscode.commands.registerCommand('clean.removePlugin', () => cliIntegration.removePlugin()),
    vscode.commands.registerCommand('clean.listPlugins', () => cliIntegration.listPlugins())
  );

  // Build commands
  context.subscriptions.push(
    vscode.commands.registerCommand('clean.build', () => cliIntegration.build()),
    vscode.commands.registerCommand('clean.buildWatch', () => cliIntegration.buildWatch()),
    vscode.commands.registerCommand('clean.buildProduction', () => cliIntegration.buildProduction())
  );

  // Server commands
  context.subscriptions.push(
    vscode.commands.registerCommand('clean.serve', () => cliIntegration.serve()),
    vscode.commands.registerCommand('clean.stopServer', () => cliIntegration.stopServer()),
    vscode.commands.registerCommand('clean.restartServer', () => cliIntegration.restartServer())
  );

  // Database commands
  context.subscriptions.push(
    vscode.commands.registerCommand('clean.dbMigrate', () => cliIntegration.dbMigrate()),
    vscode.commands.registerCommand('clean.dbSeed', () => cliIntegration.dbSeed()),
    vscode.commands.registerCommand('clean.dbReset', () => cliIntegration.dbReset())
  );

  // Generate commands
  context.subscriptions.push(
    vscode.commands.registerCommand('clean.generateModel', () => cliIntegration.generateModel()),
    vscode.commands.registerCommand('clean.generateEndpoint', () => cliIntegration.generateEndpoint()),
    vscode.commands.registerCommand('clean.generateComponent', () => cliIntegration.generateComponent())
  );

  // Cleanup on deactivation
  context.subscriptions.push(cliIntegration);
}
```

### Add Tasks Configuration

Create default tasks.json template for Clean projects:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Clean: Build",
      "type": "shell",
      "command": "cln compile app.cln -o app.wasm --plugins",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": {
        "owner": "clean",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "pattern": {
          "regexp": "^(.*):(\\d+):(\\d+):\\s+(error|warning):\\s+(.*)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "message": 5
        }
      }
    },
    {
      "label": "Clean: Watch",
      "type": "shell",
      "command": "cln compile app.cln -o app.wasm --plugins --watch",
      "isBackground": true,
      "problemMatcher": {
        "owner": "clean",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "pattern": {
          "regexp": "^(.*):(\\d+):(\\d+):\\s+(error|warning):\\s+(.*)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "message": 5
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Watching for changes",
          "endsPattern": "Compilation complete"
        }
      }
    },
    {
      "label": "Clean: Serve",
      "type": "shell",
      "command": "./host-bridge run app.wasm",
      "isBackground": true,
      "dependsOn": "Clean: Build"
    },
    {
      "label": "Clean: Production Build",
      "type": "shell",
      "command": "cln compile app.cln -o app.wasm --plugins -O3",
      "group": "build"
    }
  ]
}
```

### Status Bar Integration

Update the status bar to show server status and quick actions:

```typescript
// In statusbar.ts
export class CleanStatusBar {
  private serverStatusItem: vscode.StatusBarItem;
  private buildStatusItem: vscode.StatusBarItem;

  constructor() {
    // Server status (running/stopped)
    this.serverStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.serverStatusItem.command = 'clean.serve';
    this.updateServerStatus(false);

    // Build status
    this.buildStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.buildStatusItem.text = '$(gear) Build';
    this.buildStatusItem.command = 'clean.build';
    this.buildStatusItem.tooltip = 'Build Clean project';
  }

  updateServerStatus(running: boolean): void {
    if (running) {
      this.serverStatusItem.text = '$(debug-stop) Server Running';
      this.serverStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.serverStatusItem.command = 'clean.stopServer';
      this.serverStatusItem.tooltip = 'Click to stop dev server';
    } else {
      this.serverStatusItem.text = '$(play) Start Server';
      this.serverStatusItem.backgroundColor = undefined;
      this.serverStatusItem.command = 'clean.serve';
      this.serverStatusItem.tooltip = 'Click to start dev server';
    }
  }

  show(): void {
    this.serverStatusItem.show();
    this.buildStatusItem.show();
  }

  hide(): void {
    this.serverStatusItem.hide();
    this.buildStatusItem.hide();
  }
}
```

---

## 9. Keyboard Shortcuts

Add default keyboard shortcuts in package.json:

```json
"keybindings": [
  {
    "command": "clean.build",
    "key": "ctrl+shift+b",
    "mac": "cmd+shift+b",
    "when": "resourceLangId == clean"
  },
  {
    "command": "clean.serve",
    "key": "ctrl+shift+s",
    "mac": "cmd+shift+s",
    "when": "resourceLangId == clean"
  },
  {
    "command": "clean.runFile",
    "key": "f5",
    "when": "resourceLangId == clean"
  },
  {
    "command": "clean.generateModel",
    "key": "ctrl+alt+m",
    "mac": "cmd+alt+m",
    "when": "resourceLangId == clean"
  },
  {
    "command": "clean.generateEndpoint",
    "key": "ctrl+alt+e",
    "mac": "cmd+alt+e",
    "when": "resourceLangId == clean"
  },
  {
    "command": "clean.generateComponent",
    "key": "ctrl+alt+c",
    "mac": "cmd+alt+c",
    "when": "resourceLangId == clean"
  }
]
```

---

## Testing Checklist

After updates, verify:

- [ ] `.cln` files highlight correctly
- [ ] `.html` files highlight HTML + Clean interpolation
- [ ] `plugins:` block highlights plugin names
- [ ] `import:` block highlights file paths as strings
- [ ] Framework blocks (`data:`, `endpoints:`, etc.) highlight correctly
- [ ] HTTP methods (`GET`, `POST`) highlight in endpoints
- [ ] Sub-blocks (`where:`, `guard:`) highlight correctly
- [ ] Framework functions (`json()`, `redirect()`) highlight correctly
- [ ] Snippets work for all new constructs
- [ ] Dynamic completions load from plugin.toml files
- [ ] Hover shows plugin-provided documentation
- [ ] Status bar shows current plugin context

### CLI Integration Tests

- [ ] `New Project` wizard creates project with selected plugins
- [ ] `Add Plugin` installs plugin and updates folders
- [ ] `Build` compiles project and shows errors
- [ ] `Build (Watch)` starts file watcher
- [ ] `Start Server` runs host-bridge and opens browser
- [ ] `Stop Server` terminates the process
- [ ] Database commands work (migrate, seed, reset)
- [ ] Generate commands create correct files with templates
- [ ] Status bar shows server status
- [ ] Keyboard shortcuts work
- [ ] Tasks integrate with VS Code task system
