# API Security Hardening - Implementation Guide

## Document Information
- **Ticket:** FEAT-2
- **Created:** 2026-03-26
- **Type:** Development Implementation
- **Estimated Time:** 7-9 hours

## Implementation Overview

This document provides step-by-step instructions for implementing API security hardening using Next.js Server Actions and NestJS authentication guards.

## Prerequisites

- Node.js 20+ installed
- npm workspaces configured
- Backend running on port 3000
- Frontend running on port 3001
- Git for version control

## Phase 1: Frontend Server Actions Setup (2-3 hours)

### Step 1.1: Install Zod Dependency

```bash
cd frontend
npm install zod
```

**Verification:**
```bash
npm list zod
# Should show: zod@3.x.x
```

### Step 1.2: Create Action Result Type

**File:** `frontend/src/actions/lib/action-result.ts`

```typescript
/**
 * Type-safe result wrapper for Server Actions
 * Using discriminated union pattern for compile-time error handling
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

**Why this pattern?**
- TypeScript enforces checking `success` before accessing `data`
- Maps naturally to Zod validation errors
- Standard pattern in Next.js community

### Step 1.3: Create Action Utilities

**File:** `frontend/src/actions/lib/action-utils.ts`

```typescript
import { ZodSchema, ZodError } from 'zod';
import { ActionResult } from './action-result';

/**
 * Validates input against a Zod schema
 * Converts Zod errors to ActionResult format
 */
export async function validateInput<T>(
  schema: ZodSchema<T>,
  input: unknown,
): Promise<ActionResult<T>> {
  try {
    const data = await schema.parseAsync(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, error: 'Invalid input' };
  }
}

/**
 * Executes an async action with error handling
 * Converts exceptions to ActionResult format
 */
export async function executeAction<T>(
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    console.error('Action error:', error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

**Testing tip:** These utilities are pure functions - easy to unit test!

### Step 1.4: Create Zod Validation Schema

**File:** `frontend/src/actions/urls/create-short-url.schema.ts`

```typescript
import { z } from 'zod';
import { CUSTOM_ALIAS_MAX_LENGTH, CUSTOM_ALIAS_PATTERN } from '@repo/shared';

/**
 * Zod schema for creating short URLs
 * Validates on server-side before calling backend API
 */
export const createShortUrlSchema = z.object({
  longUrl: z
    .string()
    .url({ message: 'Must be a valid URL' })
    .startsWith('http', { message: 'URL must start with http:// or https://' }),
  customAlias: z
    .string()
    .max(CUSTOM_ALIAS_MAX_LENGTH, {
      message: `Maximum ${CUSTOM_ALIAS_MAX_LENGTH} characters`,
    })
    .regex(CUSTOM_ALIAS_PATTERN, {
      message: 'Only letters, numbers, hyphens, and underscores allowed',
    })
    .optional()
    .or(z.literal('')), // Allow empty string to be treated as undefined
});

export type CreateShortUrlInput = z.infer<typeof createShortUrlSchema>;
```

**Key points:**
- Reuses shared constants from `@repo/shared`
- `.or(z.literal(''))` handles empty string case from forms
- Validates URL format before expensive backend call

### Step 1.5: Create Server Action

**File:** `frontend/src/actions/urls/create-short-url.action.ts`

```typescript
'use server';

import { CreateShortUrlResponse } from '@repo/shared';
import { validateInput, executeAction } from '../lib/action-utils';
import { ActionResult } from '../lib/action-result';
import { createShortUrlSchema, CreateShortUrlInput } from './create-short-url.schema';

/**
 * Server Action: Create short URL with service key authentication
 * This runs ONLY on the server - service key never exposed to client
 */
export async function createShortUrlAction(
  input: CreateShortUrlInput,
): Promise<ActionResult<CreateShortUrlResponse>> {
  // Step 1: Validate input with Zod
  const validation = await validateInput(createShortUrlSchema, input);
  if (!validation.success) {
    return validation;
  }

  // Step 2: Execute backend call with service key
  return executeAction(async () => {
    const serviceKey = process.env.BACKEND_SERVICE_KEY;
    if (!serviceKey) {
      throw new Error('Server configuration error: Missing service key');
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

    const response = await fetch(`${apiUrl}/api/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': serviceKey, // ← Added only on server!
      },
      body: JSON.stringify({
        longUrl: validation.data.longUrl,
        customAlias: validation.data.customAlias || undefined,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || 'Failed to create short URL');
    }

    return response.json();
  });
}
```

**Security notes:**
- `'use server'` directive makes this server-only
- `BACKEND_SERVICE_KEY` is NOT prefixed with `NEXT_PUBLIC_`
- Validates twice: Zod here + DTO validation on backend (defense in depth)

### Step 1.6: Update Query Hook

**File:** `frontend/src/queries/use-create-short-url.ts`

**Before:**
```typescript
export function useCreateShortUrl() {
  return useMutation<CreateShortUrlResponse, Error, CreateShortUrlRequest>({
    mutationFn: (body) => apiClient.urls.create(body),
  });
}
```

**After:**
```typescript
'use client';

