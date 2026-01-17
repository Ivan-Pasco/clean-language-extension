/**
 * Compile Options Schema Types
 * Generated from Clean Language compiler options
 *
 * Author: Ivan Pasco
 */

export interface CompileOption {
    id: string;
    label: string;
    description: string;
    flag: string | null;
    default: boolean;
    available: boolean;
    mutually_exclusive?: string[];
}

export interface CompilePreset {
    id: string;
    label: string;
    description: string;
    flags: string[];
}

export interface CompileOptionsSchema {
    version: string;
    compiler_version: string;
    generated_at: string;
    targets: CompileOption[];
    optimizations: CompileOption[];
    runtimes: CompileOption[];
    flags: CompileOption[];
    presets: CompilePreset[];
}

export interface SelectedCompileOptions {
    target: string;
    runtime: string;
    optimization: string;
    debug: boolean;
    verbose: boolean;
}
