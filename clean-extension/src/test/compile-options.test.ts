/**
 * Compile Options Type Tests
 * Tests the CompileOption, CompilePreset, CompileOptionsSchema interfaces
 */

import * as assert from 'assert';
import { CompileOption, CompilePreset, CompileOptionsSchema, SelectedCompileOptions } from '../types/compile-options';

describe('CompileOption interface', () => {
	it('should accept valid compile option', () => {
		const option: CompileOption = {
			id: 'server',
			label: 'Server',
			description: 'Compile for server target',
			flag: '--target server',
			default: true,
			available: true,
		};
		assert.strictEqual(option.id, 'server');
		assert.strictEqual(option.default, true);
		assert.strictEqual(option.flag, '--target server');
	});

	it('should accept null flag for no-flag options', () => {
		const option: CompileOption = {
			id: 'none',
			label: 'None',
			description: 'No optimization',
			flag: null,
			default: false,
			available: true,
		};
		assert.strictEqual(option.flag, null);
	});

	it('should accept mutually_exclusive field', () => {
		const option: CompileOption = {
			id: 'debug',
			label: 'Debug',
			description: 'Debug mode',
			flag: '--debug',
			default: false,
			available: true,
			mutually_exclusive: ['release', 'production'],
		};
		assert.strictEqual(option.mutually_exclusive!.length, 2);
		assert.strictEqual(option.mutually_exclusive![0], 'release');
	});
});

describe('CompilePreset interface', () => {
	it('should accept valid preset', () => {
		const preset: CompilePreset = {
			id: 'development',
			label: 'Development',
			description: 'Development preset with debug flags',
			flags: ['--debug', '--verbose', '--target server'],
		};
		assert.strictEqual(preset.id, 'development');
		assert.strictEqual(preset.flags.length, 3);
	});
});

describe('CompileOptionsSchema interface', () => {
	it('should accept valid schema', () => {
		const schema: CompileOptionsSchema = {
			version: '1.0.0',
			compiler_version: '0.30.50',
			generated_at: '2026-04-13',
			targets: [],
			optimizations: [],
			runtimes: [],
			flags: [],
			presets: [],
		};
		assert.strictEqual(schema.version, '1.0.0');
		assert.strictEqual(schema.targets.length, 0);
	});
});

describe('SelectedCompileOptions interface', () => {
	it('should accept valid selections', () => {
		const selected: SelectedCompileOptions = {
			target: 'server',
			runtime: 'wasmtime',
			optimization: 'O2',
			debug: false,
			verbose: false,
		};
		assert.strictEqual(selected.target, 'server');
		assert.strictEqual(selected.debug, false);
	});
});