import { useMutation } from '@tanstack/react-query';
import { createShortUrlAction } from '@/actions/urls/create-short-url.action';
import type { CreateShortUrlRequest, CreateShortUrlResponse } from '@repo/shared';

export function useCreateShortUrl() {
  return useMutation<CreateShortUrlResponse, Error, CreateShortUrlRequest>({
    mutationFn: async (input) => {
      const result = await createShortUrlAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}
```

**Why this approach?**
- Hook API unchanged - UI component doesn't know the difference!
- TanStack Query still handles caching, retries, loading states
- Server Action called server-side, not from browser

### Step 1.7: Add Environment Variables

**File:** `frontend/.env.example`

```env
# Backend API URL (used by Server Actions)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Service key for backend authentication (server-side only)
# Generate production key with: openssl rand -hex 32
# IMPORTANT: Do NOT prefix with NEXT_PUBLIC_ - this must stay server-side!
BACKEND_SERVICE_KEY=your-secret-service-key-here
```

**File:** `frontend/.env.local` (create this file, not in git)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
BACKEND_SERVICE_KEY=dev-secret-key-replace-in-production
```

**Verify .gitignore includes:**
```gitignore
.env.local
.env*.local
```

### Step 1.8: Test Frontend (Should Fail Auth)

```bash
cd frontend
npm run dev
```

1. Open http://localhost:3001
2. Enter URL: `https://example.com`
3. Click "Shorten URL"
4. **Expected**: Error (401 Unauthorized) - backend doesn't accept requests yet
5. **Check Network tab**: X-Service-Key header NOT visible in browser

**Why does it fail?** Backend doesn't have the guard yet - that's Phase 2!

---

## Phase 2: Backend Authentication Guard (1 hour)

### Step 2.1: Install Dependencies

```bash
cd backend
npm install @nestjs/throttler helmet
npm install --save-dev @types/express
```

**Verification:**
```bash
npm list @nestjs/throttler helmet
# Should show installed versions
```

### Step 2.2: Create Service Key Guard

**File:** `backend/src/common/guards/service-key.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * NestJS Guard: Validates X-Service-Key header
 * Prevents unauthorized access to protected endpoints
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const serviceKey = request.headers['x-service-key'];
    const expectedKey = this.configService.get<string>('SERVICE_KEY');

    // Fail fast if key not configured
    if (!expectedKey) {
      throw new Error('SERVICE_KEY environment variable not configured');
    }

    // Reject if key missing or doesn't match
    if (!serviceKey || serviceKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing service key');
    }

    return true;
  }
}
```

**Testing tip:** This guard is easy to unit test with mocked ConfigService!

### Step 2.3: Apply Guard to Controller

**File:** `backend/src/url/url.controller.ts`

**Add imports:**
```typescript
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ServiceKeyGuard } from '../common/guards/service-key.guard';
```

**Update POST endpoint:**
```typescript
@Post()
@UseGuards(ServiceKeyGuard)  // ← Add this
@ApiSecurity('service-key')   // ← Add this for Swagger
@ApiOperation({ summary: 'Create a short URL', description: 'Shorten a long URL with optional custom alias' })
@ApiResponse({ status: 201, description: 'Short URL created', type: CreateShortUrlResponseDto })
@ApiConflictResponse({ description: 'Custom alias already taken or unable to generate unique code' })
async createShortUrl(
  @Req() req: Request,
  @Body() dto: CreateShortUrlDto,
): Promise<CreateShortUrlResponseDto> {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return this.urlService.createShortUrl(dto, baseUrl);
}
```

**What changed?**
- `@UseGuards(ServiceKeyGuard)` - Enforces authentication
- `@ApiSecurity('service-key')` - Documents in Swagger UI

### Step 2.4: Add Environment Variables

**File:** `backend/.env.example`

```env
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Service-to-service authentication
# Must match BACKEND_SERVICE_KEY in frontend/.env.local
SERVICE_KEY=your-secret-service-key-here

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

**File:** `backend/.env`

```env
NODE_ENV=development
PORT=3000

# (Keep your existing Supabase values)

# Add these new lines:
SERVICE_KEY=dev-secret-key-replace-in-production
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

**IMPORTANT:** Keys must match between frontend and backend!

### Step 2.5: Test Backend Authentication

**Test 1: Direct call without key (should fail)**
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"longUrl":"https://example.com"}'

# Expected: 401 Unauthorized
# {"statusCode":401,"message":"Invalid or missing service key","error":"Unauthorized"}
```

**Test 2: Direct call with key (should succeed)**
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: dev-secret-key-replace-in-production" \
  -d '{"longUrl":"https://example.com"}'

# Expected: 201 Created
# {"shortUrl":"http://localhost:3000/AbC123",...}
```

**Test 3: Frontend form (should now work)**
```
1. Open http://localhost:3001
2. Enter URL: https://example.com
3. Click "Shorten URL"
4. Should succeed and show short URL!
```

---

## Phase 3: Backend Security Hardening (2-3 hours)

### Step 3.1: Configure Rate Limiting

**File:** `backend/src/app.module.ts`

**Add import:**
```typescript
import { ThrottlerModule } from '@nestjs/throttler';
```

**Add to imports array:**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Add rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,        // 1 second window
        limit: 3,         // Max 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,       // 10 second window
        limit: 20,        // Max 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,       // 60 second window
        limit: 100,       // Max 100 requests per minute
      },
    ]),
    SupabaseModule,
    UrlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Why tiered limits?**
