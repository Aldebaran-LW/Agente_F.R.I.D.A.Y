#!/usr/bin/env bash
set -euo pipefail
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/root/.openclaw/openclaw.json}"
python3 - "$OPENCLAW_CONFIG" <<'PY'
import json, sys
p = sys.argv[1]
with open(p) as f:
    d = json.load(f)
d.setdefault("channels", {}).setdefault("telegram", {})["enabled"] = False
d.get("models", {}).get("providers", {}).pop("huggingface", None)
with open(p, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
print("OK telegram disabled, HF removed")
PY