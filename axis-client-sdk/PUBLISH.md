# Publishing @nextera.one/axis-client-sdk to npm

This guide reflects the current published package and scope:

- Package: `@nextera.one/axis-client-sdk`
- Current published baseline: `2.1.0`
- Package directory: `axis-client-sdk`

## Quick Start

```bash
# 1. Authenticate with npm
npm login

# 2. Verify your login
npm whoami

# 3. Build the package
cd axis-client-sdk
npm run build

# 4. Run pre-publish checks
bash scripts/pre-publish-check.sh

# 5. Publish the next version
npm publish --access public

# 6. Verify publication
npm view @nextera.one/axis-client-sdk
```

## Publish Flow

### 1. Confirm npm scope access

Make sure the npm account you use can publish to the `@nextera.one` scope.

```bash
npm whoami
```

If publish fails with a permissions error, switch to the correct account before continuing.

### 2. Update the version

Edit `axis-client-sdk/package.json` and bump the version from the current baseline.

Examples:

- Patch: `2.1.0` -> `2.1.1`
- Minor: `2.1.0` -> `2.2.0`
- Major: `2.1.0` -> `3.0.0`

### 3. Update release notes

Add the release entry to `axis-client-sdk/CHANGELOG.md` if the file is being used for release tracking.

### 4. Build and verify the tarball

```bash
cd axis-client-sdk
npm run build
npm pack --dry-run
```

The package should include:

- `dist/index.js`
- `dist/index.mjs`
- `dist/index.d.ts`
- `README.md`
- `LICENSE`

It should not include source files or `node_modules`.

### 5. Publish

```bash
cd axis-client-sdk
npm publish --access public
```

For accounts with 2FA enabled:

```bash
npm publish --access public --otp 123456
```

### 6. Verify the release

```bash
npm view @nextera.one/axis-client-sdk version
npm view @nextera.one/axis-client-sdk versions
```

Browser URL:

- `https://www.npmjs.com/package/@nextera.one/axis-client-sdk`

## Package Metadata

Current expected package metadata:

```json
{
  "name": "@nextera.one/axis-client-sdk",
  "version": "2.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts"
}
```

## Install Verification

In a scratch project:

```bash
mkdir test-project
cd test-project
npm init -y
npm install @nextera.one/axis-client-sdk
```

Quick smoke test:

```js
import { AxisClient, AxisFrameBuilder } from '@nextera.one/axis-client-sdk';

console.log(Boolean(AxisClient), Boolean(AxisFrameBuilder));
```

## Common Commands

```bash
npm view @nextera.one/axis-client-sdk version
npm view @nextera.one/axis-client-sdk versions
npm install @nextera.one/axis-client-sdk@latest
npm install @nextera.one/axis-client-sdk@2.1.0
```

Deprecate an old version:

```bash
npm deprecate @nextera.one/axis-client-sdk@2.1.0 "Use 2.1.1 instead"
```

Unpublish is only available within npm's restricted window:

```bash
npm unpublish @nextera.one/axis-client-sdk@2.1.0
```

## Troubleshooting

### 401 Unauthorized

```bash
npm logout
npm login
npm whoami
```

### 403 Forbidden

Check all of the following:

- the logged-in account can publish to `@nextera.one`
- the package name is `@nextera.one/axis-client-sdk`
- the target version has not already been published

### 2FA failure

Use the one-time password form of the publish command:

```bash
npm publish --access public --otp 123456
```

### Invalid entry point paths

The package must point to files, not directories:

```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts"
}
```

## Pre-Publish Checklist

- [ ] Version updated in `package.json`
- [ ] Changelog updated if needed
- [ ] `npm run build` passes
- [ ] `npm pack --dry-run` looks correct
- [ ] README is accurate
- [ ] No secrets were introduced
- [ ] Relevant git commit exists
- [ ] Release tag created if desired

Automated check:

```bash
cd axis-client-sdk
bash scripts/pre-publish-check.sh
```

## References

- https://docs.npmjs.com
- https://docs.npmjs.com/cli/v10/commands/npm-publish
- https://docs.npmjs.com/cli/v10/using-npm/scope

## Support

- npm support: https://www.npmjs.com/support
- repository: https://github.com/digital-pages-co/axis

---

Ready to publish the next client SDK release.
