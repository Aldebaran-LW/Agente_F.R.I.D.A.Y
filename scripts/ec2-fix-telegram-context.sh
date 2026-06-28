#!/usr/bin/env bash
# Telegram: contexto inflado + HF 402 — Groq-only, sem HF Inference cloud.
set -euo pipefail
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/opt/openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
cd "$OPENCLAW_ROOT"

bash scripts/ec2-apply-local-first.sh

echo "==> test groq"
node scripts/test-groq.mjs || true

echo "OK — Telegram: /new depois oi ou status macofel"
