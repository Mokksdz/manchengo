#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Desktop Build Script
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: ./scripts/build-desktop.sh [--target <target>] [--skip-tests]
#
# Targets:
#   macos-arm    (aarch64-apple-darwin)   - Apple Silicon
#   macos-intel  (x86_64-apple-darwin)    - Intel Mac
#   windows      (x86_64-pc-windows-msvc) - Windows x64
#   linux        (x86_64-unknown-linux-gnu) - Linux x64
#
# Examples:
#   ./scripts/build-desktop.sh                    # Build for current platform
#   ./scripts/build-desktop.sh --target windows   # Cross-compile for Windows
#   ./scripts/build-desktop.sh --skip-tests       # Skip test suite

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
SKIP_TESTS=false
TARGET=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Resolve target
resolve_target() {
    case "$TARGET" in
        macos-arm|"")
            if [[ "$(uname -m)" == "arm64" ]] && [[ "$TARGET" == "" ]]; then
                RUST_TARGET="aarch64-apple-darwin"
                BUNDLE_TYPE="dmg"
            elif [[ "$TARGET" == "macos-arm" ]]; then
                RUST_TARGET="aarch64-apple-darwin"
                BUNDLE_TYPE="dmg"
            elif [[ "$(uname -m)" == "x86_64" ]] && [[ "$TARGET" == "" ]]; then
                RUST_TARGET="x86_64-apple-darwin"
                BUNDLE_TYPE="dmg"
            else
                RUST_TARGET="x86_64-unknown-linux-gnu"
                BUNDLE_TYPE="appimage"
            fi
            ;;
        macos-intel)
            RUST_TARGET="x86_64-apple-darwin"
            BUNDLE_TYPE="dmg"
            ;;
        windows)
            RUST_TARGET="x86_64-pc-windows-msvc"
            BUNDLE_TYPE="msi"
            ;;
        linux)
            RUST_TARGET="x86_64-unknown-linux-gnu"
            BUNDLE_TYPE="appimage"
            ;;
        *)
            echo -e "${RED}Unknown target: $TARGET${NC}"
            echo "Valid targets: macos-arm, macos-intel, windows, linux"
            exit 1
            ;;
    esac
}

resolve_target

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Manchengo Smart ERP - Desktop Build${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Target:  ${GREEN}$RUST_TARGET${NC}"
echo -e "  Bundle:  ${GREEN}$BUNDLE_TYPE${NC}"
echo ""

# Step 1: Run tests
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}[1/4] Running backend tests...${NC}"
    cd "$ROOT_DIR/apps/backend"
    npm test --silent 2>&1 | tail -5
    echo -e "${GREEN}Tests passed!${NC}"
    echo ""
fi

# Step 2: Build frontend
echo -e "${YELLOW}[2/4] Building frontend...${NC}"
cd "$ROOT_DIR/apps/web"
npm run build 2>&1 | tail -3
echo -e "${GREEN}Frontend built!${NC}"
echo ""

# Step 3: Prepare UI for Tauri
echo -e "${YELLOW}[3/4] Preparing UI for Tauri...${NC}"
UI_DIR="$ROOT_DIR/apps/desktop/src-tauri/ui"
mkdir -p "$UI_DIR"

# Copy public assets
cp -r "$ROOT_DIR/apps/web/public/"* "$UI_DIR/" 2>/dev/null || true

# Create loading page (Tauri will load this while app initializes)
cat > "$UI_DIR/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Manchengo Smart ERP</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0f172a; color: #e2e8f0; }
    .loader { text-align: center; }
    .loader h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .loader p { color: #94a3b8; }
    .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 1rem auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <h1>Manchengo Smart ERP</h1>
    <div class="spinner"></div>
    <p>Chargement...</p>
  </div>
</body>
</html>
HTMLEOF

echo -e "${GREEN}UI prepared!${NC}"
echo ""

# Step 4: Build Tauri desktop app
echo -e "${YELLOW}[4/4] Building Tauri desktop app (this may take several minutes)...${NC}"
cd "$ROOT_DIR"
cargo tauri build --target "$RUST_TARGET" --bundles "$BUNDLE_TYPE" 2>&1 | tail -10

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Build complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

# Find and display the output
echo ""
echo -e "${BLUE}Output files:${NC}"
find "$ROOT_DIR/apps/desktop/src-tauri/target/$RUST_TARGET/release/bundle" \
    -type f \( -name "*.msi" -o -name "*.dmg" -o -name "*.AppImage" -o -name "*.deb" \) \
    2>/dev/null | while read -r file; do
    SIZE=$(du -h "$file" | cut -f1)
    echo -e "  ${GREEN}$file${NC} ($SIZE)"
done
