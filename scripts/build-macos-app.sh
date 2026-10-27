#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/dist/BerryBrowser.app"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>BerryBrowser</string>
  <key>CFBundleIdentifier</key>
  <string>com.easestart.berry-browser</string>
  <key>CFBundleName</key>
  <string>BerryBrowser</string>
  <key>CFBundleDisplayName</key>
  <string>Ổi Browser</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
</dict>
</plist>
PLIST

if [ -f "$ROOT_DIR/src/client/assets/icon.icns" ]; then
  cp "$ROOT_DIR/src/client/assets/icon.icns" "$APP_DIR/Contents/Resources/icon.icns"
fi

swiftc -O "$ROOT_DIR/src/macos/berry-desktop-shell.swift" \
  -framework AppKit -framework WebKit \
  -o "$APP_DIR/Contents/MacOS/BerryBrowser"

echo "Built $APP_DIR"
