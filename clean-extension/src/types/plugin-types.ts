/**
 * Clean Language Plugin Types
 * Created by Ivan Pasco
 *
 * Type definitions for Frame Framework plugin architecture.
 * Defines interfaces for plugin manifests, language definitions, and completions.
 */

/**
 * Function signature definition from a plugin
 */
export interface PluginFunction {
    name: string;
    signature: string;
    description: string;
    parameters?: PluginParameter[];
    returnType?: string;
    example?: string;
}

/**
 * Function parameter definition
 */
export interface PluginParameter {
    name: string;
    type: string;
    description?: string;
    optional?: boolean;
    defaultValue?: string;
}

/**
 * Completion item definition from a plugin
 */
export interface PluginCompletion {
    label: string;
    kind: 'keyword' | 'function' | 'class' | 'property' | 'variable' | 'snippet';
    detail?: string;
    documentation?: string;
    insertText?: string;
    insertTextFormat?: 'plaintext' | 'snippet';
}

/**
 * Language definition section from plugin.toml [language]
 */
export interface PluginLanguageDefinition {
    /** Block-level keywords that start sections (e.g., "data", "endpoints") */
    blocks: string[];
    /** Keywords used within blocks (e.g., "where", "guard") */
    keywords: string[];
    /** Type names provided by the plugin (e.g., "Model", "Query") */
    types: string[];
    /** Functions provided by the plugin */
    functions: PluginFunction[];
    /** Additional completion items */
    completions: PluginCompletion[];
}

/**
 * Plugin manifest parsed from plugin.toml
 */
export interface PluginManifest {
    /** Unique plugin identifier */
    name: string;
    /** Semantic version string */
    version: string;
    /** Human-readable description */
    description: string;
    /** Plugin author */
    author: string;
    /** Plugin homepage URL */
    homepage?: string;
    /** Plugin repository URL */
    repository?: string;
    /** Minimum Clean Language version required */
    cleanVersion?: string;
    /** Plugin dependencies */
    dependencies?: Record<string, string>;
    /** Language definitions for IDE support */
    language?: PluginLanguageDefinition;
    /** Plugin-specific configuration schema */
    config?: PluginConfigSchema;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
    properties: Record<string, PluginConfigProperty>;
}

/**
 * Plugin configuration property definition
 */
export interface PluginConfigProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    default?: unknown;
    required?: boolean;
    enum?: unknown[];
}

/**
 * Loaded plugin with resolved paths and manifest
 */
export interface LoadedPlugin {
    /** Plugin name from manifest */
    name: string;
    /** Resolved path to plugin directory */
    path: string;
    /** Parsed plugin manifest */
    manifest: PluginManifest;
    /** Source of the plugin (project or global) */
    source: 'project' | 'global';
    /** Whether the plugin is currently active */
    active: boolean;
}

/**
 * Plugin loading result
 */
export interface PluginLoadResult {
    /** Successfully loaded plugins */
    plugins: LoadedPlugin[];
    /** Errors encountered during loading */
    errors: PluginLoadError[];
}

/**
 * Plugin loading error
 */
export interface PluginLoadError {
    /** Plugin name that failed to load */
    pluginName: string;
    /** Error message */
    message: string;
    /** Source path that was attempted */
    path?: string;
}

/**
 * Plugin watcher event
 */
export interface PluginWatcherEvent {
    type: 'added' | 'removed' | 'changed';
    pluginName: string;
    plugin?: LoadedPlugin;
}

/**
 * Plugin completion context
 */
export interface PluginCompletionContext {
    /** Current word being typed */
    word: string;
    /** Line content before cursor */
    linePrefix: string;
    /** Current block context (e.g., "endpoints", "data") */
    blockContext?: string;
    /** Current file path */
    filePath: string;
}

/**
 * Plugin hover context
 */
export interface PluginHoverContext {
    /** Word under cursor */
    word: string;
    /** Full line content */
    line: string;
    /** Position in line */
    position: number;
    /** Current block context */
    blockContext?: string;
}

/**
 * Plugin hover result
 */
export interface PluginHoverResult {
    /** Plugin that provided the hover */
    pluginName: string;
    /** Hover content in markdown format */
    contents: string;
}
