#!/bin/bash
set -e

# Build Release Script for Diffy
# This script builds the macOS app and creates distribution packages

echo "🔨 Building Diffy release..."

# Get version from tauri.conf.json
VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
echo "📦 Version: $VERSION"

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Build the Tauri app
echo "🚀 Building Tauri app..."
npm run tauri build

# Check what architecture we're on
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64-apple-darwin"
else
    TARGET="x86_64-apple-darwin"
fi

echo "🏗️  Built for architecture: $TARGET"

# Paths
APP_BUNDLE="src-tauri/target/release/bundle/macos/Diffy.app"
BINARY="src-tauri/target/release/diffy"
DIST_DIR="dist-release"

# Create distribution directory
mkdir -p "$DIST_DIR"

# Package the app bundle as tar.gz
echo "📦 Packaging app bundle..."
tar -czf "$DIST_DIR/diffy-${TARGET}.tar.gz" -C "src-tauri/target/release/bundle/macos" "Diffy.app"

# Also copy the DMG if it exists
if [ -f "src-tauri/target/release/bundle/dmg/Diffy_${VERSION}_${ARCH}.dmg" ]; then
    echo "💿 Copying DMG..."
    cp "src-tauri/target/release/bundle/dmg/Diffy_${VERSION}_${ARCH}.dmg" "$DIST_DIR/"
fi

# Calculate SHA256
echo "🔐 Calculating SHA256..."
shasum -a 256 "$DIST_DIR/diffy-${TARGET}.tar.gz" | tee "$DIST_DIR/diffy-${TARGET}.tar.gz.sha256"

echo ""
echo "✅ Build complete!"
echo "📂 Distribution files in: $DIST_DIR"
echo ""
ls -lh "$DIST_DIR"
echo ""
echo "SHA256:"
cat "$DIST_DIR/diffy-${TARGET}.tar.gz.sha256"
