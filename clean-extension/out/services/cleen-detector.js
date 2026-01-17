"use strict";
/**
 * Clean Language Manager (cleen) Path Detector
 * Created by Ivan Pasco
 *
 * This service automatically detects the cleen installation path across different
 * installation methods and platforms, eliminating the need for manual configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleenDetector = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CleenDetector {
    constructor() {
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Detect cleen installation path using multiple strategies
     */
    async detectCleenPath(configuredPath) {
        // Check cache first
        if (this.isCacheValid()) {
            return this.cachedResult;
        }
        // Strategy 1: Use configured path if provided
        if (configuredPath && configuredPath !== 'cleen') {
            const result = await this.tryPath(configuredPath, 'user-configured');
            if (result.found) {
                return this.cacheResult(result);
            }
        }
        // Strategy 2: Try common installation locations
        const searchPaths = this.getSearchPaths();
        for (const searchPath of searchPaths) {
            const result = await this.tryPath(searchPath.path, searchPath.method);
            if (result.found) {
                return this.cacheResult(result);
            }
        }
        // Strategy 3: Try 'which cleen' command
        const whichResult = await this.tryWhichCommand();
        if (whichResult.found) {
            return this.cacheResult(whichResult);
        }
        // Not found
        return this.cacheResult({ found: false });
    }
    /**
     * Get list of paths to search for cleen, ordered by likelihood
     */
    getSearchPaths() {
        const homeDir = os.homedir();
        const isWindows = process.platform === 'win32';
        const cleenBinary = isWindows ? 'cleen.exe' : 'cleen';
        const paths = [
            // Most common: cargo install
            { path: path.join(homeDir, '.cargo', 'bin', cleenBinary), method: 'cargo-bin' },
            // Local user installation
            { path: path.join(homeDir, '.local', 'bin', cleenBinary), method: 'local-bin' },
            // System-wide installation
            { path: path.join('/usr', 'local', 'bin', cleenBinary), method: 'system-bin' },
            // Managed wrapper (points to active version)
            { path: path.join(homeDir, '.cleen', 'bin', isWindows ? 'cln.exe' : 'cln'), method: 'cleen-wrapper' },
        ];
        // Windows-specific paths
        if (isWindows) {
            paths.push({ path: path.join('C:', 'Program Files', 'cleen', cleenBinary), method: 'windows-program-files' }, { path: path.join(homeDir, 'AppData', 'Local', 'Programs', 'cleen', cleenBinary), method: 'windows-appdata' });
        }
        return paths;
    }
    /**
     * Try a specific path to see if cleen exists and works
     */
    async tryPath(cleenPath, method) {
        try {
            // Check if file exists and is executable
            if (!fs.existsSync(cleenPath)) {
                return { found: false };
            }
            const stats = fs.statSync(cleenPath);
            if (!stats.isFile()) {
                return { found: false };
            }
            // Try to execute --version to verify it works
            try {
                const { stdout } = await execAsync(`"${cleenPath}" --version`, {
                    timeout: 5000
                });
                const version = this.parseVersion(stdout);
                return {
                    found: true,
                    path: cleenPath,
                    version,
                    method
                };
            }
            catch (execError) {
                // File exists but can't execute
                return { found: false };
            }
        }
        catch (error) {
            return { found: false };
        }
    }
    /**
     * Try to find cleen using 'which' command
     */
    async tryWhichCommand() {
        try {
            const whichCommand = process.platform === 'win32' ? 'where' : 'which';
            const { stdout } = await execAsync(`${whichCommand} cleen`, {
                timeout: 3000
            });
            const cleenPath = stdout.trim().split('\n')[0]; // Take first result
            if (cleenPath && fs.existsSync(cleenPath)) {
                // Verify it works
                try {
                    const { stdout: versionOutput } = await execAsync(`"${cleenPath}" --version`, {
                        timeout: 5000
                    });
                    const version = this.parseVersion(versionOutput);
                    return {
                        found: true,
                        path: cleenPath,
                        version,
                        method: 'which-command'
                    };
                }
                catch {
                    return { found: false };
                }
            }
            return { found: false };
        }
        catch (error) {
            return { found: false };
        }
    }
    /**
     * Parse version from cleen --version output
     */
    parseVersion(output) {
        // Output format: "cleen 0.2.1" or similar
        const match = output.match(/cleen\s+(\d+\.\d+\.\d+)/i);
        return match ? match[1] : output.trim();
    }
    /**
     * Check if cached result is still valid
     */
    isCacheValid() {
        if (!this.cachedResult || !this.cacheTimestamp) {
            return false;
        }
        const age = Date.now() - this.cacheTimestamp;
        return age < this.CACHE_TTL;
    }
    /**
     * Cache detection result
     */
    cacheResult(result) {
        this.cachedResult = result;
        this.cacheTimestamp = Date.now();
        return result;
    }
    /**
     * Invalidate cache (useful when user changes configuration)
     */
    invalidateCache() {
        this.cachedResult = undefined;
        this.cacheTimestamp = undefined;
    }
    /**
     * Get the active Clean Language version from cleen config
     */
    async getActiveVersion(cleenPath) {
        try {
            const homeDir = os.homedir();
            const configPath = path.join(homeDir, '.cleen', 'config.json');
            if (!fs.existsSync(configPath)) {
                // Fallback: try running 'cleen current'
                try {
                    const { stdout } = await execAsync(`"${cleenPath}" current`, {
                        timeout: 5000
                    });
                    return stdout.trim();
                }
                catch {
                    return undefined;
                }
            }
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            return config.active_version;
        }
        catch (error) {
            return undefined;
        }
    }
    /**
     * Run diagnostics to help troubleshoot installation issues
     */
    async runDiagnostics() {
        const homeDir = os.homedir();
        const isWindows = process.platform === 'win32';
        let report = '=== Clean Language Installation Diagnostics ===\n\n';
        // 1. Check PATH environment
        report += '1. PATH Environment:\n';
        const pathEnv = process.env.PATH || '';
        const pathParts = pathEnv.split(isWindows ? ';' : ':');
        const relevantPaths = pathParts.filter(p => p.includes('cargo') ||
            p.includes('cleen') ||
            p.includes('.local'));
        if (relevantPaths.length > 0) {
            report += `   Found relevant paths:\n`;
            relevantPaths.forEach(p => report += `   - ${p}\n`);
        }
        else {
            report += '   ⚠️  No Rust/cargo paths found in PATH\n';
        }
        report += '\n';
        // 2. Check common installation locations
        report += '2. Checking Common Locations:\n';
        const searchPaths = this.getSearchPaths();
        for (const searchPath of searchPaths) {
            const exists = fs.existsSync(searchPath.path);
            const status = exists ? '✓' : '✗';
            report += `   ${status} ${searchPath.method}: ${searchPath.path}\n`;
            if (exists) {
                const result = await this.tryPath(searchPath.path, searchPath.method);
                if (result.found && result.version) {
                    report += `      Version: ${result.version}\n`;
                }
            }
        }
        report += '\n';
        // 3. Check cleen config
        report += '3. Clean Manager Configuration:\n';
        const configPath = path.join(homeDir, '.cleen', 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configContent);
                report += `   ✓ Config found: ${configPath}\n`;
                report += `   Active version: ${config.active_version || 'none'}\n`;
                // Check if version directory exists
                const versionDir = path.join(homeDir, '.cleen', 'versions', config.active_version);
                if (fs.existsSync(versionDir)) {
                    report += `   ✓ Version directory exists: ${versionDir}\n`;
                }
                else {
                    report += `   ⚠️  Version directory not found: ${versionDir}\n`;
                }
            }
            catch (error) {
                report += `   ⚠️  Config found but couldn't parse: ${error}\n`;
            }
        }
        else {
            report += `   ✗ Config not found: ${configPath}\n`;
            report += '      Run "cleen init" if you have cleen installed\n';
        }
        report += '\n';
        // 4. Try detection
        report += '4. Auto-Detection Result:\n';
        const result = await this.detectCleenPath();
        if (result.found) {
            report += `   ✓ Found cleen at: ${result.path}\n`;
            report += `   Version: ${result.version}\n`;
            report += `   Detection method: ${result.method}\n`;
        }
        else {
            report += '   ✗ Could not auto-detect cleen installation\n';
        }
        report += '\n';
        // 5. Recommendations
        report += '5. Recommendations:\n';
        if (!result.found) {
            report += '   • Install cleen: cargo install cleen\n';
            report += '   • Or download from: https://github.com/Ivan-Pasco/clean-manager/releases\n';
            report += '   • Ensure ~/.cargo/bin is in your PATH\n';
            if (!isWindows) {
                report += '   • Add to ~/.zshrc or ~/.bash_profile: export PATH="$HOME/.cargo/bin:$PATH"\n';
            }
            report += '   • Restart VS Code/Cursor completely after installation\n';
            report += '   • Or launch editor from terminal: cursor / code\n';
        }
        else {
            report += '   ✓ Installation looks good!\n';
            report += '   If issues persist, try setting clean.manager.path manually in settings\n';
        }
        return report;
    }
}
exports.CleenDetector = CleenDetector;
//# sourceMappingURL=cleen-detector.js.map