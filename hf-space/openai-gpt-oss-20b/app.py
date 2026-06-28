"""Space Docker FastAPI — porta 7860 (Hugging Face Spaces)."""
from fastapi import FastAPI

app = FastAPI(
    title="OpenAI GPT-OSS 20B",
    description="API leve no HF Space Aldebaran-LW. Evolui para proxy de inferência.",
    version="0.1.0",
)


@app.get("/")
def greet_json():
    return {"Hello": "World!"}


@app.get("/health")
def health():
    return {"ok": True, "service": "openai-gpt-oss-20b"}
