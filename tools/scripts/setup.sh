#!/bin/bash
# Manchengo Smart ERP - Development Setup Script

set -e

echo "================================================"
echo "  Manchengo Smart ERP - Development Setup"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is not installed"
        return 1
    fi
}

echo "Checking prerequisites..."
echo ""

MISSING=0

check_command "rustc" || MISSING=1
check_command "cargo" || MISSING=1
check_command "node" || MISSING=1
check_command "npm" || MISSING=1
check_command "flutter" || MISSING=1

echo ""

if [ $MISSING -eq 1 ]; then
    echo -e "${YELLOW}Some prerequisites are missing. Please install them before continuing.${NC}"
    echo ""
    echo "Required:"
    echo "  - Rust: https://rustup.rs/"
    echo "  - Node.js: https://nodejs.org/"
    echo "  - Flutter: https://flutter.dev/docs/get-started/install"
    echo ""
    exit 1
fi

echo -e "${GREEN}All prerequisites satisfied!${NC}"
echo ""

# Build Rust packages
echo "Building Rust packages..."
echo ""

cargo build --workspace

echo ""
echo -e "${GREEN}Rust packages built successfully!${NC}"
echo ""

# Setup desktop app
echo "Setting up desktop app..."
echo ""

cd apps/desktop

if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}Desktop dependencies installed!${NC}"
else
    echo -e "${YELLOW}No package.json found in apps/desktop. Skipping npm install.${NC}"
fi

cd ../..

# Setup mobile app
echo ""
echo "Setting up mobile app..."
echo ""

cd apps/mobile

flutter pub get

echo -e "${GREEN}Mobile dependencies installed!${NC}"

cd ../..

# Done
echo ""
echo "================================================"
echo -e "${GREEN}  Setup complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "  Desktop development:"
echo "    cd apps/desktop && cargo tauri dev"
echo ""
echo "  Mobile development:"
echo "    cd apps/mobile && flutter run"
echo ""
echo "  Run tests:"
echo "    cargo test --workspace"
echo ""