- Short term: Prevents burst attacks
- Medium term: Prevents sustained abuse
- Long term: Overall rate cap

### Step 3.2: Add Security Headers and CORS

**File:** `backend/src/main.ts`

**Add imports:**
```typescript
import helmet from 'helmet';
import * as express from 'express';
```

**Update bootstrap function:**
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ===== SECURITY HEADERS =====
  app.use(helmet());

  // ===== REQUEST SIZE LIMITS =====
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ===== CORS WHITELIST =====
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,        // Whitelist only
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key'],
  });

  // ===== ENHANCED VALIDATION =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip unknown properties
      transform: true,              // Auto-transform types
      forbidNonWhitelisted: true,   // Throw on unknown properties
    }),
  );

  // ===== SWAGGER DOCUMENTATION =====
  const config = new DocumentBuilder()
    .setTitle('NestJS Backend API')
    .setDescription('API documentation for fullstack boilerplate')
    .setVersion('1.0')
    .addTag('api', 'Core API endpoints')
    .addTag('urls', 'URL shortener endpoints')
    .addApiKey(
      { type: 'apiKey', name: 'X-Service-Key', in: 'header' },
      'service-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document, {
    customSiteTitle: 'Backend API Documentation',
    customfavIcon: 'https://nestjs.com/favicon.ico',
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
```

**Security improvements:**
- `helmet()` - Adds 11+ security headers
- Request size limits - Prevents memory exhaustion
- CORS whitelist - Blocks unauthorized origins
- `forbidNonWhitelisted` - Stricter validation

### Step 3.3: Add Malicious URL Validation

**File:** `backend/src/url/url.service.ts`

**Add import:**
```typescript
import { BadRequestException } from '@nestjs/common';
```

**Add private properties and method:**
```typescript
export class UrlService {
  // Blocked domain patterns for security
  private readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.',  // Private IP range
    '10.',       // Private IP range
    '172.16.',   // Private IP range
  ];

  /**
   * Validates URL for security concerns
   * Blocks internal IPs and enforces HTTPS in production
   */
  private validateUrl(longUrl: string): void {
    try {
      const url = new URL(longUrl);

      // Block internal/private IPs
      const isBlocked = this.BLOCKED_DOMAINS.some((blocked) =>
        url.hostname.includes(blocked),
      );
      if (isBlocked) {
        throw new BadRequestException('Cannot shorten internal or private URLs');
      }

      // Require HTTPS in production
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new BadRequestException('Only HTTPS URLs are allowed in production');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid URL format');
    }
  }

  // ... existing code ...
}
```

**Update createShortUrl method - add validation at the start:**
```typescript
async createShortUrl(
  dto: CreateShortUrlDto,
  baseUrl: string,
): Promise<CreateShortUrlResponse> {
  // Validate URL for security
  this.validateUrl(dto.longUrl);

  // ... rest of existing code ...
}
```

**What does this block?**
- Server-Side Request Forgery (SSRF) attempts
- Internal network scanning
- Localhost abuse
- Production HTTP downgrade attacks

### Step 3.4: Test Security Features

**Test 1: Rate limiting**
```bash
# Run this command rapidly 5 times
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/urls \
    -H "Content-Type: application/json" \
    -H "X-Service-Key: dev-secret-key-replace-in-production" \
    -d '{"longUrl":"https://example.com/test'$i'"}' \
    && echo " - Request $i";
