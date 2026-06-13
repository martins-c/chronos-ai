const COOKIE_NAME = 'chronos_session';
const PUBLIC_PATHS = new Set([
  '/login.html',
  '/css/login.css',
  '/manifest.json',
  '/sw.js',
  '/icons/chronos.svg',
  '/icons/chronos-192.png',
  '/icons/chronos-512.png',
  '/api/auth',
]);

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

function toBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
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

async function hasValidSession(request) {
  const secret = process.env.CHRONOS_SESSION_SECRET || process.env.CHRONOS_PASSWORD;
  const token = readCookie(request, COOKIE_NAME);
  if (!secret || !token) return false;

  const separator = token.indexOf('.');
  if (separator < 1) return false;
  const expiresAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Date.now()) return false;
  return signature === await sign(expiresAt, secret);
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const isPublic = PUBLIC_PATHS.has(url.pathname);
  const authenticated = await hasValidSession(request);

  if (url.pathname === '/login.html' && authenticated) {
    return Response.redirect(new URL('/', request.url), 302);
  }

  if (isPublic) return;

  if (!authenticated) {
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Autenticacao necessaria.' }, { status: 401 });
    }
    return Response.redirect(new URL('/login.html', request.url), 302);
  }
}

export const config = {
  matcher: '/((?!_vercel/).*)',
};
