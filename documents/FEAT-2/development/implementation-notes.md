# FEAT-2: Implementation Notes

記錄實際實作與原計劃的差異，以及簡化重構後的最終狀態。

---

## 最終檔案清單

### 新增

| 路徑                                                         | 說明                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `shared/src/types/health.ts`                                 | `HealthResponse` 型別                                    |
| `shared/src/types/api.ts`                                    | `ApiResponse<T>` 泛型                                    |
| `shared/src/index.ts`                                        | barrel export                                            |
| `shared/package.json`                                        | `@repo/shared` workspace                                 |
| `shared/tsconfig.json`                                       | TypeScript 設定                                          |
| `frontend/src/app/layout.tsx`                                | Root layout，包入 Providers                              |
| `frontend/src/app/page.tsx`                                  | 首頁，呼叫 `useHealth()`                                 |
| `frontend/src/app/providers.tsx`                             | `TanStackQueryProvider` 包裝層                           |
| `frontend/src/constants/common.ts`                           | `HTTP_STATUS_CODE`                                       |
| `frontend/src/queries/use-health.ts`                         | `useHealth()` hook                                       |
| `frontend/src/lib/api-client.ts`                             | 具名 API 客戶端                                          |
| `frontend/src/utils/fetchers/fetchers.ts`                    | `fetchApi` + `streamingFetchApi`                         |
| `frontend/src/utils/fetchers/fetchers.utils.ts`              | `FetchOptions`、`getFetchQueryOptions`、`parseErrorBody` |
| `frontend/src/utils/fetchers/fetchers.error.ts`              | `ApiResponseError`                                       |
| `frontend/src/utils/fetchers/fetchers.client.ts`             | client-side `defaultFetchFn`、`streamingFetchFn`         |
| `frontend/src/vendors/tanstack-query/provider.tsx`           | `TanStackQueryProvider`，設定 global `queryFn`           |
| `frontend/src/vendors/tanstack-query/provider.utils.ts`      | `stringifyQueryKey`                                      |
| `frontend/src/vendors/tanstack-query/provider.utils.spec.ts` | `stringifyQueryKey` 單元測試                             |
| `frontend/next.config.ts`                                    | Next.js 設定，`/api/*` rewrite → backend                 |
| `frontend/vercel.json`                                       | `{ "framework": "nextjs" }`                              |

### 刪除（Vite 相關）

- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/tsconfig.node.json`
- `frontend/.eslintrc.cjs`
- `frontend/src/App.tsx`, `App.css`, `App.test.tsx`, `main.tsx`, `setupTests.ts`
- `frontend/package-lock.json`（改由 root `package-lock.json` 管理）
- `backend/.eslintrc.js`（合併至 root `.eslintrc.js`）

---

## 與計劃的差異

### 1. `fetchers.ts`：AbortController 取代 Promise.race 逾時機制

**計劃（RFC-C）**：使用 `Promise.race([fetchPromise, timeoutPromise])` 實作逾時。

**實際**：改用 `AbortController`。

```typescript
// 最終實作
const controller = new AbortController();
const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeout);
try {
  const rawResponse = await fetch(url, {
    ...getFetchQueryOptions(options),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // ...
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new ApiResponseError(timeoutResponse, timeoutErrorBody, 'Request timeout');
  }
  throw error;
}
```

**原因**：

- `Promise.race` 版本在逾時後 `fetch` promise 仍在執行，造成連線洩漏（connection leak）。`streamingFetchApi` 是長連線，問題尤為嚴重。
- `AbortController` 會主動取消底層連線。
- 同時移除兩個函式中的 `try { ... } catch (error) { throw error; }` 無意義包裝（原本有 `// eslint-disable-next-line no-useless-catch` 注解抑制警告）。
- `timeoutId` 加上明確型別 `ReturnType<typeof setTimeout>`。

### 2. `fetchers.utils.ts`：`parseErrorBody` 移除 `.clone()` 與型別謊言

**計劃**：未明確規定實作細節。

**實際變更**：

```typescript
// 之前
let errorBody: TErrorBody | string = '' as TErrorBody;
// ...
errorBody = (await response.clone().json()) as TErrorBody;
// ...
errorBody = (await response.clone().text()) as TErrorBody;
// ...
errorBody = '' as TErrorBody;

// 之後
let errorBody: TErrorBody | string = '';
// ...
errorBody = (await response.json()) as TErrorBody;
// ...
errorBody = await response.text();
// ...
errorBody = '';
```

**原因**：

- `'' as TErrorBody` 是型別謊言——呼叫端以為收到 `TErrorBody`，實際上是空字串，存取 `.error.message` 會在執行期崩潰。回傳型別已是 `TErrorBody | string`，直接賦值 `''` 完全合法。
- `parseErrorBody` 在 `streamingFetchApi` 中被呼叫時，response body 尚未被讀取，無需 `.clone()`；直接讀取原始 response 即可。

### 3. `fetchers.client.ts`：`baseUrl` 改為指向 Backend

**計劃（RFC-C）**：`baseUrl = window.location.origin`（即 `http://localhost:3001`），搭配 Next.js rewrite 將 `/api/*` 轉發至 backend。

**實際**：

```typescript
// 之前（計劃版）
const baseUrl = window.location.origin;

// 之後（實際）
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
```

**原因**：

- `window.location.origin` 是 Next.js frontend（`:3001`）。`defaultFetchFn('health')` 會產生 URL `/health`，而 Next.js rewrite 只對 `/api/*` 生效，`/health` 直接打到 Next.js server，回傳 404。
- 將 baseUrl 改為直接指向 backend（`:3000`），`queryKey: ['health']` → `stringifyQueryKey` → `'health'` → `http://localhost:3000/health` 正確抵達 backend。
- 預設值 `'http://localhost:3000'` 與 `next.config.ts` 的 rewrite destination 一致：

  ```typescript
  // next.config.ts
  destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/:path*`;
  ```

- Backend 已啟用 `origin: true` CORS，允許來自 `:3001` 的跨域請求，不會有 CORS 問題。

### 4. `use-health.ts`：使用 `useQuery<HealthResponse>` 型別參數

**計劃（RFC-C）**：

```typescript
export function useHealth() {
  return useQuery({ queryKey: ['health'] });
}
```

**實際**：

```typescript
import type { HealthResponse } from '@repo/shared';

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
  });
}
```

**原因**：沒有明確 `queryFn` 時，TanStack Query 無法從型別推導出 `data` 的形狀，`data` 會是 `unknown`。`page.tsx` 試圖存取 `data.status` 與 `data.timestamp`，導致 TypeScript 編譯錯誤。加上型別參數讓 `data` 正確推導為 `HealthResponse`。

### 5. ESLint：統一至 root `.eslintrc.js`

**計劃**：未明確規定。

**實際**：

- 刪除 `backend/.eslintrc.js` 與 `frontend/.eslintrc.cjs`。
- 所有 ESLint 設定集中在 root `.eslintrc.js`，使用 `overrides` 按路徑分別套用 TypeScript、Next.js、Backend 規則。
- 所有 ESLint 相關套件（`@typescript-eslint/parser`、`@typescript-eslint/eslint-plugin`、`eslint-config-next` 等）安裝在 root `node_modules`。

---

## 路由架構（最終）

```
瀏覽器 (localhost:3001)
  └─ useQuery({ queryKey: ['health'] })
       └─ global queryFn: defaultFetchFn(stringifyQueryKey(['health']))
            └─ defaultFetchFn('health')
                 └─ baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
                      └─ fetch('http://localhost:3000/health')  ← 直接到 Backend
                           └─ NestJS GET /health → { status: 'ok', timestamp: '...' }
```

`api-client.ts` 的 `/api/health` 路徑（走 Next.js rewrite）保留，可供不透過 global queryFn 的直接呼叫場景使用。

---

## 驗證清單

- [x] `npm install` — 無錯誤
- [x] `npx tsc --noEmit -p frontend/tsconfig.json` — 通過
- [ ] `npm run dev` — FE `:3001`、BE `:3000` 同時啟動
- [ ] 瀏覽 `http://localhost:3001` — 顯示 backend health status
- [ ] `npm run build` — 兩個 app 均成功建置
- [ ] `npm run lint` — 無錯誤
- [ ] `npm run test` — `provider.utils.spec.ts` 通過