done

# Expected: First 3 succeed, then 429 Too Many Requests
```

**Test 2: Malicious URL blocking**
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: dev-secret-key-replace-in-production" \
  -d '{"longUrl":"http://localhost:8080/admin"}'

# Expected: 400 Bad Request
# {"statusCode":400,"message":"Cannot shorten internal or private URLs","error":"Bad Request"}
```

**Test 3: CORS whitelist**
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: dev-secret-key-replace-in-production" \
  -d '{"longUrl":"https://example.com"}'

# Expected: CORS error (no Access-Control-Allow-Origin header)
```

**Test 4: Request size limit**
```bash
# Create a large payload (>10KB)
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: dev-secret-key-replace-in-production" \
  -d '{"longUrl":"https://example.com/'$(python3 -c "print('x' * 20000)")'"}'

# Expected: 413 Payload Too Large
```

**Test 5: Swagger UI with authentication**
```
1. Open http://localhost:3000/
2. Find "Authorize" button (top right)
3. Enter service key: dev-secret-key-replace-in-production
4. Try POST /api/urls from Swagger UI
5. Should succeed!
```

---

## Phase 4: Documentation & Testing (2 hours)

### Create Unit Tests (Optional but Recommended)

**File:** `frontend/src/actions/lib/action-utils.spec.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateInput, executeAction } from './action-utils';

describe('action-utils', () => {
  describe('validateInput', () => {
    const testSchema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
    });

    it('should return success for valid input', async () => {
      const result = await validateInput(testSchema, { name: 'John', age: 30 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 30 });
      }
    });

    it('should return error for invalid input', async () => {
      const result = await validateInput(testSchema, { name: 'J', age: -5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.fieldErrors).toBeDefined();
      }
    });
  });

  describe('executeAction', () => {
    it('should return success for successful action', async () => {
      const result = await executeAction(async () => ({ data: 'test' }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ data: 'test' });
      }
    });

    it('should return error for failed action', async () => {
      const result = await executeAction(async () => {
        throw new Error('Test error');
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Test error');
      }
    });
  });
});
```

**Run tests:**
```bash
cd frontend
npx jest src/actions/lib/action-utils.spec.ts
```

**File:** `backend/src/common/guards/service-key.guard.spec.ts`

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceKeyGuard } from './service-key.guard';

describe('ServiceKeyGuard', () => {
  let guard: ServiceKeyGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({ SERVICE_KEY: 'test-key' });
    guard = new ServiceKeyGuard(configService);
  });

  it('should allow request with valid key', () => {
    const context = createMockContext('test-key');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject request without key', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with invalid key', () => {
    const context = createMockContext('wrong-key');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  function createMockContext(serviceKey: string | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-service-key': serviceKey },
        }),
      }),
    } as any;
  }
});
```

**Run tests:**
```bash
cd backend
npx jest src/common/guards/service-key.guard.spec.ts
```

### Manual Testing Checklist

- [ ] Frontend form creates short URLs successfully
- [ ] Service key not visible in browser DevTools Network tab
- [ ] Direct curl without key returns 401
- [ ] Direct curl with key returns 201
- [ ] Rate limiting triggers after 3 rapid requests
- [ ] Malicious URLs (localhost, private IPs) are blocked
- [ ] CORS blocks unauthorized origins
- [ ] Swagger UI "Authorize" button works
- [ ] Error messages are user-friendly

