# API Security Hardening - Product Requirements Document

## Document Information
- **Ticket:** FEAT-2
- **Created:** 2026-03-26
- **Author:** Claude Code
- **Status:** Approved

## Problem Statement

### Current Security Vulnerabilities

The POST `/api/urls` endpoint is completely unprotected and vulnerable to:

1. **Unlimited Anonymous Access**: Anyone can create short URLs without authentication
2. **Database Pollution**: No rate limiting allows malicious actors to fill the database with spam URLs
3. **DoS Attacks**: Attackers can overwhelm the server with unlimited requests
4. **CORS Misconfiguration**: `origin: true` allows requests from any domain
5. **Missing Security Headers**: No Helmet.js protection against common web vulnerabilities
6. **Malicious URL Acceptance**: System accepts internal IPs and potentially dangerous URLs

### Security Audit Findings

| Vulnerability | Severity | Current State |
|---------------|----------|---------------|
| Authentication | CRITICAL | ❌ None - completely public |
| Rate Limiting | CRITICAL | ❌ None - unlimited requests |
| CORS Policy | HIGH | ⚠️ Allows all origins |
| Security Headers | HIGH | ❌ Missing Helmet.js |
| Request Size Limits | MEDIUM | ⚠️ Unlimited |
| Malicious URL Prevention | MEDIUM | ⚠️ No validation |
| Input Validation | MEDIUM | ⚠️ Basic DTO only |

## Proposed Solution

### Architecture: Backend for Frontend (BFF) Pattern

Implement Next.js 15 Server Actions as a secure proxy layer between the frontend and backend API.

**Key Principle:** Service-to-service authentication using a shared secret key that NEVER leaves the server side.

### Authentication Flow

```
┌─────────────────────┐
│  User Browser       │
│  (No secrets here)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│  Next.js Server Action      │
│  - Validates input (Zod)    │
│  - Adds X-Service-Key       │
│  - Calls backend API        │
└──────────┬──────────────────┘
           │ + Header: X-Service-Key: <secret>
           ▼
┌─────────────────────────────┐
│  NestJS Backend             │
│  - ServiceKeyGuard validates│
│  - Rejects if invalid       │
│  - Processes if valid       │
└─────────────────────────────┘
```

### Why This Approach?

1. **Security First**: Service key never exposed to browser (not in `NEXT_PUBLIC_*` env vars)
2. **Zero Breaking Changes**: UI components remain unchanged
3. **Progressive Migration**: Other endpoints can migrate gradually
4. **Type Safety**: Zod runtime + TypeScript compile-time validation
5. **Industry Standard**: Follows BFF and Token Handler patterns

## Technical Architecture

### Server Actions Structure

This is the **FIRST Server Action** in the project. We establish clean patterns:

```
frontend/src/actions/
├── lib/
│   ├── action-result.ts       # Discriminated union types
│   └── action-utils.ts        # Validation & error handling utilities
└── urls/
    ├── create-short-url.schema.ts   # Zod validation schema
    └── create-short-url.action.ts   # 'use server' action
```

### Error Handling Pattern

Using TypeScript discriminated unions for type-safe error handling:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

**Benefits:**
- Forces error handling at compile time
- Natural mapping from Zod validation errors
- Easy to consume in React components

### Integration with Existing Code

**Decision:** Keep TanStack Query, refactor to call Server Action

**Rationale:**
- UI components unchanged (page.tsx stays identical)
- Keeps caching, optimistic updates, retry logic
- Team familiar with the API
- Progressive migration path

## Security Enhancements

### 1. Service Key Authentication

**Backend Guard:**
- Validates `X-Service-Key` header on every request
- Returns 401 Unauthorized if missing or invalid
- Applied via `@UseGuards(ServiceKeyGuard)` decorator

**Key Management:**
- Development: Simple shared key in `.env` files
- Production: Generate with `openssl rand -hex 32`
- Rotation: Quarterly or on suspected compromise

### 2. Rate Limiting

Using `@nestjs/throttler` with tiered limits:

| Tier | Time Window | Limit |
|------|-------------|-------|
| Short | 1 second | 3 requests |
| Medium | 10 seconds | 20 requests |
| Long | 1 minute | 100 requests |

### 3. CORS Whitelist

**Before:** `origin: true` (allows all)
**After:** Explicit whitelist from `ALLOWED_ORIGINS` env var

```typescript
origin: ['http://localhost:3001', 'https://production-domain.com']
```

### 4. Security Headers (Helmet.js)

Adds standard security headers:
- Content-Security-Policy (CSP)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- Strict-Transport-Security (HSTS)
- X-XSS-Protection

### 5. Request Size Limits

Limit request body size to 10KB to prevent:
- Memory exhaustion attacks
- Large payload DoS

