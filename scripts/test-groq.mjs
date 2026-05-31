#!/usr/bin/env node
/** Testa GROQ_API_KEY sem imprimir a chave. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const vars = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const key = vars.GROQ_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim() || "";
const model = vars.GROQ_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
if (!key) {
  console.log("GROQ_API_KEY: ausente — preencha no .env");
  process.exit(1);
}
console.log("GROQ_API_KEY: definida (" + key.slice(0, 8) + "...)");
console.log("model:", model);
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Responde so: OK" }],
    max_tokens: 8,
  }),
  signal: AbortSignal.timeout(25000),
});
const body = await res.json().catch(() => ({}));
const reply = body.choices?.[0]?.message?.content?.trim();
console.log("chat:", res.status, res.ok ? "reply=" + JSON.stringify(reply) : body.error?.message || "erro");
process.exit(res.ok ? 0 : 1);