### Update Project Documentation

**File:** `CLAUDE.md` - Add new section:

```markdown
## Security

### Authentication

API endpoints are protected by service-to-service authentication:
- Frontend Server Actions add `X-Service-Key` header
- Backend ServiceKeyGuard validates on every protected endpoint
- Service key stored in environment variables (never in code)

### Rate Limiting

Tiered rate limits prevent abuse:
- 3 requests per second (burst protection)
- 20 requests per 10 seconds (sustained use)
- 100 requests per minute (overall cap)

### Security Headers

Helmet.js adds protection against:
- XSS attacks (Content-Security-Policy)
- Clickjacking (X-Frame-Options)
- MIME sniffing (X-Content-Type-Options)
- And more...

### Input Validation

Double validation for defense in depth:
1. Zod validation in Server Actions (before backend call)
2. DTO validation in NestJS controllers (at API boundary)

### URL Validation

Blocks malicious URLs:
- Internal IPs (localhost, 127.0.0.1)
- Private networks (192.168.*, 10.*, 172.16.*)
- HTTP in production (requires HTTPS)
```

---

## Deployment Guide

### Production Environment Setup

**1. Generate Production Service Key:**
```bash
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...
```

**2. Configure Vercel Environment Variables:**

**Frontend:**
```
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app
BACKEND_SERVICE_KEY=<generated-key-from-step-1>
```

**Backend:**
```
SERVICE_KEY=<same-key-from-step-1>
ALLOWED_ORIGINS=https://your-frontend.vercel.app
NODE_ENV=production
```

**3. Deploy in Order:**
```bash
# Deploy backend first
cd backend
vercel --prod

# Then deploy frontend
cd ../frontend
vercel --prod
```

**4. Verify Production:**
```bash
# Test with production URLs
curl -X POST https://your-backend.vercel.app/api/urls \
  -H "Content-Type: application/json" \
  -d '{"longUrl":"https://example.com"}'

# Expected: 401 (no key provided - good!)
```

**5. Monitor:**
- Check Vercel logs for 401 errors (potential attacks)
- Monitor 429 rate limit responses
- Set up alerts for unusual traffic patterns

---

## Troubleshooting

### Issue: "Missing service key" error on server

**Cause:** BACKEND_SERVICE_KEY not in environment
**Fix:** Check `.env.local` exists and has the key

### Issue: 401 Unauthorized from frontend form

**Cause:** Keys don't match between FE and BE
**Fix:** Ensure both use exact same key value

### Issue: Rate limiting too aggressive

**Cause:** Rate limits too strict for development
**Fix:** Temporarily increase limits in `app.module.ts` during dev

### Issue: CORS errors in production

**Cause:** Frontend domain not in ALLOWED_ORIGINS
**Fix:** Add production domain to backend ALLOWED_ORIGINS env var

### Issue: Swagger UI "Authorize" button missing

**Cause:** `@ApiSecurity` decorator missing
**Fix:** Add to controller endpoints

---

## Success Metrics

After implementation, verify:

- ✅ Zero 401 errors from legitimate frontend requests
- ✅ 401 errors from unauthorized direct API calls
- ✅ Rate limiting working (429 responses under load)
- ✅ No security headers warnings on securityheaders.com
- ✅ UI latency increase < 100ms
- ✅ All tests passing

---

## Next Steps

After this implementation:

1. **Monitor for 1 week** - Check logs for issues
2. **Gather metrics** - Response times, error rates
3. **User feedback** - Any UX issues?
4. **Plan Phase 2** - User authentication (JWT), per-user rate limiting

---

## Rollback Plan

If critical issues found:

1. Remove `@UseGuards(ServiceKeyGuard)` from controller
2. Revert Server Action to call apiClient directly
3. Deploy backend first, then frontend
4. Investigate issue offline
5. Re-deploy with fixes

**Rollback time:** ~5 minutes

---

## Support & Resources

**Documentation:**
- [Plan file](/Users/andy.cyh/.claude/plans/dreamy-foraging-breeze.md)
- [PRD](./documents/FEAT-2/plans/api-security-hardening.md)

**External Resources:**
- [Next.js Server Actions Docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [NestJS Guards Docs](https://docs.nestjs.com/guards)
- [Zod Documentation](https://zod.dev/)
- [Helmet.js Security](https://helmetjs.github.io/)
