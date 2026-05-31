# Groq API — OpenClaw

API OpenAI-compatible: `https://api.groq.com/openai/v1`

Relacionado: [HF-INFERENCE-ROUTER.md](./HF-INFERENCE-ROUTER.md) (Groq também via HF `:groq` suffix)

---

## Variáveis

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

Chave: [console.groq.com/keys](https://console.groq.com/keys)

---

## Teste

```powershell
cd scripts
node test-groq.mjs
```

---

## Nota

- **HF Router**: `HF_INFERENCE_MODEL=...:groq` usa Groq via Hugging Face (outra chave: `HF_TOKEN`).
- **Groq directo**: `GROQ_API_KEY` — futuro fallback EC2 (ainda não wired no Telegram).