/**
 * Lightweight test runner for Clean Language extension
 * Uses Node's built-in assert module — no external test framework needed
 * Run with: node out/test/runTests.js
 */

interface TestResult {
	name: string;
	passed: boolean;
	error?: string;
}

const suites: Array<{ name: string; tests: Array<{ name: string; fn: () => void }> }> = [];
let currentSuite: { name: string; tests: Array<{ name: string; fn: () => void }> } | null = null;

// Mini test framework
(global as any).describe = (name: string, fn: () => void) => {
	currentSuite = { name, tests: [] };
	suites.push(currentSuite);
	fn();
	currentSuite = null;
};

(global as any).it = (name: string, fn: () => void) => {
	if (currentSuite) {
		currentSuite.tests.push({ name, fn });
	}
};

// Load test files
require('./compile-options.test');
require('./cleen-detector.test');
require('./statusbar.test');

// Run all tests
let totalPassed = 0;
let totalFailed = 0;
const results: TestResult[] = [];

console.log('\n  Clean Language Extension Tests\n');

for (const suite of suites) {
	console.log(`  ${suite.name}`);
	for (const test of suite.tests) {
		try {
			test.fn();
			console.log(`    \x1b[32m✓\x1b[0m ${test.name}`);
			totalPassed++;
			results.push({ name: `${suite.name} > ${test.name}`, passed: true });
		} catch (e: any) {
			console.log(`    \x1b[31m✗\x1b[0m ${test.name}`);
			console.log(`      ${e.message}`);
			totalFailed++;
			results.push({ name: `${suite.name} > ${test.name}`, passed: false, error: e.message });
		}
	}
	console.log('');
}

console.log(`  ${totalPassed} passing, ${totalFailed} failing\n`);

if (totalFailed > 0) {
	process.exit(1);
}
