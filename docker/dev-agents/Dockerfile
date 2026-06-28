FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates ripgrep openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (oficial)
RUN curl -fsSL https://claude.ai/install.sh | bash \
  && install -m 0755 "$(readlink -f /root/.local/bin/claude 2>/dev/null || echo /root/.local/bin/claude)" /usr/local/bin/claude 2>/dev/null \
  || npm install -g @anthropic-ai/claude-code

# Kilo Code CLI
RUN npm install -g @kilocode/cli

ENV PATH="/root/.local/bin:/usr/local/bin:${PATH}"
WORKDIR /workspace

RUN claude --version 2>/dev/null || true \
  && (kilo --version 2>/dev/null || kilocode --version 2>/dev/null || true)

CMD ["bash"]