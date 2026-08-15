#!/bin/bash
# One-click Syella installer.
# Copies Syella.app to /Applications and strips the macOS quarantine flag
# so Gatekeeper doesn't show the misleading "damaged" dialog on first open.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SRC="$SCRIPT_DIR/Syella.app"
APP_DST="/Applications/Syella.app"

if [ ! -d "$APP_SRC" ]; then
  osascript -e 'display alert "Install failed" message "Syella.app was not found next to this installer." as critical'
  exit 1
fi

# Remove old install if present
if [ -d "$APP_DST" ]; then
  rm -rf "$APP_DST"
fi

# Copy the app into /Applications
cp -R "$APP_SRC" "$APP_DST"

# Strip quarantine so Gatekeeper doesn't complain
xattr -cr "$APP_DST" 2>/dev/null || true

# Launch it
open "$APP_DST"

osascript -e 'display notification "Syella installed to /Applications" with title "Syella"'
