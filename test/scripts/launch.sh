#!/usr/bin/env bash
# Launch Firefox with extension loaded and Marionette enabled
set -euo pipefail

EXT_PATH="${1:?Usage: launch.sh <extension-path> [profile-path]}"
PROFILE_PATH="${2:-$(mktemp -d)}"
MARIONETTE_PORT="${MARIONETTE_PORT:-2828}"
FIREFOX="${FIREFOX_BIN:-firefox}"

# Resolve extension path
EXT_PATH="$(realpath "$EXT_PATH")"

if [[ ! -d "$EXT_PATH" ]] && [[ ! -f "$EXT_PATH" ]]; then
    echo "Error: Extension path not found: $EXT_PATH" >&2
    exit 1
fi

# Check for manifest
if [[ -d "$EXT_PATH" ]] && [[ ! -f "$EXT_PATH/manifest.json" ]]; then
    echo "Error: No manifest.json in extension directory" >&2
    exit 1
fi

echo "Starting Firefox..."
echo "  Extension: $EXT_PATH"
echo "  Profile: $PROFILE_PATH"
echo "  Marionette: localhost:$MARIONETTE_PORT"

# Build Firefox args
ARGS=(
    --marionette
    --marionette-port "$MARIONETTE_PORT"
    --profile "$PROFILE_PATH"
    --new-instance
    --no-remote
)

# Headless mode
if [[ "${HEADLESS:-}" == "1" ]]; then
    ARGS+=(--headless)
    echo "  Mode: headless"
fi

# Disable first-run noise
cat > "$PROFILE_PATH/user.js" << 'EOF'
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.warnOnQuit", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.newtabpage.activity-stream.feeds.topsites", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
user_pref("xpinstall.signatures.required", false);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
EOF

# Start Firefox in background
"$FIREFOX" "${ARGS[@]}" &
FIREFOX_PID=$!

echo "  PID: $FIREFOX_PID"

# Wait for Marionette
echo -n "Waiting for Marionette..."
for i in {1..30}; do
    if nc -z localhost "$MARIONETTE_PORT" 2>/dev/null; then
        echo " ready!"
        break
    fi
    sleep 0.5
    echo -n "."
done

if ! nc -z localhost "$MARIONETTE_PORT" 2>/dev/null; then
    echo " timeout!" >&2
    kill $FIREFOX_PID 2>/dev/null || true
    exit 1
fi

# Install extension via Marionette
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/install-addon.mjs" "$EXT_PATH"

echo ""
echo "Firefox ready. Extension installed."
echo "Connect via: node scripts/interact.mjs <command>"
echo "Kill with: kill $FIREFOX_PID"

# Keep script alive so caller can manage
wait $FIREFOX_PID 2>/dev/null || true
