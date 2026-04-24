# Publishing Clean Language Extension v1.3.0

## Pre-Publishing Checklist

✅ Version updated to 1.3.0 in package.json
✅ Changelog updated with new features
✅ README updated with dynamic options documentation
✅ .vscodeignore created (package size reduced from 722 KB to 59 KB)
✅ Extension compiled and tested
✅ Package created: `clean-language-1.3.0.vsix`

## Step-by-Step Publishing Guide

### 1. Verify Your Credentials

You'll need two Personal Access Tokens (PATs):

#### For VS Code Marketplace (Microsoft)
- **Publisher**: IvanPasco
- **Token Name**: Should have `Marketplace (Publish)` scope
- **Where to get it**: https://dev.azure.com/IvanPasco/_usersSettings/tokens

#### For Open VSX Registry (Eclipse Foundation)
- **Token Name**: Your Open VSX PAT
- **Where to get it**: https://open-vsx.org/user-settings/tokens

### 2. Set Up Environment Variables (Recommended)

Create a temporary environment for this session:

```bash
# For VS Code Marketplace
export VSCE_PAT="your-vscode-marketplace-token"

# For Open VSX Registry
export OVSX_PAT="your-openvsx-token"
```

**IMPORTANT**: Never commit these tokens to git!

### 3. Publish to VS Code Marketplace

```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"

# Option A: Using environment variable
npx vsce publish -p $VSCE_PAT

# Option B: Interactive (will prompt for token)
npx vsce publish

# Option C: Using npm script (if configured)
npm run publish
```

**Expected Output:**
```
Publishing IvanPasco.clean-language@1.3.0...
Successfully published IvanPasco.clean-language@1.3.0!
Your extension will live at https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
```

**Verification:**
- Visit: https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
- Check version shows as 1.3.0
- Check changelog displays correctly
- Verify README shows new features

### 4. Publish to Open VSX Registry

```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"

# Option A: Using environment variable
npx ovsx publish -p $OVSX_PAT

# Option B: Using the packaged .vsix file
npx ovsx publish clean-language-1.3.0.vsix -p $OVSX_PAT

# Option C: Using npm script (if configured)
npm run publish:ovsx
```

**Expected Output:**
```
Publishing IvanPasco.clean-language@1.3.0 to Open VSX Registry...
✅ Published IvanPasco.clean-language@1.3.0
```

**Verification:**
- Visit: https://open-vsx.org/extension/IvanPasco/clean-language
- Check version shows as 1.3.0
- Verify extension appears in Cursor marketplace

### 5. Publish Both Platforms Simultaneously

If you have both tokens set up:

```bash
npm run publish:both
```

This runs both `vsce publish` and `ovsx publish` commands.

## Post-Publishing Steps

### 1. Create GitHub Release

```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"

# Tag the release
git tag v1.3.0
git push origin v1.3.0

# Create release on GitHub
gh release create v1.3.0 \
  clean-language-1.3.0.vsix \
  --title "Clean Language Extension v1.3.0 - Dynamic Compile Options" \
  --notes "$(cat << 'EOF'
## What's New in v1.3.0

### 🎯 Dynamic Compile Options
Compile options are now loaded directly from your installed Clean Language compiler, making the extension future-proof and version-aware.

**Key Features:**
- ✨ Options automatically match your compiler's capabilities
- 🔄 Different compiler versions can have different options
- 🚀 New compiler features appear without extension updates
- 📍 Extension reads from `~/.cleen/versions/{version}/compile-options.json`
- 🔄 New "Refresh Compile Options" command

**What This Means:**
- Target platforms, optimizations, runtimes are all dynamic
- Upgrading your compiler automatically unlocks new options
- No more waiting for extension updates to use new compiler features

### 🛠️ Technical Details
- Requires Clean Language compiler v0.8.5+
- Graceful fallback to defaults if JSON unavailable
- Multi-path search for maximum compatibility
- See full changelog for implementation details

### 📦 Installation
- VS Code Marketplace: Search "Clean Language"
- Cursor: Install from VSIX or wait for marketplace sync
- Manual: Download `.vsix` from this release

**Full Changelog**: https://github.com/Ivan-Pasco/clean-language-extension/blob/main/changelog.md
EOF
)"
```

