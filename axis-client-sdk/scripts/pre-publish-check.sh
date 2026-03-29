#!/bin/bash
# Pre-publish checklist for @axis/client-sdk
# Usage: ./scripts/pre-publish-check.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Pre-publish Checklist for @axis/client-sdk"
echo "================================================"
echo ""

# 1. Check npm login
echo -n "✓ Checking npm authentication... "
if npm whoami &>/dev/null; then
    USERNAME=$(npm whoami)
    echo -e "${GREEN}OK${NC} (logged in as: $USERNAME)"
else
    echo -e "${RED}FAILED${NC}"
    echo "  Run: npm login"
    exit 1
fi

# 2. Check package.json
echo -n "✓ Checking package.json... "
if [ -f "package.json" ]; then
    NAME=$(jq -r '.name' package.json)
    VERSION=$(jq -r '.version' package.json)
    if [ "$NAME" = "@axis/client-sdk" ]; then
        echo -e "${GREEN}OK${NC} (v$VERSION)"
    else
        echo -e "${RED}FAILED${NC} (expected '@axis/client-sdk', got '$NAME')"
        exit 1
    fi
else
    echo -e "${RED}FAILED${NC} (package.json not found)"
    exit 1
fi

# 3. Check if version already published
echo -n "✓ Checking if version already published... "
PUBLISHED=$(npm view @axis/client-sdk@$VERSION 2>/dev/null || echo "")
if [ -z "$PUBLISHED" ]; then
    echo -e "${GREEN}OK${NC} (version $VERSION not published yet)"
else
    echo -e "${RED}FAILED${NC} (version $VERSION already published!)"
    exit 1
fi

# 4. Build package
echo -n "✓ Building package... "
if npm run build &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "  Run: npm run build"
    exit 1
fi

# 5. Check dist directory
echo -n "✓ Checking dist directory... "
if [ -d "dist" ]; then
    FILES=$(ls -1 dist/ | wc -l)
    echo -e "${GREEN}OK${NC} ($FILES files)"
else
    echo -e "${RED}FAILED${NC} (dist/ directory not found)"
    exit 1
fi

# 6. Check main entry point
echo -n "✓ Checking main entry point... "
if [ -f "dist/index.js" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} (dist/index.js not found)"
    exit 1
fi

# 7. Check TypeScript definitions
echo -n "✓ Checking TypeScript definitions... "
if [ -f "dist/index.d.ts" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} (dist/index.d.ts not found)"
    exit 1
fi

# 8. Check README
echo -n "✓ Checking README.md... "
if [ -f "README.md" ]; then
    LINES=$(wc -l < README.md)
    echo -e "${GREEN}OK${NC} ($LINES lines)"
else
    echo -e "${RED}FAILED${NC} (README.md not found)"
    exit 1
fi

# 9. Check LICENSE
echo -n "✓ Checking LICENSE... "
if [ -f "../LICENSE" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC} (../LICENSE not found)"
    exit 1
fi

# 10. Check .npmignore
echo -n "✓ Checking .npmignore... "
if [ -f ".npmignore" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARN${NC} (.npmignore not found, will include more files)"
fi

# 11. Test package with npm pack
echo -n "✓ Testing package with npm pack... "
TEMP_DIR=$(mktemp -d)
if npm pack --dry-run &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# 12. Verify no secrets in package
echo -n "✓ Checking for secrets... "
SECRETS=$(find dist/ -type f \( -name "*.js" -o -name "*.ts" -o -name "*.json" \) -exec grep -l "secret\|password\|token\|api.key" {} \; 2>/dev/null || echo "")
if [ -z "$SECRETS" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}WARN${NC} (found potential secrets)"
    echo "$SECRETS"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. npm publish --access public"
echo "  2. Verify at: https://www.npmjs.com/package/@axis/client-sdk"
echo ""
