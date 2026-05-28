#!/usr/bin/env bash
# Ollama CPU-only na EC2 pequena (8 GiB disco, 2 GiB RAM).
# Evita pacote completo com CUDA (~3+ GiB). Executar: sudo bash ec2-install-ollama.sh
set -euo pipefail

MODEL="${OLLAMA_MODEL:-smollm2:360m}"
OLLAMA_BIN="/usr/local/bin/ollama"
OLLAMA_LIB="/usr/local/lib/ollama"

install_cpu_binary() {
  echo "==> Ollama (extração CPU-only, sem CUDA)"
  command -v zstd >/dev/null || apt-get install -y -qq zstd
  mkdir -p "$OLLAMA_LIB" "$(dirname "$OLLAMA_BIN")"

  # Extrair só binário + backends CPU (pula cuda_*, vulkan)
  curl -fsSL "https://ollama.com/download/ollama-linux-amd64.tar.zst" \
    | zstd -d \
    | tar -x -C /usr/local \
      --wildcards \
      'bin/ollama' \
      'lib/ollama/libggml-base.so*' \
      'lib/ollama/libggml-cpu*.so*' \
      2>/dev/null || {
        echo "Extração selectiva falhou; tentando install.sh..."
        curl -fsSL https://ollama.com/install.sh | sh
      }

  chmod +x "$OLLAMA_BIN" 2>/dev/null || true
}

if ! command -v ollama >/dev/null 2>&1; then
  rm -rf "$OLLAMA_LIB" "$OLLAMA_BIN" 2>/dev/null || true
  install_cpu_binary
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "ERRO: ollama não instalado."
  exit 1
fi

# Serviço systemd (oficial costuma criar; garantimos)
if [ ! -f /etc/systemd/system/ollama.service ] && [ ! -f /lib/systemd/system/ollama.service ]; then
  cat >/etc/systemd/system/ollama.service <<'EOF'
[Unit]
Description=Ollama
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment=HOME=/usr/share/ollama

[Install]
WantedBy=multi-user.target
EOF
  id ollama &>/dev/null || useradd -r -s /bin/false -U -m -d /usr/share/ollama ollama
  mkdir -p /usr/share/ollama
  chown -R ollama:ollama /usr/share/ollama
fi

mkdir -p /etc/systemd/system/ollama.service.d
cat >/etc/systemd/system/ollama.service.d/openclaw.conf <<'EOF'
[Service]
Environment=OLLAMA_MAX_LOADED_MODELS=1
Environment=OLLAMA_NUM_PARALLEL=1
Environment=OLLAMA_KEEP_ALIVE=5m
EOF

systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama
sleep 3

if ! curl -sf http://127.0.0.1:11434/ >/dev/null; then
  echo "ERRO: Ollama não responde em :11434"
  journalctl -u ollama -n 20 --no-pager || true
  exit 1
fi

echo "==> Pull ${MODEL}"
ollama pull "${MODEL}"

echo "==> Teste"
ollama run "${MODEL}" "ok" 2>/dev/null | head -2 || true
df -h /
echo "OK modelo=${MODEL}"
