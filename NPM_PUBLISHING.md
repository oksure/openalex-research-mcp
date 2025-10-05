# NPM Publishing Guide

This guide explains how to publish and maintain the `openalex-research-mcp` package on npm with automated releases.

## Initial Setup (One-Time)

### 1. Create npm Account
- Go to [npmjs.com](https://www.npmjs.com/) and create an account if you don't have one
- Verify your email address

### 2. Generate npm Access Token
1. Log in to npmjs.com
2. Click your profile icon → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Select "Automation" type (for CI/CD)
5. Copy the generated token (starts with `npm_...`)

### 3. Add npm Token to GitHub Secrets
1. Go to your GitHub repository: https://github.com/oksure/openalex-research-mcp
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

## Publishing a New Version

The package is automatically published to npm when you create a release or push a version tag. Here are two methods:

### Method 1: GitHub Release (Recommended)

1. **Update version in package.json**
   ```bash
   npm version patch  # for bug fixes (1.0.0 → 1.0.1)
   npm version minor  # for new features (1.0.0 → 1.1.0)
   npm version major  # for breaking changes (1.0.0 → 2.0.0)
   ```

2. **Push the changes and tag**
   ```bash
   git push && git push --tags
   ```

3. **Create a GitHub release**
   ```bash
   gh release create v1.0.1 --title "v1.0.1" --notes "Bug fixes and improvements"
   ```

   Or use the GitHub web interface:
   - Go to https://github.com/oksure/openalex-mcp/releases
   - Click "Draft a new release"
   - Choose the tag you just pushed
   - Add release notes
   - Click "Publish release"

4. **GitHub Actions will automatically**:
   - Install dependencies
   - Build the TypeScript code
   - Publish to npm with provenance

### Method 2: Direct Tag Push

1. **Update version**
   ```bash
   npm version patch
   ```

2. **Push with tags**
   ```bash
   git push origin master --tags
   ```

3. **The workflow triggers automatically** when it detects a `v*` tag

## Verification

After publishing:

1. **Check npm**: Visit https://www.npmjs.com/package/openalex-research-mcp
2. **Check GitHub Actions**: Go to https://github.com/oksure/openalex-research-mcp/actions
3. **Test installation**: `npx openalex-research-mcp@latest`

## Version Numbers

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

## Publishing Checklist

Before publishing a new version:

- [ ] All tests pass locally
- [ ] CHANGELOG.md is updated
- [ ] README.md reflects any new features
- [ ] Version number follows semver
- [ ] Commit all changes
- [ ] Tag is properly formatted (v1.0.0)

## Manual Publishing (Fallback)

If GitHub Actions fails, you can publish manually:

```bash
# Login to npm (one-time)
npm login

# Build
npm run build

# Publish
npm publish --access public
```

## Using the Published Package

Once published, users can install via:

```bash
# Global installation
npm install -g openalex-research-mcp

# Or use directly
npx openalex-research-mcp
```

For Claude Desktop configuration:
```json
{
  "mcpServers": {
    "openalex": {
      "command": "npx",
      "args": ["-y", "openalex-research-mcp"],
      "env": {
        "OPENALEX_EMAIL": "your.email@example.com"
      }
    }
  }
}
```

## Troubleshooting

**Publishing fails with 401 error**
- Check that NPM_TOKEN secret is set correctly in GitHub
- Verify the token hasn't expired
- Make sure you have publish permissions for the package

**Version already exists**
- Update the version number in package.json
- Each npm version must be unique and can't be republished

**Build fails in CI**
- Check GitHub Actions logs
- Ensure all dependencies are in package.json
- Verify TypeScript compiles locally with `npm run build`

## Package Scope

If you want to publish under an npm organization (e.g., `@oksure/openalex-research-mcp`):

1. Update package.json name: `"name": "@oksure/openalex-research-mcp"`
2. The workflow already includes `--access public` for scoped packages
3. Users would install with: `npm install -g @oksure/openalex-research-mcp`
