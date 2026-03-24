# FEAT-3: Swagger Implementation Steps

## Implementation Guide

This document provides step-by-step instructions for implementing Swagger API documentation in the NestJS backend.

## Prerequisites

- Node.js and npm installed
- Backend application running on port 3000
- Frontend application running on port 3001
- Basic understanding of NestJS decorators

## Phase 1: Install Dependencies

### Step 1.1: Navigate to Backend Directory

```bash
cd backend
```

### Step 1.2: Install Swagger Packages

```bash
npm install --save @nestjs/swagger@^11.2.6
npm install --save-dev @types/swagger-ui-express@^4.1.6
```

**Packages Installed:**
- `@nestjs/swagger@^11.2.6`: Core NestJS OpenAPI integration compatible with NestJS 11 (auto-installs `swagger-ui-express` as peer dependency)
- `@types/swagger-ui-express@^4.1.6`: TypeScript type definitions for development

**Expected Output:**
```
added 15 packages, and audited XXX packages in Xs
```

### Step 1.3: Verify Installation

Check `backend/package.json` to confirm dependencies:

```json
{
  "dependencies": {
    "@nestjs/swagger": "^11.2.6",
    ...
  },
  "devDependencies": {
    "@types/swagger-ui-express": "^4.1.6",
    ...
  }
}
```

## Phase 2: Create Data Transfer Objects (DTOs)

### Step 2.1: Create DTO Directory

```bash
# From backend/ directory
mkdir -p src/dto
```

### Step 2.2: Create HealthResponseDto

**File:** `backend/src/dto/health-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { HealthResponse } from '@repo/shared';

/**
 * Health check response DTO
 * Implements shared HealthResponse interface with Swagger decorators
 */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({
    description: 'Health check status',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status: 'ok' | 'error';

  @ApiProperty({
    description: 'ISO 8601 timestamp of the health check',
    example: '2026-03-24T10:30:00.000Z',
    type: String,
  })
  timestamp: string;
}
```

**Key Points:**
- Implements `HealthResponse` from `@repo/shared` for type safety
- `@ApiProperty()` decorator adds Swagger metadata
- Enum constraint for `status` field
- Example values for better documentation

### Step 2.3: Create Barrel Export (Optional)

**File:** `backend/src/dto/index.ts`

```typescript
export * from './health-response.dto';
```

**Benefits:**
- Cleaner imports: `from './dto'` instead of `from './dto/health-response.dto'`
- Easier to manage multiple DTOs in the future

## Phase 3: Update Backend Controller

### Step 3.1: Add Imports

**File:** `backend/src/app.controller.ts`

