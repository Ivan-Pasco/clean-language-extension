# Step-by-Step Publishing Guide for Ivan

## Hey Ivan! 👋

Your extension is **100% ready to publish**. I've prepared everything for you. Follow these steps:

---

## Step 1: Get Your Publishing Tokens 🔑

### For VS Code Marketplace

1. Go to: https://dev.azure.com/IvanPasco/_usersSettings/tokens
2. Click **"New Token"**
3. Name it: "Clean Language Extension v1.3.0"
4. Scope: Select **"Marketplace (Publish)"**
5. Click **"Create"**
6. **IMPORTANT**: Copy the token immediately (you can't see it again!)

### For Open VSX Registry (Cursor, etc.)

1. Go to: https://open-vsx.org/user-settings/tokens
2. Click **"New Access Token"**
3. Name it: "Clean Language Extension"
4. Click **"Create"**
5. **IMPORTANT**: Copy the token immediately

---

## Step 2: Open Terminal 💻

Open a terminal and navigate to the extension directory:

```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"
```

---

## Step 3: Set Your Tokens 🔐

Run these commands, replacing the placeholder text with your actual tokens:

```bash
export VSCE_PAT="paste-your-vscode-token-here"
export OVSX_PAT="paste-your-openvsx-token-here"
```

**Example** (with fake tokens):
```bash
export VSCE_PAT="abc123xyz789..."
export OVSX_PAT="def456uvw012..."
```

**Important**: These tokens are only saved for this terminal session. Don't close the terminal yet!

---

## Step 4: Publish to VS Code Marketplace 🚀

Run this command:

```bash
npx vsce publish -p $VSCE_PAT
```

**What you should see:**
```
Publishing IvanPasco.clean-language@1.3.0...
✓ Successfully published IvanPasco.clean-language@1.3.0!
Your extension will live at https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
```

**If it asks "Do you want to install vsce?"**, type **yes** and press Enter.

---

## Step 5: Publish to Open VSX Registry 🌐

Run this command:

```bash
npx ovsx publish -p $OVSX_PAT
```

**What you should see:**
```
Publishing IvanPasco.clean-language@1.3.0 to Open VSX Registry...
✅ Published IvanPasco.clean-language@1.3.0
```

**If it asks "Do you want to install ovsx?"**, type **yes** and press Enter.

---

## Step 6: Verify It Worked ✅

### Check VS Code Marketplace

1. Open: https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
2. You should see **version 1.3.0**
3. Check the README shows the new features
4. Check the Changelog shows the v1.3.0 entry

### Check Open VSX Registry

1. Open: https://open-vsx.org/extension/IvanPasco/clean-language
2. You should see **version 1.3.0**
3. This makes it available in Cursor

---

## Step 7: Test the Installation (Optional but Recommended) 🧪

### In VS Code:

```bash
# Install the extension
code --install-extension IvanPasco.clean-language

# Open a test file
code test_extension.cln
```

Then in VS Code:
1. Open Command Palette (Cmd+Shift+P)
2. Type: **"Clean Language: Compile with Options"**
3. You should see the 4-step dialog with dynamic options
4. Check Developer Console (Help → Toggle Developer Tools)
5. Look for: `Loaded compile options from: ~/.cleen/versions/0.8.5/compile-options.json`

### In Cursor:

```bash
# Install the extension
cursor --install-extension IvanPasco.clean-language

# Open a test file
cursor test_extension.cln
```

Same testing steps as VS Code.

---

## Step 8: Create GitHub Release (Optional) 📦

If you want to create a GitHub release:

```bash
# Tag the version
git tag v1.3.0
git push origin v1.3.0

# Create release with the .vsix file
gh release create v1.3.0 \
  clean-language-1.3.0.vsix \
  --title "Clean Language Extension v1.3.0 - Dynamic Compile Options" \
  --notes "See CHANGELOG.md for full details"
```

---

## Troubleshooting 🔧

### "Authentication failed"

**Problem**: Token is wrong or expired

**Solution**:
1. Go back to Step 1 and get new tokens
2. Make sure you copied the entire token
3. Re-run Step 3 with the new tokens

### "Extension already published at this version"

**Problem**: Version 1.3.0 already exists

**Solution**:
```bash
# Bump version to 1.3.1
npm version patch

# Rebuild package
npm run package

# Try publishing again (from Step 4)
```

### "Package not found"

**Problem**: You're not in the right directory

**Solution**:
```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"
ls clean-language-1.3.0.vsix  # Should exist
```

### Need more help?

See the detailed guide: **PUBLISHING-STEPS-v1.3.0.md**

---

## Summary of What's Been Done ✨

I've prepared your extension for publishing:

✅ **Updated version** from 1.2.3 to 1.3.0
✅ **Updated changelog** with new features
✅ **Updated README** with dynamic options docs
✅ **Created .vscodeignore** (reduced package from 722 KB to 59 KB!)
✅ **Built package**: clean-language-1.3.0.vsix
✅ **Created documentation**:
   - QUICK-PUBLISH-GUIDE.md (quick reference)
   - PUBLISHING-STEPS-v1.3.0.md (detailed guide)
   - READY-TO-PUBLISH.md (summary)
   - STEP-BY-STEP-FOR-IVAN.md (this file)

---

## What's New in This Release 🎉

### Dynamic Compile Options

The big feature! The extension now loads compile options from your installed compiler instead of having them hardcoded.

**Benefits:**
- Options automatically match your compiler version
- When you update the compiler, new options appear automatically
- No need to update the extension when compiler adds new features
- Different compiler versions can have different options

**How it works:**
1. Compiler generates `compile-options.json`
2. Clean Manager extracts it to `~/.cleen/versions/0.8.5/`
3. Extension reads it and shows options in the dialog
4. User sees current options for their compiler version

**New Command:**
- "Refresh Compile Options" - Reload options from compiler

---

## After Publishing 📊

### First Hour
- Check both marketplaces show v1.3.0
- Test installation in VS Code and Cursor
- Monitor for any error reports

### First Day
- Watch GitHub issues for bugs
- Read marketplace reviews
- Verify dynamic options work correctly

### First Week
- Check download statistics
- Gather user feedback
- Plan bug fixes if needed

---

## Package Details 📦

- **File**: clean-language-1.3.0.vsix
- **Location**: /Users/earcandy/Documents/Dev/Clean Language/clean-extension/
- **Size**: 58.96 KB (was 722 KB - 92% smaller!)
- **Files**: 26 files (was 450 - 94% fewer!)
- **Version**: 1.3.0
- **Release Date**: October 5, 2025

---

## Quick Command Reference 📋

```bash
# Navigate to extension
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"

# Set tokens
export VSCE_PAT="your-token"
export OVSX_PAT="your-token"

# Publish
npx vsce publish -p $VSCE_PAT
npx ovsx publish -p $OVSX_PAT

# Verify
open https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
open https://open-vsx.org/extension/IvanPasco/clean-language

# Test
code --install-extension IvanPasco.clean-language
```

---

## You're All Set! 🎉

Everything is ready. Just follow Steps 1-7 above and you'll have your extension published!

The extension is fully prepared and tested. All you need to do is get your tokens and run the publish commands.

**Good luck with the release!** 🚀

---

**Questions?** Check the other documentation files or the existing PUBLISHING-GUIDE.md.

**Ready?** Start with Step 1! ⬆️
