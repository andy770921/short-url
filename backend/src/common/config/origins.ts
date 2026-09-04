import { ConfigService } from '@nestjs/config';

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * Origin the frontend is served from, and the base URL that generated short links are
 * built from: short links live on the frontend origin, which forwards /:shortCode to
 * this backend for the actual redirect.
 *
 * Deliberately not derived from the request (req.protocol / req.get('host')): behind
 * Vercel's TLS-terminating proxy the protocol reads as 'http', and Host is
 * client-controlled, so trusting it would let a caller mint short links pointing at any
 * domain they like.
 */
export function resolveFrontendOrigin(config: ConfigService): string {
  return stripTrailingSlash(config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3001'));
}

/**
 * Origin this backend is reachable at, detected per deployment platform.
 * Vercel: VERCEL_URL (e.g. 'my-app.vercel.app')
 * Render: RENDER_EXTERNAL_URL (full URL with protocol)
 * Railway: RAILWAY_PUBLIC_DOMAIN (e.g. 'my-app.railway.app')
 * Development: http://localhost:PORT
 */
export function resolveBackendOrigin(config: ConfigService): string {
  const renderUrl = config.get<string>('RENDER_EXTERNAL_URL');
  if (renderUrl) {
    return stripTrailingSlash(renderUrl);
  }

  const vercelUrl = config.get<string>('VERCEL_URL');
  if (vercelUrl) {
    return `https://${stripTrailingSlash(vercelUrl)}`;
  }

  const railwayDomain = config.get<string>('RAILWAY_PUBLIC_DOMAIN');
  if (railwayDomain) {
    return `https://${stripTrailingSlash(railwayDomain)}`;
  }

  return `http://localhost:${config.get<number>('PORT', 3000)}`;
}
