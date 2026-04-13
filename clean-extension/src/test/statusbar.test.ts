/**
 * Status Bar Logic Tests
 * Tests server status mapping and display logic
 * Runs in Node.js without VS Code dependency
 */

import * as assert from 'assert';

// Server status values from cli-integration.ts
type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';

describe('Server status to display mapping', () => {
	// Replicate the status bar display logic without VS Code dependency
	function getStatusDisplay(status: ServerStatus): { text: string; icon: string; hasError: boolean } {
		switch (status) {
			case 'stopped':
				return { text: 'Server', icon: 'circle-outline', hasError: false };
			case 'starting':
				return { text: 'Starting...', icon: 'loading~spin', hasError: false };
			case 'running':
				return { text: 'Running', icon: 'circle-filled', hasError: false };
			case 'stopping':
				return { text: 'Stopping...', icon: 'loading~spin', hasError: false };
			case 'error':
				return { text: 'Error', icon: 'error', hasError: true };
			case 'crashed':
				return { text: 'Crashed', icon: 'error', hasError: true };
		}
	}

	it('should show outline icon for stopped', () => {
		const display = getStatusDisplay('stopped');
		assert.strictEqual(display.icon, 'circle-outline');
		assert.strictEqual(display.hasError, false);
	});

	it('should show spinner for starting', () => {
		const display = getStatusDisplay('starting');
		assert.strictEqual(display.icon, 'loading~spin');
		assert.strictEqual(display.text, 'Starting...');
	});

	it('should show filled icon for running', () => {
		const display = getStatusDisplay('running');
		assert.strictEqual(display.icon, 'circle-filled');
		assert.strictEqual(display.hasError, false);
	});

	it('should show error for error status', () => {
		const display = getStatusDisplay('error');
		assert.strictEqual(display.hasError, true);
		assert.strictEqual(display.icon, 'error');
	});

	it('should show error for crashed status', () => {
		const display = getStatusDisplay('crashed');
		assert.strictEqual(display.hasError, true);
	});

	it('should show spinner for stopping', () => {
		const display = getStatusDisplay('stopping');
		assert.strictEqual(display.icon, 'loading~spin');
	});
});

describe('Version display formatting', () => {
	function formatVersionDisplay(version: string | undefined, installed: boolean): string {
		if (!installed) {
			return '$(alert) Clean: Not Installed';
		}
		if (!version) {
			return '$(check) Clean Language';
		}
		return `$(check) Clean v${version}`;
	}

	it('should show not installed when cleen is missing', () => {
		const display = formatVersionDisplay(undefined, false);
		assert.ok(display.includes('Not Installed'));
	});

	it('should show version when available', () => {
		const display = formatVersionDisplay('0.30.22', true);
		assert.strictEqual(display, '$(check) Clean v0.30.22');
	});

	it('should show generic label when version unknown', () => {
		const display = formatVersionDisplay(undefined, true);
		assert.strictEqual(display, '$(check) Clean Language');
	});
});
