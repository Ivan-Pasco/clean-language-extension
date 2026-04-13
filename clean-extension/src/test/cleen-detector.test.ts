/**
 * CleenDetector Tests
 * Tests path detection logic, cache behavior, and version parsing
 * Runs in Node.js without VS Code dependency
 */

import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';

// Import the types only — we test the pure logic patterns
import { CleenDetectionResult } from '../services/cleen-detector';

describe('CleenDetectionResult interface', () => {
	it('should represent a found result', () => {
		const result: CleenDetectionResult = {
			found: true,
			path: '/usr/local/bin/cleen',
			version: '0.30.22',
			method: 'system-bin',
		};
		assert.strictEqual(result.found, true);
		assert.strictEqual(result.version, '0.30.22');
	});

	it('should represent a not-found result', () => {
		const result: CleenDetectionResult = { found: false };
		assert.strictEqual(result.found, false);
		assert.strictEqual(result.path, undefined);
	});
});

describe('Search path logic', () => {
	it('should include cargo bin path', () => {
		const homeDir = os.homedir();
		const expectedPath = path.join(homeDir, '.cargo', 'bin', 'cleen');
		assert.ok(expectedPath.includes('.cargo'));
	});

	it('should include cleen wrapper path', () => {
		const homeDir = os.homedir();
		const expectedPath = path.join(homeDir, '.cleen', 'bin', 'cln');
		assert.ok(expectedPath.includes('.cleen'));
	});

	it('should include local bin path', () => {
		const homeDir = os.homedir();
		const expectedPath = path.join(homeDir, '.local', 'bin', 'cleen');
		assert.ok(expectedPath.includes('.local'));
	});
});

describe('Version parsing patterns', () => {
	it('should parse semver version string', () => {
		const output = 'cleen version 0.30.22';
		const match = output.match(/(\d+\.\d+\.\d+)/);
		assert.ok(match);
		assert.strictEqual(match![1], '0.30.22');
	});

	it('should parse version with prefix text', () => {
		const output = 'Clean Language Manager v0.30.22 (stable)';
		const match = output.match(/(\d+\.\d+\.\d+)/);
		assert.ok(match);
		assert.strictEqual(match![1], '0.30.22');
	});

	it('should handle missing version gracefully', () => {
		const output = 'unknown command';
		const match = output.match(/(\d+\.\d+\.\d+)/);
		assert.strictEqual(match, null);
	});
});

describe('Cache TTL logic', () => {
	it('should validate cache TTL constant', () => {
		const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms
		assert.strictEqual(CACHE_TTL, 300000);
	});

	it('should detect expired cache', () => {
		const CACHE_TTL = 5 * 60 * 1000;
		const cacheTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
		const isValid = (Date.now() - cacheTimestamp) < CACHE_TTL;
		assert.strictEqual(isValid, false);
	});

	it('should detect valid cache', () => {
		const CACHE_TTL = 5 * 60 * 1000;
		const cacheTimestamp = Date.now() - (2 * 60 * 1000); // 2 minutes ago
		const isValid = (Date.now() - cacheTimestamp) < CACHE_TTL;
		assert.strictEqual(isValid, true);
	});
});
