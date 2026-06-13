const COOKIE_NAME = 'chronos_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const config = { runtime: 'edge' };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

function toBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function constantTimeEqual(left, right) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.length] || 0) ^ (b[index % b.length] || 0);
  }
  return difference === 0;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function sessionCookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);

  const configuredPassword = process.env.CHRONOS_PASSWORD;
  const sessionSecret = process.env.CHRONOS_SESSION_SECRET || configuredPassword;
  if (!configuredPassword || !sessionSecret) {
    return json({ error: 'A senha privada da Chronos ainda nao foi configurada na Vercel.' }, 503);
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  const suppliedPassword = String(body.password || '');
  if (!suppliedPassword || !(await constantTimeEqual(suppliedPassword, configuredPassword))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return json({ error: 'Senha incorreta.' }, 401);
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const signature = await sign(String(expiresAt), sessionSecret);
  const token = encodeURIComponent(`${expiresAt}.${signature}`);
  return json(
    { ok: true },
    200,
    { 'Set-Cookie': sessionCookie(token, Math.floor(SESSION_DURATION_MS / 1000)) }
  );
}
