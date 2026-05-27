#!/usr/bin/env bash
# Executar na EC2 como root: bash ec2-fix-control-ui-origin.sh
set -euo pipefail
CFG="/root/.openclaw/openclaw.json"
python3 <<'PY'
import json
p = "/root/.openclaw/openclaw.json"
with open(p) as f:
    c = json.load(f)
g = c.setdefault("gateway", {})
cu = g.setdefault("controlUi", {})
cu["allowedOrigins"] = ["http://18.191.36.145:18789"]
cu["allowInsecureAuth"] = True
with open(p, "w") as f:
    json.dump(c, f, indent=2)
    f.write("\n")
print("allowedOrigins OK")
PY
systemctl restart openclaw-gateway
sleep 2
systemctl is-active openclaw-gateway
