#!/bin/sh
# Double-click to stop BookKeep (the backend and the phone link).
pkill -f "cloudflared tunnel" 2>/dev/null  # quick and named tunnels both match
pkill -f "ngrok http" 2>/dev/null
pkill -f "python server.py" 2>/dev/null
pkill -f "server.py" 2>/dev/null
pkill -f "next start" 2>/dev/null  # the shop app
echo "BookKeep stopped. You can close this window."
