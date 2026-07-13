#!/usr/bin/env bash
# verify-services.sh — deterministic probe for the Lailaba Termux service stack.
# Reports gateway, lailaba-ai (:8000), dashboard (:9119), and watchdog tmux sessions.
# Usage: bash ~/.lailaba/skills/devops/lailaba-termux-services/scripts/verify-services.sh
set -u
echo "=== tmux sessions ==="; tmux ls 2>/dev/null || echo "(none)"
echo "=== :8000 (lailaba-ai) ==="; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health 2>/dev/null
echo "=== :9119 (dashboard) ==="; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9119/ 2>/dev/null
echo "=== gateway proc ==="; pgrep -af "lailaba gateway" | grep -v "bash -c" || echo "GATEWAY NOT RUNNING"
echo "=== gateway-watchdog proc ==="; pgrep -af "hermes-gateway-watch.sh" | grep -v "bash -c" || echo "watchdog not running"
echo "=== duplicate gateway check (expect 1 pair) ==="; pgrep -af "lailaba gateway" | grep -v "bash -c" | wc -l
echo "=== cron jobs ==="; lailaba cron list 2>/dev/null || echo "(cron tool unavailable)"
