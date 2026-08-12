#!/usr/bin/env bash
set -euo pipefail

REQUEST_PATH="${1:-playwright-handoff/request.json}"
ACCESS_DIR="playwright-handoff/session-access"
PROFILE_DIR="/tmp/playwright-human-profile"
DISPLAY_NUMBER=99
export DISPLAY=":${DISPLAY_NUMBER}"

rm -rf "$ACCESS_DIR" "$PROFILE_DIR"
mkdir -p "$ACCESS_DIR" "$PROFILE_DIR"

TARGET_URL="$(node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(new URL(r.url).toString())' "$REQUEST_PATH")"
VNC_PASSWORD="$(openssl rand -hex 4)"
echo "::add-mask::$VNC_PASSWORD"

nohup Xvfb "$DISPLAY" -screen 0 1440x900x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
echo $! >/tmp/xvfb.pid
for _ in $(seq 1 20); do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
  sleep 1
done
xdpyinfo -display "$DISPLAY" >/dev/null

CHROME_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
nohup "$CHROME_BIN" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --no-first-run \
  --no-default-browser-check \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  --window-size=1440,900 \
  "$TARGET_URL" >/tmp/chrome.log 2>&1 &
echo $! >/tmp/chrome.pid

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:9222/json/version >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:9222/json/version >/dev/null

x11vnc -storepasswd "$VNC_PASSWORD" /tmp/vnc.pass >/dev/null
nohup x11vnc -display "$DISPLAY" -rfbauth /tmp/vnc.pass -forever -shared -rfbport 5900 -noxdamage -quiet >/tmp/x11vnc.log 2>&1 &
echo $! >/tmp/x11vnc.pid

NOVNC_WEB="/usr/share/novnc"
if [[ ! -d "$NOVNC_WEB" ]]; then
  echo "noVNC web root not found: $NOVNC_WEB" >&2
  exit 1
fi
nohup websockify --web="$NOVNC_WEB" 6080 localhost:5900 >/tmp/websockify.log 2>&1 &
echo $! >/tmp/websockify.pid

nohup cloudflared tunnel --url http://127.0.0.1:6080 --no-autoupdate --loglevel info --logfile /tmp/cloudflared.log >/tmp/cloudflared.stdout 2>&1 &
echo $! >/tmp/cloudflared.pid

TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log /tmp/cloudflared.stdout 2>/dev/null | head -n1 || true)"
  if [[ -n "$TUNNEL_URL" ]]; then break; fi
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "Cloudflare Quick Tunnel URL was not created" >&2
  tail -n 80 /tmp/cloudflared.log /tmp/cloudflared.stdout >&2 || true
  exit 1
fi

ACCESS_URL="${TUNNEL_URL}/vnc.html?autoconnect=1&resize=scale&path=websockify"
ACCESS_URL="$ACCESS_URL" VNC_PASSWORD="$VNC_PASSWORD" TARGET_URL="$TARGET_URL" node <<'NODE'
const fs = require('fs');
const record = {
  url: process.env.ACCESS_URL,
  password: process.env.VNC_PASSWORD,
  target_url: process.env.TARGET_URL,
  expires_after_minutes: 7,
  safety: 'Public target only. Complete the visible verification; do not enter credentials, personal data, or other sensitive information.',
};
fs.writeFileSync('playwright-handoff/session-access/access.json', `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
NODE

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "session_ready=true" >>"$GITHUB_OUTPUT"
  echo "access_file=${ACCESS_DIR}/access.json" >>"$GITHUB_OUTPUT"
fi

echo "Human handoff browser is ready; access data was saved to the protected short-lived workflow artifact."
