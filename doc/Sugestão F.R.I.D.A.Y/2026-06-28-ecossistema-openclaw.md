# Ecossistema OpenClaw — higiene e próximos passos

**Data:** 2026-06-28 | **Autor:** F.R.I.D.A.Y. | **Estado:** aberta | **Prioridade:** P1

## Contexto

Telegram via bridge Jarvis (gateway Vercel). HF Inference cloud desligado na EC2. Lab HF local em Docker até assinatura PRO.

## Sugestões

- **P0** — Disco EC2 ~88%: aumentar EBS ou `scripts/ec2-disk-cleanup.sh`
- **P1** — Manter esta pasta nos repos irmãos (Macofel, Texte)
- **P1** — HF local via Docker; não reactivar HF cloud na EC2 sem créditos
- **P2** — Scripts `.sh` UTF-8 sem BOM para EC2

## Próximo passo

`ec2-sync-from-pc.ps1` após push; testar Telegram: `oi`, `status macofel`.