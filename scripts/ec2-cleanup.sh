#!/usr/bin/env bash
# Alias — ver scripts/ec2-disk-cleanup.sh
exec "$(dirname "$0")/ec2-disk-cleanup.sh" "$@"
