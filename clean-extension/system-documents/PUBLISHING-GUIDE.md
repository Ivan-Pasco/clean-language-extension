# Clean Language Extension Publishing Guide

This document contains sensitive information for publishing the Clean Language extension to both VS Code Marketplace and Open VSX Registry.

⚠️ **IMPORTANT**: This file is excluded from git and contains sensitive tokens. Do not commit this file to version control.

## Publishing Platforms

### 1. VS Code Marketplace (Microsoft)
- **Current Status**: ✅ Published and available
- **URL**: https://marketplace.visualstudio.com/items?itemName=IvanPasco.clean-language
- **Tool**: `vsce` (Visual Studio Code Extension Manager)

### 2. Open VSX Registry (Eclipse Foundation)
- **Current Status**: 🔄 PR submitted for auto-sync
- **URL**: https://open-vsx.org (will be available after PR merge)
- **Tool**: `ovsx` (Open VSX CLI)
- **PR**: https://github.com/EclipseFdn/publish-extensions/pull/950

## Access Tokens

### VS Code Marketplace Token
- **Publisher**: IvanPasco
- **Token**: [REPLACE_WITH_YOUR_VSCODE_TOKEN]
- **Source**: https://dev.azure.com/ivanblogfolder/_usersSettings/tokens
- **Scope**: Marketplace (publish)

### Open VSX Registry Token
- **Publisher**: IvanPasco
- **Token**: [REPLACE_WITH_YOUR_OPENVSX_TOKEN]
- **Source**: https://open-vsx.org/user-settings/tokens
- **Account**: Login via GitHub OAuth

## Publishing Commands

### VS Code Marketplace
```bash
# Build and publish to VS Code Marketplace
npm run compile
npm run publish

# Or manually with token
vsce publish --pat [YOUR_VSCODE_TOKEN]

# Package only (creates .vsix file)
npm run package
```

### Open VSX Registry

#### One-time Setup
```bash
# Create publisher namespace (only needed once)
npx ovsx create-namespace IvanPasco --pat [YOUR_OPENVSX_TOKEN]
```

#### Publishing
```bash
# Publish to Open VSX Registry
npm run publish:ovsx -- --pat [YOUR_OPENVSX_TOKEN]

# Or manually
npx ovsx publish --pat [YOUR_OPENVSX_TOKEN]

# Publish specific .vsix file
npx ovsx publish extension.vsix --pat [YOUR_OPENVSX_TOKEN]
```

## Complete Publishing Workflow

### For Regular Updates
1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Build and test** the extension
4. **Publish to both platforms**:
   ```bash
   # Build
   npm run compile
   
   # Publish to VS Code Marketplace
   npm run publish
   
   # Publish to Open VSX Registry
   npm run publish:ovsx -- --pat [YOUR_OPENVSX_TOKEN]
   ```

### For Major Releases
1. **Create release branch**: `git checkout -b release/v1.2.0`
2. **Update version and changelog**
3. **Test thoroughly**
4. **Merge to main**: `git checkout main && git merge release/v1.2.0`
5. **Tag release**: `git tag v1.2.0 && git push origin v1.2.0`
6. **Publish to both platforms**
7. **Create GitHub release** with changelog

## Environment Variables (Optional)

Create a `.env` file (also gitignored) for easier token management:

```bash
# .env file
VSCE_PAT=your_vscode_marketplace_token_here
OVSX_PAT=your_openvsx_registry_token_here
```

Then use in scripts:
```bash
# Load environment variables
source .env

# Publish with environment variables
vsce publish --pat $VSCE_PAT
npx ovsx publish --pat $OVSX_PAT
```

## Token Management

### Generating Tokens

#### VS Code Marketplace Token
1. Go to https://dev.azure.com/
2. Sign in with Microsoft account
3. Go to User settings → Personal access tokens
4. Click "New Token"
5. Set scope to "Marketplace (publish)"
6. Copy token immediately (won't be shown again)

#### Open VSX Registry Token
1. Go to https://open-vsx.org/
2. Sign in with GitHub
3. Go to User Settings → Access Tokens
4. Click "Create new token"
5. Copy token immediately

### Token Security
- ✅ Store tokens in secure password manager
- ✅ Use environment variables for CI/CD
- ✅ Regenerate tokens if compromised
- ❌ Never commit tokens to git
- ❌ Don't share tokens in plain text
- ❌ Don't store tokens in unsecured locations

## Troubleshooting

### Common Issues

#### VS Code Marketplace
- **401 Unauthorized**: Token expired or invalid
- **403 Forbidden**: Insufficient permissions or wrong publisher
- **Extension not appearing**: May take up to 24 hours to show in search

#### Open VSX Registry
- **Publisher not found**: Need to create namespace first
- **Version conflict**: Version already exists, increment version number
- **File size limits**: Ensure extension package is under size limits

### Verification

#### After Publishing
1. **Check VS Code Marketplace**: Search for "Clean Language" or visit direct URL
2. **Check Open VSX Registry**: Visit https://open-vsx.org and search
3. **Test in Cursor**: Install extension and verify functionality
4. **Test in VSCodium**: Verify Open VSX distribution works

## Auto-Sync Status

The extension is configured for auto-sync from VS Code Marketplace to Open VSX Registry:
- **Status**: PR submitted (#950)
- **Repository**: https://github.com/EclipseFdn/publish-extensions
- **Benefit**: Automatic synchronization reduces manual publishing overhead

Once auto-sync is active, you only need to publish to VS Code Marketplace, and Open VSX will be updated automatically.

## Support Contacts

- **VS Code Marketplace**: https://github.com/microsoft/vscode/issues
- **Open VSX Registry**: https://github.com/eclipse/openvsx/issues
- **Auto-sync Issues**: https://github.com/EclipseFdn/publish-extensions/issues

---

**Last Updated**: January 2025
**Extension Version**: 1.1.9
**Next Review**: March 2025