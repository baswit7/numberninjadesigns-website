import { invariant } from './core.mjs';

function required(env, name, maximum = 8192) {
  const value = String(env[name] ?? '').trim();
  invariant(value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value), 500, 'SERVER_CONFIGURATION_INVALID', 'De serverconfiguratie is onvolledig.');
  return value;
}

function exactUrl(value, name, origin, pathname) {
  let parsed;
  try { parsed = new URL(value); } catch { parsed = null; }
  invariant(parsed && parsed.origin === origin && parsed.pathname === pathname && !parsed.search && !parsed.hash && !parsed.username && !parsed.password, 500, 'SERVER_CONFIGURATION_INVALID', `${name} is ongeldig geconfigureerd.`);
  return parsed.href;
}

export function loadPublisherConfig(env = process.env) {
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const originValue = required(env, 'SOCIAL_PUBLISHER_ORIGIN', 300).replace(/\/$/u, '');
  let origin;
  try { origin = new URL(originValue); } catch { origin = null; }
  invariant(origin && !origin.pathname.replaceAll('/', '') && !origin.search && !origin.hash && !origin.username && !origin.password, 500, 'SERVER_CONFIGURATION_INVALID', 'De publieke origin is ongeldig.');
  invariant(origin.protocol === 'https:' || (!production && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)), 500, 'SERVER_CONFIGURATION_INVALID', 'De publieke origin vereist HTTPS.');

  const mode = required(env, 'SOCIAL_PUBLISHER_TIKTOK_MODE', 20).toLowerCase();
  invariant(['review', 'production'].includes(mode), 500, 'SERVER_CONFIGURATION_INVALID', 'De TikTok-modus is ongeldig.');

  const config = {
    databaseUrl: required(env, 'DATABASE_URL', 4096),
    encryptionKey: required(env, 'SOCIAL_PUBLISHER_ENCRYPTION_KEY', 64),
    origin: origin.origin,
    secureCookies: origin.protocol === 'https:',
    mode,
    etsy: {
      clientId: required(env, 'ETSY_CLIENT_ID', 256),
      sharedSecret: required(env, 'ETSY_SHARED_SECRET', 512),
      redirectUri: required(env, 'ETSY_REDIRECT_URI', 500),
    },
    tiktok: {
      clientKey: required(env, 'TIKTOK_CLIENT_KEY', 256),
      clientSecret: required(env, 'TIKTOK_CLIENT_SECRET', 512),
      redirectUri: required(env, 'TIKTOK_REDIRECT_URI', 500),
    },
  };
  config.etsy.redirectUri = exactUrl(config.etsy.redirectUri, 'Etsy redirect URI', config.origin, '/etsy/callback/');
  config.tiktok.redirectUri = exactUrl(config.tiktok.redirectUri, 'TikTok redirect URI', config.origin, '/tiktok/callback/');
  return Object.freeze(config);
}

export function publicConfig(config) {
  return Object.freeze({ mode: config.mode, origin: config.origin, maximumVideoBytes: 4_000_000, videoSeconds: 10, videoFps: 24 });
}
