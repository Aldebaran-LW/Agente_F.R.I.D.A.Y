export function requireAuth(request, env) {
  const token = env.OPENCLAW_AUTOMATION_TOKEN || env.CLIENT_TOKEN;
  if (!token) return true;
  const auth = request.headers.get('Authorization') || '';
  const match = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return match === token;
}
