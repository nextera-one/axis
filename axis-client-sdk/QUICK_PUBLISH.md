# @axis/client-sdk Publishing Quick Reference

## One-Time Setup

```bash
npm login
# Prompts for username, password, email, 2FA code
npm whoami
# Verify: should show your npm username
```

## Publish New Version

```bash
# 1. Update version in package.json
nano client-sdk/package.json
# Change "version": "1.0.0" to "1.0.1"

# 2. Update CHANGELOG
nano client-sdk/CHANGELOG.md
# Add changes under new version header

# 3. Build and publish
cd client-sdk
npm run build
npm publish --access public

# 4. Verify
npm view @axis/client-sdk version
# Or visit: https://www.npmjs.com/package/@axis/client-sdk

# 5. Tag in git (optional)
git tag v1.0.1
git push origin v1.0.1
```

## Verify Before Publishing

```bash
cd client-sdk
bash scripts/pre-publish-check.sh
# Shows: npm auth, version check, build, dist, defs, README, LICENSE, no secrets
```

## Package Info

| Property | Value |
|----------|-------|
| Name | @axis/client-sdk |
| Scope | @axis |
| Current Version | 1.0.0 |
| License | Apache-2.0 |
| Main (CJS) | dist/index.js |
| Module (ESM) | dist/index.mjs |
| Types (dts) | dist/index.d.ts |
| Homepage | https://github.com/your-org/axis |
| Registry | https://registry.npmjs.org |

## Semantic Versioning

```
1.0.0 → 1.0.1  (patch: bug fixes)
1.0.0 → 1.1.0  (minor: features)
1.0.0 → 2.0.0  (major: breaking)
```

## What's Published

```
✅ dist/                (built JS, ESM, types)
✅ README.md            (docs and examples)
✅ LICENSE              (Apache 2.0)
❌ src/                 (excluded)
❌ scripts/             (excluded)
❌ node_modules/        (excluded)
❌ *.test.ts            (excluded)
```

## Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Run `npm login` |
| 403 Forbidden | Check @axis org permissions |
| Version already exists | Update version in package.json |
| 2FA error | Add `--otp 123456` flag |
| Secrets found | Remove from code before publish |

## Links

- **npm package:** https://www.npmjs.com/package/@axis/client-sdk
- **npm org:** https://www.npmjs.com/org/axis
- **docs:** See [PUBLISH.md](client-sdk/PUBLISH.md)
- **guide:** See [NPM_PUBLISHING_GUIDE.md](NPM_PUBLISHING_GUIDE.md)
- **summary:** See [PUBLICATION_READY.md](PUBLICATION_READY.md)

## Install (After Publishing)

```bash
npm install @axis/client-sdk
# or
npm install @axis/client-sdk@latest
# or
npm install @axis/client-sdk@1.0.0
```

---

**Ready? Run: `npm publish --access public`** 🚀