### 6. Malicious URL Validation

Block URLs targeting:
- Internal IPs: `localhost`, `127.0.0.1`, `0.0.0.0`
- Private networks: `192.168.*`, `10.*`, `172.16.*`
- Require HTTPS in production

## Success Criteria

### Functional Requirements

- [x] POST /api/urls requires valid service key
- [x] Frontend form continues to work without changes
- [x] Service key never visible in browser DevTools
- [x] Rate limiting enforces 3 requests/second maximum
- [x] CORS blocks requests from unauthorized origins
- [x] Malicious URLs (localhost, private IPs) are rejected

### Non-Functional Requirements

- [x] UI latency increase < 100ms (Server Action overhead)
- [x] Type safety maintained throughout (TypeScript + Zod)
- [x] Error messages user-friendly and informative
- [x] Code follows existing project patterns
- [x] Documentation complete and clear

### Testing Requirements

- [x] Unit tests for Server Action validation
- [x] Unit tests for ServiceKeyGuard
- [x] Unit tests for URL validation
- [x] E2E test: Full form submission flow
- [x] Manual test: curl with/without key
- [x] Manual test: Rate limiting behavior
- [x] Manual test: CORS whitelist
- [x] Manual test: Malicious URL blocking

## Implementation Phases

### Phase 1: Frontend Server Actions (2-3 hours)
- Install Zod dependency
- Create action infrastructure
- Create URL shortener Server Action
- Update query hook
- Add environment variables

### Phase 2: Backend Authentication (1 hour)
- Install security dependencies
- Create ServiceKeyGuard
- Apply to URL controller
- Configure environment variables

### Phase 3: Backend Security Hardening (2-3 hours)
- Configure rate limiting
- Add Helmet.js and CORS whitelist
- Add malicious URL validation
- Update Swagger documentation

### Phase 4: Testing & Documentation (2 hours)
- Write unit tests
- E2E testing
- Update project documentation
- Security testing

**Total Estimated Time:** 7-9 hours

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Service key leaked | Low | High | Env vars only, quarterly rotation, monitor logs |
| Rate limits too strict | Medium | Low | Monitor metrics, adjust based on usage |
| CORS misconfiguration | Low | Medium | Test thoroughly, whitelist specific origins |
| Server Action latency | Low | Low | Measure performance, optimize if needed |
| Zod validation bypass | Low | High | Server-side validation mandatory |

## Deployment Strategy

### Pre-Deployment

1. Generate production service keys: `openssl rand -hex 32`
2. Configure Vercel environment variables
3. Test staging environment
4. Prepare rollback plan

### Deployment Order

1. Deploy backend first (with guard but key not enforced yet - grace period)
2. Deploy frontend with Server Actions
3. Verify end-to-end functionality
4. Enable strict key enforcement on backend

### Monitoring

- Track 401 Unauthorized responses (invalid keys)
- Monitor rate limit 429 responses
- Alert on unexpected CORS errors
- Track average response times

## Future Enhancements

### Short Term (Next Sprint)
- Per-IP rate limiting (currently global)
- Request logging for security audit trail
- Prometheus metrics for monitoring

### Medium Term (Next Quarter)
- User authentication system (JWT)
- Per-user rate limiting
- URL analytics dashboard
- Custom expiration times per URL

### Long Term
- API key system for external integrations
- Webhook support for URL events
- Distributed rate limiting (Redis)
- Advanced security features (2FA, SSO)

## References

**Industry Best Practices:**
- [Backend for Frontend Pattern | Auth0](https://auth0.com/blog/the-backend-for-frontend-pattern-bff/)
- [Token Handler Pattern | Curity](https://curity.io/resources/learn/the-token-handler-pattern/)
- [Next.js Server Actions Security | Auth0](https://auth0.com/blog/using-nextjs-server-actions-to-call-external-apis/)
- [Server Actions Error Handling | Medium](https://medium.com/@pawantripathi648/next-js-server-actions-error-handling-the-pattern-i-wish-i-knew-earlier-e717f28f2f75)

## Appendix

### Environment Variables Reference

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
BACKEND_SERVICE_KEY=dev-secret-key-replace-in-production
```

**Backend (.env):**
```env
SERVICE_KEY=dev-secret-key-replace-in-production
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
NODE_ENV=development
PORT=3000
```

### Security Checklist

Pre-Production:
- [ ] Generate new production service keys
- [ ] Rotate any exposed Supabase keys
- [ ] Configure CORS whitelist with production domains
- [ ] Enable HTTPS-only in production
- [ ] Test rate limiting under load
- [ ] Verify security headers with securityheaders.com
- [ ] Audit logs for suspicious activity
- [ ] Document incident response procedures
