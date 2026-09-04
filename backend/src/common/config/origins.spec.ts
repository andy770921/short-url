import { ConfigService } from '@nestjs/config';
import { resolveBackendOrigin, resolveFrontendOrigin } from './origins';

const configWith = (values: Record<string, unknown>): ConfigService =>
  ({
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
  }) as unknown as ConfigService;

describe('origins', () => {
  describe('resolveFrontendOrigin', () => {
    it('falls back to the local frontend port', () => {
      expect(resolveFrontendOrigin(configWith({}))).toBe('http://localhost:3001');
    });

    it('strips a trailing slash', () => {
      expect(resolveFrontendOrigin(configWith({ FRONTEND_ORIGIN: 'https://fe.example.com/' }))).toBe(
        'https://fe.example.com',
      );
    });

    it('never downgrades an https deployment to http', () => {
      expect(
        resolveFrontendOrigin(configWith({ FRONTEND_ORIGIN: 'https://andy-short-url.vercel.app' })),
      ).toBe('https://andy-short-url.vercel.app');
    });
  });

  describe('resolveBackendOrigin', () => {
    it('prefixes https for a Vercel host', () => {
      expect(resolveBackendOrigin(configWith({ VERCEL_URL: 'be.vercel.app' }))).toBe(
        'https://be.vercel.app',
      );
    });

    it('uses the full URL Render provides', () => {
      expect(
        resolveBackendOrigin(configWith({ RENDER_EXTERNAL_URL: 'https://be.onrender.com' })),
      ).toBe('https://be.onrender.com');
    });

    it('falls back to localhost with the configured port', () => {
      expect(resolveBackendOrigin(configWith({ PORT: 4000 }))).toBe('http://localhost:4000');
    });
  });
});
