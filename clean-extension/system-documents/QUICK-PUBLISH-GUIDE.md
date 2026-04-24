# Quick Publishing Guide - Clean Language v1.3.0

## 🎯 What You Need

1. **VS Code Marketplace Token** - https://dev.azure.com/IvanPasco/_usersSettings/tokens
2. **Open VSX Token** - https://open-vsx.org/user-settings/tokens

## 🚀 Publish in 3 Steps

### Step 1: Set Up Tokens
```bash
export VSCE_PAT="your-vscode-marketplace-token"
export OVSX_PAT="your-openvsx-token"
```

### Step 2: Navigate to Extension
```bash
cd "/Users/earcandy/Documents/Dev/Clean Language/clean-extension"
```

### Step 3: Publish
```bash
# Option A: Publish to both platforms
npx vsce publish -p $VSCE_PAT && npx ovsx publish -p $OVSX_PAT

# Option B: Publish individually
npx vsce publish -p $VSCE_PAT    # VS Code Marketplace
npx ovsx publish -p $OVSX_PAT    # Open VSX (Cursor, etc.)
```

## ✅ Verify Publishing

**VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language

**Open VSX Registry**: https://open-vsx.org/extension/IvanPasco/clean-language

Both should show version **1.3.0**

## 🎉 Optional: Create GitHub Release

```bash
git tag v1.3.0
git push origin v1.3.0

gh release create v1.3.0 clean-language-1.3.0.vsix \
  --title "v1.3.0 - Dynamic Compile Options" \
  --notes "See changelog.md for details"
```

## 📦 Package Details

- **File**: clean-language-1.3.0.vsix
- **Size**: 58.96 KB
- **Version**: 1.3.0
- **Ready**: ✅ Yes

## 🆘 Troubleshooting

**"Authentication failed"**
→ Regenerate token at links above

**"Already published"**
→ Version already exists, bump version number

**Need more help?**
→ See PUBLISHING-STEPS-v1.3.0.md for detailed guide

---

**That's it!** Your extension is ready to publish. 🚀