Add these imports at the top:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { AppService } from './app.service';
```

**New Imports:**
- `ApiTags`: Groups related endpoints in Swagger UI
- `ApiOperation`: Describes what each endpoint does
- `ApiResponse`: Documents response schema and status codes
- `HealthResponseDto`: Our new DTO with Swagger metadata

### Step 3.2: Update Controller Class

Replace the controller with:

```typescript
@ApiTags('api')
@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the current health status of the application'
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
```

**Changes Made:**
1. Added `@ApiTags('api')` - Groups endpoints under "api" in Swagger UI
2. Changed `@Controller()` to `@Controller('api')` - Prefixes all routes with `/api`
3. Added `@ApiOperation()` to endpoint - Provides descriptions
4. Added `@ApiResponse()` to endpoint - Documents response schemas
5. Changed `getHealth()` return type to `HealthResponseDto`

**Route Changes:**
- `GET /health` → `GET /api/health`

## Phase 4: Update Backend Service

### Step 4.1: Update Service Imports and Return Types

**File:** `backend/src/app.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class AppService {
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Changes Made:**
1. Import `HealthResponseDto`
2. Update `getHealth()` return type from `HealthResponse` to `HealthResponseDto`
3. Remove `getHello()` method (not needed)

**Note:** Runtime behavior unchanged - DTOs are just typed objects with decorator metadata.

## Phase 5: Configure Swagger for Local Development

### Step 5.1: Update Main Entry Point

**File:** `backend/src/main.ts`

Replace the entire file with:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('NestJS Backend API')
    .setDescription('API documentation for fullstack boilerplate')
    .setVersion('1.0')
    .addTag('api', 'Core API endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document, {
    customSiteTitle: 'Backend API Documentation',
    customfavIcon: 'https://nestjs.com/favicon.ico',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI available at: http://localhost:${port}/`);
  console.log(`OpenAPI JSON at: http://localhost:${port}/api-json`);
}
bootstrap();
```

**Changes Made:**
1. Import `DocumentBuilder` and `SwaggerModule` from `@nestjs/swagger`
2. Create Swagger configuration with `DocumentBuilder`
3. Generate OpenAPI document from NestJS app metadata
4. Setup Swagger UI at root path (`/`) with custom options
5. Add console logs for documentation URLs

**Swagger Configuration Options:**
- `setTitle()`: API title shown in Swagger UI
- `setDescription()`: API description
- `setVersion()`: API version
- `addTag()`: Defines tag with description
- `customSiteTitle`: Browser tab title
- `customfavIcon`: Favicon URL

## Phase 6: Configure Swagger for Vercel Serverless

### Step 6.1: Update Serverless Entry Point

**File:** `backend/api/index.ts`

Replace the entire file with:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';

let app: NestExpressApplication;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Swagger configuration (identical to main.ts)
    const config = new DocumentBuilder()
      .setTitle('NestJS Backend API')
      .setDescription('API documentation for fullstack boilerplate')
      .setVersion('1.0')
      .addTag('api', 'Core API endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/', app, document, {
      customSiteTitle: 'Backend API Documentation',
      customfavIcon: 'https://nestjs.com/favicon.ico',
    });

    await app.init();
  }
  return app;
}

export default async function handler(req: Request, res: Response) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}
```

**Changes Made:**
1. Import `DocumentBuilder` and `SwaggerModule`
2. Add identical Swagger configuration inside `bootstrap()` function
3. Configure Swagger before `app.init()` call

**Key Differences from main.ts:**
- Uses singleton pattern (checks `if (!app)`)
- Calls `app.init()` instead of `app.listen()`
- Exports handler function for Vercel

## Phase 7: Update Frontend Configuration

### Step 7.1: Update Next.js Rewrite Rule

**File:** `frontend/next.config.ts`

Find the `rewrites()` function and update the destination:

**Before:**
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/:path*`,
    },
  ];
},
```

**After:**
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/:path*`,
    },
  ];
},
```

**Change:** Added `/api` to the destination to preserve the prefix.

**Effect:**
- Frontend `/api/health` → Backend `/api/health` (not `/health`)
- Consistent URL structure across environments
- No more "magic" prefix stripping

### Step 7.2: Update Frontend Query Hook

**File:** `frontend/src/queries/use-health.ts`

The `useHealth` hook needs to be updated to use the correct query key that matches the new `/api/health` path.

**Before:**
```typescript
export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],  // This generates URL: /health
  });
}
```

**After:**
```typescript
export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['api', 'health'],  // This generates URL: /api/health
  });
}
```

**Explanation:**
- The TanStack Query setup uses `stringifyQueryKey()` to convert the queryKey array into a URL path
- `['health']` generates `/health`
- `['api', 'health']` generates `/api/health`
- This change aligns the frontend with the new backend route structure

### Step 7.3: Verify API Client (No Changes Needed)

**File:** `frontend/src/lib/api-client.ts`

Confirm it already uses `/api/health`:

```typescript
export const apiClient = {
  health: {
    get: () => get<HealthResponse>('/api/health'),
  },
};
```

✅ No changes needed - already correct!

## Phase 8: Testing

### Step 8.1: Start Development Servers

From the monorepo root:

```bash
npm run dev
```

This starts both frontend (port 3001) and backend (port 3000).

### Step 8.2: Verify Swagger UI

1. **Open Swagger UI:**
   - Navigate to: `http://localhost:3000/`
   - Should see Swagger UI with "NestJS Backend API" title

2. **Check Endpoint Documentation:**
   - Expand "api" tag section
   - Verify `GET /api/health` endpoint is listed

### Step 8.3: Test GET /api/health Endpoint

1. Click on `GET /api/health`
2. Click "Try it out" button
3. Click "Execute" button
4. **Expected Response:**
   ```json
   Status: 200
   Response body:
   {
     "status": "ok",
     "timestamp": "2026-03-24T10:30:00.000Z"
   }
   ```

5. **Verify Schema Documentation:**
   - Scroll to "Responses" section
   - Click "Schema" tab
   - Should show `HealthResponseDto` structure:
     ```json
     {
       "status": "string (enum: ok, error)",
       "timestamp": "string"
     }
     ```

### Step 8.4: Verify OpenAPI JSON

Navigate to: `http://localhost:3000/api-json`

**Expected:** JSON document with OpenAPI specification:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "NestJS Backend API",
    "description": "API documentation for fullstack boilerplate",
    "version": "1.0"
  },
  "paths": {
    "/api/health": { ... }
  },
  ...
}
```

### Step 8.5: Test Frontend Integration

1. **Navigate to frontend:**
   - Open: `http://localhost:3001/`

