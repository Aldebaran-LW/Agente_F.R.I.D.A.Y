# Antes do push: .\scripts\prepare-hf-agent-space.ps1 -Agent sophia
# Ou usar Space partilhado friday-prod (recomendado) — ver docs/MAPAS-RESIDENCIAS.md
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY agents-config.yaml app.py sync.py ./
COPY tools ./tools
ENV PORT=7860
ENV DEFAULT_AGENT=sophia
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
