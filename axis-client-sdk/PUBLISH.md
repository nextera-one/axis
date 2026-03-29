# Publishing @axis/client-sdk to npm

Complete guide to publish the client SDK to npm under the `@axis` organization scope.

## Quick Start

```bash
# 1. Authenticate with npm
npm login

# 2. Verify your login
npm whoami

# 3. Build the package
cd client-sdk
npm run build

# 4. Run pre-publish checks
bash scripts/pre-publish-check.sh

# 5. Publish (first time - set access to public)
npm publish --access public

# 6. Verify publication
npm view @axis/client-sdk
```

## Detailed Steps

### Step 1: Create npm Account (If Needed)

1. Visit https://www.npmjs.com/signup
2. Create account with email
3. Verify email address

### Step 2: Set Up Organization (If Needed)

1. Visit https://www.npmjs.com/org/create
2. Create organization named "axis"
3. Select free plan

### Step 3: Login to npm Locally

```bash
npm login

# Prompts for:
# - username: your-npm-username
# - password: your-npm-password
# - email: your-email@example.com
# - OTP (if 2FA enabled)

# Verify login
npm whoami
# Output: your-npm-username
```

Credentials saved to: `~/.npmrc`

### Step 4: Configure Package

The package.json is already configured for npm publishing:

```json
{
  "name": "@axis/client-sdk",
  "version": "1.0.0",
  "description": "Official TypeScript/JavaScript client SDK for the AXIS Protocol v1",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": { ... },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

Key configuration:
- ✅ Name: `@axis/client-sdk` (scoped to @axis org)
- ✅ Version: 1.0.0 (follows semantic versioning)
- ✅ Main entry points: CJS, ESM, TypeScript definitions
- ✅ Files: Only dist/, README.md, LICENSE (via files array)
- ✅ .npmignore: Excludes src/, scripts/, etc.

### Step 5: Build Package

```bash
cd client-sdk
npm run build

# Output:
# CJS dist/index.js          31.33 KB
# CJS dist/index.js.map      64.70 KB
# ESM dist/index.mjs         29.06 KB
# ESM dist/index.mjs.map     64.25 KB
# DTS dist/index.d.ts        11.34 KB
# DTS ⚡️ Build success
```

### Step 6: Verify Package

```bash
# List what will be published
npm pack --dry-run

# Or create actual tarball
npm pack

# Extract and inspect
tar -tzf axis-client-sdk-1.0.0.tgz | head -20
```

Should include:
- ✅ package/dist/index.js
- ✅ package/dist/index.mjs
- ✅ package/dist/index.d.ts
- ✅ package/README.md
- ✅ package/LICENSE
- ❌ package/src/ (excluded)
- ❌ package/node_modules/ (excluded)

### Step 7: Publish

First publication to npm:

```bash
cd client-sdk
npm publish --access public
```

**Important:** 
- `--access public` is required for scoped packages
- Without it, npm assumes private (paid feature)

Expected output:
```
npm notice 📦  @axis/client-sdk@1.0.0
npm notice 📦
npm notice === Tarball Contents ===
npm notice ...
npm notice === Tarball Details ===
npm notice name:          @axis/client-sdk
npm notice version:       1.0.0
npm notice size:          50.2 kB
npm notice ...
npm notice + @axis/client-sdk@1.0.0
```

### Step 8: Verify Publication

```bash
# Check npm registry
npm view @axis/client-sdk

# Output shows:
# @axis/client-sdk@1.0.0 | Apache-2.0 | deps: 2 | versions: 1

# Visit in browser
# https://www.npmjs.com/package/@axis/client-sdk
```

### Step 9: Test Installation

In a new project:

```bash
mkdir test-project
cd test-project
npm init -y
npm install @axis/client-sdk

# Test import
cat > test.mjs << 'EOF'
import { AxisClient, AxisFrameBuilder } from '@axis/client-sdk';

console.log('✅ Imports work!');
EOF