2. **Check Browser DevTools:**
   - Open Network tab
   - Filter: XHR/Fetch

3. **Trigger API Call:**
   - If frontend has health check UI, use it
   - Or check console for background health checks

4. **Verify Request:**
   ```
   Request URL: http://localhost:3001/api/health
   Status: 200
   Response: {"status":"ok","timestamp":"..."}
   ```

5. **Next.js Rewrite Verification:**
   - The request goes to Next.js at port 3001
   - Next.js rewrites to backend at port 3000
   - Request path: `/api/health` → `/api/health` (preserved)

### Step 8.6: Test Backend Direct Access

Test backend directly (bypassing Next.js):

```bash
curl http://localhost:3000/api/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2026-03-24T10:30:00.000Z"}
```

## Phase 9: Build and Verify

### Step 9.1: Build Backend

```bash
cd backend
npm run build
```

**Expected Output:**
```
Successfully compiled TypeScript files
```

### Step 9.2: Build Frontend

```bash
cd frontend
npm run build
```

**Expected Output:**
```
Creating an optimized production build
✓ Compiled successfully
```

### Step 9.3: Run Production Build Locally (Optional)

```bash
# Backend
cd backend
npm run start:prod

# Frontend (different terminal)
cd frontend
npm start
```

Verify everything works with production builds.

## Phase 10: Deploy to Vercel

### Step 10.1: Commit Changes

```bash
git add .
git commit -m "feat: add Swagger API documentation

- Install @nestjs/swagger and dependencies
- Create HealthResponseDto with Swagger decorators
- Add /api prefix to all backend routes
- Configure Swagger UI at root path
- Update Next.js rewrite to preserve /api prefix
- Update controllers with OpenAPI decorators

Swagger UI available at backend root URL
OpenAPI spec available at /api-json"
```

### Step 10.2: Push to GitHub

```bash
git push origin main
```

**If using Vercel GitHub integration:**
- Automatic deployment will trigger
- Monitor deployment in Vercel dashboard

### Step 10.3: Manual Deployment (Alternative)

If not using GitHub integration:

```bash
# Deploy backend
cd backend
vercel --prod

# Deploy frontend
cd frontend
vercel --prod
```

### Step 10.4: Verify Production Deployment

1. **Backend Swagger UI:**
   - Visit: `https://claude-code-boilerplate-backend.vercel.app/`
   - Should show Swagger UI

2. **Test Production API:**
   ```bash
   curl https://claude-code-boilerplate-backend.vercel.app/api/health
   ```

3. **Test via Swagger UI:**
   - Use "Try it out" in production Swagger UI
   - Verify both endpoints work

4. **Verify Frontend:**
   - Visit production frontend URL
   - Check that API calls work correctly

## Troubleshooting

### Issue 1: Swagger UI Shows Empty/No Endpoints

**Symptoms:**
- Swagger UI loads but shows no endpoints
- "No operations defined in spec!" message