### 2. Verify Installations

**VS Code:**
```bash
code --install-extension clean-language-1.3.0.vsix
# Then test: Open a .cln file and run "Compile with Options"
```

**Cursor:**
```bash
cursor --install-extension clean-language-1.3.0.vsix
# Then test: Open a .cln file and run "Compile with Options"
```

### 3. Update Documentation

Update any external documentation that references the extension:
- Project README (if separate)
- Clean Language website
- Blog posts or announcements
- Social media updates

## Troubleshooting

### "Authentication failed" or "401 Unauthorized"

**Problem**: Token is invalid or expired

**Solution**:
1. Generate new token at https://dev.azure.com/IvanPasco/_usersSettings/tokens (for VS Code)
2. Or at https://open-vsx.org/user-settings/tokens (for Open VSX)
3. Ensure token has correct scopes:
   - VS Code: Marketplace (Publish)
   - Open VSX: All scopes

### "Extension already published at this version"

**Problem**: Version 1.3.0 already exists

**Solution**:
```bash
# Bump to next version
npm version patch  # 1.3.0 -> 1.3.1
# Or manually edit package.json

# Rebuild package
npm run package

# Try publishing again
npx vsce publish
```

### "Package contains files larger than 50MB"

**Problem**: Package is too large

**Solution**:
1. Check `.vscodeignore` is being used
2. Verify with: `npx vsce ls | wc -l` (should be ~26 files)
3. Current package is 59 KB, so this shouldn't happen

### Cursor Marketplace Not Updating

**Problem**: Extension doesn't appear in Cursor

**Note**: Cursor uses Open VSX Registry, which may take time to sync

**Solution**:
1. Verify published to Open VSX: https://open-vsx.org/extension/IvanPasco/clean-language
2. Wait 15-30 minutes for cache refresh
3. Install manually from .vsix in the meantime
4. Check PR #950 status for auto-sync approval

## Quick Reference Commands

```bash
# Navigate to extension directory
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"

# Verify package is ready
ls -lh clean-language-1.3.0.vsix

# Publish to VS Code Marketplace
npx vsce publish -p $VSCE_PAT

# Publish to Open VSX
npx ovsx publish -p $OVSX_PAT

# Publish to both
npm run publish:both

# Create GitHub tag
git tag v1.3.0 && git push origin v1.3.0

# Test installation locally
code --install-extension clean-language-1.3.0.vsix
```

## Success Criteria

After publishing, verify:

- [ ] Extension appears on VS Code Marketplace at version 1.3.0
- [ ] Extension appears on Open VSX Registry at version 1.3.0
- [ ] Changelog is visible on marketplace pages
- [ ] README displays correctly with new features
- [ ] Installing extension shows version 1.3.0
- [ ] "Compile with Options" command loads dynamic options
- [ ] GitHub release created with .vsix attachment
- [ ] Old installations can upgrade to 1.3.0

## Post-Release Monitoring

**First 24 hours:**
- Monitor GitHub issues for bug reports
- Check VS Code Marketplace reviews
- Test in both VS Code and Cursor
- Verify dynamic options work with compiler v0.8.5

**First week:**
- Monitor download statistics
- Gather user feedback
- Plan for bug fix releases if needed

## Notes

- **Package Size**: 58.96 KB (was 722 KB before cleanup)
- **Files Included**: 26 files (was 450 before .vscodeignore)
- **Compiler Compatibility**: Requires v0.8.5+ for dynamic options
- **Breaking Changes**: None - fully backward compatible

---

**Created by**: Ivan Pasco
**Release Date**: October 5, 2025
**Version**: 1.3.0
**Package**: clean-language-1.3.0.vsix
