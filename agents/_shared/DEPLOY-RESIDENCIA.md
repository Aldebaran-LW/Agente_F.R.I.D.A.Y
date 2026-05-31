# deploy — campo em config.yaml

```yaml
deploy:
  mode: hf_space | aws_ec2 | vercel_gateway
  hf_space: Aldebaran-LW/friday-prod   # ou Space dedicado
  hf_path: /run/yato
  promote_to: aws_ec2
  schedule: "0 */6 * * *"              # opcional, cron EC2
```

| mode | Significado |
|------|-------------|
| `hf_space` | Residência provisória no Hugging Face |
| `aws_ec2` | Produção — executor real |
| `vercel_gateway` | Só roteamento/UI (Friday) |

Mapa completo: `docs/MAPAS-RESIDENCIAS.md`
