# @nextera.one/axis-client-sdk Publishing Quick Reference

## One-Time Setup

```bash
npm login
npm whoami
```

The logged-in account must be able to publish to the `@nextera.one` scope.

## Publish New Version

```bash
# 1. Update version in package.json
nano axis-client-sdk/package.json
# Change "version": "2.1.0" to the next release

# 2. Update changelog if used
nano axis-client-sdk/CHANGELOG.md

# 3. Build and verify
cd axis-client-sdk
npm run build
bash scripts/pre-publish-check.sh

# 4. Publish
npm publish --access public

# 5. Verify
npm view @nextera.one/axis-client-sdk version
# Or visit: https://www.npmjs.com/package/@nextera.one/axis-client-sdk

# 6. Tag in git (optional)
git tag axis-client-sdk-v2.1.1
git push origin axis-client-sdk-v2.1.1
```

## Package Info

| Property | Value |
|----------|-------|
| Name | @nextera.one/axis-client-sdk |
| Scope | @nextera.one |
| Current Version | 2.1.0 |
| License | Apache-2.0 |
| Main (CJS) | dist/index.js |
| Module (ESM) | dist/index.mjs |
| Types (dts) | dist/index.d.ts |
| Homepage | https://github.com/digital-pages-co/axis |
| Registry | https://registry.npmjs.org |

## Semantic Versioning

```text
2.1.0 -> 2.1.1  (patch: bug fixes)
2.1.0 -> 2.2.0  (minor: features)
2.1.0 -> 3.0.0  (major: breaking)
```

## Published Contents

```text
dist/                 built JS, ESM, and types
README.md             package documentation
LICENSE               Apache 2.0 license
```

## Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Run `npm login` again |
| 403 Forbidden | Check `@nextera.one` publish permissions |
| Version already exists | Bump version in package.json |
| 2FA error | Add `--otp 123456` |
| Bad package contents | Run `npm pack --dry-run` before publish |

## Links

- npm package: https://www.npmjs.com/package/@nextera.one/axis-client-sdk
- docs: [PUBLISH.md](PUBLISH.md)

## Install After Publishing

```bash
npm install @nextera.one/axis-client-sdk
npm install @nextera.one/axis-client-sdk@latest
npm install @nextera.one/axis-client-sdk@2.1.0
```

---

Ready command:

```bash
npm publish --access public
```
