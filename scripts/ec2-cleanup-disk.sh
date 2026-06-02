#!/usr/bin/env bash
# ec2-cleanup-disk.sh — alias para ec2-disk-cleanup.sh (nome usado na documentação F.R.I.D.A.Y.)
# Uso na EC2: sudo bash /opt/openclaw/scripts/ec2-cleanup-disk.sh
exec "$(dirname "$0")/ec2-disk-cleanup.sh" "$@"