**Solutions:**
1. Check Swagger setup happens before `app.listen()` or `app.init()`
2. Verify decorators are imported correctly
3. Ensure DTOs are imported in controllers
4. Rebuild the project: `npm run build`

### Issue 2: Cannot Access Swagger UI

**Symptoms:**
- 404 error at `http://localhost:3000/`
- Swagger UI doesn't load

**Solutions:**
1. Verify Swagger dependencies installed: `npm ls @nestjs/swagger`
2. Check console logs for errors during startup
3. Verify `SwaggerModule.setup('/', app, document)` is called
4. Clear `dist/` folder and rebuild

### Issue 3: Frontend API Calls Fail After Changes

**Symptoms:**
- 404 errors when calling `/api/health`
- "Failed to fetch" errors

**Solutions:**
1. Verify Next.js rewrite updated to `/api/:path*` destination
2. Check backend is running and serving at correct paths
3. Test backend directly: `curl http://localhost:3000/api/health`
4. Restart both frontend and backend servers

### Issue 4: TypeScript Type Errors

**Symptoms:**
- TS2304: Cannot find name 'HealthResponseDto'
- TS2345: Type mismatch errors

**Solutions:**
1. Check DTO imports in controller and service
2. Verify DTO implements correct interface
3. Run `npm install` in backend directory
4. Restart TypeScript server in IDE

### Issue 5: Vercel Deployment Fails

**Symptoms:**
- Build errors in Vercel dashboard
- Serverless function fails to start

**Solutions:**
1. Check Vercel build logs for specific errors
2. Verify `backend/api/index.ts` has Swagger configuration
3. Test build locally: `npm run build`
4. Check `vercel.json` configuration
5. Verify environment variables set in Vercel dashboard

## Verification Checklist

Use this checklist to ensure complete implementation:

### Local Development
- [ ] Swagger dependencies installed in `backend/package.json`
- [ ] `backend/src/dto/health-response.dto.ts` created with decorators
- [ ] Controller updated with `/api` prefix and Swagger decorators
- [ ] Service return types updated to use DTOs
- [ ] `main.ts` configured with Swagger setup
- [ ] `api/index.ts` configured with Swagger setup
- [ ] Next.js rewrite updated to preserve `/api` prefix
- [ ] Backend builds without errors
- [ ] Frontend builds without errors

### Testing
- [ ] Swagger UI loads at `http://localhost:3000/`
- [ ] Both endpoints visible in Swagger UI
- [ ] `GET /api/health` returns health status object
- [ ] OpenAPI JSON available at `/api-json`
- [ ] Frontend can call `/api/health` successfully
- [ ] No console errors in browser or backend

### Production
- [ ] Changes committed to git
- [ ] Code pushed to GitHub
- [ ] Vercel deployment succeeded
- [ ] Production Swagger UI accessible
- [ ] Production API endpoints work
- [ ] Frontend can call production backend APIs

## Next Steps

After successful implementation:

1. **Add More Endpoints:**
   - Create DTOs for new endpoints
   - Add Swagger decorators
   - Documentation auto-updates

2. **Enhance Documentation:**
   - Add error response documentation
   - Document query parameters
   - Add request body examples

3. **Add Validation:**
   ```bash
   npm install class-validator class-transformer
   ```
   - Add validation decorators to DTOs
   - Enable global validation pipe

4. **Customize Swagger UI:**
   - Add custom CSS
   - Change color scheme
   - Add logo

5. **Consider API Versioning:**
   - Plan for `/api/v1`, `/api/v2`
   - Version-specific Swagger docs

## Resources

- [NestJS OpenAPI Documentation](https://docs.nestjs.com/openapi/introduction)
- [Swagger UI Configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [class-validator Decorators](https://github.com/typestack/class-validator#validation-decorators)

## Summary

You have successfully:
- ✅ Installed Swagger dependencies
- ✅ Created DTOs with Swagger decorators
- ✅ Restructured routes under `/api` prefix
- ✅ Configured Swagger UI at root path
- ✅ Updated frontend to align with backend changes
- ✅ Deployed to production with documentation

The backend now serves interactive API documentation at the root URL, making it easy for developers to understand and test the available endpoints.
