/**
 * Commit ficheiro num Dataset HF (formato NDJSON — API actual).
 */
export async function commitDatasetFile(dataset, token, filePath, contentUtf8, summary) {
  const b64 = Buffer.from(contentUtf8, 'utf8').toString('base64');
  const body = [
    JSON.stringify({ key: 'header', value: { summary, description: '' } }),
    JSON.stringify({
      key: 'file',
      value: { path: filePath, content: b64, encoding: 'base64' },
    }),
  ].join('\n');

  const res = await fetch(`https://huggingface.co/api/datasets/${dataset}/commit/main`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-ndjson',
    },
    body,
    signal: AbortSignal.timeout(60000),
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}