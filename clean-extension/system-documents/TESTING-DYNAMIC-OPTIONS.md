# Testing Dynamic Compile Options

This document provides steps to test the dynamic compile options feature in the Clean Language Extension.

## Setup Verification

### 1. Verify Compiler Options JSON Exists

```bash
# Check if compile-options.json exists in active version
cat ~/.cleen/config.json | grep active_version
cat ~/.cleen/versions/0.8.5/compile-options.json | head -20
```

**Expected**: JSON file exists with compiler version 0.8.5

### 2. Verify Extension is Packaged

```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"
ls -lh clean-language-1.2.3.vsix
```

**Expected**: Package file exists (~722 KB)

## Testing in VS Code

### Method 1: Extension Development Host (Recommended)

1. **Open the extension project in VS Code**:
   ```bash
   cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"
   # Open in your editor (VS Code, Cursor, etc.)
   ```

2. **Launch Extension Development Host**:
   - Press `F5` or go to Run → Start Debugging
   - This opens a new window with the extension loaded

3. **Open a Clean Language file**:
   - In the Extension Development Host window, open `test_extension.cln`
   - Or open any `.cln` file

4. **Test Dynamic Compile Options**:
   - Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
   - Type: `Clean Language: Compile with Options`
   - **Observe the dropdowns**:
     - Step 1/4: Should show targets with emojis (🌐 Web, 🟢 Node.js, 💻 Native, 🔧 Embedded, 🌍 WASI, 🤖 Auto)
     - Step 2/4: Should show optimizations (🔧 Development, 🚀 Production, 📦 Size, ⚡ Speed, 🐛 Debug)
     - Step 3/4: Should show runtimes (🤖 Auto, ⚡ Wasmtime, 🦀 Wasmer)
     - Step 4/4: Should show presets (📋 Standard, 🐛 Debug, 💬 Verbose, 🐛💬 Debug + Verbose)

5. **Check Console Output**:
   - In the Extension Development Host, open Developer Tools (Help → Toggle Developer Tools)
   - Check Console for log messages:
     ```
     Loaded compile options from: /Users/earcandy/.cleen/versions/0.8.5/compile-options.json
     Compiler version: 0.8.5
     ```

### Method 2: Install Packaged Extension

1. **Install the extension**:
   ```bash
   # For VS Code
   code --install-extension clean-language-1.2.3.vsix

   # For Cursor
   cursor --install-extension clean-language-1.2.3.vsix
   ```

2. **Reload VS Code/Cursor**

3. **Test as described in Method 1, steps 3-5**

## Verification Checklist

- [ ] Extension activates when opening a `.cln` file
- [ ] "Clean Language: Compile with Options" command is available
- [ ] Step 1 dropdown shows targets from JSON (with emojis)
- [ ] Step 2 dropdown shows optimizations from JSON
- [ ] Step 3 dropdown shows runtimes from JSON
- [ ] Step 4 dropdown shows presets from JSON
- [ ] Console shows: `Loaded compile options from: ~/.cleen/versions/0.8.5/compile-options.json`
- [ ] Console shows: `Compiler version: 0.8.5`

## Testing the Refresh Command

1. **Open Command Palette**
2. **Run**: `Clean Language: Refresh Compile Options`
3. **Expected**: Message "Compile options refreshed successfully"
4. **Run compile with options again** to verify it still works

## Testing Fallback Behavior

### Test 1: Missing JSON File

```bash
# Temporarily rename the JSON
mv ~/.cleen/versions/0.8.5/compile-options.json ~/.cleen/versions/0.8.5/compile-options.json.backup
```

**Run**: "Compile with Options" command
**Expected**: Falls back to hardcoded defaults, shows message "Using fallback default compile options"

```bash
# Restore the JSON
mv ~/.cleen/versions/0.8.5/compile-options.json.backup ~/.cleen/versions/0.8.5/compile-options.json
```

### Test 2: Multiple Versions

```bash
# If you have multiple compiler versions installed
ls ~/.cleen/versions/
```

**Expected**: Extension should find the active version from `~/.cleen/config.json`

## Testing Different Compiler Versions

If you install a new compiler version:

```bash
# Install new version (example)
cleen install latest

# Verify it includes compile-options.json
ls ~/.cleen/versions/*/compile-options.json

# Switch to new version
cleen use 0.9.0  # Replace with actual version

# Test extension again
# Should load options from the NEW active version
```

## Troubleshooting

### Extension doesn't show dynamic options

1. **Check console logs** in Developer Tools
2. **Verify JSON exists**:
   ```bash
   cat ~/.cleen/config.json | grep active_version
   ls -la ~/.cleen/versions/$(cat ~/.cleen/config.json | grep active_version | cut -d'"' -f4)/compile-options.json
   ```

3. **Check extension output channel**:
   - View → Output
   - Select "Clean Language" from dropdown

### Options show as hardcoded defaults

**Possible causes**:
- `compile-options.json` not found in version directory
- JSON is malformed
- Extension hasn't been reloaded after JSON was added

**Solutions**:
1. Verify JSON exists and is valid
2. Run "Reload Window" command
3. Check console for error messages

## Expected Behavior Summary

When everything is working correctly:

1. ✅ Extension loads `compile-options.json` from `~/.cleen/versions/{active_version}/`
2. ✅ Dropdowns show options with emoji labels from the JSON
3. ✅ Console shows which path was used to load options
4. ✅ Console shows compiler version from JSON
5. ✅ Compile command uses selected options correctly
6. ✅ Refresh command reloads options from compiler

## Success Criteria

The feature is working correctly if:

- [ ] Dropdown options match those in `~/.cleen/versions/0.8.5/compile-options.json`
- [ ] Emoji labels are displayed correctly
- [ ] Changing active compiler version changes available options
- [ ] Console logs confirm JSON was loaded from correct path
- [ ] Compile commands execute with selected options

---

**Last Updated**: October 5, 2025
**Extension Version**: 1.2.3
**Compiler Version**: 0.8.5
