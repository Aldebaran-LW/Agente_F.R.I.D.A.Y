#!/usr/bin/env node
/** Atalho: corre monitor e grava alerta no Hub se necessário. */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'heimdall-flow-monitor.mjs');
const child = spawn(process.execPath, [script, '--alert'], { stdio: 'inherit', cwd: resolve(script, '..') });
child.on('exit', (code) => process.exit(code ?? 1));
