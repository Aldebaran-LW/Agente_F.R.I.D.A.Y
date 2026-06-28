#!/usr/bin/env bash
set -euo pipefail
ENV=/opt/openclaw/.env
read_env() { grep -m1 "^$1=" "$ENV" | cut -d= -f2- | tr -d '\r'; }
KEY=$(read_env GROQ_API_KEY)
MODEL=$(read_env GROQ_MODEL)
MODEL=${MODEL:-llama-3.1-8b-instant}
code=$(curl -sS -o /tmp/groq-ping.json -w "%{http_code}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"Oi\"}],\"max_tokens\":24}" \
  https://api.groq.com/openai/v1/chat/completions)
echo "Groq model=${MODEL} HTTP ${code}"
head -c 200 /tmp/groq-ping.json
echo
df -h / | tail -1