node test.mjs
# Output: ✅ Imports work!
```

## Subsequent Publishes

To publish updates:

### 1. Update Version

Edit `client-sdk/package.json`:

```json
{
  "version": "1.0.1"  // was 1.0.0
}
```

Follow semantic versioning:
- **PATCH** (1.0.1): Bug fixes, non-breaking changes
- **MINOR** (1.1.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes

### 2. Update Changelog

Create/update `client-sdk/CHANGELOG.md`:

```markdown
## [1.0.1] - 2025-12-27

### Fixed
- Fix frame encoding signature varint (GitHub #42)
- Handle async signer in frame builder

### Added
- Support for optional Signer in AxisClientConfig
- buildUnsigned() and buildSigned() methods

### Changed
- AXIS1 magic bytes (5 bytes, was MDW1)
- Content-Type to application/axis-bin
```

### 3. Build & Publish

```bash
cd client-sdk
npm run build
npm publish --access public
```

## Managing Versions

### View Current Version
```bash
npm view @axis/client-sdk version
```

### View All Versions
```bash
npm view @axis/client-sdk versions
```

### Install Specific Version
```bash
npm install @axis/client-sdk@1.0.0
npm install @axis/client-sdk@latest
```

### Deprecate Old Version
```bash
npm deprecate @axis/client-sdk@1.0.0 "Use 1.0.1 instead"
```

### Unpublish (72-hour window only)
```bash
npm unpublish @axis/client-sdk@1.0.0
```

## Organization Management

### Add Team Member

```bash
npm org members add axis username --role=developer
```

Roles:
- `owner` - Full access
- `developer` - Can publish
- `readonly` - View only

### List Organization Members

```bash
npm org ls axis
```

### Set Team Permissions

```bash
npm org set axis:dev-team publish
```

## Troubleshooting

### Error: 401 Unauthorized

**Cause:** Not authenticated or token expired

**Solution:**
```bash
npm logout
npm login
npm whoami  # Verify
```

### Error: 403 Forbidden

**Cause:** No publish permission in organization

**Solutions:**
- Verify your account has "developer" or "owner" role
- Check package name is `@axis/client-sdk`
- Ensure version not already published

Contact org owner to add you with publish rights:
```bash
npm org members add axis YOUR_USERNAME --role=developer
```

### Error: 404 Not found

**Cause:** Package doesn't exist yet

**Solution:** This is normal for first publish - package will be created

### Error: ENOTFILE: illegal operation on a directory

**Cause:** main/module fields point to directories instead of files

**Solution:** Update package.json:
```json
{
  "main": "dist/index.js",      // Not "dist/"
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts"
}
```

### 2FA Code Error

If 2FA enabled:
```bash
npm publish --access public --otp 123456
# Replace 123456 with current TOTP code
```

## Pre-Publish Checklist

Before every publish:

- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] Built successfully: `npm run build`
- [ ] No TypeScript errors: `tsc --noEmit`
- [ ] Dist directory has correct files
- [ ] README.md is accurate
- [ ] No secrets in code
- [ ] Git committed: `git add . && git commit`
- [ ] Git tagged: `git tag v1.0.1`
- [ ] Tests pass (if any)

Automated check:
```bash
bash scripts/pre-publish-check.sh
```

## CI/CD Integration (Optional)

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: https://registry.npmjs.org/
      
      - run: cd client-sdk && npm ci
      - run: cd client-sdk && npm run build
      - run: cd client-sdk && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Setup:
1. Generate npm token: https://www.npmjs.com/settings/~/tokens
2. Add to GitHub: Settings → Secrets → NPM_TOKEN
3. Create tag: `git tag v1.0.1 && git push origin v1.0.1`
4. Action automatically publishes

## References

- [npm Docs](https://docs.npmjs.com)
- [Scoped Packages](https://docs.npmjs.com/cli/v10/using-npm/scope)
- [Publishing Guide](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Package.json Reference](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [2FA Setup](https://docs.npmjs.com/cli/v10/commands/npm-profile)

## Support

- npm support: https://www.npmjs.com/support
- GitHub: https://github.com/your-org/axis/issues
- Documentation: [NPM_PUBLISHING_GUIDE.md](../NPM_PUBLISHING_GUIDE.md)

---

**Ready to publish? Let's go! 🚀**
