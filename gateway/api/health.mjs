export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'openclaw-gateway',
    jarvis: true,
    routes_version: 3,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    at: new Date().toISOString(),
  });
}
