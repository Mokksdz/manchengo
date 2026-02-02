#!/bin/bash
# Manchengo Smart ERP - macOS Build Script
# Builds notarized .app for macOS distribution

set -e

echo "=== Manchengo Smart ERP macOS Build ==="

RELEASE=false
NOTARIZE=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --release) RELEASE=true ;;
        --notarize) NOTARIZE=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v cargo &> /dev/null; then
    echo "Error: Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: Node.js/npm not found. Install from https://nodejs.org"
    exit 1
fi

# Build frontend
echo "Building frontend..."
pushd ../web
npm run build
npm run export
popd

# Build Tauri app
echo "Building Tauri application..."

if [ "$RELEASE" = true ]; then
    cargo tauri build
else
    cargo tauri build --debug
fi

# Notarize if requested
if [ "$NOTARIZE" = true ]; then
    echo "Notarizing application..."
    
    APP_PATH="target/release/bundle/macos/Manchengo ERP.app"
    
    if [ -d "$APP_PATH" ]; then
        # Create zip for notarization
        ZIP_PATH="target/release/bundle/macos/Manchengo_ERP.zip"
        ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"
        
        # Submit for notarization
        # Requires Apple Developer account credentials
        xcrun notarytool submit "$ZIP_PATH" \
            --apple-id "$APPLE_ID" \
            --team-id "$APPLE_TEAM_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --wait
        
        # Staple the notarization ticket
        xcrun stapler staple "$APP_PATH"
        
        echo "Application notarized successfully"
        
        # Create DMG
        echo "Creating DMG..."
        create-dmg \
            --volname "Manchengo ERP" \
            --window-pos 200 120 \
            --window-size 600 400 \
            --icon-size 100 \
            --icon "Manchengo ERP.app" 150 190 \
            --app-drop-link 450 190 \
            "target/release/bundle/macos/Manchengo_ERP.dmg" \
            "$APP_PATH"
    fi
fi

# Output location
if [ "$RELEASE" = true ]; then
    BUNDLE_PATH="target/release/bundle"
else
    BUNDLE_PATH="target/debug/bundle"
fi

echo ""
echo "=== Build Complete ==="
echo "Application available at: $BUNDLE_PATH/macos/"
echo "  - App: Manchengo ERP.app"
if [ "$NOTARIZE" = true ]; then
    echo "  - DMG: Manchengo_ERP.dmg (notarized)"
fi
